import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { MODELS } from '../../../lib/anthropic'
import { STYLE_RULES } from '../../../lib/brand'


function buildCandidateProfile(profile) {
  if (!profile) return 'Candidate profile not set. Match senior, strategic, UK-based roles.'
  const hfj = profile.hard_filters_json || {}
  const roles = (profile.target_roles || []).join(', ') || 'various roles'
  const location = profile.postcode ? `Based near ${profile.postcode}.` : 'UK-based.'
  const cvSnippet = hfj.cvRaw?.slice(0, 800) || hfj.careerSummary || ''
  return [
    `Target roles: ${roles}.`,
    hfj.field ? `Field: ${hfj.field}.` : '',
    location,
    cvSnippet ? `Background: ${cvSnippet}` : '',
  ].filter(Boolean).join(' ')
}

function buildJobRecipe(profile) {
  if (!profile) return 'MATCH: Senior strategic roles, UK or remote. REJECT: junior, pure sales quota, 3+ days office, non-UK.'
  const roles = (profile.target_roles || []).join(', ') || 'various roles'
  const maxDays = profile.max_office_days != null ? profile.max_office_days : 2
  const seniorities = (profile.seniorities || [])
    .map(s => ({ senior_manager: 'Senior Manager', head_of: 'Head of', director: 'Director', vp: 'VP', c_suite: 'C-Suite' }[s]))
    .filter(Boolean)
  const senStr = seniorities.length ? `SENIORITY: ${seniorities.join('/')} level.` : ''
  return [
    `ROLE TYPES: ${roles}.`,
    senStr,
    `LOCATION: UK-based or fully remote. Maximum ${maxDays} days in office per week.`,
    'HARD FILTERS (reject immediately): Pure sales quota-carrying roles, junior/entry-level roles, 3+ days mandatory office, roles requiring relocation outside UK.',
  ].filter(Boolean).join('\n')
}

