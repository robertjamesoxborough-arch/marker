/**
 * lib/ai-context.js — G3 context reconstruction.
 * Builds a bounded system-context block from structured DB fields.
 * CJS so it can be tested with `node lib/ai-context.test.js`.
 *
 * CRITICAL (G3 invariant): the AI reads identity fresh from the DB on
 * every call. Chat is disposable. Wipe chat rows → this output is identical.
 * Every fact here comes from a typed DB column, never from free-text history.
 */

const MAX_CHARS = 2000

const BENEFIT_LABELS = {
  enhanced_parental_leave: 'enhanced parental leave',
  term_time:               'term-time working',
  four_day_week:           '4-day week',
  fully_remote:            'fully remote',
  hybrid:                  'hybrid working',
  share_options:           'share options',
  private_health:          'private health insurance',
}

/**
 * Builds a bounded plain-English candidate context string from structured DB records.
 * @param {object|null} profile         — profiles row
 * @param {Array|null}  careerHistory   — career_history rows (newest first)
 * @param {Array|null}  wishlists       — wishlists rows
 * @returns {string} Context string, always ≤ MAX_CHARS
 */
function buildAiContext(profile, careerHistory, wishlists) {
  if (!profile) return 'No candidate profile on file.'

  const parts = []

  if (profile.seniority) parts.push(`Seniority: ${profile.seniority}.`)

  const roles = (profile.target_roles || []).join(', ')
  if (roles) parts.push(`Target roles: ${roles}.`)

  const industries = (profile.industries || []).join(', ')
  if (industries) parts.push(`Industries: ${industries}.`)

  if (profile.max_office_days != null) {
    parts.push(`Max office days/week: ${profile.max_office_days}.`)
  }
  if (profile.postcode) parts.push(`Based near: ${profile.postcode}.`)
  if (profile.salary_floor) {
    parts.push(`Salary floor: £${Math.round(profile.salary_floor / 1000)}k.`)
  }

  const keywords = (profile.hard_filters_json?.cvKeywords || []).join(', ')
  if (keywords) parts.push(`Key skills: ${keywords}.`)

  const benefits = (profile.hard_filters_json?.benefits || [])
    .map(b => BENEFIT_LABELS[b] || b)
    .filter(Boolean)
  if (benefits.length) parts.push(`Preferred benefits: ${benefits.join(', ')}.`)

  if (profile.track) parts.push(`Career track: ${profile.track}.`)

  // Up to 3 most-recent roles from career_history
  if (Array.isArray(careerHistory) && careerHistory.length > 0) {
    const recent = careerHistory.slice(0, 3).map(h => {
      const from = h.start_date ? String(h.start_date).slice(0, 7) : '?'
      const to   = h.end_date   ? String(h.end_date).slice(0, 7)   : 'present'
      return `${h.role_title} at ${h.company} (${from}–${to})`
    })
    parts.push(`Recent experience: ${recent.join('; ')}.`)
  }

  // Up to 5 target companies from wishlists
  if (Array.isArray(wishlists) && wishlists.length > 0) {
    const companies = wishlists.slice(0, 5).map(w => w.company).filter(Boolean).join(', ')
    if (companies) parts.push(`Target companies: ${companies}.`)
  }

  const base = parts.join(' ')

  // Fill remaining budget with CV excerpt
  const remaining = MAX_CHARS - base.length - 14  // ' CV excerpt: '.length
  const cvRaw = profile.hard_filters_json?.cvRaw || ''
  if (remaining > 100 && cvRaw) {
    return (base + ' CV excerpt: ' + cvRaw.slice(0, remaining)).slice(0, MAX_CHARS)
  }

  return base.slice(0, MAX_CHARS)
}

module.exports = { buildAiContext, MAX_CHARS }
