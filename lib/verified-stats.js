const YEAR_RE = /\b(19[6-9]\d|20[012]\d)\b/g
const METRIC_RE = /£[\d,.]+[km]?|\$[\d,.]+[km]?|\d+(?:\.\d+)?%|\b[1-9]\d{2,}(?:\.\d+)?[km]?\b/gi

function normalize(s) {
  return (s || '').toLowerCase().replace(/,/g, '').trim()
}

function extractVerifiableNumbers(text) {
  const found = new Set()
  for (const m of (text.match(YEAR_RE) || [])) found.add(m)
  for (const m of (normalize(text).match(METRIC_RE) || [])) {
    if (m) found.add(m)
  }
  return found
}

function buildVerifiedPool(cvRaw, achievements) {
  const parts = [cvRaw || '']
  if (Array.isArray(achievements)) parts.push(...achievements.filter(Boolean))
  else if (typeof achievements === 'string' && achievements) parts.push(achievements)
  return normalize(parts.join(' '))
}

function checkVerifiedStats(aiText, cvRaw, achievements) {
  if (!aiText) return { flagged: [], safe: true }
  const numbers = extractVerifiableNumbers(aiText)
  if (numbers.size === 0) return { flagged: [], safe: true }
  const pool = buildVerifiedPool(cvRaw, achievements)
  const flagged = []
  for (const n of numbers) {
    if (!pool.includes(n)) flagged.push(n)
  }
  return { flagged, safe: flagged.length === 0 }
}

module.exports = { checkVerifiedStats, extractVerifiableNumbers, buildVerifiedPool }
