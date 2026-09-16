import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { after } from 'next/server'

import { trackAiUsage } from '../../../lib/ai-usage'
import { MODELS } from '../../../lib/anthropic'
import { buildAiContext } from '../../../lib/ai-context'
import { checkAllowance } from '../../../lib/allowance'
import { logIfError } from '../../../lib/log-errors'

// Interview prep overhaul (Stage 67). Same route, extended rather than
// forked, now doing two distinct jobs behind one POST:
//   - pack build (default): the full Sonnet + web_search prep pack, now
//     returned as structured JSON instead of a markdown blob, so the UI
//     can lead with a TLDR hero and jump between named sections instead
//     of scrolling one long document.
//   - Live mode free-text fallback (`mode: 'live'`): a small, fast, Haiku-
//     only call (no web_search) for the rare question the pack's
//     pre-generated cue cards don't cover, capped to ~250 tokens and its
//     own allowance so it can be tapped several times in one interview
//     without eating into the 8/month pack-build cap.

const STAGE_CONTEXT = {
  'screening': 'Initial screening call, typically 20-30 minutes with HR or talent team. Focus on: culture fit, basic role alignment, salary expectations, notice period, logistics.',
  'hiring_manager': 'With the hiring manager who makes the final call. They want deep role fit, how you think, and whether you can do the job. Expect competency-based questions and deep dives.',
  'panel': 'Panel with multiple stakeholders: peers, cross-functional partners, senior leaders. Varied question styles, need to engage multiple personalities simultaneously.',
  'final': 'Final round: likely one of 2-3 candidates. Assessing culture fit at senior level and any remaining concerns. Expect strategic questions, possibly a presentation or case study.',
  'task': 'Task or presentation round. Structure your thinking clearly, show commercial judgment, demonstrate you understand what the role needs.',
  'ceo': 'Senior/CEO level interview. Big-picture strategic questions, vision alignment, leadership philosophy and long-term thinking.',
}

const STAGE_LABELS = {
  screening: 'Screening call', hiring_manager: 'Hiring manager', panel: 'Panel',
  final: 'Final round', task: 'Task / case study', ceo: 'CEO / exec',
}

async function loadCandidate(service, userId) {
  const [profileRes, historyRes, wishlistRes] = await Promise.all([
    service.from('profiles').select('target_roles, seniority, industries, postcode, max_office_days, salary_floor, hard_filters_json, track, name').eq('user_id', userId).single(),
    service.from('career_history').select('role_title, company, start_date, end_date, achievements').eq('user_id', userId).order('start_date', { ascending: false }).limit(6),
    service.from('wishlists').select('company').eq('user_id', userId).limit(5),
  ])
  logIfError('interview-prep profiles', profileRes)
  logIfError('interview-prep career_history', historyRes)
  logIfError('interview-prep wishlists', wishlistRes)
  const profile = profileRes.data
  const careerHist = historyRes.data || []
  const wishlists = wishlistRes.data || []
  const profileCvRaw = profile?.hard_filters_json?.cvRaw || ''
  const candidateContext = profile ? buildAiContext(profile, careerHist, wishlists) : 'Candidate profile not available.'
  const candidateName = profile?.name || null
  return { profileCvRaw, candidateContext, candidateName, careerHist }
}

// Prior-stage notes (interview_stage_notes, migration 014) -- read-only
// here, oldest first. These OUTRANK the JD in the prompt below: a JD is
// what the company wrote before they ever met the candidate, whereas a
// stage note is what actually happened in the room.
async function loadStageNotes(service, userId, jobId) {
  if (!jobId) return []
  const { data, error } = await service
    .from('interview_stage_notes')
    .select('stage, note, created_at')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })
  if (error) { console.error('[interview-prep] stage notes read failed:', error.message); return [] }
  return data || []
}

function formatStageNotes(notes) {
  if (notes.length === 0) return ''
  const lines = notes.map(n => {
    const label = STAGE_LABELS[n.stage] || n.stage
    const date = new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return `- [${label}, ${date}] ${n.note}`
  })
  return `\n\nNOTES FROM PRIOR INTERVIEW STAGES (these OUTRANK the job description -- a JD is what the company wrote before they ever met the candidate; a stage note is what actually happened in the room. If a note conflicts with the JD, trust the note):\n${lines.join('\n')}`
}

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

  const body = await req.json()
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (body.mode === 'live') return handleLive(service, user, body)
  return handlePackBuild(service, user, body)
}

