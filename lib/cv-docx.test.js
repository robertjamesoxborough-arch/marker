/**
 * Fixture tests for lib/cv-docx.js
 * Run: node lib/cv-docx.test.js
 * Focus: the HARD constraint — title/company/dates must never be merged
 * onto one line/paragraph (Workday ATS parses by scanning separate lines)
 * — plus the messy real-world header shape (contact lines before the name,
 * as a CV pasted from a LinkedIn/PDF export commonly produces) and that the
 * role-header heuristic doesn't misfire on ordinary prose paragraphs.
 */

const { classifyCv, parseHeader, detectRoleHeaderGroup, isSectionHeading } = require('./cv-docx')

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

console.log('\nGroup 1: parseHeader — clean case, name first')
const h1 = parseHeader(['Rob Oxborough', 'Strategic Partner & Programme Lead', 'rob@example.com', '07807977629', 'PROFESSIONAL SUMMARY'])
assert('name', h1.name, 'Rob Oxborough')
assert('tagline', h1.tagline, 'Strategic Partner & Programme Lead')
assert('contact includes email', h1.contact.includes('rob@example.com'), true)
assert('contact includes phone', h1.contact.includes('07807977629'), true)

console.log('\nGroup 2: parseHeader — messy real-world order, contact lines BEFORE the name (real shape: a CV pasted from a LinkedIn/PDF export)')
const h2 = parseHeader(['Contact', '07807977629 (Mobile)', 'rob@example.com', 'www.linkedin.com/in/rob-oxborough (LinkedIn)', 'Rob Oxborough', 'Strategic Partner & Programme Lead', 'EXPERIENCE'])
assert('bare "Contact" label skipped, not treated as name', h2.name, 'Rob Oxborough')
assert('tagline still found after name', h2.tagline, 'Strategic Partner & Programme Lead')
assert('phone with trailing (Mobile) label captured from before the name', h2.contact.includes('07807977629'), true)
assert('email captured', h2.contact.includes('rob@example.com'), true)
assert('LinkedIn URL captured, trailing (LinkedIn) label stripped', h2.contact.includes('www.linkedin.com/in/rob-oxborough') && !h2.contact.includes('(LinkedIn)'), true)

console.log('\nGroup 3: detectRoleHeaderGroup — the ATS-critical case')
const roleLines = ['Strategic Partner Manager', 'Meta', 'October 2024 - Present', '- Lead high-impact partnership strategies', '- Drive product feedback loops']
assert('detects exactly 3 lines: title, company, dates', detectRoleHeaderGroup(roleLines, 0), ['Strategic Partner Manager', 'Meta', 'October 2024 - Present'])

console.log('\nGroup 4: detectRoleHeaderGroup — must NOT misfire on ordinary short lines not followed by a bullet')
assert('no bullet follows -> not a role header group', detectRoleHeaderGroup(['Some short standalone line', 'Another short line', 'PROFESSIONAL SUMMARY'], 0), null)

console.log('\nGroup 5: detectRoleHeaderGroup — a long prose paragraph never qualifies, even if a bullet follows')
const prose = ['Programme lead with over twelve years of experience driving cross-functional partnerships across technology, finance, and media sectors internationally.', '- some bullet anyway']
assert('long line exceeds the short-line threshold -> not a role header', detectRoleHeaderGroup(prose, 0), null)

console.log('\nGroup 6: classifyCv — full CV, the ATS-critical assertion: title/company/dates are THREE SEPARATE records, never merged')
const cvText = `Rob Oxborough
Strategic Partner & Programme Lead
rob@example.com

EXPERIENCE
Strategic Partner Manager
Meta
October 2024 - Present
- Lead high-impact partnership strategies across EMEA
- Drive product feedback loops with internal teams

Digital Product Lead
NatWest
February 2022 - July 2023
- Drove technical transformation across EMEA`

const records = classifyCv(cvText)
console.log('  Classified records:')
records.forEach(r => console.log(`    [${r.type}] ${r.text}`))

assert('name record', records.find(r => r.type === 'name')?.text, 'Rob Oxborough')
assert('tagline record', records.find(r => r.type === 'tagline')?.text, 'Strategic Partner & Programme Lead')
assert('contact record', records.find(r => r.type === 'contact')?.text.includes('rob@example.com'), true)
assert('heading record', records.find(r => r.type === 'heading')?.text, 'EXPERIENCE')
assert('first role: title is its own record, exact text, nothing merged in', records.filter(r => r.type === 'title')[0]?.text, 'Strategic Partner Manager')
assert('first role: company is a SEPARATE record from the title', records.filter(r => r.type === 'company')[0]?.text, 'Meta')
assert('first role: dates is a SEPARATE record from title and company', records.filter(r => r.type === 'dates')[0]?.text, 'OCTOBER 2024 - PRESENT')
assert('second role: title separate', records.filter(r => r.type === 'title')[1]?.text, 'Digital Product Lead')
assert('second role: company separate', records.filter(r => r.type === 'company')[1]?.text, 'NatWest')
assert('exactly 2 title records (one per role, never fused)', records.filter(r => r.type === 'title').length, 2)
assert('exactly 2 company records', records.filter(r => r.type === 'company').length, 2)
assert('exactly 2 dates records', records.filter(r => r.type === 'dates').length, 2)
assert('bullets present and separated from the role header', records.some(r => r.type === 'bullet' && r.text.includes('Lead high-impact partnership strategies')), true)
assert('no single record ever contains both title and company text', records.some(r => r.text.includes('Strategic Partner Manager') && r.text.includes('Meta')), false)

