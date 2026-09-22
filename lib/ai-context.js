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

  const benefits = (profile.hard_filters_json?.benefits || [])
    .map(b => BENEFIT_LABELS[b] || b)
    .filter(Boolean)
  if (benefits.length) parts.push(`Preferred benefits: ${benefits.join(', ')}.`)

  if (profile.track) parts.push(`Career track: ${profile.track}.`)

  // Up to 5 target companies from wishlists
  if (Array.isArray(wishlists) && wishlists.length > 0) {
    const companies = wishlists.slice(0, 5).map(w => w.company).filter(Boolean).join(', ')
    if (companies) parts.push(`Target companies: ${companies}.`)
  }

  const base = parts.join(' ')

  // Session M: prefer structured career_history over the raw CV blob once
  // it exists -- shorter, cleaner, cheaper, and consistent across every AI
  // route reading it, instead of each call re-parsing the same raw text.
  // Fall back to a cvRaw excerpt only when no structured history exists yet
  // (not backfilled, or the user has never uploaded a CV).
  if (Array.isArray(careerHistory) && careerHistory.length > 0) {
    const remaining = MAX_CHARS - base.length - 14  // ' Experience: '.length
    if (remaining > 100) {
      const lines = careerHistory.slice(0, 6).map(h => {
        const from = h.start_date ? String(h.start_date).slice(0, 7) : '?'
        const to   = h.end_date   ? String(h.end_date).slice(0, 7)   : 'present'
        // achievements is a real Postgres text[] array from the DB, but
        // stay tolerant of a plain newline-joined string too (older
        // fixtures, or any other future caller).
        const achievements = (Array.isArray(h.achievements) ? h.achievements : (h.achievements || '').split('\n')).filter(Boolean).slice(0, 2)
        const achText = achievements.length ? `: ${achievements.join('; ')}` : ''
        return `${h.role_title} at ${h.company} (${from}–${to})${achText}`
      })
      let experience = lines.join('. ')
      if (experience.length > remaining) experience = experience.slice(0, remaining)
      return (base + ' Experience: ' + experience).slice(0, MAX_CHARS)
    }
    return base.slice(0, MAX_CHARS)
  }

  // Fill remaining budget with CV excerpt
  const remaining = MAX_CHARS - base.length - 14  // ' CV excerpt: '.length
  const cvRaw = profile.hard_filters_json?.cvRaw || ''
  if (remaining > 100 && cvRaw) {
    return (base + ' CV excerpt: ' + cvRaw.slice(0, remaining)).slice(0, MAX_CHARS)
  }

  return base.slice(0, MAX_CHARS)
}

// STAGE 81 FIX -- do not reintroduce this bug.
//
// Every AI route that calls buildAiContext() above sends its output
// straight into a prompt demanding "Return ONLY a JSON object/array, no
// markdown, no commentary" and then does `text.match(/\{[\s\S]*\}/)` (or
// the array equivalent) on the reply, returning a raw 500 "Could not parse
// response" if that match fails. Against a genuinely thin profile (no
// cvRaw, no target_roles, no career history) buildAiContext() returns
// close to an empty string, and the model does not reliably keep following
// the strict-JSON instruction when handed almost nothing to reason about --
// it sometimes replies conversationally instead ("I don't have enough
// information about this candidate to..."), which fails the regex match
// and 500s. This is NOT deterministic (most calls against a blank profile
// still return valid, if generic, JSON), which is exactly why it is a real
// but easy-to-miss bug: a handful of direct test calls can look fine while
// the underlying class of failure is still live. Already known and worked
// around once, client-side only, in app/app/tabs/TodayDashboard.js's own
// "STILL SETTING YOU UP" card -- this is that same check, enforced
// server-side too, so every route that reads a candidate profile is
// protected, not just the one screen that happened to add a guard.
//
// hasEnoughProfile() uses the EXACT SAME definition TodayDashboard already
// uses (cvRaw present, or at least one target role), not a new one, so
// "thin enough to redirect to onboarding" means the same thing everywhere
// in the product. Every route that builds a candidate context should call
// this BEFORE ever reaching the model, and return a graceful, structured
// response instead -- never attempt the call and hope the parse succeeds.
function hasEnoughProfile(profile) {
  return !!(profile?.hard_filters_json?.cvRaw || (profile?.target_roles && profile.target_roles.length > 0))
}

// Shared copy so every route that hits this guard says the same clear
// thing, same convention as SPEND_CEILING_MESSAGE in lib/allowance-config.js.
const THIN_PROFILE_MESSAGE = 'Finish setting up your profile first, then we can score roles for you.'

module.exports = { buildAiContext, MAX_CHARS, hasEnoughProfile, THIN_PROFILE_MESSAGE }
