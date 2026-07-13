/**
 * lib/usage-window.test.js — run with `node lib/usage-window.test.js`.
 * Verifies the daily vs monthly usage-window maths that gates fresh scans.
 */
const { windowStart, periodFor } = require('./usage-window')

let failures = 0
function assert(cond, msg) {
  if (cond) { console.log('  ✅ ' + msg) }
  else { console.log('  ❌ ' + msg); failures++ }
}

console.log('Usage-window maths — self-test\n')

// A fixed mid-month, mid-day instant.
const now = new Date('2026-07-13T15:42:07.000Z')

const day = windowStart('day', now)
assert(day.getUTCHours() === 0 && day.getUTCMinutes() === 0 && day.getUTCSeconds() === 0, 'daily window starts at 00:00 UTC')
assert(day.getUTCDate() === now.getUTCDate() && day.getUTCMonth() === now.getUTCMonth(), 'daily window is the same UTC calendar day')

const month = windowStart('month', now)
assert(month.getUTCDate() === 1, 'monthly window starts on the 1st (UTC)')
assert(month.getUTCHours() === 0 && month.getUTCMonth() === now.getUTCMonth(), 'monthly window is first-of-month 00:00 UTC')

// A fresh scan taken at 00:05 and one at 23:55 on the same day share one window;
// the same times on different days do not.
const early = new Date('2026-07-13T00:05:00.000Z')
const late = new Date('2026-07-13T23:55:00.000Z')
const nextDay = new Date('2026-07-14T00:05:00.000Z')
assert(windowStart('day', early).getTime() === windowStart('day', late).getTime(), 'same-day scans share one daily window')
assert(windowStart('day', nextDay).getTime() !== windowStart('day', early).getTime(), 'next-day scan opens a fresh daily window')

// Period routing
assert(periodFor('feed_fresh_scan') === 'day', 'feed_fresh_scan resets daily')
assert(periodFor('analyse') === 'month', 'analyse resets monthly (default)')
assert(periodFor('anything_unlisted') === 'month', 'unlisted actions default to monthly')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
