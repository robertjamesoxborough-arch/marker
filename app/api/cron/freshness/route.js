import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { computeFreshnessState } from '../../../../lib/freshness'
import { isAllowedByRobots, REQUITE_USER_AGENT } from '../../../../lib/robots'
import { safeFetch } from '../../../../lib/safe-fetch'

const CHUNK = 500

// Session Q: this cron previously did pure date-math (recomputing a bucket
// from last_verified_at, a timestamp nothing ever updated) — the Trust
// Panel's "daily cron re-verifies every role" claim was cosmetic. It now
// does real HEAD requests against a bounded, prioritised batch each run,
// following the same polite-crawling pattern as cron/wishlist-scrape:
// robots.txt honoured, identify as REQUITE_USER_AGENT, SSRF-safe fetch
// (arbitrary third-party links), and a real delay between requests rather
// than hammering hosts back-to-back. A larger jobs_cache just takes a few
// nights to fully cycle through — see MAX_LINKS_PER_RUN.
const MAX_LINKS_PER_RUN = 40
const REQUEST_DELAY_MS = 1000
export const maxDuration = 120

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date()
  const errors = []
  const robotsSkipped = []

  // ── jobs_cache: real live verification for a bounded, prioritised batch ──
  // Prioritise rows already flagged Aging/Stale, or not genuinely checked in
  // over 20 hours, ordered oldest-first — the roles most likely to have
  // actually gone dead, and the ones furthest from today's daily guarantee.
  const cutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()
  const { data: candidates, error: candidatesErr } = await supabase
    .from('jobs_cache')
    .select('id, link, last_verified_at, freshness')
    .not('link', 'is', null)
    .or(`freshness.in.(Aging,Stale),last_verified_at.lt.${cutoff}`)
    .order('last_verified_at', { ascending: true })
    .limit(MAX_LINKS_PER_RUN)

  if (candidatesErr) errors.push(`jobs_cache candidate fetch: ${candidatesErr.message}`)

  let liveChecked = 0, verifiedAlive = 0, verifiedDead = 0
  const deadIds = new Set()

  for (const row of candidates || []) {
    try {
      const robots = await isAllowedByRobots(row.link)
      if (!robots.allowed) {
        robotsSkipped.push({ id: row.id, reason: robots.reason })
        continue
      }

      let alive = false
      try {
        const res = await safeFetch(row.link, {
          method: 'HEAD',
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': REQUITE_USER_AGENT },
          redirect: 'follow',
        })
        alive = res.ok
      } catch {
        alive = false
      }

      const verifiedAt = new Date().toISOString()
      const newFreshness = alive ? computeFreshnessState(verifiedAt, new Date()) : 'Expired'
      const { error } = await supabase
        .from('jobs_cache')
        .update({ freshness: newFreshness, last_verified_at: verifiedAt })
        .eq('id', row.id)

      if (error) {
        errors.push(`jobs_cache live-check update ${row.id}: ${error.message}`)
      } else {
        liveChecked++
        if (alive) verifiedAlive++
        else { verifiedDead++; deadIds.add(row.id) }
      }
    } catch (e) {
      errors.push(`jobs_cache live-check ${row.id}: ${e.message}`)
    }
    // Polite pacing — one link per REQUEST_DELAY_MS, matching cron/wishlist-scrape.
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS))
  }

  // ── jobs_cache: date-math bucket refresh for everything not just live-checked ──
  // Keeps the stored freshness column in step with what lib/freshness.js
  // recomputes at read time. Rows confirmed dead above are excluded so this
  // pass can't flip a just-verified "Expired" back to "Fresh" purely because
  // its last_verified_at timestamp is now recent.
  const { data: jobRows, error: jobFetchErr } = await supabase
    .from('jobs_cache')
    .select('id, last_verified_at, freshness')

  if (jobFetchErr) {
    return NextResponse.json({ error: jobFetchErr.message }, { status: 500 })
  }

  const jobUpdates = (jobRows || [])
    .filter(row => !deadIds.has(row.id))
    .map(row => {
      const computed = computeFreshnessState(row.last_verified_at, now)
      return computed !== row.freshness ? { id: row.id, freshness: computed } : null
    })
    .filter(Boolean)

  let jobsUpdated = liveChecked
  for (const batch of chunk(jobUpdates, CHUNK)) {
    const { error } = await supabase
      .from('jobs_cache')
      .upsert(batch, { onConflict: 'id' })
    if (error) errors.push(`jobs_cache: ${error.message}`)
    else jobsUpdated += batch.length
  }

  // ── employer_roles ──────────────────────────────────────────────────────
  // No external link field exists on this table — a requite_managed role
  // lives entirely inside Requite, so there is nothing to HEAD-check.
  // Date-math off the employer's own last_verified_at/status is the correct
  // model here, not a shortcut.
  const { data: roleRows, error: roleFetchErr } = await supabase
    .from('employer_roles')
    .select('id, last_verified_at, freshness')

  if (roleFetchErr) errors.push(`employer_roles fetch: ${roleFetchErr.message}`)

  const roleUpdates = (roleRows || [])
    .map(row => {
      const computed = computeFreshnessState(row.last_verified_at, now)
      return computed !== row.freshness ? { id: row.id, freshness: computed } : null
    })
    .filter(Boolean)

  let rolesUpdated = 0
  for (const batch of chunk(roleUpdates, CHUNK)) {
    const { error } = await supabase
      .from('employer_roles')
      .upsert(batch, { onConflict: 'id' })
    if (error) errors.push(`employer_roles: ${error.message}`)
    else rolesUpdated += batch.length
  }

  return NextResponse.json({
    ok: true,
    jobsScanned: (jobRows || []).length,
    jobsLiveChecked: liveChecked,
    jobsVerifiedAlive: verifiedAlive,
    jobsVerifiedDead: verifiedDead,
    jobsRobotsSkipped: robotsSkipped.length,
    jobsUpdated,
    rolesScanned: (roleRows || []).length,
    rolesUpdated,
    robotsSkipped,
    errors,
  })
}
