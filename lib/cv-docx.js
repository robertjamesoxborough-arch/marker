const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx')

// CV .docx renderer — minimalist, high-end typographic redesign (Stage 82).
// Supersedes the Stage 59 pass; see PROGRESS.md Stage 82 for the full
// before/after and the live-rendered self-test.
//
// HARD CONSTRAINT, never break this: job title, company, and date range
// each stay on their OWN separate Paragraph — never merged into one line
// or one TextRun — because Workday's ATS auto-fill parses work history by
// scanning separate lines, and app/api/cv/generate/route.js's
// WORKDAY_FORMAT_RULE guarantees the source text keeps this structure.
// Visual hierarchy here comes entirely from weight/size/colour/spacing/
// alignment on those three still-separate paragraphs (title bold, company
// regular, dates right-aligned and muted, tight spacing between the three
// so they read as one grouped block) — never by combining them.
//
// FONTS, chosen deliberately and stated here rather than left to silently
// fall back (the Stage 59 bug this replaces: 'Garamond' is not bundled
// with a default Windows/Office install, so a reader without it installed
// got an unannounced substitution to whatever Word falls back to — the
// exact failure mode a "premium, designed" CV cannot afford). Georgia
// (serif, for the name and section headings — an editorial, confident
// accent) and Calibri (clean sans, for everything else) are both shipped
// as standard fonts with every Windows install since Vista/Office 2007 and
// present on macOS/Google Docs/LibreOffice's default substitution tables
// too, so the docx's declared fonts render as declared for the overwhelming
// majority of real readers — genuinely reliable, not merely "premium-
// sounding". Exactly two families, per the brief.
//
// COLOUR: a soft near-black ink for primary content (name, job titles,
// company, bullets, body) — never pure #000, which reads harsh on screen
// and in print — and a dark (not light/washed-out) grey for every
// secondary element: the professional-title line, contact line, dates,
// and section headings. Two greys, not one flat one: SECTION headings sit
// very slightly darker/heavier than the meta-info grey, a small but real
// hierarchy cue (spec: "create hierarchy through type and spacing, not
// decoration").
//
// LAYOUT: A4 (explicitly sized — docx defaults to US Letter if you don't
// set this, which would be wrong for a UK product), ~2cm margins, a single
// subtle rule closing the header block and nothing else — no per-section
// underlines, which read as decorative default-template noise at this
// level of restraint. Candidate header (name/title/contact) is centred;
// everything else is left-aligned, conventional, single-column, ATS-safe.
// widowControl + keepNext/keepLines throughout (never orphan a heading,
// never split a job title from what follows it) — see buildCvDocx().
//
// Split in two: classifyCv() is pure (line-array in, structured-record-
// array out) and fully unit-testable without touching the docx library at
// all (see lib/cv-docx.test.js) — buildCvDocx() is a thin, low-risk mapping
// from those records to styled Paragraphs. The source text's own line
// structure is what carries the real structure (see WORKDAY_FORMAT_RULE
// and lib/cv-extract.js, which now guarantees this text is ONLY the CV,
// never the model's JD-requirements/evidence-map/ATS-analysis scaffolding).
// classifyCv()'s own output stays exactly as it was (still real-case text,
// headings/dates still pre-uppercased there — every existing test in
// lib/cv-docx.test.js asserts on that exact shape) — the NEW all-caps
// presentation on the name and the professional-title line is applied as
// pure `allCaps` RUN STYLING inside buildCvDocx only, never by mutating the
// underlying text, so the stored/ATS-readable data stays real-case.

const FONT_HEADING = 'Georgia'
const FONT_BODY = 'Calibri'

const COLOR_INK = '1A1A1A'      // primary: name, job titles, company, bullets, body
const COLOR_HEADING = '3D3D3D'  // dark grey, section headings — a shade darker than COLOR_MUTED
const COLOR_MUTED = '595959'    // dark grey, meta text: professional title, contact, dates
const COLOR_RULE = 'C9C9C9'     // one subtle rule, closing the header only — used sparingly by design

// Sizes in half-points (docx convention): 21 = 10.5pt, 22 = 11pt, etc.
const SIZE_NAME = 62        // 31pt — within the 30-32pt brief
const SIZE_TAGLINE = 23     // 11.5pt — professional title under the name
const SIZE_CONTACT = 20     // 10pt
const SIZE_SECTION = 27     // 13.5pt
const SIZE_TITLE = 23       // 11.5pt — job title within an experience entry
const SIZE_COMPANY = 21     // 10.5pt
const SIZE_DATES = 19       // 9.5pt
const SIZE_BODY = 21        // 10.5pt — never below ~10pt: the constraint is the
const SIZE_BULLET = 21      // seven-second recruiter skim, not screen aesthetics.

