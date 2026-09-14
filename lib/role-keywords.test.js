/**
 * Fixture tests for lib/role-keywords.js
 * Run: node lib/role-keywords.test.js
 * Focus: the sector-agnostic title matcher, including the stemWord fallback
 * added in Stage 68 after a real cross-profession stress test found it
 * missing genuinely identical professions purely on English suffix
 * variation ("Marine Pilotage" vs "Harbour Pilot") — this is a general
 * word-form fix, not a profession-specific one, so the cases below
 * deliberately span unrelated fields to prove that.
 */

const { titleMatchesRoleKeywords, stemWord } = require('./role-keywords')

let passed = 0
let failed = 0

function assert(label, title, targetRoles, expected) {
  const actual = titleMatchesRoleKeywords(title, targetRoles)
  const ok = actual === expected
  if (ok) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.log(`  FAIL  ${label}`)
    console.log(`        → titleMatchesRoleKeywords(${JSON.stringify(title)}, ${JSON.stringify(targetRoles)}) expected ${expected}, got ${actual}`)
    failed++
  }
}

console.log('\nGroup 1: exact phrase match — always true regardless of field')
assert('exact phrase, trades', 'Qualified Electrician', ['Qualified Electrician'], true)
assert('exact phrase, clinical', 'Registered Nurse', ['Registered Nurse'], true)

console.log('\nGroup 2: shared verbatim keyword — always true')
assert('shared word, office', 'Senior Partnerships Manager', ['Partnerships'], true)
assert('shared word, logistics', 'Warehouse Operations Manager', ['Warehouse Manager'], true)

console.log('\nGroup 3: word-form mismatch — the real Stage 68 stress-test failures, now fixed by stemWord')
assert('bookkeeping vs bookkeeper', 'Part-Time Bookkeeper', ['Bookkeeping'], true)
assert('arboricultural consulting vs consultant arborist', 'Consultant Arborist', ['Arboricultural Consulting'], true)
assert('marine pilotage vs harbour pilot', 'Harbour Pilot', ['Marine Pilotage'], true)
assert('reverse direction also holds', 'Marine Pilotage Officer', ['Harbour Pilot'], true)

console.log('\nGroup 4: genuinely unrelated professions — still correctly false')
assert('unrelated: gardener vs software engineer', 'Software Engineer', ['Garden Design'], false)
assert('unrelated: court reporter vs marine pilot', 'Harbour Pilot', ['Court Reporting'], false)

console.log('\nGroup 5: stemWord itself — spot checks')
console.log(`  bookkeeping -> ${stemWord('bookkeeping')}, bookkeeper -> ${stemWord('bookkeeper')}`)
console.log(`  consulting -> ${stemWord('consulting')}, consultant -> ${stemWord('consultant')}`)
console.log(`  pilotage -> ${stemWord('pilotage')}, pilot -> ${stemWord('pilot')}`)
assert('stem-equal: bookkeeping/bookkeeper', 'bookkeeper', ['bookkeeping'], true)

console.log(`\n${passed} passed | ${failed} failed | ${passed + failed} total`)
if (failed > 0) process.exit(1)
