/**
 * lib/loop-guard.js — G3 response deduplication.
 * Detects near-identical consecutive AI responses before they surface to the user.
 * CJS, no AI calls, no DB — pure text comparison.
 *
 * On a detected loop, callers must discard the AI output and return a
 * DB-reconstructed structured fallback instead of the repeating paragraph.
 */

function tokenize(text) {
  return new Set(((text || '').toLowerCase().match(/\b\w+\b/g) || []))
}

function jaccardSimilarity(a, b) {
  const setA = tokenize(a)
  const setB = tokenize(b)
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const w of setA) { if (setB.has(w)) intersection++ }
  const union = setA.size + setB.size - intersection
  return intersection / union
}

/**
 * Checks whether newResponse is a near-duplicate of priorResponse.
 * @param {string} newResponse
 * @param {string} priorResponse
 * @param {number} threshold     — Jaccard similarity at which to flag a loop (default 0.85)
 * @returns {{ isLoop: boolean, similarity: number }}
 */
function checkForLoop(newResponse, priorResponse, threshold = 0.85) {
  if (!newResponse || !priorResponse) return { isLoop: false, similarity: 0 }
  const similarity = Math.round(jaccardSimilarity(newResponse, priorResponse) * 100) / 100
  return { isLoop: similarity >= threshold, similarity }
}

module.exports = { checkForLoop }
