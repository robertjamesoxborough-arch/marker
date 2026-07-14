/**
 * Fixture tests for lib/uk-eligibility.js
 * Run: node lib/uk-eligibility.test.js
 * Focus: allowlist-wins logic — "Remote" kept, "Remote - US" rejected — plus
 * the ambiguous cases that are easy to get wrong.
 */

const { isUkEligible } = require('./uk-eligibility')

let passed = 0
let failed = 0

function assert(label, location, expected) {
  const actual = isUkEligible(location)
  const ok = actual === expected
  if (ok) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.log(`  FAIL  ${label}`)
    console.log(`        → isUkEligible(${JSON.stringify(location)}) expected ${expected}, got ${actual}`)
    failed++
  }
}

console.log('\nGroup 1: plain UK locations — kept')
assert('London', 'London', true)
assert('Manchester, UK', 'Manchester, UK', true)
assert('United Kingdom', 'United Kingdom', true)
assert('empty string', '', true)

console.log('\nGroup 2: bare remote — kept (feeds are GB-scoped)')
assert('Remote', 'Remote', true)
assert('Remote (UK)', 'Remote (UK)', true)

console.log('\nGroup 3: remote pinned to a non-UK region — rejected')
assert('Remote - US', 'Remote - US', false)
assert('Remote (Americas)', 'Remote (Americas)', false)
assert('Remote, USA', 'Remote, USA', false)
assert('Remote (EMEA only)', 'Remote (EMEA only)', false)
assert('Remote - Canada', 'Remote - Canada', false)

console.log('\nGroup 4: UK signal wins even when a non-UK place is also named')
assert('London or New York', 'London or New York', true)
assert('UK, or Berlin', 'UK, or Berlin', true)

console.log('\nGroup 5: explicit non-UK place, no UK signal — rejected')
assert('Dublin', 'Dublin', false)
assert('Berlin, Germany', 'Berlin, Germany', false)
assert('San Francisco, CA', 'San Francisco, CA', false)
assert('Sydney, Australia', 'Sydney, Australia', false)
assert('Mumbai, India', 'Mumbai, India', false)

console.log('\nGroup 6: ambiguous, no foreign signal — kept')
assert('EMEA', 'EMEA', true)
assert('Global', 'Global', true)
assert('Worldwide', 'Worldwide', true)

console.log('\nGroup 7: real English place names that collide with US city names — kept')
assert('Weston, Portland (Dorset)', 'Weston, Portland', true)
assert('Fortuneswell, Portland', 'Fortuneswell, Portland', true)
assert('New York, near Lincoln', 'New York, Lincoln', true)
// Known trade-off: a bare "New York" or "Portland" with no country qualifier is now kept
// (see the comment above NON_UK_LOCS in uk-eligibility.js) rather than rejected — but an
// explicit country/state signal alongside it still correctly rejects.
assert('New York, USA — still rejected via "usa"', 'New York, USA', false)
assert('Portland, Oregon — still rejected via "oregon"', 'Portland, Oregon', false)

console.log(`\n${passed} passed | ${failed} failed | ${passed + failed} total`)
if (failed > 0) process.exit(1)
