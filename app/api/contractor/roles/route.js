import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { MODELS } from '../../../../lib/anthropic'
import { STYLE_RULES } from '../../../../lib/brand'


const CONTRACT_TITLE_MUST = ['contract', 'interim', 'ftc', 'fixed.term', 'day rate', 'freelance', 'fractional', 'maternity cover', 'parental cover', 'temporary']
const CONTRACT_TITLE_REJECT = ['permanent', ' perm ', 'graduate', 'apprentice', 'junior', 'intern ']

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const adzunaId = process.env.ADZUNA_APP_ID
  const adzunaKey = process.env.ADZUNA_API_KEY

  if (!adzunaId || !adzunaKey) return Response.json({ jobs: [], error: 'Adzuna not configured' })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: profile } = await service.from('profiles')
    .select('target_roles, salary_floor, hard_filters_json')
    .eq('user_id', user.id).single()

  const hfj = profile?.hard_filters_json || {}
  const roles = profile?.target_roles || []
  const contractTypes = hfj.contractTypes || ['interim']
  const ir35 = hfj.ir35Willing || 'either'
  const salaryMin = profile?.salary_floor || 60000
  const cvSnippet = (hfj.cvRaw || hfj.careerSummary || '').slice(0, 900)
  const field = hfj.contractorField || hfj.field || ''
  const seniorities = (profile?.seniorities || [])
    .map(s => ({ senior_manager: 'Senior Manager', head_of: 'Head of', director: 'Director', vp: 'VP', c_suite: 'C-Suite' }[s]))
    .filter(Boolean)

  // Build Adzuna queries: contract variants of target roles, anchored to field
  const queries = new Set()
  for (const role of roles.slice(0, 5)) {
    queries.add(`interim ${role}`)
    queries.add(`contract ${role}`)
    if (field) queries.add(`interim ${role} ${field}`)
  }
  if (contractTypes.includes('day_rate')) {
    for (const role of roles.slice(0, 3)) queries.add(`day rate ${role}`)
  }
  if (contractTypes.includes('ftc')) {
    for (const role of roles.slice(0, 3)) queries.add(`fixed term ${role}`)
  }
  if (contractTypes.includes('freelance')) {
    for (const role of roles.slice(0, 2)) queries.add(`freelance ${role}`)
  }
  // Fallback if no target_roles
  if (queries.size === 0) {
    queries.add(`interim ${field || 'manager'}`)
    queries.add(`contract ${field || 'director'} UK`)
    queries.add(`interim senior manager UK`)
  }

  const allJobs = []

  for (const query of [...queries].slice(0, 12)) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${adzunaId}&app_key=${adzunaKey}&results_per_page=20&what=${encodeURIComponent(query)}&salary_min=${salaryMin}&max_days_old=21&sort_by=date`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = await res.json()
      const results = (data.results || []).map(j => ({
        title: j.title || '',
        company: j.company?.display_name || 'Unknown',
        location: j.location?.display_name || '',
        url: j.redirect_url || '',
        salary: j.salary_is_predicted === '0' ? `£${Math.round(j.salary_min || 0).toLocaleString()} – £${Math.round(j.salary_max || 0).toLocaleString()}` : '',
        created: j.created || '',
        description: (j.description || '').slice(0, 300),
      }))
      allJobs.push(...results)
      await new Promise(r => setTimeout(r, 350))
    } catch { continue }
  }

  // Filter: must have a contract keyword in title or description (case-insensitive)
  const contractFiltered = allJobs.filter(j => {
    const text = (j.title + ' ' + j.description).toLowerCase()
    const hasContract = CONTRACT_TITLE_MUST.some(k => text.includes(k))
    const isReject = CONTRACT_TITLE_REJECT.some(k => text.includes(k))
    return hasContract && !isReject
  })

  // Dedupe by title+company
  const seen = new Set()
  const deduped = contractFiltered.filter(j => {
    const k = (j.title + '|' + j.company).toLowerCase()
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  if (deduped.length === 0) return Response.json({ jobs: [], total: 0 })

  if (!apiKey) {
    return Response.json({
      jobs: deduped.slice(0, 20).map((j, i) => ({ ...j, id: `ct-${i}`, score: 0, signal: 'maybe', badge: 'Unscored', reason: 'No API key', office: 'Unknown', source: 'contract_search', foundAt: new Date().toISOString() })),
      total: deduped.length,
    })
  }

  // Cap per company, max 60 to score
  const companyCounts = {}
  const toScore = deduped.filter(j => {
    const k = j.company.toLowerCase()
    companyCounts[k] = (companyCounts[k] || 0) + 1
    return companyCounts[k] <= 3
  }).slice(0, 60)

  const profileCtx = cvSnippet
    ? `Candidate background: ${cvSnippet}`
    : `Candidate: senior ${seniorities[0] || ''} ${field || 'professional'} looking for ${contractTypes.join('/')} roles. Target roles: ${roles.join(', ') || 'senior manager, director'}.`

  const ir35Note = ir35 === 'outside' ? 'Prefer outside-IR35 roles.' : ir35 === 'inside' ? 'Comfortable with inside-IR35.' : ''
  const fieldNote = field
    ? `FIELD SPECIFICITY: This candidate works in "${field}". A role with a matching title but in an unrelated sector (e.g. logistics, warehousing, FMCG, construction if the candidate is in ${field}) must score 1-4. The full job context must match their sector; not just the job title.`
    : ''

  const summaries = toScore.map((j, i) => `[${i}] "${j.title}" at ${j.company} | ${j.location} | ${j.salary}`).join('\n')

  const prompt = `Score these contract/interim job listings for a candidate.

