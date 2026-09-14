/**
 * Fixture tests for lib/cv-extract.js
 * Run: node lib/cv-extract.test.js
 * Focus: the exact bug found live -- the downloaded/previewed CV must never
 * contain the model's JD-requirements/evidence-map/ATS-analysis/sift-
 * assessment scaffolding, on either the Standard (3-section) or Deep
 * (5-section) prompt shape.
 */

const { extractCvSections } = require('./cv-extract')

let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = actual === expected
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

console.log('\nGroup 1: Standard effort (3 sections) -- real prompt shape')
const standardRaw = `---JD REQUIREMENTS---
Lead cross-functional partnership programmes
Own EMEA expansion strategy
Seniority target: Senior Manager

---EVIDENCE MAP---
[Lead cross-functional programmes] -> [Strategic Partner Manager, Meta, Oct 2024-Present]: "lead high-impact partnership strategies"
[Own EMEA expansion] -> [Digital Product Lead, NatWest, Feb 2022-Jul 2023]: "drove technical transformation across EMEA"

---TAILORED CV---
Rob Oxborough
Strategic Partner & Programme Lead

[UPDATED] Professional Summary
Programme lead with 12+ years driving cross-functional partnerships across tech and finance.

Strategic Partner Manager
Meta
October 2024 - Present
- Lead high-impact partnership strategies across EMEA
- Drive product feedback loops with internal teams`

const stdResult = extractCvSections(standardRaw)
assert('does not contain JD REQUIREMENTS marker', stdResult.cv.includes('JD REQUIREMENTS'), false)
assert('does not contain EVIDENCE MAP marker', stdResult.cv.includes('EVIDENCE MAP'), false)
assert('does not contain evidence map citation text', stdResult.cv.includes('Lead cross-functional programmes'), false)
assert('starts with the real CV name line', stdResult.cv.startsWith('Rob Oxborough'), true)
assert('contains the real tailored bullet', stdResult.cv.includes('Lead high-impact partnership strategies across EMEA'), true)
assert('title/company/dates remain on separate lines (ATS-safe)', stdResult.cv.includes('Strategic Partner Manager\nMeta\nOctober 2024 - Present'), true)
assert('reasoning captured separately, not lost', stdResult.reasoning.includes('Lead cross-functional partnership programmes'), true)
assert('not a fallback path', stdResult.usedFallback, false)

console.log('\nGroup 2: Deep effort (5 sections) -- scaffolding both BEFORE and AFTER the CV')
const deepRaw = `---JD REQUIREMENTS---
Own a book of enterprise partnerships
Seniority target: Head of Partnerships

---EVIDENCE MAP---
[Own enterprise partnerships] -> [Strategic Partner Manager, Meta]: "primary relationship manager for key gaming and product partners"

---ATS ANALYSIS---
Matched: partnerships, cross-functional, EMEA
Missing: enterprise, C-suite
Match score: 74/100

---TAILORED CV---
Rob Oxborough
Head of Partnerships (target)

Strategic Partner Manager
Meta
October 2024 - Present
- Primary relationship manager for key gaming and product partners

---SIFT ASSESSMENT---
Strong partnerships background, some concern around direct enterprise/C-suite exposure. Estimated interview invite probability: 45%.`

const deepResult = extractCvSections(deepRaw)
assert('does not contain ATS ANALYSIS marker', deepResult.cv.includes('ATS ANALYSIS'), false)
assert('does not contain SIFT ASSESSMENT marker', deepResult.cv.includes('SIFT ASSESSMENT'), false)
assert('does not contain the trailing sift commentary', deepResult.cv.includes('interview invite probability'), false)
assert('does not contain the ATS match score line', deepResult.cv.includes('Match score'), false)
assert('contains the real tailored bullet', deepResult.cv.includes('Primary relationship manager for key gaming and product partners'), true)
assert('sift captured separately', deepResult.sift.includes('45%'), true)
assert('reasoning includes ATS analysis section for deep effort', deepResult.reasoning.includes('Matched: partnerships'), true)
assert('not a fallback path', deepResult.usedFallback, false)

console.log('\nGroup 3: no section markers at all -- must never delete real content on a guess')
const plainText = 'Rob Oxborough\nSenior Product Manager\n\nExperience\nSome role\nSome company'
const plainResult = extractCvSections(plainText)
assert('returns full text unchanged when no markers found', plainResult.cv, plainText)
assert('flags fallback so it can be noticed', plainResult.usedFallback, true)

console.log('\nGroup 4: markers present but TAILORED CV marker missing -- never return empty')
const missingCvMarker = `---JD REQUIREMENTS---
Some requirement

---EVIDENCE MAP---
Some evidence`
const missingResult = extractCvSections(missingCvMarker)
assert('falls back to full text rather than returning empty', missingResult.cv.length > 0, true)
assert('flags fallback', missingResult.usedFallback, true)

console.log('\nGroup 5: empty/null input -- no crash')
assert('empty string', extractCvSections('').cv, '')
assert('null input', extractCvSections(null).cv, '')

console.log(`\n${'─'.repeat(52)}\n  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total\n${'─'.repeat(52)}`)
process.exit(failed > 0 ? 1 : 0)
