// Turns a user's own free-text target roles into title-matching keywords.
// Deliberately sector-agnostic: it derives signal from whatever the user
// (or their CV) actually typed, rather than assuming a fixed profession
// list. Used anywhere we'd otherwise need a hardcoded keyword/reject list
// tied to one kind of career (see PROGRESS.md CV-personalisation fixes).
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'and', 'or', 'to', 'in', 'on', 'at', 'with',
  // Level/seniority modifiers — generic across every profession, so they
  // carry no domain signal on their own (mirrors lib/match-engine.js's
  // LOW_SIGNAL_WORDS reasoning).
  'senior', 'junior', 'head', 'director', 'manager', 'lead', 'principal',
  'chief', 'vp', 'deputy', 'assistant', 'associate', 'generalist',
])

export function extractRoleKeywords(targetRoles) {
  const words = new Set()
  const phrases = new Set()
  for (const role of (targetRoles || [])) {
    const clean = String(role || '').trim().toLowerCase()
    if (!clean) continue
    phrases.add(clean)
    for (const w of clean.split(/[^a-z0-9]+/)) {
      if (w.length >= 3 && !STOP_WORDS.has(w)) words.add(w)
    }
  }
  return { words: [...words], phrases: [...phrases] }
}

// True if `title` plausibly matches the user's own target roles — either the
// full phrase appears, or it shares one of their real keywords.
export function titleMatchesRoleKeywords(title, targetRoles) {
  const t = String(title || '').toLowerCase()
  if (!t) return false
  const { words, phrases } = extractRoleKeywords(targetRoles)
  if (phrases.some(p => t.includes(p))) return true
  return words.some(w => t.includes(w))
}