console.log('\nGroup 7: classifyCv — [UPDATED] marker stripped, never shown to the reader')
const updatedRecords = classifyCv('Rob Oxborough\n\nEXPERIENCE\n[UPDATED] Product Lead\nAcme\n2020 - 2021\n- A bullet')
assert('[UPDATED] marker never appears in any record', updatedRecords.some(r => r.text.includes('[UPDATED]')), false)
assert('the role title itself still renders correctly', updatedRecords.find(r => r.type === 'title')?.text, 'Product Lead')

console.log('\nGroup 9: REGRESSION — a real messy header (Contact/phone/email/LinkedIn/name/tagline, 6 lines) followed immediately by a Professional Summary must NOT silently drop that content (found live: the fixed-lookahead header zone was swallowing it — see PROGRESS.md Stage 59)')
const summaryRegressionCv = `Contact
07807977629 (Mobile)
robertoxborough@hotmail.com
www.linkedin.com/in/robert-oxborough (LinkedIn)
Rob Oxborough
Strategic Partner & Programme Lead | AI-Driven Growth & Transformation

Professional Summary
Programme lead with 12+ years driving cross-functional partnerships across tech, finance, and media, most recently as Strategic Partner Manager at Meta.

EXPERIENCE
Strategic Partner Manager
Meta
October 2024 - Present
- Lead high-impact partnership strategies across EMEA`
const summaryRecords = classifyCv(summaryRegressionCv)
assert('header still correctly captured (name)', summaryRecords.find(r => r.type === 'name')?.text, 'Rob Oxborough')
assert('header still correctly captured (tagline)', summaryRecords.find(r => r.type === 'tagline')?.text, 'Strategic Partner & Programme Lead | AI-Driven Growth & Transformation')
assert('"Professional Summary" label is NOT dropped (now correctly promoted to a heading, not just preserved as body)', summaryRecords.some(r => r.text === 'PROFESSIONAL SUMMARY' && r.type === 'heading'), true)
assert('the summary SENTENCE is NOT dropped', summaryRecords.some(r => r.text.startsWith('Programme lead with 12+ years')), true)
assert('EXPERIENCE section still parses correctly after the summary', summaryRecords.filter(r => r.type === 'heading').map(r => r.text), ['PROFESSIONAL SUMMARY', 'EXPERIENCE'])
assert('role title after the summary still correctly detected', summaryRecords.find(r => r.type === 'title')?.text, 'Strategic Partner Manager')

console.log('\nGroup 8: classifyCv — empty/minimal input, no crash')
assert('empty string -> empty records', classifyCv('').length, 0)
assert('null input -> empty records, no crash', classifyCv(null).length, 0)
assert('name only', classifyCv('Rob Oxborough').map(r => r.type), ['name'])

console.log('\nGroup 10: REGRESSION — "[UPDATED]" appearing anywhere in a line (not just as a strict prefix) must never reach the reader (found live against a REAL generated CV: the model appended it as a suffix, e.g. "Skills [UPDATED]" and "...budget [UPDATED wording]" — see PROGRESS.md Stage 59)')
const updatedAnywhereCv = `Jamie Carter
Head of Product Marketing [UPDATED]

Experience
Senior PMM
Acme
2022 - Present
- Led GTM strategy [UPDATED emphasis]

Skills [UPDATED]
GTM, positioning`
const updatedAnywhereRecords = classifyCv(updatedAnywhereCv)
assert('no record anywhere contains the literal string "UPDATED"', updatedAnywhereRecords.some(r => r.text.includes('UPDATED')), false)
assert('tagline text is clean after stripping a trailing marker', updatedAnywhereRecords.find(r => r.type === 'tagline')?.text, 'Head of Product Marketing')
assert('bullet text is clean after stripping a trailing "[UPDATED emphasis]"', updatedAnywhereRecords.find(r => r.type === 'bullet')?.text, 'Led GTM strategy')
assert('"Skills" line is clean after stripping a trailing marker, and still recognised as a heading', updatedAnywhereRecords.some(r => r.type === 'heading' && r.text === 'SKILLS'), true)

console.log('\nGroup 11: REGRESSION — Title Case section labels ("Experience", "Education", "Skills") must be promoted to headings even when the model doesn\'t render them in ALL CAPS (found live against a real generated CV)')
const titleCaseSections = classifyCv('Rob Oxborough\n\nExperience\nSome Role\nAcme\n2020 - 2021\n- A bullet\n\nEducation\nSome Degree')
assert('"Experience" (Title Case) recognised as a heading', titleCaseSections.some(r => r.type === 'heading' && r.text === 'EXPERIENCE'), true)
assert('"Education" (Title Case) recognised as a heading', titleCaseSections.some(r => r.type === 'heading' && r.text === 'EDUCATION'), true)
assert('an ordinary body sentence that happens to be short is NOT misclassified as a heading (exact-match only, not fuzzy)', isSectionHeading('Experienced marketer'), false)

console.log(`\n${'─'.repeat(52)}\n  ${passed} passed  |  ${failed} failed  |  ${passed + failed} total\n${'─'.repeat(52)}`)
process.exit(failed > 0 ? 1 : 0)
