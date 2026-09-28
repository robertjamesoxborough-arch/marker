import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

/**
 * lib/adzuna-http.js: the one place Requite's server code talks to the Adzuna
 * API (Stage 85). Every call site goes through adzunaFetch() so that:
 *
 *   1. The first Adzuna response each server instance sees has its headers
 *      recorded. Adzuna does not document rate-limit headers and we are on a
 *      new app (registered 2026-09-28) whose real limits are unconfirmed, so
 *      this is how we find out rather than assume the published defaults.
 *   2. Every 4xx has Adzuna's full error body recorded. Adzuna explains the
 *      fault in its body ({"exception": ..., "display": ...}) and the old
 *      call sites threw that away, leaving only a bare status code.
 *   3. The recorded app fingerprint (first 8 hex of a SHA-1 of ADZUNA_APP_ID,
 *      never the ID or key itself) proves which Adzuna app production is
 *      actually calling with.
 *
 * Both are logged AND written to admin_metrics_cache ('adzuna_headers:latest',
 * 'adzuna_error:<label>'), because function logs on this plan expire quickly.
 * The request is recorded with app_id and app_key stripped.
 */

// Adzuna's documented default is 25 calls a minute (one per 2.4s). Crons
// sleep this long between sequential calls so a nightly batch cannot trip it.
export const ADZUNA_MIN_GAP_MS = 2600
export const sleep = ms => new Promise(r => setTimeout(r, ms))

const RATE_HEADER = /rate|limit|quota|remaining|reset|retry|usage/i
let headersRecorded = false

export function adzunaAppFingerprint() {
  const id = process.env.ADZUNA_APP_ID || ''
  return id ? createHash('sha1').update(id).digest('hex').slice(0, 8) : 'unset'
}

function redact(url) {
  try {
    const u = new URL(url)
    u.searchParams.delete('app_id')
    u.searchParams.delete('app_key')
    return `${u.pathname}?${u.searchParams.toString()}`
  } catch {
    return '(unparseable url)'
  }
}

async function record(metric, value) {
  try {
    const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    await s.from('admin_metrics_cache').upsert(
      { metric, value, computed_at: new Date().toISOString() },
      { onConflict: 'metric' }
    )
  } catch {
    // Diagnostics only: never let recording break the call it describes.
  }
}

/**
 * fetch() for the Adzuna API. Same signature and return value as fetch, plus
 * a label naming the call site. Callers still check res.ok themselves.
 */
export async function adzunaFetch(url, init = {}, label = 'adzuna') {
  const res = await fetch(url, init)
  const at = new Date().toISOString()

  if (!headersRecorded) {
    headersRecorded = true
    const entries = [...res.headers.entries()]
    const entry = {
      at, label, status: res.status, app: adzunaAppFingerprint(),
      rateHeaders: Object.fromEntries(entries.filter(([k]) => RATE_HEADER.test(k))),
      headerNames: entries.map(([k]) => k),
    }
    console.log(`[adzuna-http] first Adzuna response on this instance: ${JSON.stringify(entry)}`)
    await record('adzuna_headers:latest', entry)
  }

  if (res.status >= 400 && res.status < 500) {
    const body = (await res.clone().text().catch(() => '')).slice(0, 1000)
    const entry = { at, label, status: res.status, app: adzunaAppFingerprint(), request: redact(url), body }
    console.error(`[adzuna-http] Adzuna ${res.status}: ${JSON.stringify(entry)}`)
    await record(`adzuna_error:${label}`, entry)
  }
  return res
}
