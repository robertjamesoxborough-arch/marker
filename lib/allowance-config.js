/**
 * lib/allowance-config.js — pure, dependency-free CJS holding the tier caps
 * and spend-ceiling constants, split out of lib/allowance.js (Stage 77) for
 * the same reason usage-window.js was split out: lib/allowance.js itself
 * imports @supabase/supabase-js, which means it can only be loaded inside
 * the Next.js build/runtime, not under plain `node`. These constants have
 * no such dependency, so keeping them here lets lib/allowance.test.js
 * actually run them under `node lib/allowance.test.js`.
 */

// Action caps per tier. Cap 0 = feature not available on this tier (hard block).
// Most actions reset MONTHLY. feed_fresh_scan resets DAILY (see usage-window.js)
// — it is the Pro/Max "Fresh scan" button that triggers a live board fetch, so
// it is deliberately day-capped to stop per-user-per-click spend (cost rule 1).
const TIER_CAPS = {
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
    cv_gap_analysis:        5,    // Stage 77 (Audit Stage 2, L7) — cheap Haiku gap-analysis rider on
                                   // 'cv', same reasoning and sizing as cv_lint above: was previously
                                   // tracked but had NO cap entry at all, so nothing bounded it but
                                   // the 'cv' cap itself. Sized above 'cv' so it never blocks a
                                   // legitimate generation.
    interview_prep_live:    0,    // Stage 67 — Not on Free, same gate as interview_prep itself.
    referral_draft:         0,    // Stage 69 — Haiku referral/outreach message drafting. Not on Free.
    tidy_up:                0,    // Stage 77 (Audit Stage 2, L2) — Help me tidy up. Not on Free,
                                   // same gate as its own tier check in the route.
    wishlist_generate:      10,   // Stage 77 (Audit Stage 2, L6) — cheap Haiku wishlist-suggestion
                                   // rider; previously had NO cap and NO usage tracking at all.
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
    cv_gap_analysis:        30,
    interview_prep_live:    40,   // Stage 67 — cheap Haiku Live-mode free-text fallback, deliberately
                                   // far more generous than interview_prep's own 8/month cap since a
                                   // single interview can mean many quick-tap questions in one sitting.
    referral_draft:         20,   // Stage 69 — cheap Haiku message drafting; naturally self-limiting
                                   // (a handful of real contacts per role, not hundreds).
    tidy_up:                200,  // Stage 77 — one tidy-up SESSION (the whole 8-turn conversation +
                                   // the final Sonnet resort) counts as one use of this cap, checked
                                   // on every call within the session, not just the first. Sized
                                   // generously since a genuine session is one thing a user does,
                                   // not eight; this bounds abuse, not normal use.
    wishlist_generate:      30,
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
    cv_gap_analysis:        30,
    interview_prep_live:    40,
    referral_draft:         20,
    tidy_up:                200,
    wishlist_generate:      30,
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
    cv_gap_analysis:        60,
    interview_prep_live:    100,
    referral_draft:         50,
    tidy_up:                400,
    wishlist_generate:      60,
  },
}

// PER-USER MONTHLY SPEND CEILING (Stage 77, following the Audit Stage 2
// worst-case cost model). Every action above is a plain COUNT cap, but
// actions vary in real cost by roughly 350x -- interview_prep_live is
// ~£0.003/call, interview_prep with web_search is up to ~£0.31/call -- so a
// count cap alone cannot bound spend. The audit found every plan's worst
// case AT ITS OWN PUBLISHED CAPS runs a loss (Pro -£1.09, Max -£16.93,
// before counting any of the leaks it also found). This is the backstop:
// an invisible per-tier £ ceiling, summed from the cost_estimate_gbp every
// ai_usage row already carries, checked before every billable action in
// ADDITION to that action's own count cap. It changes no published
// count cap and no pricing page copy -- a genuine user at realistic usage
// (Pro ~£4.78/mo, Max ~£12.84/mo, both measured/modelled in the audit)
// never gets near it.
//
// Numbers, and the reasoning behind each:
//   free  £2   -- Free earns £0, so this exists purely to bound abuse of a
//                 zero-revenue tier. Comfortably above realistic use
//                 (~£0.92/mo modelled) but far below what looping every
//                 capped action would cost if every leak were still open.
//   trial £5   -- Trial mirrors Pro's caps exactly, and the 7-day window
//                 is the one place a bare signup (no payment) reaches
//                 Pro-level limits -- the audit's L2 finding was reached
//                 this way. Deliberately tighter than Pro's own ceiling:
//                 £5 over 7 days is still ~4x realistic Pro usage prorated
//                 to a week (~£1.11), so it never bites a genuine trial,
//                 but it caps what a scripted signup can extract before
//                 the account either converts or the trial simply ends.
//   pro   £8   -- Sits at 42% of the £19 price (58% worst-case margin),
//                 and at 1.7x realistic Pro usage (£4.78) -- headroom for a
//                 genuinely heavy month without ever being reachable by
//                 normal use.
//   max   £17  -- Sits at 44% of the £39 price (56% worst-case margin),
//                 and at 1.3x realistic Max usage (£12.84).
//
// These numbers were proposed with full reasoning shown before being
// finalised, exactly as requested; they are plain constants specifically so
// they are trivial to revisit if real usage data (once there is real
// paying-user volume to look at) suggests a different number.
const SPEND_CEILING_GBP = {
  free:  2,
  trial: 5,
  pro:   8,
  max:   17,
}

// Shared user-facing copy for the spend-ceiling block, so every route that
// hits it says the same clear thing rather than each inventing its own
// wording. Every route's error-message logic checks `result.spendExceeded`
// first, before its own cap/count-based message, since a spend block can
// fire even when the specific action's own count cap still has room left.
const SPEND_CEILING_MESSAGE =
  "You've reached this month's usage limit. This resets on the 1st, or upgrade for more."

module.exports = { TIER_CAPS, SPEND_CEILING_GBP, SPEND_CEILING_MESSAGE }
