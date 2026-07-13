/**
 * lib/scoring.js — Requite unified scoring model.
 * SINGLE SOURCE OF TRUTH for how ANY job is scored anywhere in Requite.
 *
 * Multi-tenant: NOTHING here is hardcoded to a candidate. Every profile
 * string is built at request time from the signed-in user's profiles +
 * career_history rows. Rebuilt fresh for Requite's Supabase architecture.
 *
 * Two tiers share ONE rubric (verbatim in every prompt):
 *   QUICK — feed scans, title/company/location only, Haiku.
 *   FULL  — /api/analyse against the real JD, 8 factors, Sonnet.
 *
 * The FULL overall is computed in code from factors x WEIGHTS
 * (computeOverall). The model never sets its own overall.
 *
 * CJS so it can be tested with `node lib/scoring.test.js`.
 */

// ── Factor weights (8 factors, must sum to 1.0) ────────────────────────────
// Keys match the factor keys returned by /api/analyse and the UI FACTOR_LABELS.
const WEIGHTS = {
  roleSkillsMatch:   0.30, // Skills
  seniorityFit:      0.15, // Seniority
  officeFlexibility: 0.15, // Office flexibility
  industryFit:       0.10, // Industry
  salaryMarket:      0.10, // Salary
  careerGrowth:      0.10, // Growth
  companyCulture:    0.05, // Culture
  paternityLeave:    0.05, // Parental leave
}

// Human-readable label per factor (kept in step with the app UI).
const FACTOR_LABELS = {
  roleSkillsMatch:   'Skills',
  seniorityFit:      'Seniority',
  officeFlexibility: 'Office flexibility',
  industryFit:       'Industry',
  salaryMarket:      'Salary',
  careerGrowth:      'Growth',
  companyCulture:    'Culture',
  paternityLeave:    'Parental leave',
}

// Which model each tier runs on. Maps to keys in lib/anthropic MODELS.
const TIER_MODEL = {
  quick: 'haiku',
  full:  'sonnet',
}

// The neutral score used whenever a factor cannot be judged.
const NEUTRAL = 6

// ── Calibration anchors ────────────────────────────────────────────────────
// Plain-English definitions embedded verbatim in every scoring prompt so the
// quick scan and the full analysis mean the same thing by a given number.
const CALIBRATION = `CALIBRATION ANCHORS (apply these exactly):
- 9.0 = Exceptional fit. Skills, seniority and working pattern all line up with almost nothing to compromise on. A role worth dropping other applications for.
- 8.4 = Strong fit. Clearly worth applying. Minor gaps only (one factor slightly off), none of them dealbreakers.
- 7.0 = Solid, worth a look. Genuinely relevant but with a real trade-off: a stretch on seniority, an extra office day, or a salary at the edge of range.
- 5.0 = Borderline. Some overlap but a material mismatch on skills, level, location or pay. Apply only if options are thin.`

// ── Missing-information rule ────────────────────────────────────────────────
const MISSING_INFO_RULE = `MISSING INFORMATION: Any factor you cannot judge from the information provided scores a neutral ${NEUTRAL}. Never guess generously and never invent detail to fill a gap. A factor you are unsure about is a ${NEUTRAL}, not a high score.`

// ── Scoring scale ──────────────────────────────────────────────────────────
const SCALE_RULE = `SCALE: Whole numbers 1 to 7. For 8 and above use increments of 0.2 only (8.0, 8.2, 8.4 ... 9.8, 10.0). Score each factor 0 to 10 on this scale.`

// ── Weight table (shown to the model for context) ──────────────────────────
const WEIGHT_TABLE = `FACTOR WEIGHTS (the overall is a weighted average of these; it is computed by Requite, not by you):
- Skills 30%
- Seniority 15%
- Office flexibility 15%
- Industry 10%
- Salary 10%
- Growth 10%
- Culture 5%
- Parental leave 5%`

// ── THE RUBRIC ─────────────────────────────────────────────────────────────
// This exact string is embedded, unmodified, in the quick and the full prompt.
// If a scorer's prompt does not contain this verbatim, it is not a Requite score.
const RUBRIC = `${SCALE_RULE}

${WEIGHT_TABLE}

${CALIBRATION}

${MISSING_INFO_RULE}`

// ── Candidate profile builder ──────────────────────────────────────────────
// Builds a plain-English profile string from the user's own Supabase rows.
// No hardcoded names, no hardcoded history. Safe on partial profiles.
const BENEFIT_LABELS = {
  enhanced_parental_leave: 'enhanced parental leave',
  term_time:               'term-time working',
  four_day_week:           '4-day week',
  fully_remote:            'fully remote',
  hybrid:                  'hybrid working',
  share_options:           'share options',
  private_health:          'private health insurance',
}

