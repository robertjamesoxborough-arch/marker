import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { MODELS } from '../../../lib/anthropic'


function buildProfileStr(profile) {
  const roles = (profile?.target_roles || []).join(', ') || 'various roles'
  const hfj = profile?.hard_filters_json || {}
  const location = profile?.postcode ? `Based near ${profile.postcode}.` : 'UK-based.'
  const cvSnippet = hfj.cvRaw?.slice(0, 600) || hfj.careerSummary || ''
  return [
    `Target roles: ${roles}.`,
    hfj.field ? `Field: ${hfj.field}.` : '',
    location,
    cvSnippet ? `Background: ${cvSnippet}` : '',
  ].filter(Boolean).join(' ')
}

function buildGovQueries(profile) {
  const roles = profile?.target_roles || []
  const seniorities = (profile?.seniorities || [])
    .map(s => ({ senior_manager: 'senior manager', head_of: 'head of', director: 'director', vp: 'deputy director', c_suite: 'director general' }[s]))
    .filter(Boolean)

  if (roles.length === 0) {
    return [
      'director of digital public sector',
      'head of digital government',
      'deputy director digital strategy',
      'director partnerships public sector',
      'programme director government digital',
    ]
  }

  const govPrefixes = seniorities.length ? seniorities.slice(0, 3) : ['director', 'head of', 'deputy director']
  const queries = []

  for (const prefix of govPrefixes) {
    for (const role of roles.slice(0, 5)) {
      queries.push(`${prefix} ${role} public sector`)
    }
  }

  // Always include some generic gov searches
  queries.push('director digital government')
  queries.push('head of digital NHS')
  queries.push('deputy director communications public sector')

  return [...new Set(queries)].slice(0, 20)
}

const TITLE_MUST = ['director','head of','deputy','senior manager','programme director','chief','vp','vice president','lead']
const TITLE_REJECT = ['engineer','software','developer','data sci','data analy','finance','accountant','legal','compliance','hr ','human resource','security','infrastructure','devops','nurse','doctor','clinical','cleaner','driver','warehouse','logistics','procurement','admin','assistant','apprentice','graduate','intern','trainee','helpdesk','support analyst','junior']

export async function POST() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    const adzunaId = process.env.ADZUNA_APP_ID
    const adzunaKey = process.env.ADZUNA_API_KEY

    if (!adzunaId || !adzunaKey) {
      return Response.json({ jobs: [], error: 'Adzuna API keys not configured.' })
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
    const GOV_QUERIES = buildGovQueries(profile)
    const salaryMin = profile?.salary_floor || 60000
    const maxDays = profile?.max_office_days != null ? profile.max_office_days : 2

    const RECIPE = [
      'MATCH: Director, Deputy Director, Head of, Senior Manager, Programme Director level roles in:',
      'digital strategy, digital marketing, partnerships, marketing, commercial, growth, communications, product, programme delivery.',
      'Public sector / government / NHS / parliament bodies. UK-based.',
      `Max ${maxDays} days office.`,
      'REJECT: IT support, finance, HR, procurement, clinical, admin, legal, data entry, junior analyst, apprentice, graduate scheme.',
    ].join(' ')

    const allJobs = []

    for (const query of GOV_QUERIES) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${adzunaId}&app_key=${adzunaKey}&results_per_page=20&what=${encodeURIComponent(query)}&salary_min=${salaryMin}&max_days_old=21&sort_by=relevance`
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) continue
        const data = await res.json()
        const results = (data.results || []).map(j => ({
          title: j.title || '',
          company: j.company?.display_name || 'Unknown',
          location: j.location?.display_name || '',
          url: j.redirect_url || '',
          salary: (j.salary_min || j.salary_max) ? `${j.salary_is_predicted === '1' ? '~' : ''}£${Math.round(j.salary_min || j.salary_max || 0).toLocaleString()}${j.salary_max && j.salary_max !== j.salary_min ? ' - £' + Math.round(j.salary_max).toLocaleString() : ''}` : '',
          created: j.created || '',
        }))
        allJobs.push(...results)
        await new Promise(r => setTimeout(r, 350))
      } catch { continue }
    }

    const preFiltered = allJobs.filter(j => {
      const t = j.title.toLowerCase()
      return TITLE_MUST.some(k => t.includes(k)) && !TITLE_REJECT.some(k => t.includes(k))
    })

    const seen = new Set()
    const deduped = preFiltered.filter(j => {
      const k = (j.title + '|' + j.company).toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    if (deduped.length === 0) return Response.json({ jobs: [], total: 0 })

    const companyCounts = {}
    const toScore = deduped.filter(j => {
      const k = j.company.toLowerCase()
      companyCounts[k] = (companyCounts[k] || 0) + 1
      return companyCounts[k] <= 3
    }).slice(0, 80)

    const summaries = toScore.map((j, i) => `[${i}] "${j.title}" at ${j.company} | ${j.location} | ${j.salary} | ${j.url}`).join('\n')

    const prompt = `You are scoring public sector / government job results for this candidate:
${PROFILE}

CRITERIA:
${RECIPE}

JOBS TO SCORE:
${summaries}

RULES:
1. Score 1-10 for fit. Only return jobs scoring 6+.
2. Max 2 per organisation.
3. REJECT anything clearly private sector unrelated to candidate background.
4. REJECT junior grades: EO, HEO, SEO unless the actual job title is clearly Director/Head/Deputy level.
5. Director of Digital Products & Delivery at a parliament or public body = 8+ score.
6. Be specific in reason — mention org type and title alignment.

Return ONLY a JSON array. Each object: {"i": index, "score": 1-10, "signal": "apply"/"maybe"/"skip", "reason": "one sentence", "badge": "Best Match"/"Strong Fit"/"Worth a Look"/"Stretch"/null, "office": "Remote"/"1 day"/"2 days"/"3+ days"/"Unknown"}.
SCORING: 1-7 use whole numbers. 8+ use increments of 0.2 (8.0, 8.2, 8.4, 8.6, 8.8, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0).
No markdown, no backticks.`

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
    const scoredJobs = scored.filter(s => s.score >= 6).map((s) => {
      const orig = toScore[s.i] || {}
      return {
        id: `gov-${(orig.title||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,30).toLowerCase()}-${(orig.company||'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}`,
        title: orig.title || 'Unknown', company: orig.company || 'Unknown', url: orig.url || '',
        score: s.score, signal: s.signal, reason: s.reason, badge: s.badge, office: s.office,
        source: 'gov_search', salary: orig.salary || '', created: orig.created || '', foundAt: now
      }
    })

    scoredJobs.sort((a, b) => (b.score || 0) - (a.score || 0))
    const postCap = {}
    const jobs = scoredJobs.filter(j => {
      const k = j.company.toLowerCase()
      postCap[k] = (postCap[k] || 0) + 1
      return postCap[k] <= 2
    })

    const byCompany = {}
    jobs.forEach(j => { const k = j.company; if (!byCompany[k]) byCompany[k] = []; byCompany[k].push(j) })
    const queues = Object.values(byCompany)
    const interleaved = []
    const maxLen = Math.max(...queues.map(q => q.length), 0)
    for (let i = 0; i < maxLen; i++) { for (const q of queues) { if (i < q.length) interleaved.push(q[i]) } }

    return Response.json({ jobs: interleaved, total: allJobs.length, preFiltered: deduped.length, scored: toScore.length })
  } catch (err) {
    return Response.json({ jobs: [], error: err.message }, { status: 500 })
  }
}
