import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse, after } from 'next/server'
import { trackAiUsage } from '../../../../lib/ai-usage'
import { MODELS } from '../../../../lib/anthropic'
import { buildAiContext } from '../../../../lib/ai-context'
import { checkAllowance, SPEND_CEILING_MESSAGE } from '../../../../lib/allowance'
import { logIfError } from '../../../../lib/log-errors'
import { lintMessage } from '../../../../lib/message-lint'


export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, used, cap, tier, spendExceeded } = await checkAllowance(user.id, 'cover_letter')
  if (!allowed) {
    return NextResponse.json({
      error: spendExceeded ? SPEND_CEILING_MESSAGE : cap === 0
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

  // Stage 82 rewrite — the previous prompt produced letters that read like
  // an internal positioning memo, not a person: dense with corporate
  // abstraction, every achievement crammed into one paragraph, and (the
  // real failure that triggered this rewrite) a company/product name once
  // confused with a different one, which instantly tells the reader the
  // letter is recycled. Every numbered rule below traces to a specific,
  // named failure mode, not a generic "sound more human" instruction.
  const SYSTEM_CACHED = `You are an expert cover letter writer specialising in UK job applications. You write in a natural, human voice: the letter should read like a specific, thoughtful person explaining why this exact role makes sense for them, never like an internal positioning memo or a marketing brief.

GOVERNING INSTRUCTION, apply throughout every letter, to EVERY profession and EVERY kind of employer, not commercial companies only: Write cover letters in a natural, human voice. Use career history selectively as evidence, not as a full CV. Make the letter specific to what this actual employer or organisation needs from this specific role. Avoid generic AI/marketing jargon, over-polished corporate phrasing, and any unsupported claims. Prioritise clarity, credibility and a sense that the writer genuinely understands what makes this particular role and employer distinctive, whether that is a company selling a product, an NHS trust running a ward, a school running a department, or a client hiring a tradesperson directly.

NON-NEGOTIABLE RULES:
1. ACCURACY IS PARAMOUNT. Use the exact employer name given below, and, where the job description names a specific product, service, department, ward, site or team, the exact name, precisely as given. Never substitute, invent, or confuse it with a similar-sounding one. A wrong or swapped name is the single worst failure this letter can make: it tells the reader instantly that the letter is recycled from somewhere else. Equally, never OMIT the employer name entirely and write only in generic terms ("this role", "this contract", "the programme") -- a letter that never once names who it is actually being sent to is just as much a sign of a recycled letter as a wrong name. The employer name must appear at least once, per the Structure instructions below.
2. HUMAN VOICE, NOT JARGON. Never use any of: "go-to-market discipline", "commercial signal", "category narrative", "value proposition", "core competency", "strategic imperative", "market dynamics", "north star", "move the needle", "best-in-class", "world-class", "mission-critical", "proven track record", "thought leadership", "wheelhouse", "hit the ground running", "at the intersection of", "drive impact", "drive value", "leverage", "synergy", "seamless", "robust", "cutting-edge", "unlock", "elevate", "delve", "passionate", "excited to", "thrilled", "dynamic". Write plain, sharp, specific sentences a real person would actually say, not a generated memo. This applies equally to a nurse, an electrician, a teacher or an accountant as to anyone in a commercial or marketing role -- do not reach for commercial/product-marketing framing ("buyer", "product", "market") unless the employer genuinely is a company selling something; for a public-sector, care, education or trade employer, ground the letter in what THAT employer and role actually involve instead.
3. CAREER HISTORY IS SELECTIVE EVIDENCE, NOT A COMPRESSED CV. Choose ONE or TWO achievements that genuinely support the argument you are making, and give each room to land. Do not cram three or four achievements into one dense paragraph; that reads as a CV rewritten in prose, not a letter.
4. BE SPECIFIC TO WHAT THIS ROLE AND EMPLOYER ACTUALLY NEED. Ground the letter in the real problem this specific role exists to solve, based on what the job description actually says -- whatever that problem is for THIS employer: a commercial buyer's problem, a patient safety or care problem, a pupil outcome, a client's electrical fault, a site's compliance need. Never fall back on generic AI/marketing language, and never force a "product"/"buyer" framing onto an employer that isn't a company selling something.
5. CURIOUS AND COMMERCIALLY AWARE, NOT INFLATED CERTAINTY. Write as someone who understands why this is hard and would enjoy working on it: closer to "I understand why this is hard, and I'd enjoy helping solve it" than to any version of "I know exactly what you need."
6. ONE CLEAR THREAD. Build the whole letter from a single real line of argument grounded in the candidate's actual positioning below. Do not adopt a different persona or angle in each paragraph.
7. END WITH INTENT, NOT PASSIVITY OR GRANDIOSITY. Close with a genuine sense of wanting to build real depth in this specific area over time. Avoid a passive "I look forward to hearing from you" and avoid any overblown claim about transforming the business single-handedly.
8. NO UNSUPPORTED CLAIMS — THIS MEANS MORE THAN NUMBERS. Never invent a metric, statistic, or achievement not explicitly present in the candidate's CV below: the same rule as CV generation. But also never invent a SCENE, a conversation, a specific moment, a colleague's reaction, or any other narrative detail that is not itself stated in the source, even in service of sounding vivid or human — a fabricated anecdote is exactly as much a fabrication as a fabricated number. And never characterise what a role actually involved beyond what its listed responsibilities/achievements say: if a role's real achievements are about internal technical delivery, do not present that role as if it involved a different audience or function (e.g. direct customer-facing work) just because that would fit the letter's argument better. When you want texture or a concrete illustration, build it from a real, stated achievement, described plainly and specifically, rather than dramatised into an invented moment.

STYLE RULES: Write in British English. Never use em dashes (—) in any output. Use colons, commas, or full stops instead.

CANDIDATE PROFILE:
${candidateContext}`

  const prompt = `Write a cover letter for the role below.
${trackNote ? '\nTone note: ' + trackNote + '\n' : ''}
COMPANY (use this exact name; never substitute, invent, or confuse it with another company): ${company || 'the company named in the job description below'}

CANDIDATE CV:
${cvRaw.slice(0, 4000)}

TARGET ROLE: ${roleTitle}${company ? ` at ${company}` : ''}
JOB DESCRIPTION (read carefully for the exact employer/product/service/team name and the real problem this specific role exists to solve, whatever kind of employer this is):
${jd.slice(0, 3000)}

Structure:
- 3-4 paragraphs, max 350 words
- Opening: a hook specific to what this role and employer actually need, based on the job description, never a generic opener and never a forced "product"/"buyer" framing if this isn't a company selling something
- Body: one or two achievements from the CV used as evidence for a single clear argument, not a list of achievements
- Closing: a genuine sense of wanting to build depth in this area over time, not a passive sign-off
- Do not start with "I am writing to apply…" or any variant
- Address to "Hiring Manager" unless told otherwise
- Include a placeholder header: [Candidate Name] | [Email] | [Phone] | [LinkedIn]

MANDATORY FORMAT, copy this exactly (do not skip the second line, do not merge it into the salutation):
[Candidate Name] | [Email] | [Phone] | [LinkedIn]

Hiring Manager
${company || '[Company Name]'}

Dear Hiring Manager,

[letter body]

This is not optional: the line "${company || '[Company Name]'}" must appear verbatim on its own line exactly as shown above, every time, with no exceptions for contract, FTC, trade or informal-sounding roles. A letter that goes straight from the placeholder header to "Dear Hiring Manager," with no employer name anywhere is a FAILED output.

Return the cover letter only; no commentary, no title, no labels.`

  try {
    // Stage 82 — moved from Haiku to Sonnet for this call specifically.
    // Found live, self-testing this exact rewrite against a real seeded
    // test profile: even with an explicit, strengthened instruction
    // against mischaracterising what a role actually involved (rule 8),
    // Haiku still described a real internal technical/operations role
    // (per that profile's own stored career_history achievements) as
    // customer-facing "translating product capability into customer
    // language" work it never did. Confirmed against the real
    // career_history row, not assumed. Re-tested on Sonnet across two
    // different roles/companies and the fabrication did not recur: a
    // specific real detail the letter used (a named prior client) checked
    // out as genuinely present, word-for-word, in the source CV rather
    // than invented, and on a second JD that would have made the false
    // framing tempting, the model instead wrote an honest "I haven't run
    // this specific kind of programme, and I want to be upfront about
    // that rather than stretch the point" -- a gap acknowledged rather
    // than papered over. See PROGRESS.md Stage 82/83 for the full detail
    // (kept out of this comment deliberately -- no real person's specific
    // employer or client names belong in committed source, even in a
    // comment; see the Stage 83 sweep). Accuracy in a document sent to a
    // real hiring manager is worth the extra cost here; still gated by
    // the same per-user cover_letter allowance cap either way, so this is
    // a bounded, deliberate cost increase, not an unbounded one.
    // max_tokens raised from Haiku's 800: found live, self-testing this
    // exact change, that 800 (and then 1200) truncated a real Sonnet
    // letter mid-sentence. Diagnosed directly rather than guessed again:
    // claude-sonnet-5 is generating a real, non-trivial amount of extended
    // thinking on this prompt by default (measured live: up to ~280+
    // thinking tokens on a run of the real system prompt), and thinking
    // tokens count against the same max_tokens budget as the visible
    // letter -- so the visible text was being cut off before the thinking
    // it needed to stay grounded had even finished. Left thinking ON
    // deliberately rather than disabling it: it is plausibly PART of why
    // Sonnet stayed closer to the real career_history in testing (room to
    // reason about what a role's achievements actually support before
    // committing to a sentence) rather than a cost to eliminate. 2500
    // gives real headroom for thinking + a full ~350-word letter without
    // being open-ended -- still bounded by the existing cover_letter
    // allowance cap regardless of token count per call.
    const msg = await client.messages.create({
      model: MODELS.sonnet,
      max_tokens: 2500,
      system: [{ type: 'text', text: SYSTEM_CACHED, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    })
    // content[0] is not always the text block — see Stage 45 note in cv/generate.
    const text = (msg.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim() || ''
    if (msg.usage) {
      after(() => trackAiUsage({ userId: user.id, model: MODELS.sonnet, action: 'cover_letter', usage: msg.usage }))
    }
    // Deterministic verification, not self-report — same philosophy as
    // lib/cv-lint.js and referral/draft's own lintMessage call: a prompt
    // instruction is a request, not a guarantee, so every letter is
    // actually checked against the corporate-jargon/AI-tell list rather
    // than trusted on the model's word. Flag, never block: a lint miss
    // must never fail the letter itself, the letter is still the primary
    // deliverable.
    const lint = lintMessage(text)
    if (!lint.ok) console.error('[cover-letter] lint flagged issues:', lint.issues.join('; '))

    // Deterministic company-name check — rule 1's specific, named failure
    // ("a real recent failure mixed up two product names") is exactly the
    // kind of thing a prompt instruction alone cannot be trusted to
    // prevent, so check directly: the given company name must actually
    // appear in the letter. This cannot catch a subtler swap (e.g. a real
    // product name confused with a different real one) but it does catch
    // the outright case — the name omitted or replaced with something
    // else entirely. Logged, not blocking, same flag-never-block pattern.
    const companyNameFound = !company || text.toLowerCase().includes(company.toLowerCase())
    if (!companyNameFound) console.error(`[cover-letter] company name "${company}" not found anywhere in the generated letter`)

    return NextResponse.json({ type: 'cover_letter', text, lint, companyNameFound })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Generation failed' }, { status: 500 })
  }
}
