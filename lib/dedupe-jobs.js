// Shared cross-source/repost dedup for jobs_cache rows. The same real job
// ad can land in the cache more than once: Adzuna issues a new numeric ad
// id when an agency reposts, or when its own crawler re-picks up the same
// ad from a second board, and cron/gov's Adzuna-flavoured public-sector
// queries can independently pull an ad cron/adzuna already stored, under a
// `gov-` external_id instead of `adzuna-`. external_id is already correctly
// derived from Adzuna's stable numeric ad id everywhere (audited
// 2026-08-13 — not a redirect-URL bug), so this is a content-level
// duplicate, not an id one: dedup on normalised company + role title +
// location and keep whichever row has the higher baseline score (tie-broken
// by most recently verified).

function normaliseForDedup(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function dedupeByContent(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = [normaliseForDedup(row.company), normaliseForDedup(row.role_title), normaliseForDedup(row.location)].join('|')
    const existing = groups.get(key)
    if (!existing) { groups.set(key, row); continue }
    const rowScore = row.match_score ?? 0
    const exScore  = existing.match_score ?? 0
    const rowTime  = new Date(row.last_verified_at || row.cached_at || 0).getTime()
    const exTime   = new Date(existing.last_verified_at || existing.cached_at || 0).getTime()
    if (rowScore > exScore || (rowScore === exScore && rowTime > exTime)) groups.set(key, row)
  }
  return [...groups.values()]
}

module.exports = { dedupeByContent, normaliseForDedup }
