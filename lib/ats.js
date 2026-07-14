/**
 * lib/ats.js — shared multi-ATS abstraction.
 * Covers Greenhouse, Lever, Ashby, SmartRecruiters — all four publish public,
 * documented JSON APIs, no auth required, legal and clean to poll.
 *
 * Workday intentionally excluded pending legal review — its job-listing
 * endpoint is undocumented and carries commercial risk.
 *
 * Adding a company is just adding one entry to COMPANIES (in the caller,
 * app/api/cron/ats/route.js) naming its provider + slug. Auto-detection
 * (fetchFromAnyProvider) tries the recorded provider first, then the other
 * three, so a company that quietly migrates ATS provider is still found
 * without manual intervention — this is exactly the failure mode that left
 * 14 of 20 Greenhouse boards 404ing.
 */

const UA = { 'User-Agent': 'Requite/1.0' }

async function fetchJson(url, timeoutMs = 10000) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) return { ok: false, status: res.status }
  try {
    return { ok: true, status: res.status, data: await res.json() }
  } catch {
    return { ok: false, status: res.status, error: 'invalid JSON' }
  }
}

// Each provider's fetchJobs(slug) returns { ok, jobs, error } with jobs
// normalised to { id, title, location, url, department, description }.

const PROVIDERS = {
  greenhouse: {
    name: 'Greenhouse',
    async fetchJobs(slug) {
      const r = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`)
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
      const jobs = Array.isArray(r.data?.jobs) ? r.data.jobs : []
      return {
        ok: true,
        jobs: jobs.map(j => ({
          id: String(j.id),
          title: j.title || '',
          location: j.location?.name || '',
          url: j.absolute_url || '',
          department: (j.departments || [])[0]?.name || '',
          description: '', // content=true HTML is large; other providers rarely need it, kept consistent by omitting
        })),
      }
    },
  },
  lever: {
    name: 'Lever',
    async fetchJobs(slug) {
      const r = await fetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`)
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
      const jobs = Array.isArray(r.data) ? r.data : []
      return {
        ok: true,
        jobs: jobs.map(j => ({
          id: String(j.id),
          title: j.text || '',
          location: j.categories?.location || '',
          url: j.hostedUrl || j.applyUrl || '',
          department: j.categories?.team || '',
          description: '',
        })),
      }
    },
  },
  ashby: {
    name: 'Ashby',
    async fetchJobs(slug) {
      const r = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
      const jobs = Array.isArray(r.data?.jobs) ? r.data.jobs : []
      return {
        ok: true,
        jobs: jobs.map(j => ({
          id: String(j.id),
          title: j.title || '',
          location: j.location || j.address?.postalAddress?.addressLocality || '',
          url: j.jobUrl || j.applyUrl || '',
          department: j.department || j.team || '',
          description: '',
        })),
      }
    },
  },
  smartrecruiters: {
    name: 'SmartRecruiters',
    async fetchJobs(slug) {
      const r = await fetchJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings`)
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
      const jobs = Array.isArray(r.data?.content) ? r.data.content : []
      return {
        ok: true,
        jobs: jobs.map(j => ({
          id: String(j.id),
          title: j.name || '',
          location: [j.location?.city, j.location?.country].filter(Boolean).join(', '),
          url: j.applyUrl || j.ref || '',
          department: j.department?.label || '',
          description: '',
        })),
      }
    },
  },
  // workday: intentionally excluded pending legal review — undocumented
  // endpoint, commercial risk. Do not add without sign-off.
}

const PROVIDER_ORDER = ['greenhouse', 'lever', 'ashby', 'smartrecruiters']

/**
 * Tries `preferredProvider` first (if given and valid), then the remaining
 * three, returning the first one that responds with jobs. Used both for
 * nightly ingestion (a company's provider may have silently changed) and
 * for verifying a candidate slug against all four providers at once.
 * @returns {Promise<{provider: string, jobs: Array}|null>}
 */
async function fetchFromAnyProvider(slug, preferredProvider) {
  const order = preferredProvider && PROVIDERS[preferredProvider]
    ? [preferredProvider, ...PROVIDER_ORDER.filter(p => p !== preferredProvider)]
    : PROVIDER_ORDER
  for (const provider of order) {
    const result = await PROVIDERS[provider].fetchJobs(slug)
    if (result.ok && result.jobs.length > 0) {
      return { provider, jobs: result.jobs }
    }
  }
  return null
}

const { isUkEligible } = require('./uk-eligibility')

// The verified ATS company set. Lives here (not in cron/ats) so the fresh-scan
// path can re-pull the exact same free boards — Greenhouse/Lever/Ashby/
// SmartRecruiters have no API key and no quota, so this is the quota-free
// alternative to Adzuna for "give me something new right now".
// 43 companies verified live 2026-07-14.
const ATS_COMPANIES = [
  { company: 'Wise',            slug: 'wise',            provider: 'smartrecruiters' },
  { company: 'Tide',             slug: 'tide',             provider: 'greenhouse' },
  { company: 'Cleo',             slug: 'cleo',             provider: 'greenhouse' },
  { company: 'Trustpilot',       slug: 'trustpilot',       provider: 'greenhouse' },
  { company: 'Marshmallow',      slug: 'marshmallow',      provider: 'ashby' },
  { company: 'Zopa',             slug: 'zopa',             provider: 'lever' },
  { company: 'TrueLayer',        slug: 'truelayer',        provider: 'greenhouse' },
  { company: 'Griffin',          slug: 'griffin',          provider: 'ashby' },
  { company: 'ComplyAdvantage',  slug: 'complyadvantage',  provider: 'greenhouse' },
  { company: 'Codat',            slug: 'codat',            provider: 'ashby' },
  { company: 'Paddle',           slug: 'paddle',           provider: 'ashby' },
  { company: 'Multiverse',       slug: 'multiverse',       provider: 'ashby' },
  { company: 'Quantexa',         slug: 'quantexa',         provider: 'ashby' },
  { company: 'Matillion',        slug: 'matillion',        provider: 'lever' },
  { company: 'Gousto',           slug: 'gousto',           provider: 'smartrecruiters' },
  { company: 'Deliveroo',        slug: 'deliveroo',        provider: 'ashby' },
  { company: 'Improbable',       slug: 'improbable',       provider: 'ashby' },
  { company: 'Synthesia',        slug: 'synthesia',        provider: 'ashby' },
  { company: 'Second Nature',    slug: 'secondnature',     provider: 'smartrecruiters' },
  { company: 'Juro',             slug: 'juro',             provider: 'ashby' },
  { company: 'Brandwatch',       slug: 'brandwatch',       provider: 'greenhouse' },
  { company: 'Funding Circle',   slug: 'fundingcircle',    provider: 'ashby' },
  { company: 'Freetrade',        slug: 'freetrade',        provider: 'ashby' },
  { company: 'Miro',             slug: 'miro',             provider: 'ashby' },
  { company: 'Notion',           slug: 'notion',            provider: 'ashby' },
  { company: 'Figma',            slug: 'figma',             provider: 'greenhouse' },
  { company: 'Canva',            slug: 'canva',             provider: 'smartrecruiters' },
  { company: 'Monzo',            slug: 'monzo',             provider: 'greenhouse' },
  { company: 'GoCardless',       slug: 'gocardless',        provider: 'greenhouse' },
  { company: 'Skyscanner',       slug: 'skyscanner',        provider: 'greenhouse' },
  { company: 'Farfetch',         slug: 'farfetch',          provider: 'greenhouse' },
  { company: 'SumUp',            slug: 'sumup',             provider: 'greenhouse' },
  { company: 'Wayve',            slug: 'wayve',             provider: 'greenhouse' },
  { company: 'Graphcore',        slug: 'graphcore',         provider: 'greenhouse' },
  { company: 'Unmind',           slug: 'unmind',            provider: 'ashby' },
  { company: 'Gymshark',         slug: 'gymshark',          provider: 'greenhouse' },
  { company: 'Signal AI',        slug: 'signal-ai',         provider: 'ashby' },
  { company: 'OVO Energy',       slug: 'ovoenergy',         provider: 'greenhouse' },
  { company: 'Pleo',             slug: 'pleo',              provider: 'ashby' },
  { company: 'Thoughtworks',     slug: 'thoughtworks',      provider: 'greenhouse' },
  { company: 'Deliverect',       slug: 'deliverect',        provider: 'lever' },
  { company: 'Benevity',         slug: 'benevity',          provider: 'ashby' },
  { company: 'Wallapop',         slug: 'wallapop',          provider: 'greenhouse' },
]

/**
 * Pull every ATS board in parallel and return jobs_cache-shaped rows (UK-only,
 * deduped by external_id). Quota-free. Used by both cron/ats (nightly) and the
 * fresh-scan path. `source: 'greenhouse'` kept for existing readers; the real
 * provider is in track_tags.
 * @returns {Promise<{rows: Array, moved: string[]}>}
 */
async function pullAtsRows(now) {
  const rows = []
  const moved = []
  await Promise.allSettled(
    ATS_COMPANIES.map(async ({ company, slug, provider }) => {
      try {
        const found = await fetchFromAnyProvider(slug, provider)
        if (!found) return
        if (found.provider !== provider) moved.push(`${company}: recorded ${provider} -> now ${found.provider}`)
        for (const job of found.jobs) {
          if (!isUkEligible(job.location)) continue
          rows.push({
            external_id: `${found.provider}-${slug}-${job.id}`,
            company,
            role_title: job.title,
            link: job.url,
            salary: null,
            location: job.location,
            source: 'greenhouse',
            source_type: 'public_listing',
            track_tags: [found.provider],
            cached_at: now,
            adzuna_attribution_required: false,
            raw_json: { department: job.department, ats_provider: found.provider },
          })
        }
      } catch { /* one board failing must not sink the rest */ }
    })
  )
  const deduped = [...new Map(rows.map(r => [r.external_id, r])).values()]
  return { rows: deduped, moved }
}

module.exports = { PROVIDERS, PROVIDER_ORDER, fetchFromAnyProvider, ATS_COMPANIES, pullAtsRows }
