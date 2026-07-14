import { Document, Paragraph, TextRun, HeadingLevel } from 'docx'

// CV layout standards: 10.5pt body minimum (the constraint is the seven-
// second recruiter skim, not screen aesthetics) and looser bullet spacing
// than a plain paste-into-Word default. docx's `size` is in half-points:
// 10.5pt body = 21, 11pt bullets = 22 (bullets get a hair more room to
// breathe since they carry the actual evidence), 14pt name = 28.
const BODY_SIZE = 21
const BULLET_SIZE = 22
const NAME_SIZE = 28
const HEADING_SIZE = 24

const BULLET_PREFIXES = ['- ', '• ', '* ']

function isBullet(line) {
  return BULLET_PREFIXES.some(p => line.startsWith(p))
}

function isSectionHeading(line) {
  const t = line.trim()
  if (!t || t.length > 40) return false
  const letters = t.replace(/[^A-Za-z]/g, '')
  return letters.length >= 3 && letters === letters.toUpperCase()
}

// Parses the AI-generated CV text (plain lines, [UPDATED] markers, "- "
// bullets) into a docx Document. Deliberately simple line-based rendering,
// not a structured template engine -- the source text's own line structure
// (title/company/dates each on their own line, per the Workday-safe
// generation prompt) is what carries the real structure.
export function buildCvDocx(cvText) {
  const lines = (cvText || '').split('\n').map(l => l.replace(/^\[UPDATED\]\s*/, ''))
  const children = []
  let firstContentLine = true

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (firstContentLine) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: NAME_SIZE })],
        spacing: { after: 200 },
      }))
      firstContentLine = false
      continue
    }

    if (isBullet(trimmed)) {
      const text = trimmed.replace(/^[-•*]\s*/, '')
      children.push(new Paragraph({
        children: [new TextRun({ text: '•  ' + text, size: BULLET_SIZE })],
        spacing: { after: 160 },
        indent: { left: 240 },
      }))
      continue
    }

    if (isSectionHeading(trimmed)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: HEADING_SIZE })],
        spacing: { before: 240, after: 120 },
        heading: HeadingLevel.HEADING_2,
      }))
      continue
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: trimmed, size: BODY_SIZE })],
      spacing: { after: 120 },
    }))
  }

  return new Document({
    sections: [{ children }],
  })
}
