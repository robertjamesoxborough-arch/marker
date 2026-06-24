/**
 * Fixture tests for lib/freshness.js
 * Run: node lib/freshness.test.js
 * Tests G2 invariant: read-time enforcement, sort/filter behaviour, determinism.
 */

const { computeFreshnessState, relativeTime, applyFreshnessToRow, filterAndSortByFreshness } = require('./freshness')

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = actual === expected
  if (ok) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.log(`  FAIL  ${label}`)
    console.log(`        → expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    failed++
  }
}

const NOW = new Date('2026-06-24T12:00:00Z')
const ago = (days) => new Date(NOW - days * 86400000).toISOString()

// ── Group 1: threshold boundaries ────────────────────────────────────────────
console.log('\nGroup 1: computeFreshnessState — threshold boundaries')
assert('1h old → Fresh',    computeFreshnessState(ago(1 / 24), NOW), 'Fresh')
assert('36h old → Fresh',   computeFreshnessState(ago(1.5),    NOW), 'Fresh')
assert('3d old → Aging',    computeFreshnessState(ago(3),      NOW), 'Aging')
assert('10d old → Stale',   computeFreshnessState(ago(10),     NOW), 'Stale')
assert('20d old → Expired', computeFreshnessState(ago(20),     NOW), 'Expired')
assert('null → Stale',      computeFreshnessState(null,        NOW), 'Stale')

// ── Group 2: G2 invariant — DB freshness is OVERRIDDEN at read time ──────────
console.log('\nGroup 2: G2 read-time invariant (DB column ignored)')
const staleTenDay = applyFreshnessToRow({ last_verified_at: ago(10), freshness: 'Fresh' }, NOW)
assert('10d old + DB says Fresh → Stale after apply', staleTenDay.freshness, 'Stale')

const expiredRow = applyFreshnessToRow({ last_verified_at: ago(20), freshness: 'Fresh' }, NOW)
assert('20d old + DB says Fresh → Expired after apply', expiredRow.freshness, 'Expired')

const freshRow = applyFreshnessToRow({ last_verified_at: ago(1), freshness: 'Stale' }, NOW)
assert('1d old + DB says Stale → Fresh after apply', freshRow.freshness, 'Fresh')

// relativeTime attached
assert('applyFreshnessToRow attaches relativeTime', typeof staleTenDay.relativeTime === 'string', true)

// ── Group 3: filterAndSortByFreshness ─────────────────────────────────────────
console.log('\nGroup 3: filterAndSortByFreshness — exclude/sort/showExpired')
const rows = [
  { id: 'exp',   freshness: 'Expired' },
  { id: 'stale', freshness: 'Stale' },
  { id: 'fresh', freshness: 'Fresh' },
  { id: 'aging', freshness: 'Aging' },
]

const defaultView = filterAndSortByFreshness(rows, {})
assert('Default: Expired excluded',           defaultView.some(r => r.id === 'exp'), false)
assert('Default: 3 rows remain',              defaultView.length, 3)
assert('Default: Fresh is first',             defaultView[0].id, 'fresh')
assert('Default: Aging is second',            defaultView[1].id, 'aging')
assert('Default: Stale is last',              defaultView[2].id, 'stale')

const expiredView = filterAndSortByFreshness(rows, { showExpired: true })
assert('showExpired: Expired included',       expiredView.some(r => r.id === 'exp'), true)
assert('showExpired: 4 rows',                 expiredView.length, 4)
assert('showExpired: Expired is last',        expiredView[expiredView.length - 1].id, 'exp')

// ── Group 4: determinism ──────────────────────────────────────────────────────
console.log('\nGroup 4: Determinism — same inputs produce same output')
const r1 = JSON.stringify(computeFreshnessState(ago(10), NOW))
const r2 = JSON.stringify(computeFreshnessState(ago(10), NOW))
assert('computeFreshnessState is deterministic', r1 === r2, true)

const a1 = JSON.stringify(applyFreshnessToRow({ last_verified_at: ago(3), freshness: 'Fresh' }, NOW))
const a2 = JSON.stringify(applyFreshnessToRow({ last_verified_at: ago(3), freshness: 'Fresh' }, NOW))
assert('applyFreshnessToRow is deterministic', a1 === a2, true)

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`)
console.log(`${'─'.repeat(50)}\n`)
process.exit(failed > 0 ? 1 : 0)
