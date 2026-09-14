/**
 * Fixture tests for lib/job-match.js
 * Run: node lib/job-match.test.js
 * Focus: the exact acceptance cases from the Stage 58 brief -- (a) an exact
 * duplicate, (b) the same job via a different URL/source (no shared
 * external id, only company+title+location), (c) a genuinely different job
 * at the same company (must NOT match) -- plus the normaliser edge cases
 * that would otherwise produce a false positive or false negative.
 */

const { normaliseCompany, normaliseTitle, normaliseLocation, titleSimilarity, matchJob } = require('./job-match')

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.log(`  FAIL  ${label}`)
    console.log(`        expected: ${JSON.stringify(expected)}`)
    console.log(`        got:      ${JSON.stringify(actual)}`)
    failed++
  }
}

console.log('\nGroup 1: normaliseCompany — suffix stripping')
assert('Monzo Bank Ltd -> monzo', normaliseCompany('Monzo Bank Ltd'), 'monzo')
assert('NatWest Group plc -> natwest', normaliseCompany('NatWest Group plc'), 'natwest')
assert('The Guardian Media Group -> guardian media', normaliseCompany('The Guardian Media Group'), 'guardian media')
assert('Barclays Bank UK PLC -> barclays', normaliseCompany('Barclays Bank UK PLC'), 'barclays')
assert('already-plain stays plain', normaliseCompany('Deliveroo'), 'deliveroo')

console.log('\nGroup 2: normaliseTitle — variant collapsing')
assert('Sr. Product Manager -> senior product manager', normaliseTitle('Sr. Product Manager'), 'senior product manager')
assert('Marketing Mgr -> marketing manager', normaliseTitle('Marketing Mgr'), 'marketing manager')
assert('R&D Lead -> r and d lead', normaliseTitle('R&D Lead'), 'r and d lead')
assert('exact same after case/punct differ', normaliseTitle('Registered Nurse (RN)'), normaliseTitle('registered nurse rn'))

console.log('\nGroup 3: normaliseLocation — country suffix stripping')
assert('Manchester, UK -> manchester', normaliseLocation('Manchester, UK'), 'manchester')
assert('London, England -> london', normaliseLocation('London, England'), 'london')

console.log('\nGroup 4: titleSimilarity')
assert('identical -> 1', titleSimilarity('Product Manager', 'Product Manager'), 1)
assert('completely different -> 0', titleSimilarity('Product Manager', 'Registered Nurse'), 0)
assert('partial overlap is between 0 and 1', titleSimilarity('Senior Product Manager', 'Product Manager') > 0 && titleSimilarity('Senior Product Manager', 'Product Manager') < 1, true)

console.log('\nGroup 5: matchJob — acceptance case (a) EXACT duplicate (identical everything)')
const pipelineRecords = [
  { id: 'p1', source: 'pipeline', status: 'applied', company: 'Monzo Bank Ltd', roleTitle: 'Senior Product Manager', roleTitleRaw: 'Senior Product Manager', location: 'London, UK', externalId: 'adzuna-111' },
  { id: 'p2', source: 'pipeline', status: 'considering', company: 'Deliveroo', roleTitle: 'Data Analyst', location: 'London', externalId: null },
]
const dismissedRecords = [
  { id: 'd1', source: 'dismissed', company: 'NatWest Group', roleTitle: 'Business Analyst', location: 'Manchester', externalId: null },
]
const allRecords = [...pipelineRecords, ...dismissedRecords]

const exactDup = { company: 'Monzo Bank Ltd', roleTitle: 'Senior Product Manager', location: 'London, UK', externalId: 'adzuna-111' }
const m1 = matchJob(exactDup, allRecords)
assert('(a) exact duplicate -> STRONG, matched to p1', m1?.tier, 'strong')
assert('(a) matched record is p1', m1?.record?.id, 'p1')

console.log('\nGroup 6: matchJob — acceptance case (b) same job, different source/URL, same external listing id absent')
const sameJobDifferentSource = { company: 'Monzo Bank Limited', roleTitle: 'Senior Product Manager', location: 'London', externalId: 'indeed-xyz-999' }
const m2 = matchJob(sameJobDifferentSource, allRecords)
assert('(b) different external id, but company+title+location match -> STRONG', m2?.tier, 'strong')
assert('(b) matched record is p1', m2?.record?.id, 'p1')

console.log('\nGroup 7: matchJob — acceptance case (c) genuinely different job, same company -> must NOT match')
const differentJobSameCompany = { company: 'Monzo Bank Ltd', roleTitle: 'Backend Engineer', location: 'London', externalId: 'adzuna-222' }
const m3 = matchJob(differentJobSameCompany, allRecords)
assert('(c) different role at same company -> no match', m3, null)

console.log('\nGroup 8: SOFT tier — same company+title, location differs or missing')
const sameRoleDifferentLocation = { company: 'Monzo Bank Ltd', roleTitle: 'Senior Product Manager', location: 'Manchester', externalId: null }
const m4 = matchJob(sameRoleDifferentLocation, allRecords)
assert('same company+title, different location -> SOFT', m4?.tier, 'soft')

const noLocationGiven = { company: 'Monzo Bank Ltd', roleTitle: 'Senior Product Manager', location: '', externalId: null }
const m5 = matchJob(noLocationGiven, allRecords)
assert('same company+title, no location given -> SOFT (never asserted as strong without confirming location)', m5?.tier, 'soft')

console.log('\nGroup 9: SOFT tier — same company, fuzzy-similar title')
const similarTitle = { company: 'Monzo Bank Ltd', roleTitle: 'Product Manager, Senior', location: 'London', externalId: null }
const m6 = matchJob(similarTitle, allRecords)
assert('similar but non-exact title, same company -> SOFT', m6?.tier, 'soft')

console.log('\nGroup 10: dismissed record matches too, not just pipeline')
const dismissedDup = { company: 'NatWest Group plc', roleTitle: 'Business Analyst', location: 'Manchester', externalId: null }
const m7 = matchJob(dismissedDup, allRecords)
assert('exact dup of a dismissed record -> STRONG, matched to d1', m7?.tier, 'strong')
assert('matched record source is dismissed', m7?.record?.source, 'dismissed')

console.log('\nGroup 11: completely unrelated job -> no match at all')
const unrelated = { company: 'Spotify', roleTitle: 'UX Researcher', location: 'Stockholm', externalId: null }
assert('unrelated company -> no match', matchJob(unrelated, allRecords), null)

console.log('\nGroup 12: same external id alone is enough even if company/title text differs (e.g. a company rename)')
const sameIdDifferentText = { company: 'Monzo Bank (rebranded)', roleTitle: 'Senior PM', location: 'Remote', externalId: 'adzuna-111' }
const m8 = matchJob(sameIdDifferentText, allRecords)
assert('same external id -> STRONG regardless of text drift', m8?.tier, 'strong')

console.log('\nGroup 13: empty/no records -> no match, no crash')
assert('empty records array', matchJob(exactDup, []), null)
assert('null records', matchJob(exactDup, null), null)
assert('candidate missing company -> no match possible', matchJob({ roleTitle: 'Senior Product Manager', location: 'London' }, allRecords), null)

console.log(`\n${'─'.repeat(52)}\n  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total\n${'─'.repeat(52)}`)
process.exit(failed > 0 ? 1 : 0)
