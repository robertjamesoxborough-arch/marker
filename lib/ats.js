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

module.exports = { PROVIDERS, PROVIDER_ORDER, fetchFromAnyProvider }
