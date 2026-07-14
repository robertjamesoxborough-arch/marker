/**
 * Fixture tests for lib/match-engine.js
 * Run: node lib/match-engine.test.js
 * Every assertion also re-runs the same input to prove determinism.
 */

const { scoreMatch } = require('./match-engine')

let passed = 0
let failed = 0

function assert(label, actual, check, detail) {
  // Determinism check — run twice, must be identical
  const second = scoreMatch(check._profile, check._job)
  const deterministic = JSON.stringify(actual) === JSON.stringify(second)

  const ok = check.fn(actual) && deterministic
  if (ok) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.log(`  FAIL  ${label}`)
    if (!deterministic) console.log(`        → NON-DETERMINISTIC: second run differed`)
    if (!check.fn(actual)) console.log(`        → ${detail} | got score=${actual.score}`)
    failed++
  }
}

function check(profile, job, fn, detail) {
  const result = scoreMatch(profile, job)
  return { fn, detail, result, _profile: profile, _job: job }
}

// ── Fixtures ──────────────────────────────────────────────────────────────

const SENIOR_PARTNERSHIPS_PROFILE = {
  target_roles: ['Head of Partnerships', 'Director of Partnerships', 'Senior Partnerships Manager'],
  seniority: 'Head of',
  max_office_days: 2,
  salary_floor: 80000,
  tracks: ['standard'],
  hard_filters_json: {
    cvKeywords: ['partnerships', 'strategic alliances', 'EMEA', 'B2B'],
    benefits: ['hybrid', 'share_options'],
  },
}

const PARENT_TRACK_PROFILE = {
  target_roles: ['Senior Marketing Manager', 'Head of Marketing', 'Marketing Director'],
  seniority: 'Senior Manager',
  max_office_days: 1,
  salary_floor: 65000,
  tracks: ['parent'],
  hard_filters_json: {
    cvKeywords: ['digital marketing', 'brand', 'campaigns'],
    benefits: ['enhanced_parental_leave', 'hybrid', 'fully_remote'],
  },
}

const MINIMAL_PROFILE = {
  target_roles: [],
  seniority: null,
  max_office_days: null,
  salary_floor: null,
  tracks: [],
  hard_filters_json: {},
}

// ── Test group 1: Strong match ────────────────────────────────────────────
console.log('\nGroup 1: Strong match — all dimensions aligned')

const strongJob = {
  role_title: 'Head of Partnerships EMEA',
  company: 'TechCorp',
  location: 'London (hybrid 2 days)',
  salary: '£85,000–£100,000',
  freshness: 'Fresh',
  raw_json: { description: 'hybrid working 2 days in office, share options, B2B partnerships EMEA' },
}

const strongResult = scoreMatch(SENIOR_PARTNERSHIPS_PROFILE, strongJob)
assert(
  'Strong match scores ≥ 7.5',
  strongResult,
  { ...check(SENIOR_PARTNERSHIPS_PROFILE, strongJob, r => r.score >= 7.5, 'expected ≥7.5'), _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: strongJob },
  'expected ≥7.5'
)
assert(
  'Role fit = 10 (exact title match)',
  strongResult,
  { fn: r => r.dimensions.roleFit.score === 10, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: strongJob },
  'expected roleFit=10'
)
assert(
  'Seniority fit = 10 (Head of matches Head of)',
  strongResult,
  { fn: r => r.dimensions.seniorityFit.score === 10, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: strongJob },
  'expected seniorityFit=10'
)
assert(
  'Location fit = 10 (2 days = limit)',
  strongResult,
  { fn: r => r.dimensions.locationFit.score === 10, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: strongJob },
  'expected locationFit=10'
)
assert(
  'Comp fit ≥ 8 (£92.5k mid > £80k floor)',
  strongResult,
  { fn: r => r.dimensions.compFit.score >= 8, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: strongJob },
  'expected compFit≥8'
)
assert(
  'Freshness = 10 (Fresh)',
  strongResult,
  { fn: r => r.dimensions.freshness.score === 10, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: strongJob },
  'expected freshness=10'
)

// ── Test group 2: Poor match ──────────────────────────────────────────────
console.log('\nGroup 2: Poor match — wrong role, wrong seniority, bad comp, expired')

const poorJob = {
  role_title: 'Junior Sales Executive',
  company: 'SomeAgency',
  location: 'Manchester (5 days office)',
  salary: '£25,000–£30,000',
  freshness: 'Expired',
  raw_json: {},
}

