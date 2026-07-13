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

// Cost rules 1 + 2, same pattern as /api/feed-web. Default reads the shared,
// nightly-scored jobs_cache (cron/gov already ingests source='gov' rows) with
// zero AI cost; a live gov-flavoured Adzuna scan only runs on {fresh:true},
// gated by the Pro/Max feed_fresh_scan daily cap (lib/allowance.js).

const TITLE_MUST = ['director', 'head of', 'deputy', 'senior manager', 'programme director', 'chief', 'vp', 'vice president', 'lead']
const TITLE_REJECT = ['engineer', 'software', 'developer', 'data sci', 'data analy', 'finance', 'accountant', 'legal', 'compliance', 'hr ', 'human resource', 'security', 'infrastructure', 'devops', 'nurse', 'doctor', 'clinical', 'cleaner', 'driver', 'warehouse', 'logistics', 'procurement', 'admin', 'assistant', 'apprentice', 'graduate', 'intern', 'trainee', 'helpdesk', 'support analyst', 'junior']

function buildGovQueries(profile) {
  const roles = profile?.target_roles || []
  const seniorities = (profile?.seniorities || [])
    .map(s => ({ senior_manager: 'senior manager', head_of: 'head of', director: 'director', vp: 'deputy director', c_suite: 'director general' }[s]))
    .filter(Boolean)

  if (roles.length === 0) {
    return ['director of digital public sector', 'head of digital government', 'deputy director digital strategy', 'director partnerships public sector', 'programme director government digital']
  }
  const govPrefixes = seniorities.length ? seniorities.slice(0, 3) : ['director', 'head of', 'deputy director']
  const queries = []
  for (const prefix of govPrefixes) {
    for (const role of roles.slice(0, 5)) queries.push(`${prefix} ${role} public sector`)
  }
  queries.push('director digital government', 'head of digital NHS', 'deputy director communications public sector')
  return [...new Set(queries)].slice(0, 12)
}

function formatSalary(job) {
  const min = job.salary_min, max = job.salary_max
  if (!min && !max) return null
  if (min && max) return `£${Math.round(min / 1000)}k–£${Math.round(max / 1000)}k`
  if (min) return `£${Math.round(min / 1000)}k+`
  return null
}

function rowToJob(row) {
  return {
    id: row.id, title: row.role_title, company: row.company, url: row.link,
    salary: row.salary, location: row.location, score: row.match_score ?? null,
    score_tier: row.score_tier || null, office: 'Unknown', source: 'gov_search',
    freshness: row.freshness, created: row.posted_at || row.cached_at, foundAt: row.cached_at,
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

// Zero-AI-cost default path — reads jobs_cache rows the nightly cron/gov +
// cron/score-cache have already ingested and baseline-scored.
async function readFromCache(service, profile) {
  const { data: rows } = await service
    .from('jobs_cache')
    .select('*')
    .eq('source', 'gov')
    .not('scored_at', 'is', null)
    .order('cached_at', { ascending: false })
    .limit(300)

  if (!rows || rows.length === 0) return { jobs: [], total: 0 }

  const now = new Date()
  const fresh = filterAndSortByFreshness(rows.map(row => applyFreshnessToRow(row, now)))
  const withRelevance = fresh
    .map(row => ({ row, relevance: scoreMatch(profile, row) }))
    .filter(({ row, relevance }) => (row.match_score ?? 6) >= 5 && relevance.score >= 6)
    .sort((a, b) => b.relevance.score - a.relevance.score)
    .map(({ row }) => rowToJob(row))

  return { jobs: interleaveByCompany(withRelevance).slice(0, 60), total: rows.length }
}

// Fresh-scan path — Pro/Max only, daily-capped. Live gov-flavoured Adzuna
// search, ONE shared baseline Haiku score (lib/score-jobs-batch.js — same
// rubric as the nightly cron), upserted into the SHARED jobs_cache.
async function runFreshScan(service, apiKey, userId, profile) {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_API_KEY
  if (!appId || !appKey) return { jobs: [], error: 'Adzuna API keys not configured' }

  const salaryMin = profile?.salary_floor || 60000
  const now = new Date().toISOString()
  const raw = []
  for (const query of buildGovQueries(profile)) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(query)}&salary_min=${salaryMin}&max_days_old=21&sort_by=relevance`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = await res.json()
      for (const job of (data.results || [])) {
        if (!job.id) continue
        const title = (job.title || '').toLowerCase()
        if (!TITLE_MUST.some(k => title.includes(k)) || TITLE_REJECT.some(k => title.includes(k))) continue
        raw.push({
          id: `gov-${job.id}`,
          company: job.company?.display_name || 'Unknown',
          role_title: job.title,
          link: job.redirect_url,
          salary: formatSalary(job),
          location: job.location?.display_name || '',
          source: 'gov',
          cached_at: now,
          adzuna_attribution_required: true,
        })
      }
      await new Promise(r => setTimeout(r, 300))
    } catch { continue }
  }

  const seen = new Set()
  const deduped = raw.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, 100)
  if (deduped.length === 0) return { jobs: 0, total: 0 }

  await service.from('jobs_cache').upsert(deduped, { onConflict: 'id' })

  try {
    const { scores, usage } = await scoreJobsBatch(apiKey, deduped)
    const nowIso = new Date().toISOString()
    for (let i = 0; i < deduped.length; i++) {
      const score = scores.has(i) ? scores.get(i) : 6
      await service.from('jobs_cache').update({
        match_score: score, score_tier: 'quick', scored_at: nowIso,
        score_breakdown_json: { tier: 'quick', model: 'haiku', baseline: true, source: 'fresh_scan' },
      }).eq('id', deduped[i].id)
    }
    if (userId && usage) after(() => trackAiUsage({ userId, model: MODELS.haiku, action: 'feed_fresh_scan', usage }))
  } catch { /* rows stay cached unscored; the nightly cron will pick them up */ }

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
    .select('target_roles, seniorities, seniority, industries, postcode, salary_floor, max_office_days, hard_filters_json, tracks, track')
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

    await runFreshScan(service, apiKey, user.id, profile)
    const { jobs, total } = await readFromCache(service, profile)
    return Response.json({ jobs, total, source: 'fresh' })
  }

  const { jobs, total } = await readFromCache(service, profile)
  return Response.json({ jobs, total, source: 'cache' })
}
