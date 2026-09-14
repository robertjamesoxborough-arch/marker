// Deterministic CV lint (Stage 65) — mechanical verification that a
// generated CV actually holds the structural promises the generator makes,
// instead of trusting the model's own self-report. Built entirely on
// classifyCv()'s already-tested parser (lib/cv-docx.js, 44 test cases) —
// no new parsing logic, no AI call for the structural half.
//
// Framing note: the "75% of CVs are auto-rejected by ATS" claim is a myth.
// This is a "clean parsing + strong keyword match" confidence signal, not a
// "beat the robot that bins you" scare check — keep any UI copy consistent
// with that.

const { classifyCv } = require('./cv-docx')

// Same shape as lib/cv-extract.js's SECTION_MARKER_RE — kept as a separate
// literal here rather than importing/exporting it, since this is a distinct
// concern (verifying the marker is gone) from extraction (splitting on it).
const SCAFFOLD_MARKER_RE = /-{2,}\s*[A-Z][A-Z /]+?\s*-{2,}/

// Pure, zero-AI. Checks the three structural rules that make a CV
// ATS-parseable: no leaked internal scaffolding, standard section headings
// present, and role entries formatted as separate title/company/dates lines
// (the Workday rule). The fourth rule — no tables, no multi-column layout,
// no text in headers/footers — is a static fact about buildCvDocx(), which
// only ever emits Paragraph/TextRun and never Table/Header/Footer; it does
// not need per-generation verification and is asserted by the caller.
function lintCvStructure(cvText) {
  const issues = []
  const text = cvText || ''

  if (SCAFFOLD_MARKER_RE.test(text)) {
    issues.push('Internal section markers leaked into the CV text')
  }

  const records = classifyCv(text)
  const hasHeading = records.some(r => r.type === 'heading')
  if (!hasHeading) issues.push('No standard section headings detected')

  const hasBullets = records.some(r => r.type === 'bullet')
  const hasRoleGroup = records.some(r => r.type === 'title')
  if (hasBullets && !hasRoleGroup) {
    issues.push('Role entries are not formatted as separate title / company / date lines')
  }

  return { ok: issues.length === 0, issues }
}

// Builds the calm one-line summary shown to the user, e.g.
// "✓ Clean structure · ✓ 9/11 key terms present · 2 worth adding: X, Y"
function buildAtsSummary(structure, keyword) {
  const parts = [structure.ok ? '✓ Clean structure' : `⚠ ${structure.issues[0]}`]
  if (keyword) {
    const total = keyword.matched.length + keyword.missing.length
    if (total > 0) parts.push(`✓ ${keyword.matched.length}/${total} key terms present`)
    if (keyword.missing.length > 0) {
      parts.push(`${keyword.missing.length} worth adding: ${keyword.missing.slice(0, 3).join(', ')}`)
    }
  }
  return parts.join(' · ')
}

module.exports = { lintCvStructure, buildAtsSummary, SCAFFOLD_MARKER_RE }