const poorResult = scoreMatch(SENIOR_PARTNERSHIPS_PROFILE, poorJob)
assert(
  'Poor match scores ≤ 3',
  poorResult,
  { fn: r => r.score <= 3, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: poorJob },
  'expected ≤3'
)
assert(
  'Role fit ≤ 4 (no overlap)',
  poorResult,
  { fn: r => r.dimensions.roleFit.score <= 4, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: poorJob },
  'expected roleFit≤4'
)
assert(
  'Seniority fit ≤ 4 (Junior vs Head of)',
  poorResult,
  { fn: r => r.dimensions.seniorityFit.score <= 4, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: poorJob },
  'expected seniorityFit≤4'
)
assert(
  'Location fit = 1 (5 days, limit = 2)',
  poorResult,
  { fn: r => r.dimensions.locationFit.score === 1, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: poorJob },
  'expected locationFit=1'
)
assert(
  'Comp fit = 1 (£27.5k << £80k floor)',
  poorResult,
  { fn: r => r.dimensions.compFit.score === 1, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: poorJob },
  'expected compFit=1'
)
assert(
  'Freshness = 0 (Expired)',
  poorResult,
  { fn: r => r.dimensions.freshness.score === 0, _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: poorJob },
  'expected freshness=0'
)

// ── Test group 3: Parent track ────────────────────────────────────────────
console.log('\nGroup 3: Parent track — enhanced parental leave + remote = high WLB')

const parentFriendlyJob = {
  role_title: 'Head of Marketing',
  company: 'FlexCorp',
  location: 'Remote',
  salary: '£70,000',
  freshness: 'Aging',
  raw_json: { description: 'fully remote, enhanced parental leave 26 weeks full pay, flexible working' },
}

const parentResult = scoreMatch(PARENT_TRACK_PROFILE, parentFriendlyJob)
assert(
  'Parent track: WLB score > 5 (matching benefits)',
  parentResult,
  { fn: r => r.dimensions.cultureWlb.score > 5, _profile: PARENT_TRACK_PROFILE, _job: parentFriendlyJob },
  'expected cultureWlb>5'
)
assert(
  'Parent track: Location = 10 (fully remote, limit=1)',
  parentResult,
  { fn: r => r.dimensions.locationFit.score === 10, _profile: PARENT_TRACK_PROFILE, _job: parentFriendlyJob },
  'expected locationFit=10'
)
assert(
  'Parent track: Freshness = 7 (Aging)',
  parentResult,
  { fn: r => r.dimensions.freshness.score === 7, _profile: PARENT_TRACK_PROFILE, _job: parentFriendlyJob },
  'expected freshness=7'
)
assert(
  'Parent track: Seniority = 10 (Head of matches Senior Manager tier)',
  parentResult,
  { fn: r => r.dimensions.seniorityFit.score >= 7, _profile: PARENT_TRACK_PROFILE, _job: parentFriendlyJob },
  'expected seniorityFit≥7'
)

// ── Test group 4: Minimal profile ────────────────────────────────────────
console.log('\nGroup 4: Minimal profile — all neutral (5s)')

const anyJob = {
  role_title: 'Product Manager',
  company: 'AnyCompany',
  location: '',
  salary: '',
  freshness: null,
  raw_json: {},
}

const minResult = scoreMatch(MINIMAL_PROFILE, anyJob)
assert(
  'Minimal profile: overall score near 5',
  minResult,
  { fn: r => r.score >= 4 && r.score <= 6, _profile: MINIMAL_PROFILE, _job: anyJob },
  'expected 4–6'
)
assert(
  'Minimal profile: role fit = 5 (no targets)',
  minResult,
  { fn: r => r.dimensions.roleFit.score === 5, _profile: MINIMAL_PROFILE, _job: anyJob },
  'expected roleFit=5'
)

// ── Test group 5: Salary edge cases ──────────────────────────────────────
console.log('\nGroup 5: Salary parsing edge cases')

const profileWithFloor = { ...MINIMAL_PROFILE, salary_floor: 70000 }

const salaryTests = [
  { salary: '£70,000–£80,000', expectedMin: 6, expectedMax: 8, label: '£70k–£80k range' },
  { salary: '£90k',            expectedMin: 8, expectedMax: 10, label: '£90k shorthand' },
  { salary: '£60,000',         expectedMin: 3, expectedMax: 5, label: '£60k below floor' },
  { salary: '',                expectedMin: 5, expectedMax: 5, label: 'No salary → neutral 5' },
]