const SENIORITY_LABELS = {
  senior_manager: 'Senior Manager', head_of: 'Head of',
  director: 'Director', vp: 'VP', c_suite: 'C-Suite',
}

function buildCandidateProfile(profile, careerHistory) {
  if (!profile) return 'No candidate profile on file. Score conservatively on the information available.'

  const hfj = profile.hard_filters_json || {}
  const parts = []

  const roles = (profile.target_roles || []).join(', ')
  if (roles) parts.push(`Target roles: ${roles}.`)

  // Seniority can live in either a single string or a seniorities[] array.
  const seniorities = (profile.seniorities || [])
    .map(s => SENIORITY_LABELS[s] || s).filter(Boolean)
  if (profile.seniority) parts.push(`Seniority: ${profile.seniority}.`)
  else if (seniorities.length) parts.push(`Seniority: ${seniorities.join(' or ')}.`)

  const industries = (profile.industries || []).join(', ')
  if (industries) parts.push(`Industries: ${industries}.`)
  else if (hfj.field) parts.push(`Field/sector: ${hfj.field}.`)

  if (profile.max_office_days != null) parts.push(`Max office days per week: ${profile.max_office_days}.`)
  if (profile.postcode) parts.push(`Based near: ${profile.postcode}.`)
  if (profile.salary_floor) parts.push(`Salary floor: £${Math.round(profile.salary_floor / 1000)}k.`)
  if (hfj.yearsExperience) parts.push(`${hfj.yearsExperience} years experience.`)

  const keywords = (hfj.cvKeywords || []).join(', ')
  if (keywords) parts.push(`Key skills: ${keywords}.`)

  const benefits = (hfj.benefits || []).map(b => BENEFIT_LABELS[b] || b).filter(Boolean)
  if (benefits.length) parts.push(`Preferred benefits: ${benefits.join(', ')}.`)

  const tracks = profile.tracks || (profile.track ? [profile.track] : [])
  if (tracks.length) parts.push(`Career track: ${tracks.join(', ')}.`)

  // Up to 3 most-recent roles from career_history (newest first).
  if (Array.isArray(careerHistory) && careerHistory.length > 0) {
    const recent = careerHistory.slice(0, 3).map(h => {
      const from = h.start_date ? String(h.start_date).slice(0, 7) : '?'
      const to   = h.end_date   ? String(h.end_date).slice(0, 7)   : 'present'
      return `${h.role_title} at ${h.company} (${from}–${to})`
    })
    parts.push(`Recent experience: ${recent.join('; ')}.`)
  }

  return parts.join(' ') || 'Sparse candidate profile. Score conservatively on the information available.'
}

// ── Deterministic overall ──────────────────────────────────────────────────
function factorScore(v) {
  const n = typeof v === 'object' && v !== null ? v.score : v
  const num = Number(n)
  return Number.isFinite(num) ? Math.max(0, Math.min(10, num)) : null
}

// Round a raw weighted average onto the Requite scale.
function roundToScale(x) {
  const c = Math.max(0, Math.min(10, x))
  if (c >= 8) return Math.round(c * 5) / 5 // nearest 0.2 in the 8+ band
  return Math.round(c)                     // whole numbers below 8
}

/**
 * Compute the FULL overall in code from the 8 factor scores.
 * Missing / unparseable factors fall back to the neutral score.
 * @returns {{ raw:number, score:number, usedNeutralFor:string[] }}
 */
function computeOverall(factors) {
  const f = factors || {}
  let raw = 0
  const usedNeutralFor = []
  for (const key of Object.keys(WEIGHTS)) {
    let s = factorScore(f[key])
    if (s === null) { s = NEUTRAL; usedNeutralFor.push(key) }
    raw += s * WEIGHTS[key]
  }
  raw = Math.round(raw * 100) / 100
  return { raw, score: roundToScale(raw), usedNeutralFor }
}

// ── Prompt builders (both embed RUBRIC verbatim) ───────────────────────────

// FULL scorer system prompt (Sonnet / Haiku for /api/analyse).
// hardFilters is the caller's pre-built hard-filter block (may be empty).
function buildFullSystem(candidateProfile, hardFilters, jsonSchema, styleRules) {
  return `You are a senior job matching assistant. Analyse the job description against the candidate profile below and return structured JSON scores.

CANDIDATE:
${candidateProfile}

${RUBRIC}${hardFilters ? '\n\nHARD FILTERS (apply before scoring):\n' + hardFilters : ''}

${jsonSchema}

${styleRules || ''}`.trim()
}

module.exports = {
  WEIGHTS,
  FACTOR_LABELS,
  TIER_MODEL,
  NEUTRAL,
  CALIBRATION,
  MISSING_INFO_RULE,
  SCALE_RULE,
  WEIGHT_TABLE,
  RUBRIC,
  buildCandidateProfile,
  computeOverall,
  roundToScale,
  buildFullSystem,
}
