/**
 * Fixture tests for Stage 85: lib/adzuna-budget.js (daily, weekly and monthly
 * ceilings with partial grants), lib/aggregate-role-queries.js rotateNightly(),
 * and lib/adzuna-http.js (header and 4xx body recording).
 * Run: node lib/adzuna-budget.test.mjs
 * No network, no database: Supabase and fetch are stubbed.
 */
import { reserveAdzuna, getAdzunaUsage, ADZUNA_WEEKLY_LIMIT, ADZUNA_MONTHLY_LIMIT, ADZUNA_DAILY_LIMIT, ADZUNA_ONDEMAND_CEILING } from './adzuna-budget.js'
import { rotateNightly, NIGHTLY_CAPS, ADZUNA_CATEGORIES } from './aggregate-role-queries.js'
import { adzunaFetch } from './adzuna-http.js'

let passed = 0
let failed = 0
function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) passed++
  else failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : `: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`)
}

// ── Fake clock and fake Supabase ──
const DAY = 86400000
const realNow = Date.now
const FIXED = Date.parse('2026-12-20T03:00:00Z') // whole 31-day window after the ledger epoch
Date.now = () => FIXED
const day = n => new Date(FIXED - n * DAY).toISOString().slice(0, 10)

function fakeSupabase(counts) {
  const rows = Object.entries(counts).map(([d, count]) => ({ metric: `adzuna_budget:${d}`, value: { count } }))
  const writes = []
  return {
    writes,
    from: () => ({
      select: () => ({ in: async (_col, keys) => ({ data: rows.filter(r => keys.includes(r.metric)) }) }),
      upsert: async (row) => { writes.push(row) },
    }),
  }
}

// ── 1. Rotation ──
const nightsToCover = (len, cap) => Math.ceil(len / cap)
for (const [name, len, cap] of [['roles', 35, NIGHTLY_CAPS.roles], ['categories', ADZUNA_CATEGORIES.length, NIGHTLY_CAPS.categories], ['contract', 24, NIGHTLY_CAPS.contract], ['gov', 31, NIGHTLY_CAPS.gov], ['roles grown to 44', 44, NIGHTLY_CAPS.roles]]) {
  const list = Array.from({ length: len }, (_, i) => `q${String(i).padStart(2, '0')}`)
  const n = nightsToCover(len, cap)
  // Check every possible starting night across a long run, not just one.
  let allCovered = true
  for (let start = 0; start < 60; start++) {
    const seen = new Set()
    for (let k = 0; k < n; k++) for (const q of rotateNightly(list, cap, x => x, FIXED + (start + k) * DAY)) seen.add(q)
    if (seen.size !== len) allCovered = false
  }
  assert(`rotation ${name}: ${cap}/night covers all ${len} in any ${n} consecutive nights`, allCovered, true)
  assert(`rotation ${name}: exactly ${cap} a night`, rotateNightly(list, cap, x => x).length, cap)
}
{
  const list = ['b', 'a', 'd', 'c', 'e']
  assert('rotation is independent of input order', rotateNightly(list, 3), rotateNightly([...list].reverse(), 3))
  assert('rotation returns the whole list when it fits under the cap', rotateNightly(list, 10).length, 5)
  const sum = NIGHTLY_CAPS.roles + NIGHTLY_CAPS.categories + NIGHTLY_CAPS.contract + NIGHTLY_CAPS.gov
  assert('nightly caps total 70', sum, 70)
  assert('70 a night x 31 nights stays under the monthly ceiling', sum * 31 <= ADZUNA_MONTHLY_LIMIT, true)
}

