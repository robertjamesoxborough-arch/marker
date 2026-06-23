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
    .select('target_roles, postcode, hard_filters_json')
    .eq('user_id', user.id).single()

  const hfj = profile?.hard_filters_json || {}
  const field = hfj.contractorField || hfj.field || 'general management'
  const roles = (profile?.target_roles || []).slice(0, 4).join(', ') || 'director, senior manager'
  const contractTypes = (hfj.contractTypes || ['interim']).join(', ')
  const location = profile?.postcode ? `near ${profile.postcode}, UK` : 'UK'
  const wishlistCompanies = (hfj.wishlist || []).map(c => c.name).slice(0, 20)
  const wishlistStr = wishlistCompanies.length > 0 ? `The candidate's target companies include: ${wishlistCompanies.join(', ')}.` : ''

  const prompt = `You are a specialist recruitment researcher. A senior ${field} professional (targeting: ${roles}) is looking for UK recruitment agencies that place ${contractTypes} contractors.

Location: ${location}
${wishlistStr}

Identify 10 UK recruitment agencies that actively place senior ${field} contractors.

For each agency return a JSON object with EXACTLY these fields:
{
  "agency": "Agency name",
  "priority": 1, // 1 = most relevant to this candidate's field, 2 = strong, 3 = useful
  "specialisation": "What they specifically place — be specific about seniority and sector",
  "coverage": "Geographic coverage",
  "contractFocus": "Contract types they specialise in",
  "website": "Their website URL",
  "linkedin": "LinkedIn company page URL or null",
  "register": "Direct URL to their registration/candidate portal page",
  "ats": {
    "name": "ATS system name (e.g. Bullhorn, Hays proprietary, Workable, Lever, SmartRecruiters — use your knowledge of what each agency uses)",
    "format": "Preferred CV format (.docx or PDF)",
    "instructions": "2-3 specific formatting tips for getting past their ATS — be concrete and practical"
  },
  "companies": ["List", "of", "10-15", "real", "UK", "companies", "they", "regularly", "place", "candidates", "at"],
  "insight": "One strategic insight — why this agency is particularly relevant to this candidate and how to maximise your chances with them",
  "note": "One practical tip on HOW to approach this agency — e.g. direct LinkedIn to practice lead, specific division, timing"
}

Rules:
- Only include real, active UK agencies
- Priority 1: most relevant to this specific field and contract type
- The companies list must be real companies this agency genuinely works with — not generic examples
- ATS instructions must be specific and actionable
- Return ONLY a JSON array of 10 objects, no markdown`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('') || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let recruiters
  try { recruiters = JSON.parse(cleaned) } catch {
    return Response.json({ error: 'Parse error — try again', raw: cleaned.slice(0, 300) })
  }
  if (!Array.isArray(recruiters)) return Response.json({ error: 'Expected array from model' })

  // Sort by priority
  recruiters.sort((a, b) => (a.priority || 3) - (b.priority || 3))

  // Cache to profile
  const merged = { ...hfj, contractorRecruiters: recruiters, contractorRecruitersCachedAt: new Date().toISOString() }
  await service.from('profiles').update({ hard_filters_json: merged }).eq('user_id', user.id)

  return Response.json({ recruiters })
}
