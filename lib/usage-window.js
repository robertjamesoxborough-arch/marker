/**
 * lib/usage-window.js — usage-window maths for allowance caps.
 * Pure, dependency-free CJS so it runs under `node lib/usage-window.test.js`.
 *
 * Some actions reset monthly (the default), some daily. This file owns the
 * per-action period map and the window-start calculation; lib/allowance.js
 * imports both. Kept out of allowance.js so it stays testable without the
 * Supabase client.
 */

// Reset window per action. Anything not listed defaults to 'month'.
// feed_fresh_scan is the Pro/Max "Fresh scan" button — capped PER DAY so a
// user cannot burn a month's worth of live scans in one sitting.
const ACTION_PERIOD = {
  feed_fresh_scan: 'day',
}

/**
 * Start of the current usage window for a period.
 * UTC-based so it lines up with ai_usage.created_at (stored UTC) and the crons
 * (which run in UTC); a local-time boundary would drift the daily reset.
 * @param {'day'|'month'} period
 * @param {Date} [now] — injectable for testing; defaults to real now.
 * @returns {Date} 00:00 UTC today (day) or 00:00 UTC on the 1st (month)
 */
function windowStart(period, now) {
  const d = now ? new Date(now) : new Date()
  d.setUTCHours(0, 0, 0, 0)
  if (period === 'day') return d
  d.setUTCDate(1) // start of the calendar month (UTC)
  return d
}

function periodFor(action) {
  return ACTION_PERIOD[action] || 'month'
}

module.exports = { ACTION_PERIOD, windowStart, periodFor }
