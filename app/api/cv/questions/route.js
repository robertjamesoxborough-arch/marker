import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { MODELS } from '../../../../lib/anthropic'
import { buildAiContext } from '../../../../lib/ai-context'
import { STYLE_RULES } from '../../../../lib/brand'


const COUNT = { light: 2, medium: 4, deep: 7 }

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { roleTitle, company, jd, mode = 'cv', effort = 'light' } = body
  const count = COUNT[effort] || 2

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ questions: [] })

  // Fetch profile context (best-effort — questions still work without it)
  let candidateContext = ''
  try {
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const [profileRes, historyRes, wishlistRes] = await Promise.all([
      service.from('profiles').select('target_roles, seniority, industries, max_office_days, salary_floor, postcode, track, hard_filters_json').eq('user_id', user.id).single(),
      service.from('career_history').select('role_title, company, start_date, end_date').eq('user_id', user.id).order('start_date', { ascending: false }).limit(5),
      service.from('wishlists').select('company').eq('user_id', user.id).limit(5),
    ])
    candidateContext = buildAiContext(profileRes.data, historyRes.data || [], wishlistRes.data || [])
  } catch {}

  const prompt = `Generate exactly ${count} targeted questions to help someone personalise their ${mode === 'cover' ? 'cover letter' : 'CV'} for this specific role.
${candidateContext ? '\nCANDIDATE BACKGROUND:\n' + candidateContext + '\n' : ''}
Role: ${roleTitle || 'Unknown'}${company ? ` at ${company}` : ''}
JD: ${(jd || '').slice(0, 2500)}

Rules:
- Each question should draw out a specific achievement, number, context, or story directly relevant to what this JD asks for
- Tailor questions to the candidate's background above; do not ask about experience they clearly have
- Do NOT ask generic questions like "tell me about yourself" or "how many years experience do you have"
- Make each question unanswerable with a generic CV; the answers should add real specificity
- Each answer should be completeable in 2-4 sentences
- Questions should feel like they were written by a senior recruiter for THIS role

Return ONLY a JSON array of strings: ["Q1?", "Q2?", ...]

${STYLE_RULES}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELS.haiku, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    const text = data.content?.map(c => c.text || '').join('') || '[]'
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const questions = JSON.parse(cleaned)
    return NextResponse.json({ questions: Array.isArray(questions) ? questions.slice(0, count) : [] })
  } catch {
    return NextResponse.json({ questions: [] })
  }
}
