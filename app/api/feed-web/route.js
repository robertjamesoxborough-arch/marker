import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import { scoreMatch } from '../../../lib/match-engine'
import { checkAllowance } from '../../../lib/allowance'
import { trackAiUsage } from '../../../lib/ai-usage'
import { scoreJobsBatch } from '../../../lib/score-jobs-batch'
import { applyFreshnessToRow, filterAndSortByFreshness } from '../../../lib/freshness'
import { MODELS } from '../../../lib/anthropic'

// Cost rules 1 + 2: default behaviour reads the shared, nightly-scored
// jobs_cache and applies PER-USER relevance deterministically (zero AI cost).
// A live Adzuna scan only runs when the client explicitly asks for
// { fresh: true }, and only then behind the Pro/Max feed_fresh_scan daily cap
// (3/day Pro, 10/day Max, 0 on Free/unauth — see lib/allowance.js).

const ROLE_QUERIES = [
  { what: 'partnerships manager',         family: 'Partnerships' },
  { what: 'business development manager', family: 'BD' },
  { what: 'product marketing manager',    family: 'Product Marketing' },
  { what: 'growth manager',               family: 'Growth' },
  { what: 'product manager',              family: 'Product Management' },
  { what: 'marketing manager',            family: 'Marketing Generalist' },
]

function formatSalaryFromAdzuna(job) {
  const min = job.salary_min, max = job.salary_max
  if (!min && !max) return null
  if (min && max) return `£${Math.round(min / 1000)}k–£${Math.round(max / 1000)}k`
  if (min) return `£${Math.round(min / 1000)}k+`
  return null
}

function rowToJob(row) {
  return {
    id: row.id,
    title: row.role_title,
    company: row.company,
    url: row.link,
    salary: row.salary,
    location: row.location,
    score: row.match_score ?? null,
    score_tier: row.score_tier || null,
    office: 'Unknown',
    source: row.source,
    freshness: row.freshness,
    created: row.posted_at || row.cached_at,
    foundAt: row.cached_at,
  }
}

function interleaveByCompany(jobs) {
  const byCompany = {}
  jobs.forEach(j => { const k = j.company; if (!byCompany[k]) byCompany[k] = []; byCompany[k].push(j) })
  const queues = Object.values(byCompany)
  const out = []
  const maxLen = Math.max(...queues.map(q => q.length), 0)
  for (let i = 0; i < maxLen; i++) { for (const q of queues) { if (i < q.length) out.push(q[i]) } }
  return out
}

// Default path — zero AI cost. Reads jobs_cache rows already scored by the
// nightly /api/cron/score-cache run and ranks them for THIS user with the
// deterministic match engine (lib/match-engine.js). Never calls a model.
async function readFromCache(service, profile) {
  const { data: rows } = await service
    .from('jobs_cache')
    .select('*')
    .eq('source', 'adzuna')
    .not('scored_at', 'is', null)
    .order('cached_at', { ascending: false })
    .limit(300)

  if (!rows || rows.length === 0) return { jobs: [], total: 0 }

  const now = new Date()
  const fresh = filterAndSortByFreshness(rows.map(row => applyFreshnessToRow(row, now)))
  const withRelevance = fresh
    .map(row => ({ row, relevance: scoreMatch(profile, row) }))
    // Global baseline quality floor (nightly score) AND per-user relevance floor
    .filter(({ row, relevance }) => (row.match_score ?? 6) >= 5 && relevance.score >= 6)
    .sort((a, b) => b.relevance.score - a.relevance.score)
    .map(({ row }) => rowToJob(row))

  return { jobs: interleaveByCompany(withRelevance).slice(0, 60), total: rows.length }
}

// Fresh-scan path — Pro/Max only, daily-capped. Live Adzuna fetch, ONE shared
// baseline Haiku scoring call (lib/score-jobs-batch.js, same rubric as the
// nightly cron), upserted into jobs_cache so the scan benefits every user
// from the next cache read onward — not just the one who triggered it.
async function runFreshScan(service, apiKey, userId) {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_API_KEY
  if (!appId || !appKey) return { jobs: [], error: 'Adzuna API keys not configured' }

  const now = new Date().toISOString()
  const rows = []
  for (const { what } of ROLE_QUERIES) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(what)}&max_days_old=14&sort_by=date`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = await res.json()
      for (const job of (data.results || [])) {
        if (!job.id) continue
        rows.push({
          external_id: `adzuna-${job.id}`,
          company: job.company?.display_name || 'Unknown',
          role_title: job.title,
          link: job.redirect_url,
          salary: formatSalaryFromAdzuna(job),
          location: job.location?.display_name || '',
          source: 'adzuna',
          source_type: 'public_listing',
          cached_at: now,
          last_verified_at: now,
          adzuna_attribution_required: true,
          raw_json: { description: (job.description || '').slice(0, 500) },
        })
      }
      await new Promise(r => setTimeout(r, 300))
    } catch { continue }
  }

  const seen = new Set()
  const deduped = rows.filter(r => (seen.has(r.external_id) ? false : (seen.add(r.external_id), true))).slice(0, 100)
  if (deduped.length === 0) return { jobs: [], total: 0 }

  await service.from('jobs_cache').upsert(deduped, { onConflict: 'external_id' })

  let usage = null
  try {
    const { scores, cacheReadTokens, usage: u } = await scoreJobsBatch(apiKey, deduped)
    usage = u
    const nowIso = new Date().toISOString()
    for (let i = 0; i < deduped.length; i++) {
      const score = scores.has(i) ? scores.get(i) : 6
      await service.from('jobs_cache').update({
        match_score: score, score_tier: 'quick', scored_at: nowIso,
        score_breakdown_json: { tier: 'quick', model: 'haiku', baseline: true, source: 'fresh_scan' },
      }).eq('external_id', deduped[i].external_id)
    }
    if (userId && usage) after(() => trackAiUsage({ userId, model: MODELS.haiku, action: 'feed_fresh_scan', usage }))
  } catch { /* rows are still cached unscored; the nightly cron will pick them up */ }

  return { jobs: deduped.length, total: deduped.length }
}

export async function POST(req) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ jobs: [], error: 'Sign in required' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: profile } = await service
    .from('profiles')
    .select('target_roles, seniority, industries, postcode, salary_floor, max_office_days, hard_filters_json, track')
    .eq('user_id', user.id).single()

  let body = {}
  try { body = await req.json() } catch {}

  if (body?.fresh === true) {
    const { allowed, used, cap, tier } = await checkAllowance(user.id, 'feed_fresh_scan')
    if (!allowed) {
      return Response.json({
        jobs: [], limitReached: true, used, cap, tier,
        error: cap === 0
          ? 'Fresh scan is a Pro feature. Upgrade to run live scans; free plans read the shared daily-refreshed feed.'
          : `Fresh scan limit reached (${used}/${cap} today). Try again tomorrow, or browse the cached feed.`,
      }, { status: 429 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return Response.json({ jobs: [], error: 'No API key configured' }, { status: 500 })

    await runFreshScan(service, apiKey, user.id)
    // Serve the just-refreshed cache back through the same deterministic path
    const { jobs, total } = await readFromCache(service, profile)
    return Response.json({ jobs, total, source: 'fresh' })
  }

  const { jobs, total } = await readFromCache(service, profile)
  return Response.json({ jobs, total, source: 'cache' })
}
