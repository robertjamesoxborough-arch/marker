import { createClient } from '@supabase/supabase-js'
import { windowStart, periodFor } from './usage-window'

// Action caps per tier. Cap 0 = feature not available on this tier (hard block).
// Most actions reset MONTHLY. feed_fresh_scan resets DAILY (see usage-window.js)
// — it is the Pro/Max "Fresh scan" button that triggers a live board fetch, so
// it is deliberately day-capped to stop per-user-per-click spend (cost rule 1).
export const TIER_CAPS = {
  free: {
    analyse:                30,   // Haiku job scoring (strategies 1+2)
    analyse_search:         3,    // Sonnet web-search fallback (strategy 3)
    cv:                     1,    // CV generation
    cover_letter:           0,    // Not on Free
    interview_prep:         0,    // Not on Free
    negotiation_prep:       0,    // Not on Free
    recruiter_search:       0,    // Sonnet + web_search (most expensive call) — Pro/Max only
    feed_fresh_scan:        0,    // Free reads the shared nightly cache only, no live scans
    parse_career_history:   5,    // Haiku CV-to-structured-history parse (onboarding + re-parse)
    web_search:             3,    // Shared cross-feature ceiling — see comment below. Matches
                                   // Free's only existing web_search grant (analyse_search), so
                                   // this is a pure ceiling on what already exists, not a new grant.
    cv_lint:                5,    // Stage 65 — cheap Haiku keyword-match rider on 'cv'; sized
                                   // above every tier's 'cv' cap so it never blocks the lint on a
                                   // legitimate generation, only spam of the lint call itself.
    cv_questions:           5,    // Stage 65 — cheap Haiku two-phase clarifying-questions call.
    interview_prep_live:    0,    // Stage 67 — Not on Free, same gate as interview_prep itself.
    referral_draft:         0,    // Stage 69 — Haiku referral/outreach message drafting. Not on Free.
  },
  trial: {
    analyse:                1000,
    analyse_search:         60,
    cv:                     20,
    cover_letter:           20,
    interview_prep:         8,
    negotiation_prep:       8,
    recruiter_search:       5,    // per MONTH
    feed_fresh_scan:        3,    // per DAY
    parse_career_history:   30,
    web_search:             30,   // mirrors pro, same convention as every other action here
    cv_lint:                30,
    cv_questions:           30,
    interview_prep_live:    40,   // Stage 67 — cheap Haiku Live-mode free-text fallback, deliberately
                                   // far more generous than interview_prep's own 8/month cap since a
                                   // single interview can mean many quick-tap questions in one sitting.
    referral_draft:         20,   // Stage 69 — cheap Haiku message drafting; naturally self-limiting
                                   // (a handful of real contacts per role, not hundreds).
  },
  pro: {
    analyse:                1000,
    analyse_search:         60,
    cv:                     20,
    cover_letter:           20,
    interview_prep:         8,
    negotiation_prep:       8,
    recruiter_search:       5,    // per MONTH — five is a real search; nobody needs thirty recruiters
    feed_fresh_scan:        3,    // per DAY
    parse_career_history:   30,
    web_search:             30,
    cv_lint:                30,
    cv_questions:           30,
    interview_prep_live:    40,
    referral_draft:         20,
  },
  max: {
    analyse:                3000,
    analyse_search:         200,
    cv:                     60,
    cover_letter:           60,
    interview_prep:         30,
    negotiation_prep:       30,
    recruiter_search:       20,   // per MONTH
    feed_fresh_scan:        10,   // per DAY
    parse_career_history:   60,
    web_search:             60,
    cv_lint:                60,
    cv_questions:           60,
    interview_prep_live:    100,
    referral_draft:         50,
  },
}

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
