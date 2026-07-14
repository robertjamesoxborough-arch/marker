import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isUkEligible } from '../../../../lib/uk-eligibility'
import { isSourceEnabled } from '../../../../lib/source-flags'
import { REQUITE_USER_AGENT } from '../../../../lib/robots'

// Nightly, shared ingest for contract/interim roles — no existing cron
// covered this source before Stage 22. Same pattern as cron/adzuna: generic,
// candidate-agnostic queries (cost rule 1 — never per-user, never live on a
// click), upserted into the SAME shared jobs_cache table. Deliberately reuses
// cron/adzuna's `adzuna-${job.id}` external_id scheme (not a separate
// `contract-` prefix) so the exact same real Adzuna ad correctly merges into
// one row if it's ever matched by both crons, rather than duplicating.
// track_tags (existing, previously-unused column) marks these rows
// 'contract' for the contractor/roles reader to filter on; cron/adzuna's own
// upsert never references track_tags, so it can never clobber this tag on a
// later pass over the same row.
const ROLE_QUERIES = [
  { what: 'interim finance director',     family: 'Finance' },
  { what: 'interim CFO',                  family: 'Finance' },
  { what: 'interim programme manager',    family: 'Programme Lead' },
  { what: 'contract project manager',     family: 'Project Management' },
  { what: 'interim HR director',          family: 'HR' },
  { what: 'interim marketing director',   family: 'Marketing' },
  { what: 'interim operations director',  family: 'Ops' },
  { what: 'interim change manager',       family: 'Change & Transformation' },
  { what: 'contract business analyst',    family: 'Business Analysis' },
  { what: 'contract software engineer',   family: 'Engineering' },
  { what: 'day rate product manager',     family: 'Product Management' },
  { what: 'interim head of digital',      family: 'Digital' },
  { what: 'freelance creative director',  family: 'Creative' },
  { what: 'fixed term marketing manager', family: 'Marketing' },
]

const BASE = 'https://api.adzuna.com/v1/api/jobs/gb/search/1'

async function fetchAdzuna(appId, apiKey, what) {
  const url = new URL(BASE)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', apiKey)
  url.searchParams.set('results_per_page', '30')
  url.searchParams.set('what', what)
  url.searchParams.set('content-type', 'application/json')
  url.searchParams.set('sort_by', 'date')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': REQUITE_USER_AGENT },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Adzuna HTTP ${res.status}`)
  return res.json()
}

function formatSalary(job) {
  const min = job.salary_min
  const max = job.salary_max
  if (!min && !max) return null
  if (min && max) return `£${Math.round(min / 1000)}k–£${Math.round(max / 1000)}k`
  if (min) return `£${Math.round(min / 1000)}k+`
  return null
}

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!await isSourceEnabled('contract')) {
    return NextResponse.json({ ok: true, skipped: 'source_contract disabled via admin kill switch' })
  }

  const appId = process.env.ADZUNA_APP_ID
  const apiKey = process.env.ADZUNA_API_KEY
  if (!appId || !apiKey) {
    return NextResponse.json({ error: 'ADZUNA_APP_ID or ADZUNA_API_KEY not set' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date().toISOString()
  const rows = []
  const errors = []

  for (const { what, family } of ROLE_QUERIES) {
    try {
      const data = await fetchAdzuna(appId, apiKey, what)
      const results = Array.isArray(data.results) ? data.results : []
      results.forEach(job => {
        if (!isUkEligible(job.location?.display_name)) return
        rows.push({
          external_id: `adzuna-${job.id}`,
          company: job.company?.display_name || 'Unknown',
          role_title: job.title,
          link: job.redirect_url,
          salary: formatSalary(job),
          location: job.location?.display_name || '',
          source: 'adzuna',
          source_type: 'public_listing',
          track_tags: ['contract'],
          cached_at: now,
          last_verified_at: now,
          adzuna_attribution_required: true,
          raw_json: {
            family,
            category: job.category?.label || null,
            // Session O: trimmed to what match-engine.js's office-day/remote/benefit keyword detection needs; never displayed to users.
            description: (job.description || '').slice(0, 300),
          },
        })
      })
    } catch (e) {
      errors.push(`${what}: ${e.message}`)
    }
  }

  // Dedupe by external_id — a single batch can otherwise contain the same
  // listing from two overlapping ROLE_QUERIES.
  const deduped = [...new Map(rows.map(r => [r.external_id, r])).values()]

  if (deduped.length > 0) {
    const { error } = await supabase
      .from('jobs_cache')
      .upsert(deduped, { onConflict: 'external_id' })
    if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
  }

  // No separate prune here — cron/adzuna already deletes source='adzuna'
  // rows older than 3 days, which covers these too regardless of track_tags.

  return NextResponse.json({
    ok: true,
    inserted: deduped.length,
    queries: ROLE_QUERIES.length,
    errors,
  })
}
