/**
 * lib/allowance.test.js — run with `node lib/allowance.test.js`.
 *
 * checkAllowance() itself needs a live Supabase service-role client (see
 * usage-window.js's own note on why the pure maths were split out into a
 * separate, dependency-free file), so this only covers what's genuinely
 * testable without a DB round-trip: the shape and sanity of the constants
 * added in Stage 77 (Audit Stage 2 cost-hardening) -- SPEND_CEILING_GBP,
 * the new TIER_CAPS entries (tidy_up, cv_gap_analysis, wishlist_generate),
 * the shared error message, and (Stage 81) resolveTier(), which IS pure
 * and dependency-free and so gets real, direct coverage below rather than
 * only a live self-test. Imported from lib/allowance-config.js, where
 * these now actually live (split out of lib/allowance.js for exactly this
 * reason -- that file pulls in @supabase/supabase-js and can't load under
 * plain node). The actual spend-ceiling QUERY logic, the tidy-up per-call
 * gating, and the check-links caps were verified live against production
 * as part of prior sessions (see PROGRESS.md Stage 77) rather than mocked
 * here.
 */
const { SPEND_CEILING_GBP, SPEND_CEILING_MESSAGE, TIER_CAPS, resolveTier } = require('./allowance-config')

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg) }
  else { console.log('  ❌ ' + msg); failures++ }
}

console.log('Allowance constants — self-test\n')

// ── SPEND_CEILING_GBP shape and sanity ──────────────────────────────
console.log('SPEND_CEILING_GBP')
for (const tier of ['free', 'trial', 'pro', 'max']) {
  assert(typeof SPEND_CEILING_GBP[tier] === 'number' && SPEND_CEILING_GBP[tier] > 0, `${tier} has a positive ceiling`)
}
const PRICE = { pro: 19, max: 39 }
for (const tier of ['pro', 'max']) {
  assert(SPEND_CEILING_GBP[tier] < PRICE[tier], `${tier} ceiling (£${SPEND_CEILING_GBP[tier]}) sits below its price (£${PRICE[tier]}), never zero worst-case margin`)
  const marginPct = (PRICE[tier] - SPEND_CEILING_GBP[tier]) / PRICE[tier]
  assert(marginPct >= 0.4, `${tier} worst-case margin at the ceiling is >= 40% (actual ${(marginPct * 100).toFixed(0)}%)`)
}
assert(SPEND_CEILING_GBP.trial < SPEND_CEILING_GBP.pro, 'trial ceiling is tighter than Pro\'s own, since trial needs no payment to reach Pro-level caps')
assert(SPEND_CEILING_GBP.free < SPEND_CEILING_GBP.trial, 'free ceiling is the tightest, since it earns £0')

// ── SPEND_CEILING_MESSAGE ───────────────────────────────────────────
console.log('\nSPEND_CEILING_MESSAGE')
assert(typeof SPEND_CEILING_MESSAGE === 'string' && SPEND_CEILING_MESSAGE.length > 10, 'is a real, non-trivial string')
assert(SPEND_CEILING_MESSAGE.toLowerCase().includes('1st'), 'mentions the reset date, per the "resets on the 1st" requirement')

// ── New TIER_CAPS entries (Stage 77) ────────────────────────────────
console.log('\nNew TIER_CAPS entries')
for (const tier of ['free', 'trial', 'pro', 'max']) {
  for (const action of ['tidy_up', 'cv_gap_analysis', 'wishlist_generate']) {
    assert(typeof TIER_CAPS[tier][action] === 'number', `TIER_CAPS.${tier}.${action} is defined (was previously untracked or absent)`)
  }
}
assert(TIER_CAPS.free.tidy_up === 0, 'tidy_up stays hard-blocked on Free (matches the route\'s own tier gate)')
assert(TIER_CAPS.free.wishlist_generate > 0, 'wishlist_generate has a real Free cap now (was previously uncapped AND untracked)')
// cv_gap_analysis and cv_lint are both cheap Haiku riders on 'cv', sized the
// same way for the same reason (never block a legitimate generation) -- they
// should track each other, not drift apart by accident.
for (const tier of ['free', 'trial', 'pro', 'max']) {
  assert(TIER_CAPS[tier].cv_gap_analysis === TIER_CAPS[tier].cv_lint, `${tier}: cv_gap_analysis cap matches cv_lint's sizing convention`)
}

// ── resolveTier (Stage 81 fix) ───────────────────────────────────────
console.log('\nresolveTier — the trial-tier dead-code fix')
const NOW = new Date('2026-09-22T12:00:00Z')
const future = '2026-09-25T12:00:00Z' // 3 days ahead of NOW
const past   = '2026-09-01T12:00:00Z' // long expired

assert(
  resolveTier({ tier: 'free', trial_ends_at: future }, NOW) === 'trial',
  'free + active trial_ends_at resolves to trial (the bug: this used to always read free)'
)
assert(
  resolveTier({ tier: 'free', trial_ends_at: past }, NOW) === 'free',
  'free + expired trial_ends_at resolves to free'
)
assert(
  resolveTier({ tier: 'free', trial_ends_at: null }, NOW) === 'free',
  'free + no trial_ends_at at all resolves to free'
)
assert(
  resolveTier({ tier: 'pro', trial_ends_at: future }, NOW) === 'pro',
  'a stored PAID tier (pro) always wins over trial_ends_at -- a real paying customer is never downgraded by a stale trial date'
)
assert(
  resolveTier({ tier: 'max', trial_ends_at: future }, NOW) === 'max',
  'a stored PAID tier (max) always wins over trial_ends_at, same as pro'
)
assert(
  resolveTier(null, NOW) === 'free',
  'a missing user row resolves to free (fail to the safe default, not throw)'
)
assert(
  resolveTier({ tier: null, trial_ends_at: future }, NOW) === 'trial',
  'a null tier column (not just the "free" default) with an active trial still resolves to trial'
)

console.log(`\n${failures === 0 ? '✅' : '❌'} ${failures} failure(s)\n`)
process.exit(failures === 0 ? 0 : 1)
