const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx')

// CV .docx renderer — premium typographic redesign (Stage 59).
//
// HARD CONSTRAINT, never break this: job title, company, and date range
// each stay on their OWN separate Paragraph — never merged into one line
// or one TextRun — because Workday's ATS auto-fill parses work history by
// scanning separate lines, and app/api/cv/generate/route.js's
// WORKDAY_FORMAT_RULE guarantees the source text keeps this structure.
// Visual hierarchy here comes entirely from weight/size/colour/spacing on
// those three still-separate paragraphs (title bold+larger, company
// regular, dates small+muted, tight spacing between the three so they read
// as one grouped block) — never by combining them.
//
// Typography: Garamond (serif) for the name and section headings — a
// distinguished, editorial accent — paired with Calibri (clean sans) for
// body copy, company names, dates and bullets, for maximum on-screen
// readability. Ink is a soft charcoal rather than pure black; meta text
// (dates, contact line) is muted grey; a thin rule closes the header block
// and underlines each section heading.
//
// Split in two: classifyCv() is pure (line-array in, structured-record-
// array out) and fully unit-testable without touching the docx library at
// all (see lib/cv-docx.test.js) — buildCvDocx() is a thin, low-risk mapping
// from those records to styled Paragraphs. The source text's own line
// structure is what carries the real structure (see WORKDAY_FORMAT_RULE
// and lib/cv-extract.js, which now guarantees this text is ONLY the CV,
// never the model's JD-requirements/evidence-map/ATS-analysis scaffolding).

const FONT_HEADING = 'Garamond'
const FONT_BODY = 'Calibri'

const COLOR_INK = '1A1A1A'
const COLOR_MUTED = '666666'
const COLOR_RULE = 'B5B5B5'

// Sizes in half-points (docx convention): 21 = 10.5pt, 22 = 11pt, etc.
const SIZE_NAME = 32       // 16pt
const SIZE_TAGLINE = 21    // 10.5pt
const SIZE_CONTACT = 17    // 8.5pt
const SIZE_SECTION = 21    // 10.5pt
const SIZE_TITLE = 23      // 11.5pt
const SIZE_COMPANY = 21    // 10.5pt
const SIZE_DATES = 17      // 8.5pt
const SIZE_BODY = 21       // 10.5pt — 10.5pt body minimum: the constraint is the
const SIZE_BULLET = 21     // seven-second recruiter skim, not screen aesthetics.

const BULLET_PREFIXES = ['- ', '• ', '* ']
const MAX_HEADER_LINES = 8
const MAX_ROLE_HEADER_LINES = 3
const ROLE_HEADER_LINE_MAX_CHARS = 70

const EMAIL_RE = /\S+@\S+\.\S+/
const PHONE_RE = /^[\d+\s().-]{7,}$/
const URL_RE = /^(https?:\/\/|www\.)/i
const DOMAIN_HINT_RE = /\.(com|co\.uk|io|org|net|me)\b/i
const TRAILING_LABEL_RE = /\s*\([^)]{1,20}\)\s*$/

function isBullet(line) {
  return BULLET_PREFIXES.some(p => line.startsWith(p))
}

// A known CV section-label vocabulary, matched case-insensitively as an
// EXACT (not fuzzy) match — found live (Stage 59 self-test against a real
// generated CV): the model doesn't always render section labels in ALL
// CAPS ("Experience"/"Education"/"Skills", not "EXPERIENCE"), so relying
// on the all-caps heuristic alone silently demoted real section headings
// to plain body text. Exact-match keeps false-positive risk low — a body
// sentence would have to consist of nothing but one of these words to
// misfire, and even then heading treatment is a reasonable outcome.
const KNOWN_SECTION_LABELS = new Set([
  'experience', 'work experience', 'professional experience', 'employment history', 'career history',
  'education', 'education and training', 'academic background',
  'skills', 'key skills', 'core skills', 'technical skills', 'skills and expertise',
  'summary', 'professional summary', 'profile', 'personal statement', 'about',
  'certifications', 'certificates', 'qualifications',
  'projects', 'publications', 'languages', 'interests', 'hobbies',
  'references', 'awards', 'achievements', 'volunteering', 'volunteer experience',
  'training', 'accomplishments', 'additional information',
])

