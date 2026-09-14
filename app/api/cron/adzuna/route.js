import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isUkEligible } from '../../../../lib/uk-eligibility'
import { isSourceEnabled } from '../../../../lib/source-flags'
import { REQUITE_USER_AGENT } from '../../../../lib/robots'
import { reserveAdzuna } from '../../../../lib/adzuna-budget'
import { buildAdzunaRoleQueries, ADZUNA_CATEGORIES } from '../../../../lib/aggregate-role-queries'

const BASE = 'https://api.adzuna.com/v1/api/jobs/gb/search/1'

async function fetchAdzuna(appId, apiKey, { what, category, resultsPerPage = 50 }) {
  const url = new URL(BASE)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', apiKey)
  url.searchParams.set('results_per_page', String(resultsPerPage))
  if (what) url.searchParams.set('what', what)
  if (category) url.searchParams.set('category', category)
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

  // Query set = a broadened static floor (all sectors, not just marketing/
  // tech) plus real distinct target_roles pulled from actual user profiles,
  // bounded and deduped — still one shared nightly batch (Cost Guardrails
  // RULE 1), just no longer structurally incapable of covering anyone
  // outside the founder's own profession.
  const ROLE_QUERIES = await buildAdzunaRoleQueries(supabase)

  // Stage 70 — category sweep. Even the widened ROLE_QUERIES above is still
  // a hand-picked (if broadened) list of profession TEXT — it can only ever
  // cover professions someone thought to type. Adzuna's own category
  // taxonomy (ADZUNA_CATEGORIES, confirmed live against the real API) is
  // exhaustive and Adzuna-maintained, not curated by Requite: querying by
  // category with no "what" filter pulls a genuine cross-section of every
  // sector Adzuna tracks, so a profession never has to be named by a real
  // user or guessed by us for its sector to get nightly coverage. Confirmed
  // live (Stage 70) that Adzuna carries huge real volume — 27k+ management
  // accountant listings, 24k+ primary teacher, 8k+ plumber, 27k+ care
  // worker — that was invisible to jobs_cache before this, purely because
  // nothing ever asked for it.
  const budget = await reserveAdzuna({ calls: ROLE_QUERIES.length + ADZUNA_CATEGORIES.length, kind: 'cron', service: supabase })
  if (!budget.allowed) {
    return NextResponse.json({ ok: false, skipped: `adzuna daily budget exhausted (${budget.used}/${budget.limit})` })
  }

  const now = new Date().toISOString()
  const rows = []
  const errors = []

  // Run queries sequentially to avoid hammering the API
  for (const { what, family } of ROLE_QUERIES) {
    try {
      const data = await fetchAdzuna(appId, apiKey, { what, resultsPerPage: 50 })
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

  // Category sweep — same row shape, same shared external_id scheme (a
  // listing already caught by a ROLE_QUERIES text match just de-dupes on
  // upsert, exactly like cron/contract's shared-ID reasoning), smaller page
  // size since the goal here is universal breadth, not depth per sector.
  for (const category of ADZUNA_CATEGORIES) {
    try {
      const data = await fetchAdzuna(appId, apiKey, { category, resultsPerPage: 30 })
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
            family: 'category-sweep',
            category: job.category?.label || category,
            description: (job.description || '').slice(0, 300),
          },
        })
      })
    } catch (e) {
      errors.push(`category:${category}: ${e.message}`)
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
    roleQueries: ROLE_QUERIES.length,
    categoryQueries: ADZUNA_CATEGORIES.length,
    errors,
  })
}