function buildFallbackSearchTerms(profile) {
  const roles = profile?.target_roles || []
  if (roles.length === 0) return ['senior manager UK remote', 'director UK remote', 'head of department UK']
  const location = profile?.postcode ? 'UK' : 'UK remote'
  return roles.slice(0, 5).map(r => `${r} ${location}`)
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'No API key configured' }, { status: 500 })

  // Read user profile for personalised scoring
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
        .select('target_roles, seniorities, postcode, max_office_days, hard_filters_json')
        .eq('user_id', user.id).single()
      profile = data
    }
  } catch {}

  const CANDIDATE_PROFILE = buildCandidateProfile(profile)
  const JOB_RECIPE = buildJobRecipe(profile)

  const { companies, webSearchTerms } = await req.json()

  const allSnippets = []

  // 1. Scrape career pages from companies list
  if (companies && companies.length > 0) {
    const scrapePromises = companies.slice(0, 25).map(async (co) => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(co.link, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        })
        clearTimeout(timeout)
        if (!res.ok) return null
        const html = await res.text()
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 3000)
        return { company: co.company, source: 'careers_page', url: co.link, content: text }
      } catch { return null }
    })
    const results = await Promise.allSettled(scrapePromises)
    results.forEach(r => { if (r.status === 'fulfilled' && r.value) allSnippets.push(r.value) })
  }

  // 2. Web search for additional jobs
  const searchQueries = webSearchTerms || buildFallbackSearchTerms(profile)

  for (const query of searchQueries.slice(0, 5)) {
    try {
      const searchRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODELS.sonnet,
          max_tokens: 2600,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: `Search for current UK job listings: "${query}". Find specific job postings with direct application URLs. Focus on roles posted in the last 30 days. Return the job titles, companies, and URLs you find.` }],
        }),
      })
      const searchData = await searchRes.json()
      const searchText = searchData.content?.map(c => c.text || '').filter(Boolean).join('\n') || ''
      if (searchText) {
        allSnippets.push({ company: 'Web Search', source: 'web_search', url: query, content: searchText.slice(0, 4000) })
      }
    } catch {}
  }

  if (allSnippets.length === 0) {
    return Response.json({ jobs: [], message: 'No career pages could be reached and web search returned no results.' })
  }

  // 3. Send all snippets to Claude for filtering and scoring
  const batchContent = allSnippets.map((s, i) =>
    `--- SOURCE ${i + 1}: ${s.company} (${s.source}) ---\nURL: ${s.url}\n${s.content}`
  ).join('\n\n')

  const prompt = `You are a job matching assistant. Here is the candidate profile and job recipe, followed by content scraped from career pages and web searches.

CANDIDATE:
${CANDIDATE_PROFILE}

JOB RECIPE (what to look for / filter):
${JOB_RECIPE}

SCRAPED CONTENT:
${batchContent.slice(0, 25000)}

TASK: Extract individual job listings from the content above. For each one, check it against the recipe filters. Reject jobs that hit the hard filters.

CRITICAL RULES:
- Maximum 3 jobs per company. Pick only the TOP 3 most relevant roles per company.
- Be selective; only include roles that genuinely match the candidate's seniority and domain. A generic "Account Executive" or "Software Engineer" at GitLab is NOT a match just because GitLab is on the list.
- Prioritise variety across companies over depth within one company.
- If a career page lists 50 roles but only 1 matches, return only that 1.

Return ONLY a JSON array (no markdown, no backticks, no explanation). Each object must have:
{
  "title": "Exact job title",
  "company": "Company name",
  "url": "Direct link to the job posting (construct from the career page URL if needed, or use the exact URL found)",
  "score": 1-10 suitability score,
  "signal": "apply" or "maybe" or "skip",
  "reason": "One sentence why this matches or doesn't",
  "badge": "Best Match" or "Strong Fit" or "Worth a Look" or "Stretch" or null,
  "office": "Remote" or "1 day" or "2 days" or "3+ days" or "Unknown",
  "source": "careers_page" or "web_search"
}

SCORING:
- 8-10 = strong match, "Best Match" badge
- 6-7 = good match, "Strong Fit" badge
- 4-5 = partial match, "Worth a Look" badge
- 2-3 = stretch, "Stretch" badge
- 1 = reject, don't include

Only include jobs scoring 3+. If no jobs match, return an empty array [].
Return ONLY the JSON array.

${STYLE_RULES}`

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELS.sonnet,
        max_tokens: 5200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    const text = aiData.content?.map(c => c.text || '').join('') || ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let jobs
    try {
      jobs = JSON.parse(cleaned)
    } catch {
      return Response.json({ jobs: [], error: 'Could not parse results', raw: cleaned.slice(0, 300) })
    }

    if (!Array.isArray(jobs)) jobs = [jobs]

    // Cap at 3 per company (highest score first)
    jobs.sort((a, b) => (b.score || 0) - (a.score || 0))
    const companyCounts = {}
    jobs = jobs.filter(j => {
      const key = (j.company || '').toLowerCase().trim()
      companyCounts[key] = (companyCounts[key] || 0) + 1
      return companyCounts[key] <= 3
    })

    // Interleave companies so results are spread out
    const byCompany = {}
    jobs.forEach(j => {
      const key = (j.company || '').toLowerCase().trim()
      if (!byCompany[key]) byCompany[key] = []
      byCompany[key].push(j)
    })
    const companyQueues = Object.values(byCompany)
    const interleaved = []
    let maxLen = Math.max(...companyQueues.map(q => q.length), 0)
    for (let i = 0; i < maxLen; i++) {
      for (const queue of companyQueues) {
        if (i < queue.length) interleaved.push(queue[i])
      }
    }
    jobs = interleaved

    // Add timestamps
    const now = new Date().toISOString()
    jobs = jobs.map((j, i) => ({ ...j, id: `feed-${Date.now()}-${i}`, foundAt: now }))

    return Response.json({ jobs, sourcesChecked: allSnippets.length })
  } catch (err) {
    return Response.json({ jobs: [], error: 'Analysis failed: ' + err.message }, { status: 500 })
  }
}
