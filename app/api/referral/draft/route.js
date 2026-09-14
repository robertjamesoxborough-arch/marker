import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { after } from 'next/server'

import { trackAiUsage } from '../../../../lib/ai-usage'
import { MODELS } from '../../../../lib/anthropic'
import { buildAiContext } from '../../../../lib/ai-context'
import { checkAllowance } from '../../../../lib/allowance'
import { logIfError } from '../../../../lib/log-errors'
import { lintMessage } from '../../../../lib/message-lint'

// Referrals engine (Stage 69) — AI-drafted outreach messages. Candidate-side
// only: this drafts a message the USER sends from their own account, to
// someone in THEIR own network. Nothing here contacts anyone, stores an
// employer record, or introduces any employer-pays mechanic.
//
// The hard rule this route enforces server-side, not just in the UI: once a
// role is already Applied or further along, asking a contact to refer you
// is the wrong ask (the moment for a referral to help has passed) and makes
// the candidate look disorganised. warm_referral/reconnect_ask are only
// valid BEFORE application; nudge/intel_request are only valid AFTER.
// speculative_outreach never has a job attached at all -- it is relationship-
// building at a dream company, and the prompt explicitly asks for a
// conversation, never a job.

const POST_APPLY_STATUSES = ['applied', 'interviewing', 'offer']

const MESSAGE_TYPES = {
  warm_referral: {
    label: 'Warm referral ask',
    requiresJob: true,
    allowedWhen: (status) => !POST_APPLY_STATUSES.includes(status),
  },
  reconnect_ask: {
    label: 'Reconnect, then ask',
    requiresJob: true,
    allowedWhen: (status) => !POST_APPLY_STATUSES.includes(status),
  },
  speculative_outreach: {
    label: 'Speculative dream-company outreach',
    requiresJob: false,
    allowedWhen: () => true,
  },
  nudge: {
    label: 'Post-application nudge',
    requiresJob: true,
    allowedWhen: (status) => POST_APPLY_STATUSES.includes(status),
  },
  intel_request: {
    label: 'Ask for intel, not a referral',
    requiresJob: true,
    allowedWhen: (status) => POST_APPLY_STATUSES.includes(status),
  },
}

async function loadCandidate(service, userId) {
  const [profileRes, historyRes, wishlistRes] = await Promise.all([
    service.from('profiles').select('target_roles, seniority, industries, postcode, max_office_days, salary_floor, hard_filters_json, track, name').eq('user_id', userId).single(),
    service.from('career_history').select('role_title, company, start_date, end_date, achievements').eq('user_id', userId).order('start_date', { ascending: false }).limit(6),
    service.from('wishlists').select('company').eq('user_id', userId).limit(5),
  ])
  logIfError('referral/draft profiles', profileRes)
  logIfError('referral/draft career_history', historyRes)
  logIfError('referral/draft wishlists', wishlistRes)
  const profile = profileRes.data
  const candidateContext = profile ? buildAiContext(profile, historyRes.data || [], wishlistRes.data || []) : 'Candidate profile not available.'
  return { candidateContext, candidateName: profile?.name || null }
}

function buildRelationshipContext(contact) {
  const parts = [`Contact name: ${contact.name}`]
  if (contact.company) parts.push(`Currently at: ${contact.company}`)
  if (contact.pastCompanies?.length) parts.push(`Past companies: ${contact.pastCompanies.join(', ')}`)
  if (contact.relationship) parts.push(`How the candidate knows them: ${contact.relationship}`)
  if (contact.lastContactedAt) {
    const days = Math.floor((Date.now() - new Date(contact.lastContactedAt).getTime()) / 86400000)
    const when = days < 30 ? `${days} days ago` : days < 365 ? `${Math.round(days / 30)} months ago` : `${Math.round(days / 365)} years ago`
    parts.push(`Last contacted: ${when}`)
  } else {
    parts.push('Last contacted: no record of prior contact')
  }
  if (contact.notes) parts.push(`Notes on this relationship: ${contact.notes}`)
  return parts.join('\n')
}