${profileCtx}
${ir35Note}
${fieldNote}

JOBS:
${summaries}

Return JSON array. Each object:
{"i": index, "score": 1-10, "signal": "apply"/"maybe"/"skip", "reason": "one sentence explaining relevance to this specific candidate", "badge": "Best Match"/"Strong Fit"/"Worth a Look"/"Stretch"/null, "office": "Remote"/"1 day"/"2 days"/"3+ days"/"Unknown", "contractType": "Day-rate"/"Interim"/"FTC"/"Freelance"/"Unknown"}

Scoring: 8+ use 0.2 increments. Only include score ≥ 7. Reject perm roles, wrong-sector roles, junior roles, generic aggregator listings. Be strict: a smaller list of genuinely relevant roles is better than a long list of questionable ones. Return ONLY the JSON array.

${STYLE_RULES}`

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELS.sonnet, max_tokens: 3900, messages: [{ role: 'user', content: prompt }] }),
  })

  const aiData = await aiRes.json()
  const text = (aiData.content || []).map(c => c.text || '').join('') || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let scored
  try { scored = JSON.parse(cleaned) } catch { return Response.json({ jobs: [], error: 'Parse error' }) }
  if (!Array.isArray(scored)) scored = [scored]

  const now = new Date().toISOString()
  const jobs = scored.filter(s => s.score >= 7).map(s => {
    const orig = toScore[s.i] || {}
    return {
      id: `ct-${(orig.title || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25).toLowerCase()}-${(orig.company || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
      title: orig.title || 'Unknown',
      company: orig.company || 'Unknown',
      url: orig.url || '',
      score: s.score,
      signal: s.signal,
      reason: s.reason,
      badge: s.badge,
      office: s.office,
      contractType: s.contractType || 'Unknown',
      salary: orig.salary || '',
      location: orig.location || '',
      created: orig.created || '',
      source: 'contract_search',
      foundAt: now,
    }
  })

  jobs.sort((a, b) => (b.score || 0) - (a.score || 0))

  return Response.json({ jobs, total: deduped.length, scored: toScore.length })
}
