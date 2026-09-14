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

function extractRoleKeywords(targetRoles) {
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

// Lightweight, dependency-free suffix stripping -- not a full stemmer, just
// enough that an AI-suggested role family in one grammatical form ("Marine
// Pilotage", "Arboricultural Consulting", "Bookkeeping") isn't blind to the
// real job-title form of the exact same profession ("Harbour Pilot",
// "Consultant Arborist", "Bookkeeper"). Found live in a Stage 68 stress
// test across genuinely diverse professions: all three of those pairs
// failed a pure exact-word match despite being the same job to a human,
// purely because of English noun/agent-noun/gerund suffix variation --
// not a profession-rarity issue, a word-form one, so the fix is generic
// rather than a name for any specific field.
const STEM_SUFFIXES = ['ations', 'ation', 'ering', 'ments', 'ment', 'ants', 'ant', 'ing', 'ers', 'ors', 'age', 'ies', 'ist', 'er', 'or', 'y']
function stemWord(word) {
  const w = String(word || '').toLowerCase()
  for (const suf of STEM_SUFFIXES) {
    if (w.length > suf.length + 3 && w.endsWith(suf)) return w.slice(0, -suf.length)
  }
  return w
}

// True if `title` plausibly matches the user's own target roles: the full
// phrase appears, a real keyword appears verbatim, or a keyword shares a
// stem with a word in the title (the word-form fallback above).
function titleMatchesRoleKeywords(title, targetRoles) {
  const t = String(title || '').toLowerCase()
  if (!t) return false
  const { words, phrases } = extractRoleKeywords(targetRoles)
  if (phrases.some(p => t.includes(p))) return true
  if (words.some(w => t.includes(w))) return true
  const titleWords = t.split(/[^a-z0-9]+/).filter(Boolean)
  const roleStems = new Set(words.map(stemWord))
  return titleWords.some(tw => roleStems.has(stemWord(tw)))
}

module.exports = { extractRoleKeywords, stemWord, titleMatchesRoleKeywords }
