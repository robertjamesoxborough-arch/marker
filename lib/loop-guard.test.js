/**
 * Fixture tests for lib/loop-guard.js
 * Run: node lib/loop-guard.test.js
 * Tests G3 invariant: loop guard fires on near-identical responses,
 * doesn't fire on genuinely different responses.
 */

const { checkForLoop } = require('./loop-guard')

let passed = 0, failed = 0

function assert(label, actual, expected) {
  const ok = actual === expected
  if (ok) { console.log(`  PASS  ${label}`); passed++ }
  else {
    console.log(`  FAIL  ${label}`)
    console.log(`        → expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    failed++
  }
}

const RESPONSE_A = 'This is a great opportunity for a partnerships manager with EMEA experience and strong B2B skills. The role requires managing strategic alliances and driving revenue growth across multiple territories.'
const RESPONSE_C = 'This position focuses on sales and business development in the US market. It is a quota-carrying role with commission structure. No partnerships or alliance management required.'

// ── Group 1: Loop detection ──────────────────────────────────────────────────
console.log('\nGroup 1: Loop detection — identical and near-identical text')
const exact = checkForLoop(RESPONSE_A, RESPONSE_A)
assert('Identical texts → isLoop=true',       exact.isLoop,        true)
assert('Identical texts → similarity=1',       exact.similarity,    1)

// Near-identical: one-word swap — Jaccard ~0.93, should loop
const nearSame = checkForLoop(
  RESPONSE_A,
  RESPONSE_A.replace('great', 'excellent')
)
assert('Near-identical (one-word swap, >85%) → isLoop=true', nearSame.isLoop, true)

// Different text — should not loop
const different = checkForLoop(RESPONSE_A, RESPONSE_C)
assert('Different texts → isLoop=false',      different.isLoop,    false)
assert('Different texts → low similarity',    different.similarity < 0.5, true)

// ── Group 2: Edge cases ──────────────────────────────────────────────────────
console.log('\nGroup 2: Edge cases')
assert('Empty new → isLoop=false',            checkForLoop('', RESPONSE_A).isLoop,         false)
assert('Empty prior → isLoop=false',          checkForLoop(RESPONSE_A, '').isLoop,          false)
assert('Both null → isLoop=false',            checkForLoop(null, null).isLoop,              false)
assert('Null new → isLoop=false',             checkForLoop(null, RESPONSE_A).isLoop,        false)
assert('Single word identical → isLoop=true', checkForLoop('hello', 'hello').isLoop,        true)

// ── Group 3: Custom threshold ───────────────────────────────────────────────
console.log('\nGroup 3: Threshold parameter respected')
// At threshold 0.70, identical text still fires
assert('threshold=0.70: identical → fires',   checkForLoop(RESPONSE_A, RESPONSE_A, 0.70).isLoop, true)
// At threshold 0.99, near-identical text may not fire (depends on text)
// Use a genuinely 50% similar pair to test threshold cutoff
const mediumText = 'This is a great opportunity for a partnerships manager.'
const similarText = 'This is a strong opportunity for a partnerships director and leader.'
const looseFire   = checkForLoop(mediumText, similarText, 0.50)
const strictFail  = checkForLoop(mediumText, similarText, 0.99)
assert('threshold=0.50: fires on medium similarity', looseFire.isLoop,  true)
assert('threshold=0.99: does not fire on medium similarity', strictFail.isLoop, false)

// ── Group 4: G3 structural fallback proof ───────────────────────────────────
console.log('\nGroup 4: G3 invariant — guard would serve structured fallback on loop')
// This simulates what the route does: if isLoop → return fallback, not the repeat
function simulateRoute(newResp, priorResp) {
  const { isLoop } = checkForLoop(newResp, priorResp)
  if (isLoop) {
    return { fallback: true, message: 'Loop detected — structured fallback served', loopDetected: true }
  }
  return { fallback: false, message: newResp }
}

const loopResult  = simulateRoute(RESPONSE_A, RESPONSE_A)
const freshResult = simulateRoute(RESPONSE_A, RESPONSE_C)
assert('Loop detected → fallback served (not the repeat)',  loopResult.fallback,  true)
assert('Loop detected → loopDetected flag set',             loopResult.loopDetected, true)
assert('Fresh response → not flagged as fallback',          freshResult.fallback, false)
assert('Fresh response → actual content returned',          freshResult.message === RESPONSE_A, true)

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`)
console.log(`${'─'.repeat(50)}\n`)
process.exit(failed > 0 ? 1 : 0)