// ── 2. Budget ceilings ──
{
  const s = fakeSupabase({})
  const r = await reserveAdzuna({ calls: 34, kind: 'cron', service: s })
  assert('fresh ledger grants in full', [r.allowed, r.granted, r.limitedBy], [true, 34, null])
  assert('grant written to today\'s row', s.writes[0]?.value, { count: 34 })
}
{
  const s = fakeSupabase({ [day(0)]: ADZUNA_DAILY_LIMIT - 10 })
  const r = await reserveAdzuna({ calls: 34, kind: 'cron', service: s })
  assert('daily ceiling: partial grant of what is left', [r.granted, r.limitedBy], [10, 'daily'])
}
{
  const s = fakeSupabase({ [day(0)]: ADZUNA_ONDEMAND_CEILING })
  const r = await reserveAdzuna({ calls: 1, kind: 'ondemand', service: s })
  assert('on-demand ceiling still applies', [r.allowed, r.granted], [false, 0])
  assert('blocked reservation writes nothing', s.writes.length, 0)
}
{
  // 6 earlier days at 160 = 960 in the rolling week.
  const counts = Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [day(n), 160]))
  const r = await reserveAdzuna({ calls: 70, kind: 'cron', service: fakeSupabase(counts) })
  assert('weekly ceiling: partial grant', [r.granted, r.limitedBy], [ADZUNA_WEEKLY_LIMIT - 960, 'weekly'])
}
{
  // Day 7 back is OUTSIDE the rolling week, so it must not count.
  const r = await reserveAdzuna({ calls: 70, kind: 'cron', service: fakeSupabase({ [day(7)]: 900 }) })
  assert('rolling week excludes day 7', [r.granted, r.week.used], [70, 70])
}
{
  // 30 earlier days at 80 = 2,400 in the rolling 31 days; week is 6 x 80 = 480.
  const counts = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [day(i + 1), 80]))
  const r = await reserveAdzuna({ calls: 150, kind: 'cron', service: fakeSupabase(counts) })
  assert('monthly ceiling: partial grant', [r.granted, r.limitedBy], [ADZUNA_MONTHLY_LIMIT - 2400, 'monthly'])
}
{
  const counts = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [day(i + 1), 80]))
  const r = await reserveAdzuna({ calls: 150, kind: 'cron', service: fakeSupabase(counts), allowPartial: false })
  assert('allowPartial:false is all-or-nothing', [r.allowed, r.granted], [false, 0])
}
{
  // Old shared-app days (before the 2026-09-29 epoch) must not count.
  Date.now = () => Date.parse('2026-10-02T03:00:00Z')
  const r = await reserveAdzuna({ calls: 70, kind: 'cron', service: fakeSupabase({ '2026-09-28': 119, '2026-09-27': 119, '2026-09-30': 70 }) })
  assert('ledger epoch: pre-split days ignored in week and month', [r.granted, r.week.used, r.month.used], [70, 140, 140])
  const u = await getAdzunaUsage(fakeSupabase({ '2026-09-28': 119, '2026-10-01': 70, '2026-10-02': 12 }))
  assert('admin usage reports today, week, month', [u.used, u.week.used, u.month.used], [12, 82, 82])
  Date.now = () => FIXED
}

// ── 3. adzunaFetch recording ──
{
  const logs = []
  const origLog = console.log
  const origErr = console.error
  console.log = (...a) => logs.push(a.join(' '))
  console.error = (...a) => logs.push(a.join(' '))
  process.env.ADZUNA_APP_ID = 'testappid'
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url) => url.includes('bad')
    ? new Response('{"exception":"BAD_REQUEST","display":"Unknown company"}', { status: 400 })
    : new Response('{"results":[]}', { status: 200, headers: { 'x-ratelimit-remaining': '24', 'content-type': 'application/json' } })
  const r1 = await adzunaFetch('https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=testappid&app_key=SECRETKEY&what=x', {}, 't')
  const r2 = await adzunaFetch('https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=testappid&app_key=SECRETKEY&what=bad', {}, 't')
  globalThis.fetch = realFetch
  console.log = origLog
  console.error = origErr
  const first = logs.find(l => l.includes('first Adzuna response'))
  assert('first response headers recorded, incl. rate header', !!first && first.includes('x-ratelimit-remaining'), true)
  assert('headers recorded once per instance', logs.filter(l => l.includes('first Adzuna response')).length, 1)
  const err = logs.find(l => l.includes('Adzuna 400'))
  assert('4xx body recorded', !!err && err.includes('Unknown company'), true)
  assert('app key and id never logged', logs.some(l => l.includes('SECRETKEY') || l.includes('testappid')), false)
  assert('caller can still read the body', (await r2.json()).display, 'Unknown company')
  assert('wrapper returns the response unchanged', r1.status, 200)
}

Date.now = realNow
console.log(`\n${passed} PASS, ${failed} FAIL`)
process.exit(failed ? 1 : 0)
