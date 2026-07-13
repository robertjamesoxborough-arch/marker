import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { after } from 'next/server'

import { trackAiUsage } from '../../../lib/ai-usage'
import { MODELS } from '../../../lib/anthropic'
import { buildAiContext } from '../../../lib/ai-context'
import { checkAllowance } from '../../../lib/allowance'


export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'No API key' }, { status: 500 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, used, cap, tier } = await checkAllowance(user.id, 'interview_prep')
  if (!allowed) {
    return Response.json({
      error: cap === 0
        ? 'Interview prep is not available on your current plan. Upgrade to Pro or Max to unlock.'
        : `Interview prep limit reached (${used}/${cap} this month on your ${tier} plan). Upgrade to unlock more.`,
      limitReached: true, used, cap, tier,
    }, { status: 429 })
  }

  let profileCvRaw = ''
  let candidateContext = 'Candidate profile not available.'
  let candidateName = null
  if (user) {
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const [profileRes, historyRes, wishlistRes] = await Promise.all([
      service.from('profiles').select('target_roles, seniority, industries, postcode, max_office_days, salary_floor, hard_filters_json, track, name').eq('user_id', user.id).single(),
      service.from('career_history').select('role_title, company, start_date, end_date').eq('user_id', user.id).order('start_date', { ascending: false }).limit(5),
      service.from('wishlists').select('company').eq('user_id', user.id).limit(5),
    ])
    const profile    = profileRes.data
    const careerHist = historyRes.data  || []
    const wishlists  = wishlistRes.data || []
    if (profile) {
      profileCvRaw    = profile.hard_filters_json?.cvRaw || ''
      candidateContext = buildAiContext(profile, careerHist, wishlists)
      candidateName   = profile.name || null
    }
  }

  const displayName = candidateName || 'the candidate'

  const { job, stage, interviewer, cvBase64, notes, jdText } = await req.json()
  if (!job || !stage) return Response.json({ error: 'Missing job or stage' }, { status: 400 })

  const CANDIDATE = profileCvRaw
    ? `CV on file (use as primary source):\n${profileCvRaw.slice(0, 2000)}\n\nProfile: ${candidateContext}`
    : candidateContext

  const STAGE_CONTEXT = {
    'screening': 'Initial screening call, typically 20-30 minutes with HR or talent team. Focus on: culture fit, basic role alignment, salary expectations, notice period, logistics.',
    'hiring_manager': 'With the hiring manager who makes the final call. They want deep role fit, how you think, and whether you can do the job. Expect competency-based questions and deep dives.',
    'panel': 'Panel with multiple stakeholders: peers, cross-functional partners, senior leaders. Varied question styles, need to engage multiple personalities simultaneously.',
    'final': 'Final round: likely one of 2-3 candidates. Assessing culture fit at senior level and any remaining concerns. Expect strategic questions, possibly a presentation or case study.',
    'task': 'Task or presentation round. Structure your thinking clearly, show commercial judgment, demonstrate you understand what the role needs.',
    'ceo': 'Senior/CEO level interview. Big-picture strategic questions, vision alignment, leadership philosophy and long-term thinking.',
  }

  const stageContext = STAGE_CONTEXT[stage] || `This is a ${stage} interview.`
  const hasJobLink = !!(job.jobLink && job.jobLink.trim())
  const hasJdText = !!(jdText && jdText.trim().length > 50)

  const content = []

  // Add CV PDF if provided
  if (cvBase64) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 }
    })
  }

  const prompt = `You are an expert interview coach preparing ${displayName} for a job interview. All research and preparation must be done via your web search tool.

STYLE RULES: Write in British English. Never use em dashes (—) in any output. Use colons, commas, or full stops instead.

CANDIDATE BACKGROUND: ${CANDIDATE}

ROLE: ${job.roleTitle || 'Unknown Role'} at ${job.company || 'Unknown Company'}
${hasJobLink ? 'Job URL: ' + job.jobLink : 'NO JOB URL PROVIDED: use web search to find this role if possible'}
${job.score ? 'Match score when assessed: ' + job.score + '/10' : ''}
${job.signalReason ? 'Initial assessment note: ' + job.signalReason : ''}

INTERVIEW STAGE: ${stage.replace('_', ' ').toUpperCase()}
${stageContext}

INTERVIEWER/FORMAT: ${interviewer || 'Not specified'}

${cvBase64 ? `SUBMITTED CV: The PDF attached is the ACTUAL CV ${displayName} submitted for this role. Use this as the basis for all preparation, not general background. Treat it as the source of truth for what they claimed.` : 'NO CV UPLOADED: base preparation on the candidate background above only.'}

${hasJdText ? 'JOB DESCRIPTION (provided by candidate):\n' + jdText.trim().slice(0, 6000) : ''}

${notes ? 'ADDITIONAL NOTES: ' + notes : ''}

---

IMPORTANT INSTRUCTION: For section 0 (JD Essentials), treat ${displayName} as if they have never read the job description. Explain the core requirements as if briefing someone fresh. This ensures a clear, unbiased view of what the company actually wants.

---

Please provide ALL of the following sections in full. Be specific, direct, and tailored. No padding.

## 0. JD ESSENTIALS: WHAT THIS ROLE ACTUALLY WANTS
Search for the job description if not provided. Then distill it as if briefing someone who has never seen it:
- The 5-6 core things this role requires (skills, experience, behaviours) in plain language
- The single most important thing the hiring manager cares about above all else
- Any specific tools, methodologies, or domain knowledge mentioned
- What success looks like in this role in year 1
- Any specific language or phrases from the JD that the candidate should mirror back in the interview
${!hasJobLink && !hasJdText ? '\n⚠️ NOTE: No job link or JD was provided. Search for this role online. If you cannot find it, note this clearly and ask the candidate to paste the JD.' : ''}

## 1. COMPANY INTEL (search now; live research only, no assumptions)
- What the company does and their current strategic focus
- Recent news, product launches, partnerships, funding, or challenges (last 6 months)
- Glassdoor signals on interview process and culture
- The interviewer\'s background if name/title was given (search LinkedIn/web)
- One sharp, specific insight ${displayName} should reference to show genuine preparation

## 2. ROLE ALIGNMENT
- Where ${displayName}'s background maps most strongly to what this role needs
- Where there are gaps, and specifically how to address each one proactively in the interview
- The angle ${displayName} should lead with (what's the most compelling version of their story for this role)

## 3. LIKELY QUESTIONS FOR THIS STAGE
8-10 questions most likely to be asked at a ${stage.replace('_', ' ')} interview for this role. For each:
**Q: [Question]**
Answer framework: [Specific approach referencing the candidate's actual experience from the submitted CV or their background; be concrete, not generic]

## 4. STORIES TO PREPARE (STAR format)
4 specific stories from the candidate's background mapped to the most likely competency areas for this role:
- Situation & Task (brief context)
- Action (what the candidate specifically did: their decisions, not the team's)
- Result (numbers where available; use the submitted CV as source)
- Why it lands for THIS role specifically

## 5. QUESTIONS TO ASK THEM
8 genuinely smart questions appropriate for this stage; show strategic thinking and genuine curiosity. Not generic. Stage-appropriate.

## 6. WATCH OUTS
3 things ${displayName} should prepare to address: likely concerns the interviewer will have, gaps to handle proactively, and anything to avoid saying based on the JD.

## 7. PREP CHECKLIST
Practical checklist: what to research, what to have ready, logistics, documents, and anything else to do before the call.

Execute this in full. Use web search to research the company, role, and interviewer. Be direct and specific throughout.`

  content.push({ type: 'text', text: prompt })

  const SYSTEM_STABLE = `You are an expert interview coach preparing job candidates for interviews. Use your web search tool to research companies, roles, and interviewers in real time. Be direct, specific, and tailored throughout. No generic advice.

STYLE RULES: Write in British English. Never use em dashes (—) in any output. Use colons, commas, or full stops instead.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: MODELS.sonnet,
        max_tokens: 2600,
        system: [{ type: 'text', text: SYSTEM_STABLE, cache_control: { type: 'ephemeral' } }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content }]
      })
    })

    const data = await res.json()
    const text = data.content?.filter(c => c.type === 'text').map(c => c.text).join('') || ''
    if (!text) return Response.json({ error: 'No response from AI' }, { status: 500 })
    if (user && data.usage) {
      after(() => trackAiUsage({ userId: user.id, model: MODELS.sonnet, action: 'interview_prep', usage: data.usage }))
    }
    return Response.json({ prep: text, usedJdText: hasJdText, hadJobLink: hasJobLink })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
