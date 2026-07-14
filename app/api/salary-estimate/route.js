// Salary estimation — Adzuna histogram (real market data) + static seniority
// floor fallback. No Claude usage.
//
// Cost/quota control (Session V): the Adzuna histogram shares the ingest
// crons' monthly Adzuna quota, so salary lookups must not scale per-user-
// per-click. Two defences:
//   1. Shared per-role cache in admin_metrics_cache — the FIRST user to look
//      up a role title pays the one Adzuna call; every other user (and every
//      repeat view) reads that row. Real results cached 30 days (salaries
//      don't move week to week); static fallbacks cached 3 days so we retry
//      Adzuna soon without hammering it.
//   2. A daily-budget backstop — once SALARY_DAILY_BUDGET live calls have been
//      made in a UTC day, further misses fall back to static instead of
//      calling Adzuna, so salary can never exhaust the quota mid-month.
// Auth-gated so an unauthenticated caller can't trigger the Adzuna call at all.
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SALARY_TTL_MS = 30 * 24 * 60 * 60 * 1000
const STATIC_TTL_MS = 3 * 24 * 60 * 60 * 1000
const SALARY_DAILY_BUDGET = 150 // crons use ~42 Adzuna calls/night; this bounds salary's live calls well within any realistic plan

const SENIORITY_FLOORS = [
  { match: ['chief', 'cto', 'cmo', 'coo', 'cpo'], floor: 150, cap: 250 },
  { match: ['vp ', 'vice president'], floor: 120, cap: 180 },
  { match: ['director'], floor: 90, cap: 160 },
  { match: ['deputy director'], floor: 80, cap: 130 },
  { match: ['head of'], floor: 85, cap: 140 },
  { match: ['principal'], floor: 80, cap: 120 },
  { match: ['senior manager', 'sr manager'], floor: 75, cap: 115 },
  { match: ['senior', 'sr '], floor: 65, cap: 100 },
  { match: ['manager'], floor: 55, cap: 90 },
  { match: ['lead'], floor: 60, cap: 95 },
  { match: ['specialist', 'consultant'], floor: 45, cap: 75 },
  { match: ['coordinator', 'executive', 'associate'], floor: 28, cap: 55 },
]

function getSeniorityBounds(roleTitle) {
  const t = (roleTitle || '').toLowerCase()
  for (const s of SENIORITY_FLOORS) {
    if (s.match.some(k => t.includes(k))) return s
  }
  return { floor: 45, cap: 100 }
}

function staticEstimate(roleTitle) {
  const bounds = getSeniorityBounds(roleTitle)
  return { min: bounds.floor, max: bounds.cap, source: 'estimate' }
}

export async function POST(req) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { roleTitle, company, profileSeniority } = await req.json()
  if (!roleTitle) return Response.json({ salary: null })

  // Seniority keyword tightens the histogram to the candidate's actual level.
  const effectiveTitle = profileSeniority ? `${profileSeniority} ${roleTitle}` : roleTitle
  const bounds = getSeniorityBounds(effectiveTitle)

  const adzunaId = process.env.ADZUNA_APP_ID
  const adzunaKey = process.env.ADZUNA_API_KEY // was ADZUNA_APP_KEY (typo, never resolved)

  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null

  const cacheKey = `salary:${effectiveTitle.toLowerCase().trim().slice(0, 120)}`

  // ── 1. Shared cache read ──────────────────────────────────────────────────
  if (service) {
    const { data } = await service.from('admin_metrics_cache').select('value, computed_at').eq('metric', cacheKey).maybeSingle()
    if (data?.value?.salary && data.computed_at) {
      const age = Date.now() - new Date(data.computed_at).getTime()
      const ttl = data.value.salary.source === 'adzuna' ? SALARY_TTL_MS : STATIC_TTL_MS
      if (age < ttl) return Response.json({ salary: data.value.salary })
    }
  }

  async function cacheAndReturn(salary) {
    if (service) {
      await service.from('admin_metrics_cache').upsert(
        { metric: cacheKey, value: { salary }, computed_at: new Date().toISOString() },
        { onConflict: 'metric' }
      )
    }
    return Response.json({ salary })
  }

  // ── 2. Daily-budget backstop ──────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const budgetKey = `salary_budget:${today}`
  let budgetUsed = 0
  if (service && adzunaId && adzunaKey) {
    const { data: b } = await service.from('admin_metrics_cache').select('value').eq('metric', budgetKey).maybeSingle()
    budgetUsed = b?.value?.count || 0
  }
  const canCallAdzuna = !!(adzunaId && adzunaKey) && budgetUsed < SALARY_DAILY_BUDGET

  // ── 3. Live Adzuna histogram (budget permitting) ──────────────────────────
  if (canCallAdzuna) {
    // Count the attempt against today's budget before making it, so the cap
    // holds even for role titles whose result never passes the sanity check.
    if (service) {
      await service.from('admin_metrics_cache').upsert(
        { metric: budgetKey, value: { count: budgetUsed + 1 }, computed_at: new Date().toISOString() },
        { onConflict: 'metric' }
      )
    }
    try {
      const query = encodeURIComponent(effectiveTitle)
      const url = `https://api.adzuna.com/v1/api/jobs/gb/histogram?app_id=${adzunaId}&app_key=${adzunaKey}&what=${query}&content-type=application/json`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = await res.json()
        const buckets = data.histogram
        if (buckets && Object.keys(buckets).length > 0) {
          const entries = Object.entries(buckets)
            .map(([k, v]) => ({ salary: parseInt(k), count: v }))
            .filter(e => e.salary >= bounds.floor * 1000 && e.salary <= bounds.cap * 1000)
            .sort((a, b) => a.salary - b.salary)

          if (entries.length >= 2) {
            const total = entries.reduce((s, e) => s + e.count, 0)
            let cumulative = 0
            let p25 = entries[0].salary
            let p75 = entries[entries.length - 1].salary
            for (const e of entries) {
              cumulative += e.count
              if (cumulative / total >= 0.25 && p25 === entries[0].salary) p25 = e.salary
              if (cumulative / total >= 0.75) { p75 = e.salary; break }
            }
            const min = Math.round(p25 / 1000)
            const max = Math.round(p75 / 1000)
            if (min >= bounds.floor && max <= bounds.cap + 20) {
              return cacheAndReturn({ min, max, source: 'adzuna' })
            }
          }
        }
      }
    } catch {}
  }

  // Fallback: cache the static estimate (short TTL) so repeat lookups of the
  // same role don't re-call Adzuna every time.
  return cacheAndReturn(staticEstimate(effectiveTitle))
}