// A4 in twips (docx has no named A4 preset — must be stated explicitly or
// the page defaults to US Letter, wrong for a UK product) and ~2cm margins
// (1cm = 566.93 twips; 1134 ≈ 2cm).
const PAGE_A4 = { width: 11906, height: 16838 }
const MARGIN_2CM = 1134

// Applied to every paragraph below: never let a single line of a paragraph
// strand alone at the top/bottom of a page (Word's own default, made
// explicit rather than left implicit).
const WIDOW_CONTROL = { widowControl: true }

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

// The ONE rule in the whole document — closes the centred header block.
// Deliberately not reused per-section (see the Stage 82 file comment):
// restraint means one considered rule, not a template-generator habit of
// underlining every heading.
function headerRule() {
  return { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_RULE, space: 8 } }
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

  // Centred candidate header: NAME (large serif, allCaps run styling only —
  // the underlying text stays real-case, see the file comment) / professional
  // title (allCaps, dark grey) / contact line, then the one rule that closes
  // the block.
  headerRecords.forEach((r, idx) => {
    const isLast = idx === headerRecords.length - 1
    const style = {
      name: { bold: true, size: SIZE_NAME, font: FONT_HEADING, color: COLOR_INK, allCaps: true, characterSpacing: 10 },
      tagline: { size: SIZE_TAGLINE, font: FONT_BODY, color: COLOR_MUTED, allCaps: true, characterSpacing: 14 },
      contact: { size: SIZE_CONTACT, font: FONT_BODY, color: COLOR_MUTED, characterSpacing: 6 },
    }[r.type]
    children.push(new Paragraph({
      ...WIDOW_CONTROL,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: r.text, ...style })],
      spacing: { after: isLast ? 220 : 60 },
      border: isLast ? headerRule() : undefined,
    }))
  })

  for (let i = bodyStart; i < records.length; i++) {
    const r = records[i]
    if (r.type === 'bullet') {
      children.push(new Paragraph({
        ...WIDOW_CONTROL,
        keepLines: true,
        children: [new TextRun({ text: '•  ' + r.text, size: SIZE_BULLET, font: FONT_BODY, color: COLOR_INK })],
        spacing: { after: 120 },
        indent: { left: 260 },
      }))
    } else if (r.type === 'heading') {
      // Hierarchy from type/colour/spacing, not decoration: no underline
      // here (see headerRule's comment) — bold, dark grey, uppercase
      // (already-uppercase text from classifyCv), generous space before to
      // separate it from the previous section, keepNext so it can never be
      // stranded alone at the bottom of a page.
      children.push(new Paragraph({
        ...WIDOW_CONTROL,
        keepNext: true,
        children: [new TextRun({ text: r.text, bold: true, size: SIZE_SECTION, font: FONT_HEADING, color: COLOR_HEADING, characterSpacing: 16 })],
        spacing: { before: 340, after: 140 },
        heading: HeadingLevel.HEADING_2,
      }))
    } else if (r.type === 'title') {
      // keepNext on title/company/dates glues the whole role-header trio
      // (and whatever follows) together — never split a job title from its
      // own company, dates, or first bullet across a page break.
      children.push(new Paragraph({
        ...WIDOW_CONTROL,
        keepNext: true,
        children: [new TextRun({ text: r.text, bold: true, size: SIZE_TITLE, font: FONT_BODY, color: COLOR_INK })],
        spacing: { before: 220, after: 20 },
      }))
    } else if (r.type === 'company') {
      children.push(new Paragraph({
        ...WIDOW_CONTROL,
        keepNext: true,
        children: [new TextRun({ text: r.text, size: SIZE_COMPANY, font: FONT_BODY, color: COLOR_INK })],
        spacing: { after: 20 },
      }))
    } else if (r.type === 'dates') {
      // Right-aligned, per the brief — a standalone right-set date line
      // under a left-set title/company reads as a deliberate, designed
      // pattern rather than a default template.
      children.push(new Paragraph({
        ...WIDOW_CONTROL,
        keepNext: true,
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: r.text, size: SIZE_DATES, font: FONT_BODY, color: COLOR_MUTED, characterSpacing: 6 })],
        spacing: { after: 120 },
      }))
    } else {
      children.push(new Paragraph({
        ...WIDOW_CONTROL,
        keepLines: true,
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
      properties: {
        page: {
          size: PAGE_A4,
          margin: { top: MARGIN_2CM, bottom: MARGIN_2CM, left: MARGIN_2CM, right: MARGIN_2CM },
        },
      },
      children,
    }],
  })
}

module.exports = { buildCvDocx, classifyCv, parseHeader, detectRoleHeaderGroup, isSectionHeading, isBullet, isContactLine }