function isSectionHeading(line) {
  if (!line || line.length > 40) return false
  if (KNOWN_SECTION_LABELS.has(line.trim().toLowerCase())) return true
  const letters = line.replace(/[^A-Za-z]/g, '')
  return letters.length >= 3 && letters === letters.toUpperCase()
}

// A contact-info line: email, phone number, or a URL (including the messy
// "07807977629 (Mobile)" / "www.example.com/path (LinkedIn)"-style lines a
// CV pasted from a PDF/LinkedIn export often produces — the trailing label
// is stripped before testing so it doesn't defeat the phone/URL match).
function isContactLine(line) {
  const core = line.replace(TRAILING_LABEL_RE, '').trim()
  return EMAIL_RE.test(core) || PHONE_RE.test(core) || URL_RE.test(core) || DOMAIN_HINT_RE.test(core)
}

function cleanContactText(line) {
  return line.replace(TRAILING_LABEL_RE, '').trim()
}

// Splits the header block (name / tagline / contact details) from the rest
// of the CV. Handles real messy source text robustly — e.g. contact lines
// appearing BEFORE the name (common when a CV was pasted from a LinkedIn/
// PDF export) — rather than assuming line 1 is always the name.
function parseHeader(lines) {
  const contactParts = []
  let name = null
  let tagline = null
  let i = 0

  // A single forward pass with early termination — MAX_HEADER_LINES is only
  // a safety cap for pathological input, never the primary stop condition.
  // The real stop condition is: once name AND tagline are both found, the
  // next non-contact line is body content, not more header — `break`
  // (never `continue`) there so `consumed` stops before it, and it's
  // classified normally in the main loop instead of being silently
  // absorbed into the header zone and dropped. (Found live: a real
  // "Professional Summary" line + its sentence were vanishing entirely
  // because the old fixed-lookahead version swallowed them into the header
  // zone, which only ever extracts name/tagline/contact and discards
  // anything else it finds there — see PROGRESS.md Stage 59.)
  for (; i < Math.min(lines.length, MAX_HEADER_LINES); i++) {
    const line = lines[i]
    if (isBullet(line) || isSectionHeading(line)) break
    if (/^contact$/i.test(line)) continue // a bare "Contact" label, not content
    if (isContactLine(line)) {
      contactParts.push(cleanContactText(line))
      continue
    }
    if (!name) { name = line; continue }
    if (!tagline) { tagline = line; continue }
    break
  }

  return { name, tagline, contact: contactParts.join('   ·   '), consumed: i }
}

// Detects a "role header group" — 1-3 short consecutive non-bullet,
// non-heading lines immediately followed by a bullet, per
// WORKDAY_FORMAT_RULE's guaranteed shape (title / company / dates, each on
// its own line, directly before that role's bullets). Falls through to
// plain body-paragraph rendering for anything that doesn't match — a real
// paragraph of prose (e.g. a professional summary sentence) is virtually
// never this short AND immediately followed by a bullet.
function detectRoleHeaderGroup(lines, start) {
  const cluster = []
  let i = start
  while (
    i < lines.length &&
    cluster.length < MAX_ROLE_HEADER_LINES &&
    !isBullet(lines[i]) &&
    !isSectionHeading(lines[i]) &&
    lines[i].length <= ROLE_HEADER_LINE_MAX_CHARS
  ) {
    cluster.push(lines[i])
    i++
  }
  if (cluster.length > 0 && i < lines.length && isBullet(lines[i])) {
    return cluster
  }
  return null
}

// Pure: cvText in, an array of typed records out. No docx dependency —
// this is what lib/cv-docx.test.js exercises directly.
// Record shapes: {type:'name'|'tagline'|'contact', text} for the header,
// {type:'heading'|'bullet'|'title'|'company'|'dates'|'body', text} after.
// The model is asked to mark changed sections with "[UPDATED]" at the start
// of a line, but doesn't always comply exactly — found live (Stage 59 self-
// test against a real generated CV): it sometimes appends "[UPDATED]" or
// "[UPDATED emphasis]"/"[UPDATED wording]" at the END of a line instead, or
// mid-line. Strip it wherever it appears, not just as a strict prefix — an
// internal Requite marker like this must never reach the reader either way.
const UPDATED_MARKER_RE = /\s*\[UPDATED[^\]]*\]\s*/g