// ── Live mode free-text fallback ────────────────────────────────────
// Pre-generated cue cards (built once, at pack-build time, and cached
// client-side -- see PrepTab.js) cover the tap-and-read case at zero
// marginal cost. This handles only what those cues don't: a genuinely new
// question typed live. Haiku, no web_search, hard-capped output, its own
// allowance so it never competes with the 8/month pack-build cap.
async function handleLive(service, user, body) {
  const { allowed, used, cap, tier } = await checkAllowance(user.id, 'interview_prep_live')
  if (!allowed) {
    return Response.json({
      error: cap === 0
        ? 'Live mode is not available on your current plan. Upgrade to Pro or Max to unlock.'
        : `Live mode limit reached (${used}/${cap} this month on your ${tier} plan). Your pre-built cue cards still work.`,
      limitReached: true, used, cap, tier,
    }, { status: 429 })
  }

  const { job, stage, question, packSummary } = body
  if (!question || !question.trim()) return Response.json({ error: 'Missing question' }, { status: 400 })

  const { candidateContext, candidateName } = await loadCandidate(service, user.id)
  const displayName = candidateName || 'the candidate'

  const prompt = `You are coaching ${displayName} DURING a live interview, right now, in real time. They just got asked something their prep pack didn't cover and need an answer in seconds, not a discussion.

ROLE: ${job?.roleTitle || 'the role'} at ${job?.company || 'the company'}
STAGE: ${STAGE_LABELS[stage] || stage || 'interview'}
CANDIDATE BACKGROUND: ${candidateContext}
${packSummary ? `WHAT THEIR PREP ALREADY COVERED: ${packSummary}` : ''}

THE QUESTION THEY WERE JUST ASKED: ${question.trim()}

Give ONE short, ready-to-say answer. First person, spoken rhythm, plain English, grounded only in the real background above -- never invent a fact, number, or achievement not already given. No preamble, no "here's how I'd answer that", just the answer itself as they should say it. Two to four sentences maximum. Write in British English, never use an em dash.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELS.haiku,
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim()
    if (!text) return Response.json({ error: 'No response from AI' }, { status: 500 })
    if (data.usage) after(() => trackAiUsage({ userId: user.id, model: MODELS.haiku, action: 'interview_prep_live', usage: data.usage }))
    return Response.json({ answer: text })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// ── Pack build ───────────────────────────────────────────────────────
async function handlePackBuild(service, user, body) {
  const { allowed, used, cap, tier } = await checkAllowance(user.id, 'interview_prep')
  if (!allowed) {
    return Response.json({
      error: cap === 0
        ? 'Interview prep is not available on your current plan. Upgrade to Pro or Max to unlock.'
        : `Interview prep limit reached (${used}/${cap} this month on your ${tier} plan). Upgrade to unlock more.`,
      limitReached: true, used, cap, tier,
    }, { status: 429 })
  }

  // Shared web_search pool (Stage 64) — checked in addition to the
  // feature-specific cap above, since this call always uses web_search.
  // See lib/allowance.js.
  const searchPool = await checkAllowance(user.id, 'web_search')
  if (!searchPool.allowed) {
    return Response.json({
      error: `You've used your web searches for this month (${searchPool.used}/${searchPool.cap}). Upgrade for more, or it resets on the 1st.`,
      limitReached: true, used: searchPool.used, cap: searchPool.cap, tier: searchPool.tier, action: 'web_search',
    }, { status: 429 })
  }

  const { profileCvRaw, candidateContext, candidateName } = await loadCandidate(service, user.id)
  const displayName = candidateName || 'the candidate'

  const { job, stage, interviewer, cvBase64, notes, jdText } = body
  if (!job || !stage) return Response.json({ error: 'Missing job or stage' }, { status: 400 })

  const stageNotes = await loadStageNotes(service, user.id, job.id)
  const stageNotesBlock = formatStageNotes(stageNotes)

  const CANDIDATE = profileCvRaw
    ? `CV on file (use as primary source):\n${profileCvRaw.slice(0, 2000)}\n\nProfile: ${candidateContext}`
    : candidateContext

  const stageContext = STAGE_CONTEXT[stage] || `This is a ${stage} interview.`
  const hasJobLink = !!(job.jobLink && job.jobLink.trim())
  const hasJdText = !!(jdText && jdText.trim().length > 50)

  const content = []
  if (cvBase64) {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 } })
  }

  const prompt = `Prepare ${displayName} for a job interview. All research must be done via your web search tool.

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
${stageNotesBlock}

Execute the full JSON structure described in your instructions. Use web search to research the company, role, and interviewer. Be direct and specific throughout.${!hasJobLink && !hasJdText ? ' No job link or JD was given; search for this role online, and if you genuinely cannot find it, say so plainly in jdEssentials rather than guessing.' : ''}`

  content.push({ type: 'text', text: prompt })

  // Static instructions only -- no candidate-specific content -- so this
  // block caches across every prep-pack call regardless of candidate or
  // role. Deliberately sized well past any model's real cache-eligibility
  // floor (this project measured Haiku's real floor at ~4096 tokens, well
  // above the commonly-quoted 1024 -- see PROGRESS.md Stage 19g/27 -- so
  // this is written long enough to clear either comfortably rather than
  // trusting a documented minimum).
  const SYSTEM_STABLE = `You are an expert interview coach preparing job candidates for real interviews. Use your web search tool to research companies, roles, and interviewers in real time; never assume or invent what you have not found. Be direct, specific, and tailored throughout; no generic advice, no padding, no filler sentences that could apply to any candidate for any role.

STYLE RULES: Write in British English. Never use an em dash in any output. Use colons, commas, or full stops instead.

THE CORE DIFFERENTIATOR OF THIS PREP PACK -- SCRIPTED "SAY:" ANSWERS
For every likely interview question you generate, the primary output is NOT "here are themes to cover" -- it is a ready-to-speak answer the candidate could say almost word for word. Write each "say" field as:
- First person, in the candidate's own likely voice -- "I led..." not "The candidate led..."
- Spoken rhythm: contractions (I'd, we'd, it's), natural sentence lengths, the way someone actually talks in a room -- never written-CV language ("spearheaded", "leveraged synergies", "utilised"). If it would look normal as a CV bullet point, rewrite it; it must sound normal said out loud instead.
- Long enough to fill roughly 45 to 90 seconds spoken aloud at a natural pace -- that is roughly 100 to 200 words, not a one-line summary and not an essay.
- Grounded ONLY in real material: the candidate's real CV, real career history, and the STAR stories you yourself generate in this same response. Never invent a project, number, team size, or outcome that is not already present in what you were given. If there is genuinely no strong real story for a question, say so honestly within the "say" field itself rather than fabricating one, and suggest what kind of real example would work if the candidate has one you were not given.
- Also provide a "framework" field: the underlying structural skeleton (e.g. a STAR outline: Situation, Task, Action, Result, each a short phrase) for candidates who would rather build their own answer than use a script. This is secondary, always present, but never the lead.

STAGE MEMORY
When notes from prior interview stages are provided, they describe what genuinely happened in the room and OUTRANK the job description on every point where they differ -- a job description is what the company wrote before they had ever met this candidate. Use prior notes to sharpen every section: likely questions for a LATER stage should reflect what was actually asked or flagged earlier, not just restate generic questions for that stage in the abstract. When prior notes exist, tldr.whatsChanged must be one or two honest sentences on what has genuinely changed in the picture since the JD was written (a concern raised, a requirement that turned out to matter more or less, a detail about the team or process). When there are no prior notes, tldr.whatsChanged must be exactly null.

LIVE MODE CUE CARDS
Alongside the main pack, generate 8 to 12 short "liveCues": quick-tap prompts for the exact moment a candidate is mid-interview and needs a one-glance reminder, not a full script. Each has a short "trigger" label (e.g. "Why this company", "Your biggest weakness", "Why leaving current role", "Salary expectations", "Handling the [specific real gap] question") and a "cue": one to two sentences, spoken rhythm, immediately usable, covering the highest-probability real moments for THIS specific role and stage, not generic interview advice.

OUTPUT FORMAT -- STRICT
Return ONLY a single valid JSON object, no markdown fencing, no commentary before or after it, in exactly this shape:
{
  "tldr": {
    "roleSummary": "one or two plain sentences: what this role actually is, distilled for someone who has never read the JD",
    "decidingFactors": ["the 3 to 4 specific things that will actually decide whether this candidate gets an offer, most important first"],
    "landThis": "one sentence: the single most important thing to land above everything else in this interview",
    "whatsChanged": "one or two sentences on what has changed since the JD, using prior stage notes -- or exactly null if no prior notes were given"
  },
  "jdEssentials": "markdown text using - bullets: the 5-6 core things this role requires in plain language, the single most important thing the hiring manager cares about, specific tools/methodology/domain knowledge mentioned, what success looks like in year 1, and specific JD phrases worth mirroring back",
  "companyIntel": "markdown text using - bullets, from real web search only: what the company does and its current strategic focus, recent news/launches/funding/challenges in the last 6 months, publicly reported detail on what their interview process involves, the interviewer's background if given, and one sharp specific insight worth referencing",
  "roleAlignment": "markdown text using - bullets: where the candidate's real background maps most strongly to this role, where the real gaps are and how to address each proactively, and the single most compelling angle to lead with",
  "likelyQuestions": [
    { "question": "the likely question, verbatim as it might be asked", "say": "the scripted spoken answer as described above", "framework": "the short structural skeleton for building an alternative answer" }
  ],
  "stories": [
    { "title": "a short label for the story", "situation": "brief real context", "action": "what the candidate specifically did, their decisions not the team's", "result": "the real, verifiable outcome, numbers only if genuinely present in the source material", "why": "why this story lands for this specific role" }
  ],
  "questionsToAsk": ["8 genuinely smart, stage-appropriate questions to ask the interviewer, showing real strategic thinking, not generic ones"],
  "watchOuts": ["3 things to prepare to address: likely concerns, gaps to handle proactively, anything to avoid saying given the JD"],
  "checklist": ["a practical pre-interview checklist: what to research, what to have ready, logistics, documents"],
  "liveCues": [
    { "trigger": "short label for the moment this covers", "cue": "the one-to-two sentence spoken cue" }
  ]
}
Generate 8 to 10 items in likelyQuestions, exactly 4 in stories, 8 in questionsToAsk, 3 in watchOuts, and 8 to 12 in liveCues. Return ONLY the JSON object described above.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELS.sonnet,
        // Sized generously and verified live: the full 9-question scripted
        // pack + 10-cue Live set genuinely runs to ~8,000-9,000 output
        // tokens on its own even with thinking off, so a lower ceiling
        // truncates the JSON before it can close -- self-tested twice.
        max_tokens: 14000,
        // Explicitly disabled: Sonnet 5 auto-invokes extended thinking on a
        // prompt this complex even when not asked (same behaviour noted in
        // cv/generate and onboard/parse-cv), and a strict-JSON response
        // like this one has zero tolerance for truncation the way a
        // markdown response degrades gracefully -- self-tested live and
        // confirmed thinking alone consumed 6096 of a 6000-token budget on
        // one real run, truncating the JSON before it could close.
        thinking: { type: 'disabled' },
        system: [{ type: 'text', text: SYSTEM_STABLE, cache_control: { type: 'ephemeral' } }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        messages: [{ role: 'user', content }],
      }),
    })

    const data = await res.json()
    const raw = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim()
    if (!raw) return Response.json({ error: 'No response from AI' }, { status: 500 })

    if (user && data.usage) {
      after(() => trackAiUsage({ userId: user.id, model: MODELS.sonnet, action: 'interview_prep', usage: data.usage }))
      after(() => trackAiUsage({ userId: user.id, model: MODELS.sonnet, action: 'web_search', usage: data.usage }))
    }

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    let pack
    try {
      pack = match ? JSON.parse(match[0]) : null
    } catch (e) {
      console.error('[interview-prep] pack JSON parse failed:', e.message)
      pack = null
    }
    if (!pack) return Response.json({ error: 'Could not parse the prep pack; try again' }, { status: 500 })

    return Response.json({ pack, usedJdText: hasJdText, hadJobLink: hasJobLink, stageNotesCount: stageNotes.length })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
