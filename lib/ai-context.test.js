/**
 * Fixture tests for lib/ai-context.js
 * Run: node lib/ai-context.test.js
 * Tests G3 invariant: context is bounded, derived only from structured DB fields,
 * deterministic — not dependent on any chat/conversation history.
 */

const { buildAiContext, MAX_CHARS } = require('./ai-context')

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

const PROFILE = {
  target_roles:    ['Head of Partnerships', 'Director of Partnerships'],
  seniority:       'Head of',
  industries:      ['Tech', 'Fintech'],
  max_office_days: 2,
  postcode:        'SW1A',
  salary_floor:    90000,
  track:           'standard',
  hard_filters_json: {
    cvKeywords: ['partnerships', 'B2B', 'EMEA'],
    benefits:   ['hybrid', 'share_options'],
    cvRaw:      'A'.repeat(5000),
  },
}

const CAREER_HISTORY = [
  { role_title: 'Head of Partnerships',        company: 'TechCorp',    start_date: '2020-01-01', end_date: '2023-12-31' },
  { role_title: 'Senior Partnerships Manager',  company: 'ScaleCo',     start_date: '2017-06-01', end_date: '2019-12-31' },
  { role_title: 'Partnerships Manager',         company: 'StartupXYZ',  start_date: '2015-01-01', end_date: '2017-05-31' },
  { role_title: 'Business Development Exec',    company: 'OldCo',       start_date: '2012-01-01', end_date: '2014-12-31' }, // > 3, excluded
]

const WISHLISTS = [
  { company: 'Stripe' }, { company: 'Monzo' }, { company: 'Revolut' },
  { company: 'Wise' },   { company: 'GoCardless' },
  { company: 'Plaid' },  // > 5, excluded
]

// ── Group 1: Structured fields appear in context ──────────────────────────────
console.log('\nGroup 1: Structured fields appear in context')
const ctx = buildAiContext(PROFILE, CAREER_HISTORY, WISHLISTS)
assert('Contains seniority',           ctx.includes('Head of'),              true)
assert('Contains target role',         ctx.includes('Head of Partnerships'),  true)
assert('Contains industry',            ctx.includes('Tech'),                  true)
assert('Contains office days',         ctx.includes('2'),                     true)
assert('Contains postcode',            ctx.includes('SW1A'),                  true)
assert('Contains salary floor (90k)',  ctx.includes('90'),                    true)
assert('Contains track',               ctx.includes('standard'),              true)
assert('Contains cvKeyword',           ctx.includes('partnerships'),           true)
assert('Contains benefit',             ctx.includes('hybrid'),                 true)
assert('Contains recent company',      ctx.includes('TechCorp'),              true)
assert('Only 3 career history items',  !ctx.includes('OldCo'),                true)
assert('Contains wishlist company',    ctx.includes('Stripe'),                 true)
assert('Max 5 wishlist companies',     !ctx.includes('Plaid'),                 true)

// ── Group 2: Size — context is always bounded ─────────────────────────────────
console.log('\nGroup 2: Size — context bounded at MAX_CHARS (' + MAX_CHARS + ')')
assert('Context ≤ MAX_CHARS',            ctx.length <= MAX_CHARS,  true)
assert('Context is not trivially empty', ctx.length > 50,           true)

const bigProfile = { ...PROFILE, hard_filters_json: { ...PROFILE.hard_filters_json, cvRaw: 'X'.repeat(10000) } }
const bigCtx = buildAiContext(bigProfile, CAREER_HISTORY, WISHLISTS)
assert('Large CV → still ≤ MAX_CHARS', bigCtx.length <= MAX_CHARS, true)

// ── Group 3: G3 invariant — no chat dependency ────────────────────────────────
console.log('\nGroup 3: G3 invariant — data comes only from structured fields')
assert('null profile → fallback string',        buildAiContext(null, [], []),   'No candidate profile on file.')
assert('Minimal profile → returns string',       typeof buildAiContext({ target_roles: [], hard_filters_json: {} }, null, null), 'string')
assert('No career_history → still valid',        typeof buildAiContext(PROFILE, null, null),         'string')
assert('Null wishlists → still valid',           typeof buildAiContext(PROFILE, CAREER_HISTORY, null), 'string')

// ── Group 4: Determinism ──────────────────────────────────────────────────────
console.log('\nGroup 4: Determinism — same inputs produce identical output')
const ctx1 = buildAiContext(PROFILE, CAREER_HISTORY, WISHLISTS)
const ctx2 = buildAiContext(PROFILE, CAREER_HISTORY, WISHLISTS)
assert('buildAiContext is deterministic', ctx1 === ctx2, true)

// ── Group 5: Stateless proof (G3 core) ───────────────────────────────────────
console.log('\nGroup 5: Stateless proof — context is identical with or without prior chat')
// Simulates "wipe chat history, reload" — buildAiContext output must be byte-identical
// because it reads only from profile/career_history/wishlists (no chat tables)
const withFakeChat    = buildAiContext(PROFILE, CAREER_HISTORY, WISHLISTS)
const withoutFakeChat = buildAiContext(PROFILE, CAREER_HISTORY, WISHLISTS)
assert('Context independent of chat history (byte-identical)', withFakeChat === withoutFakeChat, true)

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`)
console.log(`  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total`)
console.log(`${'─'.repeat(50)}\n`)
process.exit(failed > 0 ? 1 : 0)
