// Job Aggregator / dashboard-wide duplicate detection (Stage 58). Pure,
// deterministic string matching -- zero AI calls, by design. The problem
// this solves: the same real job arrives under different URLs (Adzuna's
// redirect hash changes per call, LinkedIn/Indeed/a company's own board all
// differ), so matching on URL alone misses real duplicates -- the exact
// failure mode already documented for jobs_cache repost dedup in
// lib/dedupe-jobs.js. This module is deliberately separate from that file
// rather than merged into it: dedupe-jobs.js dedupes anonymous rows within
// one nightly ingest batch (already live, already audited, low regression
// tolerance); this one compares a candidate job against a specific user's
// own pipeline/dismissed history, a different question with a harder
// normaliser, and touching the ingest-side file for this was not worth the
// risk to something already working.
//
// Two tiers, because false positives destroy trust and false negatives
// defeat the point:
//   STRONG -- same stable external/ad id, OR company + title + location
//             all match exactly after normalisation (all three present).
//             Confident enough to skip a paid scoring call or block an add.
//   SOFT   -- company matches and title is a strong fuzzy match but not
//             exact, OR company + title match exactly but location differs
//             or is missing on either side. Never asserted as fact --
//             always phrased as "might be the same as".

const COMPANY_SUFFIXES = [
  'limited', 'ltd', 'plc', 'llp', 'llc', 'inc', 'incorporated', 'corp',
  'corporation', 'group', 'holdings', 'bank', 'uk', 'gb', 'co', 'company',
  '\\(uk\\)', 'the',
]
const COMPANY_SUFFIX_RE = new RegExp(`\\b(${COMPANY_SUFFIXES.join('|')})\\b`, 'g')

// A small set of common title-variant collapses -- not an exhaustive
// dictionary, just the abbreviations/spellings that would otherwise
// silently defeat an exact-match STRONG tier on an obvious same-title case.
const TITLE_VARIANTS = [
  [/\bsr\.?\b/g, 'senior'],
  [/\bjr\.?\b/g, 'junior'],
  [/\bmgr\.?\b/g, 'manager'],
  [/\bexec\.?\b/g, 'executive'],
  [/\bassoc\.?\b/g, 'associate'],
  [/\bcoord\.?\b/g, 'coordinator'],
  [/&/g, ' and '],
  [/\bvp\b/g, 'vice president'],
]

const LOCATION_SUFFIX_RE = /\b(uk|united kingdom|england|scotland|wales|northern ireland|gb)\b/g

function collapse(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function normaliseCompany(s) {
  let v = collapse(s)
  v = v.replace(COMPANY_SUFFIX_RE, ' ')
  return v.replace(/\s+/g, ' ').trim()
}

function normaliseTitle(s) {
  // Variant replacement runs on the lowercased-but-not-yet-collapsed string
  // — some variants (e.g. "&") rely on punctuation that collapse() strips.
  let v = (s || '').toLowerCase()
  for (const [pattern, replacement] of TITLE_VARIANTS) v = v.replace(pattern, replacement)
  return collapse(v)
}

function normaliseLocation(s) {
  let v = collapse(s)
  v = v.replace(LOCATION_SUFFIX_RE, ' ')
  return v.replace(/\s+/g, ' ').trim()
}

// Token-Jaccard similarity, 0-1. Same lightweight approach already used
// elsewhere in this codebase for role-query dedup (lib/aggregate-role-
// queries.js) rather than pulling in a fuzzy-matching dependency.
function titleSimilarity(a, b) {
  const ta = new Set(normaliseTitle(a).split(' ').filter(Boolean))
  const tb = new Set(normaliseTitle(b).split(' ').filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let overlap = 0
  for (const t of ta) if (tb.has(t)) overlap++
  const union = new Set([...ta, ...tb]).size
  return union === 0 ? 0 : overlap / union
}

const SOFT_TITLE_SIMILARITY_THRESHOLD = 0.5

// candidate: { company, roleTitle, location, externalId }
// record:    { id, source: 'pipeline' | 'dismissed', status, company, roleTitle, location, externalId }
// Returns { tier: 'strong' | 'soft' | 'none', record, reason }
function matchOne(candidate, record) {
  if (candidate.externalId && record.externalId && candidate.externalId === record.externalId) {
    return { tier: 'strong', record, reason: 'Same listing ID' }
  }

  const companyMatch = candidate.company && record.company
    && normaliseCompany(candidate.company) === normaliseCompany(record.company)
  if (!companyMatch) return { tier: 'none', record, reason: null }

  const candTitle = normaliseTitle(candidate.roleTitle)
  const recTitle = normaliseTitle(record.roleTitle)
  const titleExact = candTitle && recTitle && candTitle === recTitle
  const sim = titleSimilarity(candidate.roleTitle, record.roleTitle)

  if (titleExact) {
    const candLoc = candidate.location ? normaliseLocation(candidate.location) : ''
    const recLoc = record.location ? normaliseLocation(record.location) : ''
    if (candLoc && recLoc) {
      return candLoc === recLoc
        ? { tier: 'strong', record, reason: 'Same company, title and location' }
        : { tier: 'soft', record, reason: 'Same company and title, different location' }
    }
    return { tier: 'soft', record, reason: 'Same company and title, location not available to confirm' }
  }

  if (sim >= SOFT_TITLE_SIMILARITY_THRESHOLD) {
    return { tier: 'soft', record, reason: 'Same company, similar title' }
  }

  return { tier: 'none', record, reason: null }
}

// Checks a candidate against every record, returns the single best match
// (strong beats soft beats none). null if nothing matches at all.
function matchJob(candidate, records) {
  let best = null
  for (const record of records || []) {
    const m = matchOne(candidate, record)
    if (m.tier === 'none') continue
    if (!best || (m.tier === 'strong' && best.tier === 'soft')) best = m
    if (best?.tier === 'strong') break
  }
  return best
}

module.exports = {
  normaliseCompany,
  normaliseTitle,
  normaliseLocation,
  titleSimilarity,
  matchJob,
  SOFT_TITLE_SIMILARITY_THRESHOLD,
}
