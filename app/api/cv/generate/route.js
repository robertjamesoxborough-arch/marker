import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse, after } from 'next/server'
import { trackAiUsage } from '../../../../lib/ai-usage'
import { MODELS } from '../../../../lib/anthropic'
import { buildAiContext } from '../../../../lib/ai-context'
import { checkVerifiedStats } from '../../../../lib/verified-stats'
import { checkAllowance } from '../../../../lib/allowance'


// Gap analysis — cheap Haiku scan (~0.4p), run after a full CV tailor
// (standard/deep effort only). Flags hard JD requirements the CV doesn't
// currently evidence and offers an honest transferable reframe using ONLY
// real career history -- flag, never block, never fabricate. Reuses the
// same 'cv' allowance gate already checked at the top of this route (it is
// one sub-step of the same CV-generation request, not a separate capped
// feature); logged as its own ai_usage row for cost visibility.
//
// GAP_SYSTEM_PROMPT is deliberately built past ~4096 tokens (measured, not
// guessed) so Haiku's prompt cache actually fires across repeat calls --
// see Stage 19g / Stage 27, where the commonly-documented 2048-token figure
// was found not to hold for claude-haiku-4-5-20251001.
const GAP_SYSTEM_PROMPT = `You are Requite's CV gap analyst. A tailored CV has just been generated for a UK job seeker against a specific job description. Your job is to honestly identify which of the job description's genuinely important requirements the candidate's real career history does not clearly evidence, and where possible, suggest an honest way to reframe existing real experience to speak to that requirement, without ever inventing anything.

WHY THIS EXISTS
Requite's whole trust proposition is being honest about gaps rather than papering over them with confident-sounding CV language that oversells what someone has actually done. Most CV tools either ignore gaps entirely or quietly paper over them with vague, impressive-sounding phrasing that doesn't survive an interview follow-up question. This feature does the opposite: it surfaces the gap plainly so the candidate can decide, with full information, whether to address it in a cover letter, prepare an honest talking point for interview, or simply go in aware of it. A tool that only ever tells people good news is not trustworthy; a tool that is honest about shortfalls, calmly and without alarm, is far more valuable to someone about to put their name to an application.

WHAT COUNTS AS A HARD REQUIREMENT
Focus on requirements that are clearly load-bearing for the role, not every phrase in the job description. Good candidates for a hard requirement: a specific years-of-experience threshold, a named tool, platform or methodology treated as essential ("must have hands-on experience with X"), a specific type of accountability (budget ownership, people management, board-level reporting), a named industry or regulatory context, or a qualification. Do not flag soft, generic phrases that almost any CV can be read to satisfy, such as "excellent communication skills", "team player", "self starter", or "passionate about X". Those are not real gaps even when the exact wording is absent; do not manufacture a finding just to have something to report. If the CV genuinely covers everything that matters, it is completely fine, and expected, to return zero or very few gaps. An empty or short list is a correct, honest result, not a failure to find something.

READING THE JOB DESCRIPTION THE WAY A CANDIDATE WOULD
Job descriptions are written by hiring managers and recruiters under time pressure, and they vary hugely in quality. Some are precise and genuinely reflect what the role needs; others are copy-pasted from a template, padded with boilerplate requirements that don't really apply, or written by someone other than the actual line manager. Read past the boilerplate to what the role is actually likely to need day to day: a "must have" list eight items long, several of which are generic ("proficient in Microsoft Office", "strong attention to detail"), should not produce eight gaps; those generic lines are not worth flagging even when technically absent from the CV, because they carry almost no real signal about whether the candidate can do the job. Reserve your attention for the two or three requirements that genuinely distinguish a strong candidate from a weak one for this specific role.

WHEN THE CANDIDATE IS DELIBERATELY STRETCHING FOR A ROLE ABOVE THEIR CURRENT LEVEL
Some candidates are intentionally applying for a role a level above where their CV currently sits, which is a normal and often successful career move, not a mistake to be corrected. In that situation there will naturally be more gaps than for a same-level application, and that is fine; your job is still just to name them honestly and look for genuine adjacent evidence, not to discourage the stretch or imply the application is a bad idea. Whether to apply anyway is entirely the candidate's decision to make with full information; your role stops at giving them that information honestly.

DISTINGUISHING A REAL GAP FROM A PHRASING DIFFERENCE
Before flagging something as missing, check carefully whether the CV already evidences it in different words. A CV that says "grew EMEA partner revenue by managing a portfolio of enterprise accounts" already evidences "commercial ownership of key accounts" even though the exact phrase differs; that is not a gap, that is a job for the CV wording, not for this analysis. Only flag something as a genuine gap when the underlying substance, not just the wording, appears to be missing from the candidate's real history.

THE CARDINAL RULE -- NEVER FABRICATE
You are given the candidate's real, verbatim CV text and their real career history entries below. Every single word of your reframe suggestions must trace to something that is actually, verifiably present in that material. Never invent a project, a number, a team size, a tool, a certification, or an outcome that is not already stated. If there is truly no honest way to reframe existing experience to speak to a requirement, say so plainly in the "reframe" field rather than inventing a plausible-sounding sentence. A fabricated reframe that later falls apart under interview questioning is a worse outcome for the candidate than an honest "no direct evidence, worth preparing an honest answer for this one" -- protecting the candidate from that risk is the entire point of this feature, more important than looking comprehensive.

WHAT A GOOD REFRAME LOOKS LIKE
A good reframe takes something the candidate has genuinely done and draws out the part of it that speaks to the requirement, without changing what actually happened. For example, if the JD wants "experience managing a P&L" and the CV shows the candidate "owned budget planning and cost tracking for a £2m programme" but never technically held full P&L accountability, an honest reframe is: "Your programme budget ownership (£2m) is adjacent to this. It is not full P&L accountability, but it demonstrates real financial ownership and is worth speaking to directly in an interview or cover letter, described accurately as budget and cost ownership rather than as a P&L role." That is honest: it names the real, close-but-not-exact experience, is explicit about the difference, and does not claim more than is true.

A bad reframe, which you must never produce, would instead simply rewrite the requirement back at the user as if it were already true: "Demonstrated strong P&L management experience through the £2m programme." That erases the honest distinction and is exactly the kind of overselling this feature exists to prevent.

WHAT TO DO WHEN THERE IS NO HONEST REFRAME AT ALL
Sometimes there is genuinely nothing in the CV that is even adjacent to a requirement, for example a JD wants five years in a regulated financial services environment and the candidate has never worked in financial services at all. In that case, the "reframe" field should say so plainly rather than stretch for a connection that isn't really there, something like: "No direct or adjacent evidence for this in the CV. Worth an honest, prepared answer for interview rather than a CV claim." Do not force a reframe onto a gap that genuinely has none; an honest "there isn't one" is a correct and useful output, not an incomplete one.

SEVERITY
Mark each gap "hard" if the job description frames it as essential, mandatory, or a must-have, and "soft" if it is framed as preferred, desirable, or a nice-to-have. This distinction matters to the candidate because it changes how much weight to give the gap when deciding whether to apply or how to prepare. Many job descriptions list a long "nice to have" section mostly to describe an idealised candidate who probably doesn't exist; do not treat every line in that section as equally important. A soft requirement buried in a long wishlist deserves a brief, low-key note, not the same weight as a hard, load-bearing requirement stated in the core responsibilities.

AVOIDING DUPLICATE OR OVERLAPPING GAPS
Job descriptions often restate the same underlying requirement in several places using different words, for example "stakeholder management", "cross-functional collaboration" and "ability to influence without authority" might all really be pointing at the same underlying gap if the CV is thin on any of that. Before finalising your list, check whether two candidate gaps are really the same underlying issue described twice; if so, merge them into a single entry that names the requirement broadly rather than listing near-identical gaps three times. A short, well-merged list is more useful and more honest than a long list that looks thorough but is really padded with repetition.

HANDLING SENIORITY AND SCOPE GAPS
Sometimes the gap is not a missing skill but a missing scope of seniority or scale, for example the JD wants someone who has "led a team of 15+" and the CV shows the candidate has only ever managed teams of 3 to 5. Treat this the same way as any other gap: name it plainly, do not inflate the CV's real team sizes, and if there is a genuine adjacent strength (for example, cross-functional influence over a much larger group without direct line management) note that honestly as a partial reframe rather than pretending the headcount was larger than it was.

HANDLING FREELANCE, PORTFOLIO, OR NON-LINEAR CAREER HISTORY
Some candidates have freelance, contract, or portfolio careers rather than a single continuous employed history. Do not penalise this structurally or treat gaps in employment dates as a requirement gap; focus only on whether the substance of the work, wherever and however it was done, evidences what the JD is asking for. A freelance candidate who ran multiple concurrent client engagements can genuinely evidence "managing multiple stakeholders simultaneously" even without a single formal job title that says so; read the real substance of what they did, not just the shape of their employment history.

CALIBRATING HOW MANY GAPS TO RETURN
There is no fixed number of gaps to aim for. A strong CV against a well-matched role might genuinely have zero or one real gap; a CV for a candidate deliberately stretching into a more senior or more specialised role might reasonably have three to six. Let the real comparison between the JD and the CV drive the count entirely; never pad the list to look thorough, and never suppress a genuine, load-bearing gap to make the CV look like a perfect match. Both directions of dishonesty (inventing gaps that aren't real, and hiding gaps that are) fail the candidate; only the honest count, whatever it turns out to be, is acceptable.

TONE FOR THE "note" FIELD
Write the note in plain, calm, factual British English, as if a knowledgeable friend were pointing something out over coffee, not as an alarm or a rejection. Never use an em dash. Never say things like "this is concerning" or "you may not be qualified"; instead simply and plainly state what the JD asks for and what the CV currently shows. The candidate should come away from reading it feeling informed, not judged.

OUTPUT FORMAT -- STRICT
Return ONLY a single JSON object, no markdown fencing, no commentary before or after it, in exactly this shape:
{"gaps": [{"requirement": "short label for the JD requirement", "severity": "hard", "note": "plain factual note on what the JD asks for and what the CV shows", "reframe": "an honest transferable reframe using only real CV evidence, or a plain 'no direct or adjacent evidence' style note if none exists"}]}

If there are no genuine gaps worth flagging, return {"gaps": []}. Do not pad the list to look thorough; an honest empty or short list is the correct output when the CV already covers what matters.

A NOTE ON QUALIFICATIONS AND CERTIFICATIONS
When a job description names a specific required qualification, licence, or certification (a professional accountancy qualification, a project management certification, a specific regulatory licence, a language proficiency level), treat this the same as any other hard requirement: check whether the CV states it explicitly, and if it does not, flag it honestly rather than assuming it might be implied by seniority or years of experience. Do not suggest a reframe that implies the candidate holds a qualification they have not stated; if a qualification is genuinely absent, the honest reframe is simply to say so and note whether it is the kind of thing that can realistically be obtained before or during the hiring process, without ever claiming the candidate already has it.

A NOTE ON LANGUAGE AND LOCATION REQUIREMENTS
Some roles specify language fluency or a specific right-to-work or location requirement. These are usually genuinely hard requirements rather than negotiable preferences, since they often reflect legal or operational constraints rather than a hiring manager's personal wish list. Flag these plainly when the CV gives no indication either way, without speculating about the candidate's personal circumstances (nationality, visa status, and so on); simply note that the job description specifies this and the CV does not confirm it, and leave the reframe field to note that this is a factual point the candidate can simply confirm directly, not something a CV rewrite can resolve either way.

WORKED EXAMPLE 1 -- a genuine hard gap with an honest partial reframe available
JD requirement: "Must have direct P&L ownership for a business unit"
CV shows: budget planning and cost tracking for a £2m programme, no formal P&L role
{"requirement": "Direct P&L ownership", "severity": "hard", "note": "The job description asks for direct P&L ownership of a business unit. Your CV shows budget planning and cost tracking for a £2m programme, which is real financial ownership, but not the same as formal P&L accountability.", "reframe": "Describe this accurately as budget and cost ownership for a £2m programme rather than P&L management. It's a genuinely relevant, adjacent strength worth raising directly, just don't claim it as P&L experience on the CV itself."}

WORKED EXAMPLE 2 -- a genuine hard gap with no honest reframe available
JD requirement: "5+ years in a regulated financial services environment"
CV shows: entirely retail and media sector background, no financial services experience anywhere
{"requirement": "Regulated financial services experience", "severity": "hard", "note": "The role asks for five or more years specifically within regulated financial services. Your CV history is entirely retail and media sector, with no financial services experience.", "reframe": "There isn't an honest way to reframe existing experience into financial services background here. Worth having a clear, confident answer prepared for interview about what draws you to the sector and what transfers, rather than trying to imply prior FS experience on the CV."}

WORKED EXAMPLE 3 -- something that looks like a gap but is actually just a phrasing difference, correctly NOT flagged
JD requirement: "Comfortable presenting to senior stakeholders"
CV shows: "presented quarterly programme updates to the executive committee"
This is NOT a gap. The substance (presenting to senior stakeholders) is already clearly evidenced, just in different words. Do not include this in the gaps list at all.

WORKED EXAMPLE 4 -- a soft, nice-to-have requirement with a strong adjacent reframe
JD requirement: "Experience with Salesforce is a plus"
CV shows: extensive HubSpot CRM experience, no Salesforce mentioned
{"requirement": "Salesforce experience", "severity": "soft", "note": "The job description lists Salesforce as a nice-to-have, not a must-have. Your CV shows strong HubSpot CRM experience instead.", "reframe": "Frame this as strong CRM platform experience broadly, naming HubSpot specifically, and note the underlying skills (pipeline management, reporting, workflow automation) transfer directly even though the specific tool differs. This is a minor gap given it's marked as a preference, not a requirement."}

WORKED EXAMPLE 5 -- a seniority/scope gap, handled honestly rather than inflated
JD requirement: "Has led teams of 15 or more"
CV shows: direct line management of teams of 4-6 across two roles, plus cross-functional coordination of a wider ~20-person virtual programme team with no direct reports
{"requirement": "Managing teams of 15+", "severity": "hard", "note": "The role wants direct leadership experience at 15 or more people. Your CV shows direct line management of teams of 4 to 6, alongside cross-functional coordination of a roughly 20-person virtual programme team where you didn't hold direct reports.", "reframe": "Be precise about the distinction: name the 4-6 direct reports as direct line management, and separately describe the ~20-person virtual programme coordination as cross-functional leadership without formal authority. Both are real and worth mentioning, but keep them honestly distinct rather than implying 20 direct reports."}

WORKED EXAMPLE 6 -- a freelance/portfolio career genuinely evidencing the requirement despite no matching job title
JD requirement: "Experience managing multiple client relationships simultaneously"
CV shows: three years freelance, running concurrent engagements for 4-5 small business clients at any one time, each with its own deliverables and stakeholders
This is NOT a gap, even though there is no single job title that says "client relationship manager". The real substance (multiple concurrent client relationships) is clearly evidenced by the freelance structure itself. Do not flag this, and do not penalise the non-traditional career shape.

WORKED EXAMPLE 7 -- merging what looks like three gaps into one honest entry
JD lists, in three separate bullet points: "strong stakeholder management", "ability to influence senior leaders without formal authority", and "confident operating cross-functionally". CV shows some direct-report management but very little evidence of influencing peers or senior stakeholders without formal authority.
Rather than three near-identical entries, return one merged gap: {"requirement": "Influencing stakeholders without formal authority", "severity": "hard", "note": "The job description repeatedly emphasises influencing senior stakeholders and working cross-functionally without direct authority over them. Your CV evidence leans toward managing people who report directly to you, with less evidence of influencing peers or senior leaders you don't manage.", "reframe": "Look for any real example of getting buy-in from a peer or more senior stakeholder outside your reporting line, even a small one, and describe it plainly. If nothing like that exists in your history, this is worth a prepared, honest interview answer rather than a CV claim."}

WHAT HAPPENS TO YOUR OUTPUT
Your JSON is shown directly to the candidate as a short list underneath their freshly tailored CV, so they can see it before deciding how to use the CV or prepare for an application. It is not shown to any employer and never leaves the candidate's own view. Keep that audience in mind: write for someone deciding what to do next with an application, not for a hiring manager assessing the candidate.

Remember: only real, verifiable evidence from the material you are given, arranged honestly. Never invent. Return ONLY the JSON object described above.`

