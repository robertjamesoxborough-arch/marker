import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse, after } from 'next/server'
import { trackAiUsage } from '../../../../lib/ai-usage'
import { MODELS } from '../../../../lib/anthropic'
import { buildAiContext } from '../../../../lib/ai-context'
import { checkVerifiedStats } from '../../../../lib/verified-stats'


export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const [profileRes, historyRes, wishlistRes] = await Promise.all([
    service.from('profiles').select('hard_filters_json, target_roles, seniority, industries, max_office_days, salary_floor, postcode, track').eq('user_id', user.id).single(),
    service.from('career_history').select('role_title, company, start_date, end_date, achievements').eq('user_id', user.id).order('start_date', { ascending: false }).limit(5),
    service.from('wishlists').select('company').eq('user_id', user.id).limit(5),
  ])
  const profile = profileRes.data
  const careerHistory = historyRes.data || []
  const wishlists     = wishlistRes.data || []

  const cvRaw = profile?.hard_filters_json?.cvRaw || ''
  if (!cvRaw) return NextResponse.json({ error: 'No CV stored. Complete onboarding to upload your CV.' }, { status: 400 })

  const { roleTitle, company, jd, effort = 'standard', answers = [] } = await request.json()
  const answersSection = answers.length > 0
    ? '\n\nAdditional context from the candidate:\n' + answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')
    : ''

  const TRACK_TONE = {
    balanced:       'The candidate prioritises roles with genuine work-life balance. Where relevant, highlight achievements that demonstrate sustainable, high-quality output rather than overwork.',
    parent:         'The candidate is a parent seeking family-friendly employers. Where relevant, frame experience to highlight reliability, time management, and the breadth of transferable skills that come with managing work and family.',
    returner:       'The candidate has taken a career break. Frame any gaps positively — reframe transferable skills, volunteer work, or development activities from the break period. Never apologise for the gap.',
    career_changer: 'The candidate is changing industries or role type. Emphasise transferable skills, underlying competencies, and the value their different background brings — not what they lack.',
    standard:       '',
  }
  const trackNote = TRACK_TONE[profile?.track] || ''
  if (!roleTitle || !jd) return NextResponse.json({ error: 'Role title and job description are required.' }, { status: 400 })

  const client = new Anthropic()

  let prompt
  let maxTokens

  const STAT_GUARDRAIL = `VERIFIED-STATS RULE (hard): Every metric, number, percentage, date, and monetary figure you write MUST appear verbatim in the BASE CV. Never invent, estimate, or extrapolate any statistic. If a number is not in the CV, do not include it. This is a non-negotiable rule.`

  if (effort === 'quick') {
    prompt = `Compare the CV against the job description and return ONLY valid JSON.
${trackNote ? '\nFraming note: ' + trackNote + '\n' : ''}
CV:
${cvRaw.slice(0, 4000)}

Role: ${roleTitle}${company ? ` at ${company}` : ''}
Job Description:
${jd.slice(0, 3000)}

Return this exact JSON format:
{"matched":["keyword1","keyword2"],"missing":["keyword3","keyword4"],"tweaks":["Tweak suggestion 1","Tweak suggestion 2","Tweak suggestion 3"],"matchScore":72}

Rules:
- matched: keywords/phrases from the JD that already appear in the CV (max 10)
- missing: important JD keywords not in the CV (max 10)
- tweaks: 3-5 specific, actionable sentence-level edits (not generic advice)
- matchScore: estimated ATS match percentage 0-100
- No markdown, no explanation, just the JSON object`
    maxTokens = 600
  } else if (effort === 'standard') {
    prompt = `Rewrite the CV below to better match the target role. Improve the profile summary, and update the most relevant experience bullets to mirror the JD's language and keywords. Keep the structure and all other content unchanged.
${trackNote ? '\nFraming note: ' + trackNote + '\n' : ''}
${STAT_GUARDRAIL}

BASE CV:
${cvRaw.slice(0, 5000)}

TARGET ROLE: ${roleTitle}${company ? ` at ${company}` : ''}
JOB DESCRIPTION:
${jd.slice(0, 3000)}${answersSection}

Rules:
- Mark each changed section with [UPDATED] at the start
- Do not add any metric, number, or percentage not already in the BASE CV
- Keep the same formatting style
- Return the full CV text, not just the changed sections`
    maxTokens = 2000
  } else {
    // deep
    prompt = `Perform a full tailoring of the CV below for the target role.
${trackNote ? '\nFraming note: ' + trackNote + '\n' : ''}
${STAT_GUARDRAIL}

BASE CV:
${cvRaw.slice(0, 5000)}

TARGET ROLE: ${roleTitle}${company ? ` at ${company}` : ''}
JOB DESCRIPTION:
${jd.slice(0, 3000)}${answersSection}

Step 1 — ATS simulation: list matched keywords, missing keywords, and an honest match score.
Step 2 — Full rewrite: rewrite the profile, core skills section, and all experience bullets to maximise ATS match and human readability. Do not invent any metrics not in the BASE CV.
Step 3 — Sift assessment: 2-3 sentences on strengths, concerns, and estimated interview invite probability.

Format:
---ATS ANALYSIS---
Matched: [comma-separated list]
Missing: [comma-separated list]
Match score: X/100

---TAILORED CV---
[full CV text with [UPDATED] markers on changed sections]

---SIFT ASSESSMENT---
[2-3 sentences]`
    maxTokens = 3000
  }

  const candidateContext = buildAiContext(profile, careerHistory, wishlists)
  const SYSTEM_CACHED = `You are an expert CV writer and ATS specialist working with UK job seekers at senior level. Your outputs are used directly by candidates — accuracy, specificity, and professional tone are essential.

HARD RULE: Never invent, add, or extrapolate any metric, statistic, number, percentage, date, or monetary figure not explicitly present in the candidate's base CV. Hallucinated CV stats are the #1 trust failure in AI writing — it is your job to prevent them. Only use facts that appear in the source material below.

CANDIDATE PROFILE:
${candidateContext}`

  try {
    const model = MODELS.haiku
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: SYSTEM_CACHED, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
      betas: ['prompt-caching-2024-07-31'],
    })

    const raw = msg.content[0]?.text?.trim() || ''
    if (msg.usage) {
      after(() => trackAiUsage({ userId: user.id, model, action: 'cv', usage: msg.usage }))
    }

    if (effort === 'quick') {
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      try {
        const parsed = JSON.parse(text)
        return NextResponse.json({ type: 'keywords', data: parsed })
      } catch {
        return NextResponse.json({ type: 'text', text: raw })
      }
    }

    // Post-generation verified-stats check (standard + deep only)
    const achievements = careerHistory.map(h => h.achievements).filter(Boolean)
    const { flagged: flaggedMetrics } = checkVerifiedStats(raw, cvRaw, achievements)

    return NextResponse.json({ type: 'cv', text: raw, flaggedMetrics })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Generation failed' }, { status: 500 })
  }
}