function classifyCv(cvText) {
  const lines = (cvText || '').split('\n').map(l => l.replace(UPDATED_MARKER_RE, ' ').trim()).filter(Boolean)
  const records = []

  const { name, tagline, contact, consumed } = parseHeader(lines)
  if (name) records.push({ type: 'name', text: name })
  if (tagline) records.push({ type: 'tagline', text: tagline })
  if (contact) records.push({ type: 'contact', text: contact })

  let i = consumed
  while (i < lines.length) {
    const line = lines[i]

    if (isBullet(line)) {
      records.push({ type: 'bullet', text: line.replace(/^[-•*]\s*/, '') })
      i++
      continue
    }

    if (isSectionHeading(line)) {
      records.push({ type: 'heading', text: line.toUpperCase() })
      i++
      continue
    }

    const roleGroup = detectRoleHeaderGroup(lines, i)
    if (roleGroup) {
      const [title, company, dates] = roleGroup
      records.push({ type: 'title', text: title })
      if (company) records.push({ type: 'company', text: company })
      if (dates) records.push({ type: 'dates', text: dates.toUpperCase() })
      i += roleGroup.length
      continue
    }

    records.push({ type: 'body', text: line })
    i++
  }

  return records
}

function headingBorder() {
  return { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_RULE, space: 4 } }
}

function buildCvDocx(cvText) {
  const records = classifyCv(cvText)
  const children = []

  const headerRecords = []
  let bodyStart = 0
  while (bodyStart < records.length && ['name', 'tagline', 'contact'].includes(records[bodyStart].type)) {
    headerRecords.push(records[bodyStart])
    bodyStart++
  }

  headerRecords.forEach((r, idx) => {
    const isLast = idx === headerRecords.length - 1
    const style = {
      name: { bold: true, size: SIZE_NAME, font: FONT_HEADING, color: COLOR_INK },
      tagline: { italics: true, size: SIZE_TAGLINE, font: FONT_BODY, color: COLOR_MUTED },
      contact: { size: SIZE_CONTACT, font: FONT_BODY, color: COLOR_MUTED, characterSpacing: 6 },
    }[r.type]
    children.push(new Paragraph({
      children: [new TextRun({ text: r.text, ...style })],
      spacing: { after: isLast ? 160 : 40 },
      border: isLast ? headingBorder() : undefined,
    }))
  })

  for (let i = bodyStart; i < records.length; i++) {
    const r = records[i]
    if (r.type === 'bullet') {
      children.push(new Paragraph({
        children: [new TextRun({ text: '•  ' + r.text, size: SIZE_BULLET, font: FONT_BODY, color: COLOR_INK })],
        spacing: { after: 120 },
        indent: { left: 260 },
      }))
    } else if (r.type === 'heading') {
      children.push(new Paragraph({
        children: [new TextRun({ text: r.text, bold: true, size: SIZE_SECTION, font: FONT_HEADING, color: COLOR_INK, characterSpacing: 12 })],
        spacing: { before: 260, after: 100 },
        border: headingBorder(),
        heading: HeadingLevel.HEADING_2,
      }))
    } else if (r.type === 'title') {
      children.push(new Paragraph({
        children: [new TextRun({ text: r.text, bold: true, size: SIZE_TITLE, font: FONT_BODY, color: COLOR_INK })],
        spacing: { before: 200, after: 20 },
      }))
    } else if (r.type === 'company') {
      children.push(new Paragraph({
        children: [new TextRun({ text: r.text, size: SIZE_COMPANY, font: FONT_BODY, color: COLOR_INK })],
        spacing: { after: 20 },
      }))
    } else if (r.type === 'dates') {
      children.push(new Paragraph({
        children: [new TextRun({ text: r.text, size: SIZE_DATES, font: FONT_BODY, color: COLOR_MUTED, characterSpacing: 6 })],
        spacing: { after: 100 },
      }))
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: r.text, size: SIZE_BODY, font: FONT_BODY, color: COLOR_INK })],
        spacing: { after: 140 },
        alignment: AlignmentType.LEFT,
      }))
    }
  }

  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT_BODY, size: SIZE_BODY, color: COLOR_INK } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      children,
    }],
  })
}

module.exports = { buildCvDocx, classifyCv, parseHeader, detectRoleHeaderGroup, isSectionHeading, isBullet, isContactLine }
