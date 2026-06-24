import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { after } from 'next/server'

import { trackAiUsage } from '../../../lib/ai-usage'
import { MODELS } from '../../../lib/anthropic'
import { buildAiContext } from '../../../lib/ai-context'

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

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { roleTitle, company, offerAmount, targetAmount, notes, jdText } = await req.json()
  if (!roleTitle || !company) return Response.json({ error: 'Role title and company are required.' }, { status: 400 })

  const [profileRes, historyRes, wishlistRes] = await Promise.all([
    service.from('profiles').select('target_roles, seniority, industries, postcode, max_office_days, salary_floor, hard_filters_json, track, name').eq('user_id', user.id).single(),
    service.from('career_history').select('role_title, company, start_date, end_date').eq('user_id', user.id).order('start_date', { ascending: false }).limit(5),
    service.from('wishlists').select('company').eq('user_id', user.id).limit(5),
  ])
  const profile = profileRes.data
  const careerHistory = historyRes.data || []
  const wishlists = wishlistRes.data || []

  const candidateContext = buildAiContext(profile, careerHistory, wishlists)
  const displayName = profile?.name || 'the candidate'
  const salaryFloor = profile?.salary_floor ? `£${Math.round(profile.salary_floor / 1000)}k` : null

  const prompt = `You are an expert negotiation coach preparing ${displayName} to negotiate a job offer. Be direct, specific, and commercially practical. No generic advice.

CANDIDATE BACKGROUND:
${candidateContext}
${salaryFloor ? `Stated salary floor: ${salaryFloor}` : ''}

ROLE: ${roleTitle} at ${company}
${offerAmount ? `OFFER RECEIVED: ${offerAmount}` : 'No offer amount specified — coach on general negotiation approach.'}
${targetAmount ? `CANDIDATE'S TARGET: ${targetAmount}` : ''}
${jdText ? `JOB DESCRIPTION:\n${jdText.slice(0, 2000)}` : ''}
${notes ? `ADDITIONAL CONTEXT: ${notes}` : ''}

Provide ALL of the following sections. Be specific to this candidate and role. No padding.

## 1. OFFER ANALYSIS
${offerAmount
  ? `- Where does ${offerAmount} sit relative to market for ${roleTitle} at this seniority level in the UK?
- Is this strong, fair, or below market? Give a direct verdict.
- What does the total package look like beyond base (pension, equity, benefits) — what to probe for?`
  : `- What salary range should ${displayName} expect for ${roleTitle} at this level in the UK?
- What's a realistic ask vs what would be overreaching?
- What total package components to prioritise beyond base?`}

## 2. COUNTER-OFFER STRATEGY
- Should ${displayName} counter? Yes/No with a direct reason.
${offerAmount && targetAmount ? `- How to move from ${offerAmount} to ${targetAmount} — specific strategy, not generic advice.` : '- What to ask for and how to frame it.'}
- Anchor technique: what number to open with and why.
- What to ask for beyond salary (equity, signing bonus, review date, remote days, title).

## 3. OPENING SCRIPTS (word-for-word)
Write 3 versions — one call/verbal script, one email, one for when they push back on the ask:

**VERBAL (phone/video call):**
[exact script — what to say, including the pause technique]

**EMAIL:**
[full email draft — subject line + body, confident and specific, not sycophantic]

**PUSHBACK RESPONSE:**
[what to say when they say "we can't move on salary" — how to pivot to other components or hold firm]

## 4. BATNA — Know Your Walk-Away
- What is ${displayName}'s walk-away point based on their stated salary floor?
- What to say if they won't negotiate — how to accept gracefully OR decline professionally.
- How to keep the relationship warm if declining.

## 5. LIKELY OBJECTIONS + RESPONSES
3-4 common pushbacks for this type of role and direct counter-responses:

**Objection:** [likely thing they'll say]
**Response:** [what to say — specific, confident, not defensive]

## 6. TIMING AND PROCESS
- When to negotiate (after verbal offer, before signing — the exact moment).
- How many rounds is normal for this type of role.
- What to do if they give a deadline — how to buy time professionally.

Be direct throughout. This candidate needs a negotiation pack they can use tomorrow morning.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELS.sonnet,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const text = data.content?.filter(c => c.type === 'text').map(c => c.text).join('') || ''
    if (!text) return Response.json({ error: 'No response from AI' }, { status: 500 })
    if (user && data.usage) {
      after(() => trackAiUsage({ userId: user.id, model: MODELS.sonnet, action: 'negotiation_prep', usage: data.usage }))
    }
    return Response.json({ prep: text })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
