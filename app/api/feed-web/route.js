import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { MODELS } from '../../../lib/anthropic'


function buildProfileStr(profile) {
  const roles = (profile?.target_roles || []).join(', ') || 'various roles'
  const hfj = profile?.hard_filters_json || {}
  const location = profile?.postcode ? `Based near ${profile.postcode}.` : 'UK-based.'
  const cvSnippet = hfj.cvRaw?.slice(0, 900) || hfj.careerSummary || ''
  const seniorities = (profile?.seniorities || [])
    .map(s => ({ senior_manager: 'Senior Manager', head_of: 'Head of', director: 'Director', vp: 'VP', c_suite: 'C-Suite' }[s]))
    .filter(Boolean)
  return [
    `Target roles: ${roles}.`,
    hfj.field ? `Field/sector: ${hfj.field}.` : '',
    seniorities.length ? `Seniority: ${seniorities.join(' or ')}.` : '',
    hfj.yearsExperience ? `${hfj.yearsExperience} years experience.` : '',
    location,
    cvSnippet ? `Background (CV extract): ${cvSnippet}` : '',
  ].filter(Boolean).join(' ')
}

function buildRecipeStr(profile) {
  const roles = (profile?.target_roles || []).join(', ') || 'various roles'
  const maxDays = profile?.max_office_days != null ? profile.max_office_days : 2
  const seniorities = (profile?.seniorities || [])
    .map(s => ({ senior_manager: 'Senior Manager', head_of: 'Head of', director: 'Director', vp: 'VP', c_suite: 'C-Suite' }[s]))
    .filter(Boolean)
  const senStr = seniorities.length ? seniorities.join('/') + ' level.' : ''
  return [
    `MATCH: ${roles}.`,
    senStr,
    `UK or remote, max ${maxDays} days office.`,
    'REJECT: junior, pure sales quota, 3+ days mandatory office, non-UK.',
  ].filter(Boolean).join(' ')
}

function buildQueries(profile) {
  const roles = profile?.target_roles || []
  const hfj = profile?.hard_filters_json || {}
  const field = hfj.field || ''

  if (roles.length === 0) {
    const base = field ? [`senior ${field}`, `director ${field}`, `head of ${field}`] : ['senior manager UK', 'director UK', 'head of department UK']
    return base
  }

  const seniorities = (profile?.seniorities || [])
    .map(s => ({ senior_manager: 'senior', head_of: 'head of', director: 'director', vp: 'VP', c_suite: 'chief' }[s]))
    .filter(Boolean)

  // Use target_roles directly as primary queries
  const base = roles.slice(0, 12)

  // Cross-product top seniority × top roles
  const extra = []
  const topSen = seniorities[0]
  if (topSen) {
    for (const role of roles.slice(0, 6)) {
      extra.push(`${topSen} ${role}`)
    }
  }

  // Field-anchored queries to keep results in the right sector
  const fieldQueries = []
  if (field) {
    for (const role of roles.slice(0, 4)) {
      fieldQueries.push(`${role} ${field}`)
    }
  }

  return [...base, ...fieldQueries, ...extra].slice(0, 25)
}

