import { createClient } from '@supabase/supabase-js'
import { windowStart, periodFor } from './usage-window'

// Action caps per tier. Cap 0 = feature not available on this tier (hard block).
// Most actions reset MONTHLY. feed_fresh_scan resets DAILY (see usage-window.js)
// — it is the Pro/Max "Fresh scan" button that triggers a live board fetch, so
// it is deliberately day-capped to stop per-user-per-click spend (cost rule 1).
export const TIER_CAPS = {
  free: {
    analyse:          30,   // Haiku job scoring (strategies 1+2)
    analyse_search:   3,    // Sonnet web-search fallback (strategy 3)
    cv:               1,    // CV generation
    cover_letter:     0,    // Not on Free
    interview_prep:   0,    // Not on Free
    negotiation_prep: 0,    // Not on Free
    feed_fresh_scan:  0,    // Free reads the shared nightly cache only, no live scans
  },
  trial: {
    analyse:          1000,
    analyse_search:   60,
    cv:               20,
    cover_letter:     20,
    interview_prep:   8,
    negotiation_prep: 8,
    feed_fresh_scan:  3,    // per DAY
  },
  pro: {
    analyse:          1000,
    analyse_search:   60,
    cv:               20,
    cover_letter:     20,
    interview_prep:   8,
    negotiation_prep: 8,
    feed_fresh_scan:  3,    // per DAY
  },
  max: {
    analyse:          3000,
    analyse_search:   200,
    cv:               60,
    cover_letter:     60,
    interview_prep:   30,
    negotiation_prep: 30,
    feed_fresh_scan:  10,   // per DAY
  },
}

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
