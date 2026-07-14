import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse, after } from 'next/server'
import { trackAiUsage } from '../../../../lib/ai-usage'
import { MODELS } from '../../../../lib/anthropic'
import { buildAiContext } from '../../../../lib/ai-context'
import { checkAllowance } from '../../../../lib/allowance'
import { logIfError } from '../../../../lib/log-errors'


export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, used, cap, tier } = await checkAllowance(user.id, 'cover_letter')
  if (!allowed) {
    return NextResponse.json({
      error: cap === 0
        ? 'Cover letters are not available on your current plan. Upgrade to Pro or Max to unlock.'
        : `Cover letter limit reached (${used}/${cap} this month on your ${tier} plan). Upgrade to unlock more.`,
      limitReached: true, used, cap, tier,
    }, { status: 429 })
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const [profileRes, historyRes, wishlistRes] = await Promise.all([
    service.from('profiles').select('hard_filters_json, target_roles, seniority, track').eq('user_id', user.id).single(),
    service.from('career_history').select('role_title, company, start_date, end_date').eq('user_id', user.id).order('start_date', { ascending: false }).limit(5),
    service.from('wishlists').select('company').eq('user_id', user.id).limit(5),
  ])
  logIfError('cv/cover-letter profiles', profileRes)
  logIfError('cv/cover-letter career_history', historyRes)
  logIfError('cv/cover-letter wishlists', wishlistRes)
  const profile = profileRes.data
  const careerHistory = historyRes.data || []
  const wishlists = wishlistRes.data || []

  const cvRaw = profile?.hard_filters_json?.cvRaw || ''
  if (!cvRaw) return NextResponse.json({ error: 'No CV stored. Complete onboarding to upload your CV.' }, { status: 400 })

  const { roleTitle, company, jd } = await request.json()
  if (!roleTitle || !jd) return NextResponse.json({ error: 'Role title and job description are required.' }, { status: 400 })

  const TRACK_TONE = {
    balanced:       'The candidate values work-life balance. Where appropriate, the tone should reflect someone who delivers excellent work sustainably, not someone who glorifies overwork.',
    parent:         'The candidate is a working parent seeking family-friendly roles. The tone should be confident and direct; do not make the candidate sound apologetic or overly grateful.',
    returner:       'The candidate may have taken a career break. Frame their return as a strength. Do not reference or apologise for any gap.',
    career_changer: 'The candidate is changing sector or role type. Emphasise what their different background uniquely brings to this role.',
    standard:       '',
  }
  const trackNote = TRACK_TONE[profile?.track] || ''

  const candidateContext = buildAiContext(profile, careerHistory, wishlists)
  const client = new Anthropic()

  const SYSTEM_CACHED = `You are an expert cover letter writer specialising in UK job applications. Your letters are specific, confident, and human. You never use filler language, corporate buzzwords, or generic openings. Never invent, add, or extrapolate any metric, statistic, or achievement not explicitly present in the candidate's CV below.

STYLE RULES: Write in British English. Never use em dashes (—) in any output. Use colons, commas, or full stops instead.

CANDIDATE PROFILE:
${candidateContext}`

  const prompt = `Write a cover letter for the role below.
${trackNote ? '\nTone note: ' + trackNote + '\n' : ''}
CANDIDATE CV:
${cvRaw.slice(0, 4000)}

TARGET ROLE: ${roleTitle}${company ? ` at ${company}` : ''}
JOB DESCRIPTION:
${jd.slice(0, 3000)}

Instructions:
- 3-4 paragraphs, max 350 words
- Opening: hook that references something specific about the company or role, not generic
- Body: connect 2-3 specific achievements from the CV directly to what the JD asks for
- Closing: confident, clear call to action
- Tone: professional but human, not corporate, not sycophantic
- Do not start with "I am writing to apply…" or any variant
- Banned words: "passionate", "leverage", "synergy", "dynamic", "excited to", "thrilled"
- Address to "Hiring Manager" unless told otherwise
- Include a placeholder header: [Candidate Name] | [Email] | [Phone] | [LinkedIn]

Return the cover letter only; no commentary, no title, no labels.`

  try {
    const msg = await client.messages.create({
      model: MODELS.haiku,
      max_tokens: 800,
      system: [{ type: 'text', text: SYSTEM_CACHED, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
      betas: ['prompt-caching-2024-07-31'],
    })
    const text = msg.content[0]?.text?.trim() || ''
    if (msg.usage) {
      after(() => trackAiUsage({ userId: user.id, model: MODELS.haiku, action: 'cover_letter', usage: msg.usage }))
    }
    return NextResponse.json({ type: 'cv', text })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Generation failed' }, { status: 500 })
  }
}
