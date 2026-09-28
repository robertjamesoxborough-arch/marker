import { createClient } from '@supabase/supabase-js'

/**
 * lib/adzuna-budget.js: GLOBAL daily, weekly and monthly ceilings on Adzuna API calls
 * across the whole product (nightly crons, salary lookups, fresh scans,
 * contractor roles — everything). Adzuna's registered tier is roughly
 * 250 calls/day; without a global cap, ~20 paying users doing live scans
 * would exhaust it in a day and every feed would break at once, silently.
 *
 * The counter lives in admin_metrics_cache under `adzuna_budget:<UTC-date>`
 * (resets naturally at UTC midnight). Every Adzuna call must reserve against
 * it BEFORE firing. Weekly and monthly ceilings (rolling sums of the daily
 * rows, see ADZUNA_WEEKLY_LIMIT) apply to every caller. Two daily ceilings:
 *   - Crons (kind:'cron') may use up to DAILY_LIMIT. They run at 02:00-04:30
 *     UTC, right after the reset, so they always claim their share first.
 *   - On-demand callers (kind:'ondemand': salary, fresh scan, contractor) are
 *     blocked at ONDEMAND_CEILING, which reserves DAILY_LIMIT - ONDEMAND_CEILING
 *     for the crons no matter how much daytime traffic there is.
 *
 * Set DAILY_LIMIT to ~80% of your real Adzuna plan's daily limit (headroom for
 * retries and slight non-atomic overshoot). The reserve/read is a simple
 * read-modify-write, not a DB-atomic transaction: at these volumes the race
 * window is negligible and any overshoot is bounded by one concurrent request
 * per call site; the ceiling sitting below the true limit absorbs it.
 */

// Conservative: assumes a ~250/day Adzuna plan. CONFIRM your actual plan limit
// and set this to ~80% of it. If your plan is higher, raise both numbers.
export const ADZUNA_DAILY_LIMIT = 220
export const ADZUNA_ONDEMAND_CEILING = 160 // reserves 60/day for the nightly crons
export const ADZUNA_ALERT_PCT = 80

// Weekly and monthly ceilings (Stage 85). Adzuna's documented DEFAULT limits are
// 25/minute, 250/day, 1,000/week and 2,500/month, per app. Until 2026-09-28
// Requite shared one app with Rob's personal tracker, and Requite's nightly
// crons alone reached 2,754 calls in 30 days. Requite now has its own app, so
// these are set to the full documented defaults. Raise them only once Adzuna
// confirms commercial limits in writing.
//
// Both are ROLLING windows summed from the daily rows, so they also hold for
// any calendar week or month Adzuna might use instead: 7 days covers any
// calendar week, 31 days covers any calendar month.
export const ADZUNA_WEEKLY_LIMIT = parseInt(process.env.ADZUNA_WEEKLY_LIMIT || '', 10) || 1000
export const ADZUNA_MONTHLY_LIMIT = parseInt(process.env.ADZUNA_MONTHLY_LIMIT || '', 10) || 2500
const WEEK_DAYS = 7
const MONTH_DAYS = 31

// First UTC day on Requite's own Adzuna app. Daily rows before this were spent
// on the old shared app, so they are left out of the weekly and monthly sums;
// counting them would block the new app for a month over usage it never had.
export const ADZUNA_LEDGER_EPOCH = '2026-09-29'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
function dayString(offsetDays = 0) {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10)
}
function todayKey() {
  return `adzuna_budget:${dayString()}`
}

// One query for the whole 31-day window. Returns today's count plus the
// rolling 7-day and 31-day totals (today included).
async function readUsage(service) {
  const days = Array.from({ length: MONTH_DAYS }, (_, i) => dayString(i))
  const { data } = await service
    .from('admin_metrics_cache')
    .select('metric, value')
    .in('metric', days.map(d => `adzuna_budget:${d}`))
  const byDay = Object.fromEntries((data || []).map(r => [r.metric.slice('adzuna_budget:'.length), r.value?.count || 0]))
  const sum = n => days.slice(0, n).filter(d => d >= ADZUNA_LEDGER_EPOCH).reduce((t, d) => t + (byDay[d] || 0), 0)
  return { today: byDay[days[0]] || 0, week: sum(WEEK_DAYS), month: sum(MONTH_DAYS) }
}

/**
 * Reserve up to `calls` Adzuna calls against the daily, weekly and monthly
 * ceilings.
 *
 * PARTIAL by default (Stage 85): asking for 34 with 20 left anywhere grants
 * 20, so a cron near a ceiling still refreshes part of the cache instead of
 * none of it. The caller MUST NOT make more than `granted` calls; slice the
 * query list to it. `allowed` is simply granted > 0. Pass allowPartial:false
 * for all-or-nothing.
 *
 * @returns {Promise<{allowed:boolean, granted:number, requested:number,
 *   used:number, ceiling:number, limit:number, limitedBy:string|null,
 *   week:{used:number, limit:number}, month:{used:number, limit:number}}>}
 */
