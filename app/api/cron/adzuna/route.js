import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isUkEligible } from '../../../../lib/uk-eligibility'
import { isSourceEnabled } from '../../../../lib/source-flags'


// Queries mapped to our role families — each runs as a separate Adzuna search
const ROLE_QUERIES = [
  { what: 'partnerships manager',        family: 'Partnerships' },
  { what: 'business development manager', family: 'BD' },
  { what: 'product marketing manager',   family: 'Product Marketing' },
  { what: 'growth manager',              family: 'Growth' },
  { what: 'product manager',             family: 'Product Management' },
  { what: 'programme manager',           family: 'Programme Lead' },
  { what: 'digital strategy manager',    family: 'Digital Strategy' },
  { what: 'data analyst',                family: 'Data' },
  { what: 'software engineer',           family: 'Engineering' },
  { what: 'UX designer',                 family: 'Design' },
  { what: 'operations manager',          family: 'Ops' },
  { what: 'customer success manager',    family: 'Customer Success' },
  { what: 'marketing manager',           family: 'Marketing Generalist' },
  { what: 'head of partnerships',        family: 'Partnerships' },
  { what: 'head of product',             family: 'Product Management' },
]

const BASE = 'https://api.adzuna.com/v1/api/jobs/gb/search/1'

async function fetchAdzuna(appId, apiKey, what) {
  const url = new URL(BASE)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', apiKey)
  url.searchParams.set('results_per_page', '50')
  url.searchParams.set('what', what)
  url.searchParams.set('content-type', 'application/json')
  url.searchParams.set('sort_by', 'date')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Marker/1.0' },
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

  if (!await isSourceEnabled('adzuna')) {
    return NextResponse.json({ ok: true, skipped: 'source_adzuna disabled via admin kill switch' })
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

  // Run queries sequentially to avoid hammering the API
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
  // listing from two overlapping ROLE_QUERIES, and Postgres rejects an
  // upsert that would touch the same ON CONFLICT target row twice.
  const deduped = [...new Map(rows.map(r => [r.external_id, r])).values()]

  if (deduped.length > 0) {
    const { error } = await supabase
      .from('jobs_cache')
      .upsert(deduped, { onConflict: 'external_id' })
    if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
  }

  // Prune Adzuna rows older than 3 days
  await supabase
    .from('jobs_cache')
    .delete()
    .eq('source', 'adzuna')
    .lt('cached_at', new Date(Date.now() - 3 * 86400000).toISOString())

  return NextResponse.json({
    ok: true,
    inserted: deduped.length,
    queries: ROLE_QUERIES.length,
    errors,
  })
}
