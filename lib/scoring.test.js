/**
 * lib/scoring.test.js — run with `node lib/scoring.test.js`.
 * Satisfies the Session 1 test:
 *   1. A quick (feed) prompt and a full (analyse) prompt for the same job
 *      contain the identical rubric text.
 *   2. The FULL overall equals the hand-computed weighted average of factors.
 */
const fs = require('fs')
const path = require('path')
const {
  WEIGHTS, RUBRIC, NEUTRAL, buildCandidateProfile,
  buildFullSystem, computeOverall, roundToScale,
} = require('./scoring')

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg) }
  else { console.log('  ❌ ' + msg); failures++ }
}

console.log('Requite unified scoring — self-test\n')

// Weights sum to exactly 1.0
const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
assert(Math.abs(sum - 1.0) < 1e-9, `WEIGHTS sum to 1.0 (got ${sum})`)

// A representative multi-tenant profile, built from DB rows only.
const profile = {
  target_roles: ['Head of Marketing', 'Marketing Director'],
  seniority: 'Head of',
  industries: ['SaaS', 'Fintech'],
  max_office_days: 2,
  salary_floor: 80000,
  postcode: 'KT18 5LB',
  hard_filters_json: { cvKeywords: ['demand gen', 'brand', 'lifecycle'] },
}
const careerHistory = [{ role_title: 'Marketing Director', company: 'Acme', start_date: '2021-01', end_date: null }]
const candidate = buildCandidateProfile(profile, careerHistory)
assert(!/rob|oxborough/i.test(candidate), 'candidate profile has no hardcoded name')
assert(candidate.includes('Head of Marketing'), 'candidate profile built from DB target_roles')

// 1. Identical rubric text in the quick and the full prompt for the same job.
// The real quick-tier (baseline/Haiku) prompt lives in lib/score-jobs-batch.js
// (ESM — ai imports MODELS/brand, can't require() it from this CJS test), so
// this checks its source embeds the same shared RUBRIC rather than a
// duplicated copy. buildQuickPrompt (lib/scoring.js) was dead code — no
// caller anywhere in the app — and was deleted; nothing in production still
// needs it.
const schema = '{ "factors": { ... } }'
const style = 'British English. No em dashes.'
const fullPrompt = buildFullSystem(candidate, '', schema, style)
const quickSource = fs.readFileSync(path.join(__dirname, 'score-jobs-batch.js'), 'utf8')
assert(fullPrompt.includes(RUBRIC), 'FULL prompt contains the rubric verbatim')
assert(quickSource.includes("from './scoring'") && quickSource.includes('${RUBRIC}'),
  'QUICK (score-jobs-batch.js) embeds the same shared RUBRIC, not a duplicated copy')
assert(RUBRIC.includes('9.0') && RUBRIC.includes('8.4') && RUBRIC.includes('7.0') && RUBRIC.includes('5.0'),
  'rubric carries all four calibration anchors')
assert(RUBRIC.includes(`neutral ${NEUTRAL}`), 'rubric states the missing-information neutral rule')

// 2. FULL overall equals the hand-computed weighted average.
const factors = {
  roleSkillsMatch:   { score: 9 },
  seniorityFit:      { score: 8 },
  officeFlexibility: { score: 10 },
  industryFit:       { score: 7 },
  salaryMarket:      { score: 6 },
  careerGrowth:      { score: 8 },
  companyCulture:    { score: 5 },
  paternityLeave:    { score: 6 },
}
const handRaw =
  9 * WEIGHTS.roleSkillsMatch + 8 * WEIGHTS.seniorityFit + 10 * WEIGHTS.officeFlexibility +
  7 * WEIGHTS.industryFit + 6 * WEIGHTS.salaryMarket + 8 * WEIGHTS.careerGrowth +
  5 * WEIGHTS.companyCulture + 6 * WEIGHTS.paternityLeave
const overall = computeOverall(factors)
assert(Math.abs(overall.raw - Math.round(handRaw * 100) / 100) < 1e-9,
  `deterministic overall raw (${overall.raw}) equals hand-computed weighted average (${Math.round(handRaw * 100) / 100})`)
assert(overall.score === roundToScale(handRaw), `overall display score is ${overall.score} (scale-rounded)`)

// Missing factors fall back to neutral, not a guess.
const partial = computeOverall({ roleSkillsMatch: { score: 9 } })
assert(partial.usedNeutralFor.length === 7, 'seven absent factors default to neutral')
assert(partial.raw === Math.round((9 * WEIGHTS.roleSkillsMatch + NEUTRAL * (1 - WEIGHTS.roleSkillsMatch)) * 100) / 100,
  'partial overall uses neutral for absent factors')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