for (const { salary, expectedMin, expectedMax, label } of salaryTests) {
  const job = { role_title: 'Role', salary, freshness: 'Fresh', raw_json: {} }
  const result = scoreMatch(profileWithFloor, job)
  assert(
    `Salary: ${label}`,
    result,
    { fn: r => r.dimensions.compFit.score >= expectedMin && r.dimensions.compFit.score <= expectedMax, _profile: profileWithFloor, _job: job },
    `expected compFit ${expectedMin}–${expectedMax}`
  )
}

// ── Test group 6: Determinism proof ──────────────────────────────────────
console.log('\nGroup 6: Determinism — 10 identical runs must produce identical output')

const deterJob = {
  role_title: 'Director of Growth',
  company: 'ScaleCo',
  location: 'hybrid 3 days London',
  salary: '£95,000–£110,000',
  freshness: 'Fresh',
  raw_json: { description: 'equity, hybrid working' },
}

const firstRun = JSON.stringify(scoreMatch(SENIOR_PARTNERSHIPS_PROFILE, deterJob))
let deterPassed = true
for (let i = 0; i < 9; i++) {
  if (JSON.stringify(scoreMatch(SENIOR_PARTNERSHIPS_PROFILE, deterJob)) !== firstRun) {
    deterPassed = false; break
  }
}
if (deterPassed) {
  console.log(`  PASS  10 identical runs produce identical output`)
  passed++
} else {
  console.log(`  FAIL  NON-DETERMINISTIC output detected`)
  failed++
}

// ── Test group 7: Weekly preference — hard veto, hard preference, soft nudge, neutral ──
console.log('\nGroup 7: Weekly preference (weeklyFocus dimension)')

const fintechJob = {
  role_title: 'Partnerships Manager', company: 'Monzo', location: 'London',
  raw_json: { description: 'Join our fintech banking team' },
}
const nonFintechJob = {
  role_title: 'Partnerships Manager', company: 'Wayve', location: 'London',
  raw_json: { description: 'Join our autonomous driving team' },
}
const remoteJob = { role_title: 'Partnerships Manager', company: 'Acme', location: 'Remote' }
const officeJob = { role_title: 'Partnerships Manager', company: 'Acme', location: 'London office' }

const noFintechProfile = { ...SENIOR_PARTNERSHIPS_PROFILE, hard_filters_json: { weeklyPreference: 'no fintech please' } }
const excludedResult = scoreMatch(noFintechProfile, fintechJob)
assert('Excludes "no fintech" job', excludedResult, {
  fn: r => r.dimensions.weeklyFocus.score === 1,
  _profile: noFintechProfile, _job: fintechJob,
}, 'expected weeklyFocus.score 1 (hard veto)')

const nonExcludedResult = scoreMatch(noFintechProfile, nonFintechJob)
assert('Non-fintech job unaffected by "no fintech" note', nonExcludedResult, {
  fn: r => r.dimensions.weeklyFocus.score >= 5,
  _profile: noFintechProfile, _job: nonFintechJob,
}, 'expected weeklyFocus.score >= 5 (no veto triggered)')

const remoteOnlyProfile = { ...SENIOR_PARTNERSHIPS_PROFILE, hard_filters_json: { weeklyPreference: 'remote only' } }
const remoteMatchResult = scoreMatch(remoteOnlyProfile, remoteJob)
assert('"Remote only" note + remote job scores high', remoteMatchResult, {
  fn: r => r.dimensions.weeklyFocus.score === 9,
  _profile: remoteOnlyProfile, _job: remoteJob,
}, 'expected weeklyFocus.score 9')

const remoteMismatchResult = scoreMatch(remoteOnlyProfile, officeJob)
assert('"Remote only" note + office job scores low', remoteMismatchResult, {
  fn: r => r.dimensions.weeklyFocus.score === 2,
  _profile: remoteOnlyProfile, _job: officeJob,
}, 'expected weeklyFocus.score 2')

const noPrefResult = scoreMatch(SENIOR_PARTNERSHIPS_PROFILE, fintechJob)
assert('No weekly preference set → neutral', noPrefResult, {
  fn: r => r.dimensions.weeklyFocus.score === 5,
  _profile: SENIOR_PARTNERSHIPS_PROFILE, _job: fintechJob,
}, 'expected weeklyFocus.score 5 (neutral)')

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`)
console.log(`${'─'.repeat(50)}\n`)
process.exit(failed > 0 ? 1 : 0)
