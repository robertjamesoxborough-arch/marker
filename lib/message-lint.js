// Deterministic lint for AI-drafted referral/outreach messages (Stage 69).
// Same verification-not-trust philosophy as the CV lint (lib/cv-lint.js):
// a prompt instruction saying "no em dashes, no AI-tell filler" is a
// request, not a guarantee, and this project has already proven once
// (Stage 65) that trusting a model's own self-report on style compliance
// is worthless. Zero AI cost, pure string checks, always runs.

const AI_TELL_PHRASES = [
  'delve', 'moreover', 'furthermore', 'holistic', 'boast', 'testament to',
  'tapestry', 'leverage', 'synergy', 'unlock', 'elevate', 'seamless',
  'robust', 'cutting-edge', 'cutting edge', 'paradigm', 'esteemed',
  'utilize', 'utilise', 'game-changer', 'game changer', "in today's",
  'dive into', 'navigate the', 'landscape of', 'realm of', 'unparalleled',
  // Stage 82 — corporate-jargon "positioning memo" tells, added for the
  // cover letter generator specifically (lib/ai-context.js/app/api/cv/
  // cover-letter/route.js). Named directly from a real failure: a letter
  // that reads like an internal strategy memo rather than a person, dense
  // with vague marketing-department abstractions instead of anything a
  // human would actually say about why a role makes sense to them.
  'go-to-market discipline', 'go to market discipline', 'commercial signal',
  'category narrative', 'value proposition', 'core competenc',
  'strategic imperative', 'market dynamics', 'north star', 'move the needle',
  'best-in-class', 'best in class', 'world-class', 'world class',
  'mission-critical', 'mission critical', 'proven track record',
  'thought leadership', 'wheelhouse', 'hit the ground running',
  'at the intersection of', 'drive impact', 'drive value',
]

function lintMessage(text) {
  const issues = []
  const t = text || ''

  if (t.includes('—')) issues.push('Contains an em dash')

  const lower = t.toLowerCase()
  const foundTells = AI_TELL_PHRASES.filter(p => lower.includes(p))
  if (foundTells.length > 0) issues.push(`AI-tell phrasing: ${foundTells.join(', ')}`)

  return { ok: issues.length === 0, issues }
}

module.exports = { lintMessage, AI_TELL_PHRASES }