function buildPrompt(messageType, contact, job, candidateContext, displayName) {
  const relationshipContext = buildRelationshipContext(contact)
  const jobContext = job
    ? `TARGET ROLE: ${job.roleTitle || 'Unknown role'} at ${job.company || contact.company || 'Unknown company'}${job.jd ? `\nJob description excerpt:\n${job.jd.slice(0, 1500)}` : ''}`
    : `No specific live role -- this is speculative relationship-building at ${contact.company || 'this company'}, not tied to any one opening.`

  const BRIEFS = {
    warm_referral: `Draft a short, warm message asking ${relationshipContext.includes('no record of prior contact') ? 'this contact' : contact.name} for a referral or a good word for a specific role. Be direct about the ask but not presumptuous -- reference the real relationship context given, make it easy for them to say yes or no, and give them an easy out. Do not write a cover letter in message form; this is a short personal message, not a pitch.`,
    reconnect_ask: `This relationship has gone quiet (see "Last contacted" above). Draft a message that leads with a genuine, brief reconnect (referencing real shared context if given) BEFORE making the ask -- do not open cold with the ask itself. The referral/good-word ask should feel like a natural next line after re-establishing contact, not the entire message.`,
    speculative_outreach: `Draft a speculative outreach message to someone at a company the candidate admires, with NO specific open role in mind. This must ask for a CONVERSATION (a coffee, a call, their perspective on the company/industry) -- it must NEVER ask for a job, a referral, or "any openings". The entire point is relationship-building for its own sake; asking for a job here would undermine that and read as presumptuous given there is no role and often limited relationship history.`,
    nudge: `This candidate has ALREADY APPLIED (or is further along) for this role, so asking for a referral now would be the wrong ask -- too late to help, and makes them look disorganised. Instead, draft a low-pressure "heads up" message: let the contact know they've applied, and if they happen to get a chance to mention it internally that would be appreciated, but make clear there's no expectation or pressure either way. Keep it brief and genuinely low-key.`,
    intel_request: `This candidate has ALREADY APPLIED (or is further along) for this role. Do NOT ask for a referral (too late, wrong ask). Instead draft a message asking the contact for genuine intel: what the team/interview process is actually like, anything useful to know, framed as picking their brain rather than asking for anything on the candidate's behalf.`,
  }

  return `You are helping ${displayName} write a short, genuinely personal outreach message as part of their own job search. This is a message THEY will send from their own account to someone in their own real network -- it must read like a real person wrote it, not a template.

CANDIDATE BACKGROUND: ${candidateContext}

RELATIONSHIP CONTEXT:
${relationshipContext}

${jobContext}

TASK: ${BRIEFS[messageType]}

Rules:
- First person, as if ${displayName} is writing it themselves. Natural, warm, concise -- 60 to 120 words, not a formal letter.
- Reference real, specific details from the relationship context and (if given) the role -- never generic filler that could apply to any contact or any company.
- Never invent a shared history, a specific project together, or any fact not given above.
- End with a clear, low-friction next step (a specific small ask, not vague).

Write in British English. Never use an em dash. Return ONLY the message text, no subject line, no preamble, no explanation.`
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

  const { contact, job, messageType } = await req.json()

  const typeDef = MESSAGE_TYPES[messageType]
  if (!typeDef) return Response.json({ error: `Unknown message type: ${messageType}` }, { status: 400 })
  if (!contact?.name) return Response.json({ error: 'Missing contact' }, { status: 400 })

  if (typeDef.requiresJob && !job) {
    return Response.json({ error: `${typeDef.label} needs a specific role attached.` }, { status: 400 })
  }
  if (!typeDef.requiresJob && job) {
    return Response.json({ error: `${typeDef.label} is for speculative outreach with no specific role attached.` }, { status: 400 })
  }
  if (job && !typeDef.allowedWhen(job.status)) {
    const wrongDirection = POST_APPLY_STATUSES.includes(job.status)
    return Response.json({
      error: wrongDirection
        ? `This role is already ${job.status} -- asking for a referral now is the wrong ask. Use "Post-application nudge" or "Ask for intel" instead.`
        : `This role hasn't been applied to yet -- "${typeDef.label}" is for after you've applied. Use "Warm referral ask" or "Reconnect, then ask" instead.`,
    }, { status: 400 })
  }

  const { allowed, used, cap, tier } = await checkAllowance(user.id, 'referral_draft')
  if (!allowed) {
    return Response.json({
      error: cap === 0
        ? 'Referral message drafting is not available on your current plan. Upgrade to Pro or Max to unlock.'
        : `Referral drafting limit reached (${used}/${cap} this month on your ${tier} plan). Upgrade to unlock more.`,
      limitReached: true, used, cap, tier,
    }, { status: 429 })
  }

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { candidateContext, candidateName } = await loadCandidate(service, user.id)
  const displayName = candidateName || 'the candidate'

  const prompt = buildPrompt(messageType, contact, job, candidateContext, displayName)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODELS.haiku,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const message = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim()
    if (!message) return Response.json({ error: 'No response from AI' }, { status: 500 })
    if (data.usage) after(() => trackAiUsage({ userId: user.id, model: MODELS.haiku, action: 'referral_draft', usage: data.usage }))

    const lint = lintMessage(message)
    return Response.json({ message, lint })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
