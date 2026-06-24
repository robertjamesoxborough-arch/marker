/**
 * lib/freshness.js — G2 read-time freshness enforcement.
 * CJS so it can be tested with `node lib/freshness.test.js` and imported by Next.js routes.
 * CRITICAL: applyFreshnessToRow ALWAYS overrides the stored DB freshness field.
 * The cron is an optimisation; this helper is the real gate.
 */

const THRESHOLDS = {
  FRESH_MS: 48 * 60 * 60 * 1000,        // < 48h  → Fresh
  AGING_MS:  7 * 24 * 60 * 60 * 1000,   // < 7d   → Aging
  STALE_MS: 14 * 24 * 60 * 60 * 1000,   // < 14d  → Stale
  // ≥ 14d → Expired
}

// Derives freshness state purely from lastVerifiedAt timestamp.
// Ignores any stored freshness column — that's the G2 invariant.
function computeFreshnessState(lastVerifiedAt, now) {
  if (!lastVerifiedAt) return 'Stale'
  const ref = now instanceof Date ? now : (now ? new Date(now) : new Date())
  const age = ref - new Date(lastVerifiedAt)
  if (age < THRESHOLDS.FRESH_MS) return 'Fresh'
  if (age < THRESHOLDS.AGING_MS) return 'Aging'
  if (age < THRESHOLDS.STALE_MS) return 'Stale'
  return 'Expired'
}

// Human-readable age string for the Freshness Pulse badge.
function relativeTime(lastVerifiedAt, now) {
  if (!lastVerifiedAt) return 'unknown'
  const ref = now instanceof Date ? now : (now ? new Date(now) : new Date())
  const age = ref - new Date(lastVerifiedAt)
  const h = Math.floor(age / (60 * 60 * 1000))
  if (h < 1)  return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

// Enriches a DB row with read-time freshness state and relativeTime.
// The stored row.freshness is OVERRIDDEN — cron lag cannot cause a stale job to appear Fresh.
function applyFreshnessToRow(row, now) {
  const anchor = row.last_verified_at || row.cached_at || row.first_seen_at
  const state  = computeFreshnessState(anchor, now)
  return {
    ...row,
    freshness:    state,
    relativeTime: relativeTime(anchor, now),
  }
}

const SORT_ORDER = { Fresh: 0, Aging: 1, Stale: 2, Expired: 3 }

// Filters out Expired rows (unless showExpired=true) and sorts Fresh → Aging → Stale → Expired.
function filterAndSortByFreshness(rows, options) {
  const showExpired = !!(options && options.showExpired)
  return rows
    .filter(r => showExpired || r.freshness !== 'Expired')
    .sort((a, b) => (SORT_ORDER[a.freshness] ?? 2) - (SORT_ORDER[b.freshness] ?? 2))
}

module.exports = {
  computeFreshnessState,
  relativeTime,
  applyFreshnessToRow,
  filterAndSortByFreshness,
  THRESHOLDS,
}