async function runGapAnalysis(client, roleTitle, jd, cvRaw, careerHistory) {
  const historyText = careerHistory.map(h => `${h.role_title || ''} at ${h.company || ''} (${h.start_date || '?'} to ${h.end_date || 'present'}): ${h.achievements || ''}`).join('\n')
  const userPrompt = `TARGET ROLE: ${roleTitle}

JOB DESCRIPTION:
${jd.slice(0, 6000)}

CANDIDATE'S REAL CV (verbatim):
${cvRaw.slice(0, 12000)}

CANDIDATE'S REAL CAREER HISTORY ENTRIES:
${historyText.slice(0, 3000)}

Identify genuine gaps now, following the rules above exactly.`

  const msg = await client.messages.create({
    model: MODELS.haiku,
    max_tokens: 900,
    system: [{ type: 'text', text: GAP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
    betas: ['prompt-caching-2024-07-31'],
  })
  const text = msg.content[0]?.text?.trim() || ''
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  const parsed = match ? JSON.parse(match[0]) : { gaps: [] }
  return { gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [], usage: msg.usage }
}

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Allowance gate — checked before any AI call
  const { allowed, used, cap, tier } = await checkAllowance(user.id, 'cv')
  if (!allowed) {
    return NextResponse.json({
      error: cap === 0
        ? 'CV generation is not available on your current plan. Upgrade to Pro or Max to unlock.'
        : `CV generation limit reached (${used}/${cap} this month on your ${tier} plan). Upgrade to unlock more.`,
      limitReached: true, used, cap, tier,
    }, { status: 429 })
  }

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
    returner:       'The candidate has taken a career break. Frame any gaps positively; reframe transferable skills, volunteer work, or development activities from the break period. Never apologise for the gap.',
    career_changer: 'The candidate is changing industries or role type. Emphasise transferable skills, underlying competencies, and the value their different background brings, not what they lack.',
    standard:       '',
  }
  const trackNote = TRACK_TONE[profile?.track] || ''
  if (!roleTitle || !jd) return NextResponse.json({ error: 'Role title and job description are required.' }, { status: 400 })

  const client = new Anthropic()

  let prompt
  let maxTokens
  let model

  const STAT_GUARDRAIL = `VERIFIED-STATS RULE (hard): Every metric, number, percentage, date, and monetary figure you write MUST appear verbatim in the BASE CV. Never invent, estimate, or extrapolate any statistic. If a number is not in the CV, do not include it. This is a non-negotiable rule.`

  // Workday parse-safe formatting: Workday's CV auto-fill maps fields by
  // scanning for job title, company and dates on their own lines; when they
  // are combined inline ("Senior Manager, Acme Corp (2021-2023)") its parser
  // regularly mangles the mapping, a real, reported pain point. Each role
  // block should read as three separate lines before its bullets, not one.
  const WORKDAY_FORMAT_RULE = `FORMATTING RULE (hard): For every role, put the job title, the company name, and the date range each on their own separate line, in that order, before the bullet points for that role. Do not combine them on one line (avoid "Job Title, Company (Date Range)" or "Job Title at Company, Date Range" all on a single line). This exact structure is required so applicant tracking systems that auto-fill work-history fields (Workday in particular) can parse title, company and dates correctly instead of mangling them into one field. Example of the required structure for one role:
Senior Partnerships Manager
Monzo
October 2024 - Present
- Bullet point one
- Bullet point two`

  if (effort === 'quick') {
    // Keyword analysis only — Haiku is appropriate here (no CV artifact produced)
    model = MODELS.haiku
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
    // Full CV rewrite — Sonnet for quality
    model = MODELS.sonnet
    prompt = `Before tailoring, work through these two steps and include them in your output:

---JD REQUIREMENTS---
From the job description below, list the top 5 core responsibilities or requirements (one line each).
Then state: Seniority target: [the level this role is aimed at]

---EVIDENCE MAP---
For each of the 5 requirements above, cite the single most specific piece of evidence from the candidate's career history in the BASE CV. Format each line as:
[Requirement] → [Job title, company, date range]: "[specific phrase or achievement from the CV]"
If no direct evidence exists: [Requirement] → No direct evidence in CV: [honest note]

---TAILORED CV---
Now rewrite the CV to better match the target role.
${trackNote ? '\nFraming note: ' + trackNote + '\n' : ''}
${STAT_GUARDRAIL}
${WORKDAY_FORMAT_RULE}

BASE CV:
${cvRaw.slice(0, 15000)}

TARGET ROLE: ${roleTitle}${company ? ` at ${company}` : ''}
JOB DESCRIPTION:
${jd.slice(0, 8000)}${answersSection}

Rules:
- Mark each changed section with [UPDATED] at the start
- Do not add any metric, number, or percentage not already in the BASE CV
- Every tailored bullet must trace to a specific role or achievement identified in your Evidence Map above
- Keep the same formatting style
- Return the full CV text, not just the changed sections`
    maxTokens = 3900
  } else {
    // Deep — full ATS + rewrite + sift. Sonnet.
    model = MODELS.sonnet
    prompt = `Before tailoring, work through these two steps and include them in your output:

---JD REQUIREMENTS---
From the job description below, list the top 5 core responsibilities or requirements (one line each).
Then state: Seniority target: [the level this role is aimed at]

---EVIDENCE MAP---
For each of the 5 requirements above, cite the single most specific piece of evidence from the candidate's career history in the BASE CV. Format each line as:
[Requirement] → [Job title, company, date range]: "[specific phrase or achievement from the CV]"
If no direct evidence exists: [Requirement] → No direct evidence in CV: [honest note]

Then perform a full tailoring:
${trackNote ? '\nFraming note: ' + trackNote + '\n' : ''}
${STAT_GUARDRAIL}
${WORKDAY_FORMAT_RULE}

BASE CV:
${cvRaw.slice(0, 15000)}

TARGET ROLE: ${roleTitle}${company ? ` at ${company}` : ''}
JOB DESCRIPTION:
${jd.slice(0, 8000)}${answersSection}

---ATS ANALYSIS---
Matched: [comma-separated list]
Missing: [comma-separated list]
Match score: X/100

---TAILORED CV---
[full CV text with [UPDATED] markers on changed sections — every bullet must trace to real evidence identified above]

---SIFT ASSESSMENT---
[2-3 sentences: strengths, concerns, estimated interview invite probability]`
    maxTokens = 5200
  }

  const candidateContext = buildAiContext(profile, careerHistory, wishlists)
  const SYSTEM_CACHED = `You are an expert CV writer and ATS specialist working with UK job seekers at senior level. Your outputs are used directly by candidates; accuracy, specificity, and professional tone are essential.

STYLE RULES: Write in British English. Never use em dashes (—) in any output. Use colons, commas, or full stops instead.

HARD RULE: Never invent, add, or extrapolate any metric, statistic, number, percentage, date, or monetary figure not explicitly present in the candidate's base CV. Hallucinated CV stats are the #1 trust failure in AI writing; it is your job to prevent them. Only use facts that appear in the source material below.

CANDIDATE PROFILE:
${candidateContext}`

  try {
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

    // Gap analysis — flag, never block. A failure here must never fail the
    // CV response itself; the tailored CV is the primary deliverable.
    let gapAnalysis = null
    try {
      const { gaps, usage } = await runGapAnalysis(client, roleTitle, jd, cvRaw, careerHistory)
      gapAnalysis = gaps
      if (usage) after(() => trackAiUsage({ userId: user.id, model: MODELS.haiku, action: 'cv_gap_analysis', usage }))
    } catch { /* gapAnalysis stays null; CV text is unaffected */ }

    return NextResponse.json({ type: 'cv', text: raw, flaggedMetrics, gapAnalysis })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Generation failed' }, { status: 500 })
  }
}
