import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


// Generic gov queries covering all our role families at senior level
const GOV_QUERIES = [
  { what: 'director of digital public sector', seniority: ['director', 'head', 'vp_plus'] },
  { what: 'head of digital government',        seniority: ['head', 'director'] },
  { what: 'deputy director digital strategy',  seniority: ['director', 'senior_manager'] },
  { what: 'director partnerships public sector', seniority: ['director', 'head'] },
  { what: 'head of marketing government',      seniority: ['head', 'director'] },
  { what: 'director communications public sector', seniority: ['director', 'head'] },
  { what: 'programme director government',     seniority: ['director', 'head'] },
  { what: 'head of commercial government',     seniority: ['head', 'director'] },
  { what: 'head of product government',        seniority: ['head', 'director'] },
  { what: 'head of data public sector',        seniority: ['head', 'director'] },
  { what: 'senior manager digital public sector', seniority: ['senior_manager', 'head'] },
  { what: 'director of strategy public sector', seniority: ['director', 'head'] },
  { what: 'head of growth public sector',      seniority: ['head', 'director'] },
  { what: 'director product management government', seniority: ['director', 'head'] },
]

const TITLE_MUST = ['director', 'head of', 'deputy', 'senior manager', 'programme director', 'chief', 'vp ', 'vice president', 'lead']
const TITLE_REJECT = ['engineer', 'software developer', 'data scientist', 'data analy', 'finance', 'accountant', 'legal', 'compliance', 'human resource', 'security', 'infrastructure', 'devops', 'nurse', 'doctor', 'clinical', 'procurement', 'admin assistant', 'apprentice', 'graduate scheme', 'intern', 'trainee', 'helpdesk', 'junior']

function passesTitleFilter(title) {
  const t = title.toLowerCase()
  return TITLE_MUST.some(k => t.includes(k)) && !TITLE_REJECT.some(k => t.includes(k))
}

function formatSalary(job) {
  const min = job.salary_min
  const max = job.salary_max
  if (!min && !max) return null
  if (min && max && max !== min) return `£${Math.round(min / 1000)}k–£${Math.round(max / 1000)}k`
  if (min) return `£${Math.round(min / 1000)}k+`
  return null
}

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appId = process.env.ADZUNA_APP_ID
  const apiKey = process.env.ADZUNA_API_KEY
  if (!appId || !apiKey) {
    return NextResponse.json({ error: 'ADZUNA_APP_ID or ADZUNA_API_KEY not set' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date().toISOString()
  const rows = []
  const errors = []
  const seen = new Set()

  for (const { what } of GOV_QUERIES) {
    try {
      const url = new URL('https://api.adzuna.com/v1/api/jobs/gb/search/1')
      url.searchParams.set('app_id', appId)
      url.searchParams.set('app_key', apiKey)
      url.searchParams.set('results_per_page', '30')
      url.searchParams.set('what', what)
      url.searchParams.set('salary_min', '60000')
      url.searchParams.set('max_days_old', '21')
      url.searchParams.set('sort_by', 'date')
      url.searchParams.set('content-type', 'application/json')

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'Marker/1.0' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) { errors.push(`${what}: HTTP ${res.status}`); continue }
      const data = await res.json()

      for (const job of (data.results || [])) {
        if (!passesTitleFilter(job.title || '')) continue
        const externalId = `gov-${job.id}`
        if (seen.has(externalId)) continue
        seen.add(externalId)
        rows.push({
          external_id: externalId,
          company: job.company?.display_name || 'Unknown',
          role_title: job.title,
          link: job.redirect_url,
          salary: formatSalary(job),
          location: job.location?.display_name || '',
          source: 'gov',
          cached_at: now,
          adzuna_attribution_required: true,
          raw_json: {
            category: job.category?.label || null,
            description: (job.description || '').slice(0, 400),
          },
        })
      }
    } catch (e) {
      errors.push(`${what}: ${e.message}`)
    }
  }

  // Defensive dedupe by external_id immediately before upsert (the `seen` Set
  // above already prevents this during collection, but every writer gets the
  // same final guard so a single batch can never touch one ON CONFLICT
  // target row twice).
  const deduped = [...new Map(rows.map(r => [r.external_id, r])).values()]

  if (deduped.length > 0) {
    const { error } = await supabase
      .from('jobs_cache')
      .upsert(deduped, { onConflict: 'external_id' })
    if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
  }

  // Prune gov rows older than 7 days
  await supabase
    .from('jobs_cache')
    .delete()
    .eq('source', 'gov')
    .lt('cached_at', new Date(Date.now() - 7 * 86400000).toISOString())

  return NextResponse.json({
    ok: true,
    inserted: deduped.length,
    queries: GOV_QUERIES.length,
    errors,
  })
}