export async function POST() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    const adzunaId = process.env.ADZUNA_APP_ID
    const adzunaKey = process.env.ADZUNA_API_KEY

    if (!adzunaId || !adzunaKey) {
      return Response.json({ jobs: [], error: 'Adzuna API keys not configured. Add ADZUNA_APP_ID and ADZUNA_API_KEY to Vercel env vars.' })
    }

    // Read user profile for personalised queries
    let profile = null
    try {
      const cookieStore = await cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        const { data } = await service.from('profiles')
          .select('target_roles, seniorities, postcode, salary_floor, max_office_days, hard_filters_json')
          .eq('user_id', user.id).single()
        profile = data
      }
    } catch {}

    const PROFILE = buildProfileStr(profile)
    const RECIPE = buildRecipeStr(profile)
    const ADZUNA_QUERIES = buildQueries(profile)
    const salaryMin = profile?.salary_floor || 60000

    const allJobs = []

    // Sequential Adzuna searches with delays to avoid 429
    for (const query of ADZUNA_QUERIES) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${adzunaId}&app_key=${adzunaKey}&results_per_page=20&what=${encodeURIComponent(query)}&salary_min=${salaryMin}&max_days_old=14&sort_by=date`
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) continue
        const data = await res.json()
        const results = (data.results || []).map(j => ({
          title: j.title || '',
          company: j.company?.display_name || 'Unknown',
          location: j.location?.display_name || '',
          url: j.redirect_url || '',
          salary: j.salary_is_predicted === '0' ? `£${Math.round(j.salary_min || 0).toLocaleString()} - £${Math.round(j.salary_max || 0).toLocaleString()}` : '',
          created: j.created || '',
        }))
        allJobs.push(...results)
        await new Promise(r => setTimeout(r, 400))
      } catch { continue }
    }

    // Dedupe
    const seen = new Set()
    const deduped = allJobs.filter(j => {
      const k = (j.title + '|' + j.company).toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    if (deduped.length === 0) return Response.json({ jobs: [], total: 0 })

    if (!apiKey) {
      return Response.json({ jobs: deduped.slice(0, 30).map((j, i) => ({ ...j, id: 'az-' + i, score: 0, signal: 'maybe', badge: 'Unscored', reason: 'No API key for scoring', office: 'Unknown', source: 'web_search', foundAt: new Date().toISOString() })), total: deduped.length })
    }

    // Score with Claude — cap per company
    const companyCounts = {}
    const toScore = deduped.filter(j => {
      const k = j.company.toLowerCase()
      companyCounts[k] = (companyCounts[k] || 0) + 1
      return companyCounts[k] <= 3
    }).slice(0, 80)

    const summaries = toScore.map((j, i) => `[${i}] "${j.title}" at ${j.company} | ${j.location} | ${j.salary} | ${j.url}`).join('\n')

    const fieldLine = profile?.hard_filters_json?.field
      ? `FIELD: Candidate works in "${profile.hard_filters_json.field}". A role with a matching title but in an unrelated sector (e.g. logistics, warehousing, manufacturing, retail if candidate is in tech/media/finance) must score 1-4; title alone is not enough. Score the whole role context, not just the job title.`
      : ''

    const prompt = `Score these Adzuna job search results for: ${PROFILE}\nCriteria: ${RECIPE}\n${fieldLine}\n\nJOBS:\n${summaries}\n\nReturn JSON array only. Each object: {"i": index, "score": 1-10, "signal": "apply"/"maybe"/"skip", "reason": "one sentence explaining relevance to this specific candidate", "badge": "Best Match"/"Strong Fit"/"Worth a Look"/"Stretch"/null, "office": "Remote"/"1 day"/"2 days"/"3+ days"/"Unknown"}.\nSCORING: 1-7 use whole numbers. 8+ use increments of 0.2 (8.0, 8.2, 8.4, 8.6, 8.8, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0).\nOnly include 7+ scores. Max 3 per company. Be strict: reject junior, sales-quota, 3+ days mandatory office, wrong sector, generic aggregator listings. Return ONLY JSON array, no markdown.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELS.sonnet, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    })
    const aiData = await aiRes.json()
    const text = aiData.content?.map(c => c.text || '').join('') || '[]'
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let scored
    try { scored = JSON.parse(cleaned) } catch { return Response.json({ jobs: [], error: 'Parse error', raw: cleaned.slice(0, 200) }) }
    if (!Array.isArray(scored)) scored = [scored]

    const now = new Date().toISOString()
    const jobs = scored.filter(s => s.score >= 7).map((s) => {
      const orig = toScore[s.i] || {}
      return { id: `az-${(orig.title||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,30).toLowerCase()}-${(orig.company||'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}`, title: orig.title || 'Unknown', company: orig.company || 'Unknown', url: orig.url || '', score: s.score, signal: s.signal, reason: s.reason, badge: s.badge, office: s.office, source: 'web_search', salary: orig.salary || '', created: orig.created || '', foundAt: now }
    })

    // Interleave companies
    const byCompany = {}
    jobs.forEach(j => { const k = j.company; if (!byCompany[k]) byCompany[k] = []; byCompany[k].push(j) })
    const queues = Object.values(byCompany)
    const interleaved = []
    const maxLen = Math.max(...queues.map(q => q.length), 0)
    for (let i = 0; i < maxLen; i++) { for (const q of queues) { if (i < q.length) interleaved.push(q[i]) } }

    return Response.json({ jobs: interleaved, total: deduped.length, scored: toScore.length })
  } catch (err) {
    return Response.json({ jobs: [], error: err.message }, { status: 500 })
  }
}
