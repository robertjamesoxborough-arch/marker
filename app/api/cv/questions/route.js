import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { MODELS } from '../../../../lib/anthropic'


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

  const prompt = `Generate exactly ${count} targeted questions to help someone personalise their ${mode === 'cover' ? 'cover letter' : 'CV'} for this specific role.

Role: ${roleTitle || 'Unknown'}${company ? ` at ${company}` : ''}
JD: ${(jd || '').slice(0, 2500)}

Rules:
- Each question should draw out a specific achievement, number, context, or story directly relevant to what this JD asks for
- Do NOT ask generic questions like "tell me about yourself" or "how many years experience do you have"
- Make each question unanswerable with a generic CV — the answers should add real specificity
- Each answer should be completeable in 2-4 sentences
- Questions should feel like they were written by a senior recruiter for THIS role

Return ONLY a JSON array of strings: ["Q1?", "Q2?", ...]`

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
