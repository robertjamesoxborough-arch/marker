/**
 * Fixture tests for lib/channel-urls.js
 * Run: node lib/channel-urls.test.js
 * Focus: exact param shapes verified live against each real site (see
 * PROGRESS.md Stage 57) — especially that LinkedIn never carries a
 * location param, and that salary/radius are omitted, not defaulted to
 * a wrong value, when a profile field is missing.
 */

const { buildIndeedUrl, buildLinkedInUrl, buildAdzunaUrl, buildChannelUrls, isChannelOverdue } = require('./channel-urls')

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = actual === expected
  if (ok) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.log(`  FAIL  ${label}`)
    console.log(`        expected: ${expected}`)
    console.log(`        got:      ${actual}`)
    failed++
  }
}

console.log('\nGroup 1: Indeed — location, radius, salary all present')
assert(
  'nurse, BA11 4GH, 50mi, £50k floor',
  buildIndeedUrl({ role: 'nurse', postcode: 'BA11 4GH', radiusMiles: 50, salaryFloor: 50000 }),
  'https://uk.indeed.com/jobs?q=nurse&l=BA11+4GH&radius=50&salaryType=%C2%A350%2C000&sort=date'
)

console.log('\nGroup 2: Indeed — missing fields omit params rather than defaulting wrong')
assert(
  'no postcode, no radius, no salary',
  buildIndeedUrl({ role: 'electrician' }),
  'https://uk.indeed.com/jobs?q=electrician&sort=date'
)

console.log('\nGroup 3: LinkedIn — NEVER carries a location param (verified live: LinkedIn ignores it)')
assert(
  'nurse, no location in output even if a postcode is passed elsewhere in the profile',
  buildLinkedInUrl({ role: 'nurse' }),
  'https://www.linkedin.com/jobs/search/?keywords=nurse&sortBy=DD&f_TPR=r86400'
)
assert('electrician', buildLinkedInUrl({ role: 'electrician' }), 'https://www.linkedin.com/jobs/search/?keywords=electrician&sortBy=DD&f_TPR=r86400')

console.log('\nGroup 4: Adzuna — w/sf/sb/sd, no radius param (none exists on their real site)')
assert(
  'nurse, Manchester, £80k floor',
  buildAdzunaUrl({ role: 'nurse', postcode: 'Manchester', salaryFloor: 80000 }),
  'https://www.adzuna.co.uk/jobs/search?q=nurse&w=Manchester&sf=80000&sb=date&sd=down'
)
assert(
  'no postcode, no salary',
  buildAdzunaUrl({ role: 'teacher' }),
  'https://www.adzuna.co.uk/jobs/search?q=teacher&sb=date&sd=down'
)

console.log('\nGroup 5: buildChannelUrls — reads the real profile shape (profiles.postcode, .salary_floor, hard_filters_json.radiusMiles)')
const nurseProfile = { postcode: 'BA11 4GH', salary_floor: 50000, hard_filters_json: { radiusMiles: 50 } }
const nurseUrls = buildChannelUrls('nurse', nurseProfile)
assert('indeed has location+radius+salary', nurseUrls.indeed, 'https://uk.indeed.com/jobs?q=nurse&l=BA11+4GH&radius=50&salaryType=%C2%A350%2C000&sort=date')
assert('linkedin has no location regardless of profile postcode', nurseUrls.linkedin, 'https://www.linkedin.com/jobs/search/?keywords=nurse&sortBy=DD&f_TPR=r86400')
assert('adzuna has location+salary', nurseUrls.adzuna, 'https://www.adzuna.co.uk/jobs/search?q=nurse&w=BA11+4GH&sf=50000&sb=date&sd=down')

console.log('\nGroup 6: buildChannelUrls — radiusMiles missing from hard_filters_json defaults to 50 (matches lib/uk-geo.js and the onboarding client default)')
const noRadiusProfile = { postcode: 'Manchester', salary_floor: 80000, hard_filters_json: {} }
assert(
  'radiusMiles absent -> defaults to 50 for Indeed',
  buildChannelUrls('electrician', noRadiusProfile).indeed,
  'https://uk.indeed.com/jobs?q=electrician&l=Manchester&radius=50&salaryType=%C2%A380%2C000&sort=date'
)

console.log('\nGroup 7: isChannelOverdue')
assert('never checked -> overdue', isChannelOverdue('indeed', null), true)
assert('indeed checked 2h ago -> not overdue (1-day cadence)', isChannelOverdue('indeed', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()), false)
assert('indeed checked 25h ago -> overdue (1-day cadence)', isChannelOverdue('indeed', new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()), true)
assert('adzuna checked 2 days ago -> not overdue (2.5-day cadence)', isChannelOverdue('adzuna', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()), false)
assert('adzuna checked 3 days ago -> overdue (2.5-day cadence)', isChannelOverdue('adzuna', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()), true)

console.log(`\n${'─'.repeat(52)}\n  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total\n${'─'.repeat(52)}`)
process.exit(failed > 0 ? 1 : 0)
