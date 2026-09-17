import { createClient } from '@supabase/supabase-js'
import { windowStart, periodFor } from './usage-window'
import { TIER_CAPS, SPEND_CEILING_GBP, SPEND_CEILING_MESSAGE } from './allowance-config'

// TIER_CAPS, SPEND_CEILING_GBP and SPEND_CEILING_MESSAGE all live in
// lib/allowance-config.js now (Stage 77) -- pure data with no dependency on
// @supabase/supabase-js, split out for the same reason usage-window.js was:
// so lib/allowance.test.js can load them under plain `node`, without pulling
// in this whole file's Supabase client. See that file for the full reasoning
// behind every number and every cap. Re-exported here so every existing
// `import { ... } from '../lib/allowance'` call site keeps working unchanged.
export { TIER_CAPS, SPEND_CEILING_GBP, SPEND_CEILING_MESSAGE }

// SHARED WEB_SEARCH POOL (Stage 64) — web_search is the most expensive call
// type in the product ($10/1000 searches + Sonnet, vs cheap Haiku scoring).
// Before this, every web_search-consuming feature (recruiter search, the CV
// generator's company-research refresh, interview prep, the analyse
// scorer's search-fallback strategy) had its OWN independent monthly cap.
// Individually reasonable, those caps SUM: a Max user maxing recruiter
// search (20) + analyse_search (200) + interview_prep (30) in one month
// could trigger up to 250 web_search-capable calls — each capable of up to
// 4 searches — while every individual cap still reported "within limit".
//
// The fix is this one extra `web_search` action, checked via the exact
// same generic checkAllowance()/ai_usage machinery as every other action
// (no new table, no new counting logic) IN ADDITION to each feature's own
// existing gate, right before the web_search-enabled model call fires.
// Existing per-feature caps and their UI messaging are UNCHANGED — this
// pool is the real binding ceiling in practice, invisibly, without any
// panel needing to know it exists. Any future web_search feature only
// needs to check/log against this one action to be cost-safe by
// construction; it does not need a bucket of its own.

// Returns { allowed, used, cap, tier }
// allowed: false when cap === 0 (tier can't use feature) OR monthly count >= cap
export async function checkAllowance(userId, action) {
  if (!userId || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { allowed: true, used: 0, cap: 9999, tier: 'unknown' }
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: userData } = await service
    .from('users')
    .select('tier, trial_ends_at')
    .eq('id', userId)
    .single()

  const now = new Date().toISOString()
  const trialActive = userData?.trial_ends_at && userData.trial_ends_at > now
  const tier = userData?.tier || (trialActive ? 'trial' : 'free')

  const caps = TIER_CAPS[tier] || TIER_CAPS.free
  const cap = caps[action] ?? 0

  const period = periodFor(action)
  if (cap === 0) return { allowed: false, used: 0, cap: 0, tier, period }

  // Spend-ceiling backstop, checked before the count cap below. This is what
  // actually bounds worst-case cost -- see the SPEND_CEILING_GBP comment
  // above. Uses a single Postgres aggregate (migration 018) rather than
  // pulling every ai_usage row into JS, since some routes (e.g. /api/analyse)
  // call checkAllowance() two or three times in one request.
  const spendCeiling = SPEND_CEILING_GBP[tier] ?? SPEND_CEILING_GBP.free
  const monthStart = windowStart('month')
  const { data: spendData, error: spendError } = await service.rpc('ai_usage_monthly_spend', {
    p_user_id: userId,
    p_since: monthStart.toISOString(),
  })

  // Same fail-closed discipline as the count query below: a broken spend
  // query must never silently read as £0 spent, or the ceiling is not a
  // ceiling. Log loudly and block.
  if (spendError) {
    console.error(`[checkAllowance] spend query failed for user=${userId} action=${action}:`, spendError.message)
    return { allowed: false, used: 0, cap, tier, period, error: spendError.message }
  }

  const spend = parseFloat(spendData) || 0
  if (spend >= spendCeiling) {
    return { allowed: false, used: 0, cap, tier, period, spendExceeded: true, spend, spendCeiling }
  }

  // Count usage within this action's reset window (monthly by default, daily
  // for feed_fresh_scan) so daily caps cannot be bypassed by a monthly count.
  const start = windowStart(period)

  const { count, error } = await service
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', start.toISOString())

  // A query error (e.g. a missing GRANT) must never silently read as
  // used:0 -- that previously made every cap look unenforced. Log loudly
  // (visible in Vercel logs) and fail closed: block the action rather than
  // let a broken query masquerade as "no usage yet, allowed".
  if (error) {
    console.error(`[checkAllowance] ai_usage count query failed for user=${userId} action=${action}:`, error.message)
    return { allowed: false, used: 0, cap, tier, period, error: error.message }
  }

  const used = count || 0
  return { allowed: used < cap, used, cap, tier, period }
}
