import { createClient } from '@supabase/supabase-js'

/**
 * lib/adzuna-budget.js — a single GLOBAL daily ceiling on Adzuna API calls
 * across the whole product (nightly crons, salary lookups, fresh scans,
 * contractor roles — everything). Adzuna's registered tier is roughly
 * 250 calls/day; without a global cap, ~20 paying users doing live scans
 * would exhaust it in a day and every feed would break at once, silently.
 *
 * The counter lives in admin_metrics_cache under `adzuna_budget:<UTC-date>`
 * (resets naturally at UTC midnight). Every Adzuna call must reserve against
 * it BEFORE firing. Two ceilings:
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

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
function todayKey() {
  return `adzuna_budget:${new Date().toISOString().slice(0, 10)}`
}

async function readCount(service) {
  const { data } = await service.from('admin_metrics_cache').select('value').eq('metric', todayKey()).maybeSingle()
  return data?.value?.count || 0
}

/**
 * Reserve `calls` Adzuna calls against today's global budget.
 * @returns {Promise<{allowed:boolean, used:number, ceiling:number, limit:number}>}
 * On !allowed, the caller must NOT call Adzuna — it should degrade to cache.
 */
export async function reserveAdzuna({ calls = 1, kind = 'ondemand', service = null } = {}) {
  const s = service || svc()
  const ceiling = kind === 'cron' ? ADZUNA_DAILY_LIMIT : ADZUNA_ONDEMAND_CEILING
  const used = await readCount(s)
  if (used + calls > ceiling) {
    console.error(`[adzuna-budget] BLOCKED ${kind} reservation of ${calls}: ${used}/${ceiling} used today (global limit ${ADZUNA_DAILY_LIMIT}). Serving cache instead.`)
    return { allowed: false, used, ceiling, limit: ADZUNA_DAILY_LIMIT }
  }
  const next = used + calls
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
  return { allowed: true, used: next, ceiling, limit: ADZUNA_DAILY_LIMIT }
}

/** Read-only usage for the admin dashboard. */
export async function getAdzunaUsage(service = null) {
  const s = service || svc()
  const used = await readCount(s)
  return {
    used,
    limit: ADZUNA_DAILY_LIMIT,
    ondemandCeiling: ADZUNA_ONDEMAND_CEILING,
    pct: Math.round((used / ADZUNA_DAILY_LIMIT) * 100),
    // % of the on-demand ceiling used — this is the number that matters for the
    // customer experience (on-demand degrades to cache at 100% of it).
    ondemandPct: Math.round((used / ADZUNA_ONDEMAND_CEILING) * 100),
    alertPct: ADZUNA_ALERT_PCT,
    alerting: used >= (ADZUNA_ONDEMAND_CEILING * ADZUNA_ALERT_PCT) / 100,
    ondemandExhausted: used >= ADZUNA_ONDEMAND_CEILING,
  }
}