export async function reserveAdzuna({ calls = 1, kind = 'ondemand', service = null, allowPartial = true } = {}) {
  const s = service || svc()
  const ceiling = kind === 'cron' ? ADZUNA_DAILY_LIMIT : ADZUNA_ONDEMAND_CEILING
  const usage = await readUsage(s)
  const free = {
    daily: Math.max(ceiling - usage.today, 0),
    weekly: Math.max(ADZUNA_WEEKLY_LIMIT - usage.week, 0),
    monthly: Math.max(ADZUNA_MONTHLY_LIMIT - usage.month, 0),
  }
  const available = Math.min(free.daily, free.weekly, free.monthly)
  const granted = allowPartial ? Math.min(calls, available) : (calls <= available ? calls : 0)
  // Which ceiling bit, for the log line and the caller's response.
  const limitedBy = granted < calls
    ? Object.entries(free).sort((a, b) => a[1] - b[1])[0][0]
    : null

  const result = (used) => ({
    allowed: granted > 0,
    granted,
    requested: calls,
    used,
    ceiling,
    limit: ADZUNA_DAILY_LIMIT,
    limitedBy,
    week: { used: usage.week + granted, limit: ADZUNA_WEEKLY_LIMIT },
    month: { used: usage.month + granted, limit: ADZUNA_MONTHLY_LIMIT },
  })

  if (granted === 0) {
    console.error(`[adzuna-budget] BLOCKED ${kind} reservation of ${calls}: ${limitedBy} ceiling reached (today ${usage.today}/${ceiling}, week ${usage.week}/${ADZUNA_WEEKLY_LIMIT}, month ${usage.month}/${ADZUNA_MONTHLY_LIMIT}). Serving cache instead.`)
    return result(usage.today)
  }
  if (granted < calls) {
    console.warn(`[adzuna-budget] PARTIAL ${kind} grant ${granted}/${calls}: ${limitedBy} ceiling (today ${usage.today}/${ceiling}, week ${usage.week}/${ADZUNA_WEEKLY_LIMIT}, month ${usage.month}/${ADZUNA_MONTHLY_LIMIT}).`)
  }

  const next = usage.today + granted
  await s.from('admin_metrics_cache').upsert(
    { metric: todayKey(), value: { count: next }, computed_at: new Date().toISOString() },
    { onConflict: 'metric' }
  )
  // Alert on the ON-DEMAND ceiling, not the global limit: that is the point at
  // which user-facing features (fresh scan, salary) start degrading to cache,
  // so it is the number that protects the customer experience.
  if (next >= (ADZUNA_ONDEMAND_CEILING * ADZUNA_ALERT_PCT) / 100) {
    console.warn(`[adzuna-budget] ALERT: ${next} Adzuna calls used today (>=${ADZUNA_ALERT_PCT}% of the ${ADZUNA_ONDEMAND_CEILING} on-demand ceiling). On-demand scanning will start degrading to cache soon.`)
  }
  for (const [name, used, limit] of [['weekly', usage.week + granted, ADZUNA_WEEKLY_LIMIT], ['monthly', usage.month + granted, ADZUNA_MONTHLY_LIMIT]]) {
    if (used >= (limit * ADZUNA_ALERT_PCT) / 100) console.warn(`[adzuna-budget] ALERT: ${used}/${limit} of the ${name} Adzuna ceiling used.`)
  }
  return result(next)
}

/** Read-only usage for the admin dashboard. */
export async function getAdzunaUsage(service = null) {
  const s = service || svc()
  const { today: used, week, month } = await readUsage(s)
  return {
    used,
    limit: ADZUNA_DAILY_LIMIT,
    ondemandCeiling: ADZUNA_ONDEMAND_CEILING,
    pct: Math.round((used / ADZUNA_DAILY_LIMIT) * 100),
    // % of the on-demand ceiling used. This is the number that matters for the
    // customer experience (on-demand degrades to cache at 100% of it).
    ondemandPct: Math.round((used / ADZUNA_ONDEMAND_CEILING) * 100),
    alertPct: ADZUNA_ALERT_PCT,
    alerting: used >= (ADZUNA_ONDEMAND_CEILING * ADZUNA_ALERT_PCT) / 100,
    ondemandExhausted: used >= ADZUNA_ONDEMAND_CEILING,
    week: { used: week, limit: ADZUNA_WEEKLY_LIMIT, pct: Math.round((week / ADZUNA_WEEKLY_LIMIT) * 100) },
    month: { used: month, limit: ADZUNA_MONTHLY_LIMIT, pct: Math.round((month / ADZUNA_MONTHLY_LIMIT) * 100) },
  }
}
