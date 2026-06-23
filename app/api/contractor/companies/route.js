import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'


export async function POST() {
  const apiKey = process.env.jobtrackergeneral || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'No API key configured' }, { status: 500 })

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
    .select('target_roles, postcode, salary_floor, hard_filters_json')
    .eq('user_id', user.id).single()

  const hfj = profile?.hard_filters_json || {}
  const field = hfj.contractorField || hfj.field || 'general management'
  const roles = (profile?.target_roles || []).slice(0, 5).join(', ') || 'senior manager, director'
  const contractTypes = (hfj.contractTypes || ['interim']).join(', ')
  const location = profile?.postcode ? `near ${profile.postcode}, UK` : 'UK'
  const ir35Note = hfj.ir35Willing === 'outside' ? 'Candidate strongly prefers outside-IR35 engagements.' : hfj.ir35Willing === 'inside' ? 'Candidate is comfortable with inside-IR35 roles.' : ''
  const goalNote = hfj.contractGoal === 'either' ? 'Open to contract-to-perm or pure contract.' : hfj.contractGoal === 'perm' ? 'Primarily using contracting as a bridge to perm.' : 'Looking for ongoing contract work.'
  const cvSnippet = (hfj.cvRaw || hfj.careerSummary || '').slice(0, 800)

  const prompt = `You are a specialist contract recruitment researcher helping a senior ${field} professional identify their best UK target companies for contract and interim work.

Candidate:
- Field: ${field}
- Target roles: ${roles}
- Contract types: ${contractTypes}
- Location: ${location}
- ${goalNote}
- ${ir35Note}
${cvSnippet ? `- Background: ${cvSnippet}` : ''}

Your task: Identify exactly 12 UK companies in the ${field} space that regularly hire senior contractors and interim professionals for roles like: ${roles}.

For each company, provide evidence-based scores based on what you know about UK hiring patterns, LinkedIn contractor activity, industry norms, and company culture.

Score each company on:
1. contractorVolume (1–10): How actively does this company use senior contractors / interims in ${field}? (10 = very high — they are known to have a large contractor workforce or regularly post interim roles)
2. conversionConfidence (1–10): How confident is a ${roles} contractor to actually land work here, considering the company's hiring behaviour, size, and typical use of contractors in this field?
3. wlb (1–10): Work-life balance evidence from Glassdoor ratings, culture disclosures, and industry reputation

Tier is determined by: average of conversionConfidence and wlb.
Tier 1 = avg ≥ 8 (prime targets — high confidence + good culture)
Tier 2 = avg ≥ 6 (strong targets)
Tier 3 = avg ≥ 4 (worth monitoring)

Return ONLY a JSON array of exactly 12 objects. Each object:
{
  "company": "Company name",
  "sector": "Industry sector (2–4 words)",
  "why": "One sentence: why this company regularly uses contractors in ${field} — be specific (e.g. 'Going through a major digital transformation with heavy use of interim programme managers')",
  "contractorVolume": number 1-10,
  "conversionConfidence": number 1-10,
  "wlb": number 1-10,
  "tier": 1 or 2 or 3,
  "greenhouseSlug": "their-greenhouse-board-slug if they use Greenhouse ATS, otherwise null",
  "careersUrl": "URL to their careers / jobs page"
}

Rules:
- Only include real, named UK companies you are confident about
- Tier 1 should have 2–4 companies (the clearest, most accessible targets)
- Tier 2 should have 5–6 companies
- Tier 3 should have the remainder
- Return ONLY the JSON array, no markdown, no commentary`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('') || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let companies
  try { companies = JSON.parse(cleaned) } catch {
    return Response.json({ error: 'Parse error — try again', raw: cleaned.slice(0, 300) })
  }
  if (!Array.isArray(companies)) return Response.json({ error: 'Expected array from model' })

  // Sort by tier then conversionConfidence
  companies.sort((a, b) => a.tier - b.tier || b.conversionConfidence - a.conversionConfidence)

  // Cache to profile
  const merged = { ...hfj, contractorCompanies: companies, contractorCompaniesCachedAt: new Date().toISOString() }
  await service.from('profiles').update({ hard_filters_json: merged }).eq('user_id', user.id)

  return Response.json({ companies })
}
