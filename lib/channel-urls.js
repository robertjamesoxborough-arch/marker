// Job Aggregator: pure URL builders for the channels Requite can legally
// link OUT to but never scrape or store data from (Adzuna is the exception —
// it's the one channel this app already ingests via its own API elsewhere;
// here we only ever build its public search-page URL, same link-out
// treatment as Indeed/LinkedIn). Every pattern below was verified live
// against the real site before being written here (see PROGRESS.md Stage 57):
//
//  - Indeed (uk.indeed.com/jobs): honours location (l) and radius correctly.
//    Its "Pay" filter writes a `salaryType=£<amount>` param (URL-encoded,
//    e.g. salaryType=%C2%A380%2C000 for £80,000) — confirmed it also accepts
//    values outside its own 5-item quick-filter list, so any of Requite's
//    SALARY_FLOOR_OPTIONS bands works even though most aren't in Indeed's
//    own preset list. `sort=date` sorts newest-first.
//
//  - LinkedIn (linkedin.com/jobs/search): silently ignores/overrides the
//    `location` param — tested twice, logged in and requesting both a real
//    UK postcode and a different city, both times it fell back to whatever
//    "London (80 km)" the account's own profile location implies, not what
//    was requested. So LinkedIn links here carry NO location — they are
//    deliberately NATIONAL, newest-sorted (`sortBy=DD&f_TPR=r86400`, the
//    last-24h filter), and must never be labelled "near you" anywhere in
//    the UI. This is a real constraint of the channel, not a bug in this
//    code.
//
//  - Adzuna's PUBLIC search page (adzuna.co.uk/jobs/search — distinct from
//    the ingest API this app already calls elsewhere) uses `w=` for
//    location, `sf=` for a salary floor in whole pounds, and `sb=date&sd=down`
//    for newest-first. Its own search UI exposes no radius/distance control,
//    so none is built here — adding an unverified param would repeat the
//    exact LinkedIn location mistake this file exists to avoid.

function buildIndeedUrl({ role, postcode, radiusMiles, salaryFloor }) {
  const params = new URLSearchParams()
  params.set('q', role)
  if (postcode) params.set('l', postcode)
  if (radiusMiles) params.set('radius', String(radiusMiles))
  if (salaryFloor) params.set('salaryType', `£${Number(salaryFloor).toLocaleString('en-GB')}`)
  params.set('sort', 'date')
  return `https://uk.indeed.com/jobs?${params.toString()}`
}

// Deliberately no location param — see file header. `role` is the only
// input that matters here.
function buildLinkedInUrl({ role }) {
  const params = new URLSearchParams()
  params.set('keywords', role)
  params.set('sortBy', 'DD')
  params.set('f_TPR', 'r86400')
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`
}

function buildAdzunaUrl({ role, postcode, salaryFloor }) {
  const params = new URLSearchParams()
  params.set('q', role)
  if (postcode) params.set('w', postcode)
  if (salaryFloor) params.set('sf', String(salaryFloor))
  params.set('sb', 'date')
  params.set('sd', 'down')
  return `https://www.adzuna.co.uk/jobs/search?${params.toString()}`
}

// One role -> all three channel links, reading the profile shape this app
// actually stores (profiles.postcode, profiles.salary_floor in whole
// pounds, hard_filters_json.radiusMiles in miles).
function buildChannelUrls(role, profile) {
  const postcode = profile?.postcode || ''
  const radiusMiles = profile?.hard_filters_json?.radiusMiles ?? 50
  const salaryFloor = profile?.salary_floor || null
  return {
    indeed: buildIndeedUrl({ role, postcode, radiusMiles, salaryFloor }),
    linkedin: buildLinkedInUrl({ role }),
    adzuna: buildAdzunaUrl({ role, postcode, salaryFloor }),
  }
}

// Research cadence per channel — how often a disciplined sweep should
// revisit it. LinkedIn/Indeed change fastest (new postings hourly on the
// big boards); Adzuna and target-company career pages move slower, so
// checking every 2-3 days is enough. 'specialist' is listed here as a
// roadmap placeholder only — no specialist-board mapping exists yet (NHS
// Jobs, teaching-vacancy portals, trades boards; see PROGRESS.md Stage 53's
// banked roadmap item), so it is NOT rendered as a real channel row until
// that ingest source is actually built.
const CHANNEL_CADENCE_DAYS = {
  indeed: 1,
  linkedin: 1,
  adzuna: 2.5,
  target_companies: 2.5,
}

const CHANNEL_LABELS = {
  indeed: 'Indeed',
  linkedin: 'LinkedIn',
  adzuna: 'Adzuna',
  target_companies: 'Target companies',
}

// Real channels the sweep tracks cadence for, in display order.
const CHANNELS = ['indeed', 'linkedin', 'adzuna', 'target_companies']

function isChannelOverdue(channel, lastCheckedAt) {
  if (!lastCheckedAt) return true
  const cadenceMs = (CHANNEL_CADENCE_DAYS[channel] || 1) * 24 * 60 * 60 * 1000
  return Date.now() - new Date(lastCheckedAt).getTime() > cadenceMs
}

module.exports = {
  buildIndeedUrl,
  buildLinkedInUrl,
  buildAdzunaUrl,
  buildChannelUrls,
  CHANNEL_CADENCE_DAYS,
  CHANNEL_LABELS,
  CHANNELS,
  isChannelOverdue,
}
