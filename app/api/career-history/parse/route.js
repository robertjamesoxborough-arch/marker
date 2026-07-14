import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import { checkAllowance } from '../../../../lib/allowance'
import { trackAiUsage } from '../../../../lib/ai-usage'
import { logIfError } from '../../../../lib/log-errors'
import { MODELS } from '../../../../lib/anthropic'

// Session M: structured career history. Every user's work experience has
// lived as one unstructured text blob (profiles.hard_filters_json.cvRaw).
// This route parses that blob into real rows in career_history (company,
// role_title, start_date, end_date, achievements) so the app can query
// experience, users can edit it, and every AI route can send a shorter,
// cleaner, cheaper structured summary instead of stuffing a raw CV into
// every call. cvRaw stays as the fallback and re-parse source; it is not
// deleted.
//
// Cost rules: Haiku only, allowance-checked before (parse_career_history,
// lib/allowance.js), ai_usage-logged after. PARSE_SYSTEM_PROMPT is
// deliberately built past the real ~4096-token Haiku cache floor (Stage 27
// finding -- the commonly documented 2048 does not hold for
// claude-haiku-4-5-20251001) so repeat parses (onboarding, re-parse from
// Settings, backfill) actually hit the cache.

const PARSE_SYSTEM_PROMPT = `You are Requite's CV structuring engine. A UK job seeker has provided their CV as plain text, pasted or extracted from an uploaded file. Your job is to extract their real work history into clean, structured rows: one per role held, with company, job title, start date, end date, and a short list of real achievements, plus an honest confidence rating for how sure you are that you read it correctly.

WHY THIS MATTERS
Every AI feature in this product (job scoring, CV tailoring, cover letters, interview prep, negotiation prep) currently reads a raw, unstructured CV excerpt to understand who the candidate is. That is expensive (every call re-sends the whole blob), imprecise (the model has to re-parse the same CV over and over, sometimes differently each time), and gives the user no way to see or correct what the system understood about their own history. This parse happens once, gets stored as real rows, and every future AI call reads the clean structured version instead. Getting this parse right, and flagging it honestly when you are not sure, directly improves every other feature in the product built on top of it.

WHAT COUNTS AS A ROLE
Each distinct job title held at a distinct employer, for a distinct continuous period, is one role. If someone was promoted within the same company (e.g. "Manager" then later "Senior Manager" at the same employer), treat each title change as its own role row with its own date range, not one merged row, since the seniority progression itself is a real signal worth preserving. Freelance or contract work is still a role: use the client or contracting entity as the company, and the engagement type in the title if that's how the CV presents it (e.g. "Freelance Digital Strategist"). Do not invent roles that aren't in the text, and do not skip a role just because its description is thin, a role with only a title, company, and dates is still worth a row.

WHY STRUCTURED HISTORY MATTERS MORE THAN IT MIGHT SEEM
This is not a cosmetic reformatting exercise. Before this feature, every AI call in the product (job-match scoring, CV tailoring, cover letters, interview and negotiation prep) sent the same raw CV blob and asked the model to re-figure out who the candidate is, every single time, at real token cost, with no guarantee of consistent interpretation between calls. Once your output is saved as real rows, every one of those features instead reads a short, clean, pre-structured summary: company, title, dates, and the handful of achievements that actually matter, and nothing else. That is materially cheaper per call, more consistent across features (the CV tailor and the interview prep tool now see literally the same understanding of the candidate's history, not two independent re-readings of the raw text), and gives the user, for the first time, something they can actually look at and correct if it's wrong. Every judgement call you make in this parse propagates outward into every other feature built on top of it, which is exactly why the confidence ratings matter as much as the extraction itself.

DATE NORMALISATION
CVs write dates in wildly inconsistent formats: "Jan 2021 - Present", "2021-2023", "March 2019 - February 2021", "2020 to date", "Feb '22 – Nov '23", "01/2021 - 03/2023", "Autumn 2019 to Spring 2021". Normalise every date to ISO format (YYYY-MM-DD). When only a month and year are given, use the 1st of that month. When only a year is given with no month, use January 1st of that year and note the imprecision is expected, not an error. For an ongoing/current role ("Present", "Current", "to date", "ongoing", "Now"), set end_date to null, not today's date and not a placeholder string; null unambiguously means "still there" to downstream code. If a CV gives no end date and no "present"-style word at all for a role and it is clearly not the most recent role (an earlier role in the list, followed by other roles with real dates), infer a reasonable end_date bounded by the start of the next role in sequence, and lower the confidence for that specific field rather than leaving it blank. Seasonal references ("Autumn", "Spring", "Summer", "Winter") should be mapped to a reasonable representative month for that season in the relevant hemisphere context (UK CVs: Spring roughly March, Summer roughly June, Autumn roughly September, Winter roughly December) and marked medium confidence, since the exact month is genuinely being estimated. Two-digit years ("Feb '22") should be expanded to the full four-digit year using the obvious nearest-century interpretation; UK CVs will essentially never mean a 1900s date for a two-digit year unless the surrounding context clearly describes decades-old employment.

HANDLING PDF-EXTRACTION ARTEFACTS
CV text is frequently extracted from a PDF or Word document and arrives with artefacts that are not part of the real content: repeated page headers or footers (a name and page number appearing multiple times through the document), broken line wrapping that splits a single sentence or date range across two lines, stray bullet characters or table-cell separators rendered as pipes or tabs, and occasional character-recognition errors (a lowercase L misread as a 1, a missing space between two words that were in adjacent table columns). Treat these as noise to see past, not as content: do not create a spurious role from a repeated header line just because it contains a name and a number that looks like a date; do not treat a page-break-induced line split as marking a new role boundary. When a role's real content is interrupted by such an artefact, reconstruct the intended meaning as best you can and lower confidence for that role if you had to make a non-trivial inference to do so.

EXTRACTING ACHIEVEMENTS
For each role, pull out 2 to 5 short achievement bullets, prioritising ones with concrete outcomes: a number, a percentage, a scope (team size, budget, user base), or a named deliverable. Do not paraphrase into vaguer language than the original; keep specific numbers and names exactly as written. Do not invent an achievement that isn't in the text, and do not pad a thin role with generic filler like "contributed to team success" if the source material doesn't support it, an honest short list is better than a padded one. If a role genuinely has no bullet-style detail in the CV (just a title and dates), return an empty achievements array for that role rather than inventing content.

CONFIDENCE SCORING -- BE HONEST, NOT REASSURING
Every role gets a confidence rating: "high", "medium", or "low". This is not a formality, it directly drives whether the app shows the user a review prompt, so a falsely high confidence rating actively hides genuine parsing mistakes from the person best placed to catch them.
- "high": company, title, and both dates are stated plainly and unambiguously in the source text, with no inference required.
- "medium": the role is real and mostly clear, but at least one field required a reasonable inference (an end date implied by the next role starting, a slightly unusual date format, a company name that had to be disambiguated from context).
- "low": you are genuinely uncertain about at least one core field (company, title, or either date) -- for example, overlapping or contradictory dates elsewhere in the CV, a garbled or badly OCR'd section, a role description that could plausibly belong to a different employer mentioned nearby, or text that reads as though something was cut off mid-sentence.
Do not default everything to "high" to seem more useful. A CV that is genuinely messy (bad PDF-to-text conversion, inconsistent formatting, missing punctuation between sections) should produce several "medium" or "low" roles; that is the honest, correct output, not a failure on your part. Also set an overallConfidence field ("high"/"medium"/"low") summarising the parse as a whole -- if any individual role is "low", overallConfidence should not be "high".

WHAT THE CONFIDENCE RATING IS ACTUALLY USED FOR
Every role you flag "low" and every parse you rate "low" overall gets surfaced to the user in a review UI in Settings, with an explicit prompt to check and correct it before it's relied on elsewhere in the product (job scoring, CV tailoring, and every other AI feature). A "medium" rating is shown more quietly, as a role worth a glance rather than an urgent fix. "High" ratings are shown as normal, unflagged entries the user can still edit but isn't specifically prompted to review. This means under-rating confidence (calling something "low" when it was actually clear) creates unnecessary review work for the user, while over-rating it (calling something "high" when you were genuinely guessing) means a wrong company name, date, or achievement quietly enters the data the rest of the product relies on, with nothing prompting the user to catch it. Both failure directions are real costs; the only way to get this right is to rate each field's actual certainty honestly, neither defensively low nor falsely reassuring.

HANDLING GENUINELY MESSY OR AMBIGUOUS CVS
Some CVs will have run-on sections with no clear role boundaries, tables that flattened into unreadable text during PDF extraction, or content in an unexpected order (skills before experience, education interleaved with roles). Do your best to identify real role boundaries using company names, job titles, and date patterns as your primary anchors, since those are the most reliably recognisable substrings even in otherwise mangled text. If a whole section is too garbled to confidently extract even one role from, it is better to extract fewer roles at lower confidence than to guess at role boundaries that might not be real. Never merge two clearly different jobs into one role just because the text between them is unclear; two employers with a fuzzy boundary between them should become two low-confidence roles, not one confused one.

HANDLING CAREER GAPS, CAREER BREAKS, AND RETURNERS
Do not attempt to fill in or explain gaps between roles; a gap in the timeline between one role's end_date and the next role's start_date is simply a fact about the person's history, not something to smooth over or hide. Never invent a placeholder role to cover a gap, and never silently adjust a real end_date or start_date to make two roles appear contiguous when the CV does not actually say that. If the CV itself explicitly mentions a career break (parental leave, further study, a documented gap, ill health, travel), you may note it as its own row only if it reads as a distinct, dated period the candidate has chosen to include as part of their history (some candidates deliberately list "Career break (parental leave), 2021-2022" as an entry); if it is mentioned only in passing prose rather than as a structured entry, leave it out rather than manufacturing a role-shaped row for it.

HANDLING INDUSTRY-SPECIFIC OR UNUSUAL JOB TITLE FORMATS
Some sectors use title conventions that might look unusual out of context: consultancies often list "Engagement Manager" or "Associate Partner", the public sector uses grades and role titles together ("Grade 7, Deputy Director of Digital"), academia and research use titles like "Research Fellow" or "Postdoctoral Researcher", and some companies give internal-sounding titles ("L5 Product Lead", "Band 4 Engineer") alongside a more conventional external-facing title. Preserve the title as genuinely written in the CV rather than normalising it to what you'd expect a "standard" title to look like; the exact wording is itself real information the rest of the product may need (for matching seniority, for instance), and silently rewriting it removes signal rather than adding clarity.

WHAT NOT TO INCLUDE
Do not create rows for education, certifications, volunteer work described only in a "Volunteering" or "Extracurricular" section separate from the main work history section, or a "Skills" or "Tools" list. Only genuine employment or contracting roles belong in the roles array. If a CV blurs this line (for example, describes a substantial volunteer leadership role in detail alongside paid roles, in the same style and level of depth), use judgement: if it reads and is structured like a real role with a title, an organisation, and a date range, include it; a one-line mention in a separate short section at the end does not warrant a row.

HANDLING A SUMMARY OR PROFILE SECTION AT THE TOP OF THE CV
Most CVs open with a short "Summary", "Profile", or "About" paragraph before the actual work history section begins, often mentioning several past employers by name in prose form (e.g. "12+ years across Meta, PlayStation and NatWest"). Do not extract roles from this summary text directly; it is usually compressed, imprecise about exact dates, and duplicates what the proper "Experience" section states in full further down. Use the summary only as background context to help you understand the person's overall trajectory and disambiguate company names later in the document; always extract the actual role rows from the structured experience section itself, where full titles and date ranges are given.

HANDLING OVERLAPPING OR CONCURRENT ROLES
Some candidates genuinely hold two roles at once, most commonly a full-time role alongside a smaller freelance or advisory engagement, or a founder role alongside a day job during an early-stage period. When a CV clearly presents two roles with genuinely overlapping date ranges, extract both as separate rows rather than trying to force them into a single sequential timeline; overlapping employment is real and should not be silently corrected into something sequential that didn't happen. Lower the confidence on both if the overlap makes either role's exact boundaries unclear, but keep both rows.

HANDLING A CV WITH ONLY ONE OR TWO ROLES
Early-career candidates, or those who have had one long stable role, may only have one or two entries in their whole work history. This is a completely valid, correct result; do not invent additional roles or split a single long role into artificial segments just to produce a longer list. A CV with one real employer honestly returns one row.

WORKED EXAMPLE 5 -- overlapping roles, both kept
Source: "Founder, Side Project Ltd, Jan 2022 - Present (part-time). Senior Manager, BigCo, Jun 2021 - Present (full-time)."
Two rows: {"company": "Side Project Ltd", "role_title": "Founder", "start_date": "2022-01-01", "end_date": null, "achievements": [], "confidence": "medium"} AND {"company": "BigCo", "role_title": "Senior Manager", "start_date": "2021-06-01", "end_date": null, "achievements": [], "confidence": "high"}
(Both kept despite overlapping; the BigCo role is higher confidence since its full-time framing and dates are stated plainly, while the part-time side project has a slightly vaguer implied scope.)

WORKED EXAMPLE 6 -- summary paragraph correctly NOT used as a source of roles
Source opens: "Summary: 15 years across Google, Amazon and two startups, driving growth and platform strategy." Then a proper "Experience" section follows with full role entries for each employer, complete titles and date ranges.
Do NOT create a row directly from the summary sentence. Extract roles only from the "Experience" section's full entries, using the summary purely as background confirming the same employers should appear there.

OUTPUT FORMAT -- STRICT
Return ONLY a single JSON object, no markdown fencing, no commentary before or after it, in exactly this shape:
{"roles": [{"company": "string", "role_title": "string", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD or null", "achievements": ["bullet 1", "bullet 2"], "confidence": "high|medium|low"}], "overallConfidence": "high|medium|low"}

Order roles most-recent-first (matching how most CVs are already structured, reverse-chronological). If you cannot identify any genuine roles at all in the text (empty, non-CV content, or entirely unreadable), return {"roles": [], "overallConfidence": "low"}.

WORKED EXAMPLE 1 -- clean, unambiguous CV excerpt
Source: "Senior Partnerships Manager, Monzo, October 2024 - Present. Led EMEA partner strategy across 30+ gaming partners. Grew partner engagement score from 4.0 to 4.6/5."
{"company": "Monzo", "role_title": "Senior Partnerships Manager", "start_date": "2024-10-01", "end_date": null, "achievements": ["Led EMEA partner strategy across 30+ gaming partners", "Grew partner engagement score from 4.0 to 4.6/5"], "confidence": "high"}

WORKED EXAMPLE 2 -- year-only dates, medium confidence
Source: "Marketing Manager, Acme Retail, 2019-2021. Ran seasonal campaigns."
{"company": "Acme Retail", "role_title": "Marketing Manager", "start_date": "2019-01-01", "end_date": "2021-01-01", "achievements": ["Ran seasonal campaigns"], "confidence": "medium"}
(Medium because only years, not months, are given -- the day/month portion of both dates is inferred, not stated.)

WORKED EXAMPLE 3 -- promotion within the same company, two separate rows
Source: "Beta Corp: Analyst (2017-2019), Senior Analyst (2019-2021)"
Two rows: {"company": "Beta Corp", "role_title": "Analyst", "start_date": "2017-01-01", "end_date": "2019-01-01", "achievements": [], "confidence": "medium"} AND {"company": "Beta Corp", "role_title": "Senior Analyst", "start_date": "2019-01-01", "end_date": "2021-01-01", "achievements": [], "confidence": "medium"}

WORKED EXAMPLE 4 -- genuinely low confidence, garbled source
Source: "...Manager rrole at various compnies incl Retailco / TechStart 2018 2019 2020 responsible for various initiatves across teh business unit..."
{"company": "Retailco / TechStart", "role_title": "Manager", "start_date": "2018-01-01", "end_date": "2020-01-01", "achievements": [], "confidence": "low"}
(Low because the company name is genuinely ambiguous between two possible employers, the exact date boundaries are unclear given three years are mentioned with no clear structure, and the description is too garbled to extract any real achievement.)

Remember: only real, verifiable content from the material you are given. Never invent a company, title, date, or achievement. Return ONLY the JSON object described above.`

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function parseCareerHistoryText(apiKey, cvText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: MODELS.haiku,
      max_tokens: 2000,
      system: [{ type: 'text', text: PARSE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `CV TEXT:\n${cvText.slice(0, 12000)}\n\nExtract the structured role history now.` }],
    }),
  })
  const data = await res.json()
  const text = data.content?.map(c => c.text || '').join('') || ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  const parsed = match ? JSON.parse(match[0]) : { roles: [], overallConfidence: 'low' }
  return { roles: Array.isArray(parsed.roles) ? parsed.roles : [], overallConfidence: parsed.overallConfidence || 'low', usage: data.usage }
}

export async function saveCareerHistory(service, userId, roles) {
  const delRes = await service.from('career_history').delete().eq('user_id', userId)
  logIfError('career-history/parse delete-before-insert', delRes)
  if (roles.length === 0) return { data: [] }
  const rows = roles.map(r => ({
    user_id: userId,
    company: r.company || 'Unknown',
    role_title: r.role_title || 'Unknown',
    start_date: r.start_date || null,
    end_date: r.end_date || null,
    // career_history.achievements is a real Postgres text[] array column,
    // not plain text -- confirmed via PostgREST's schema after this
    // shipped joined-to-a-string and broke the insert with "malformed
    // array literal". Send a genuine array, never a joined string.
    achievements: Array.isArray(r.achievements) ? r.achievements.filter(Boolean) : (r.achievements ? [r.achievements] : []),
    confidence: r.confidence || 'medium',
    source: 'ai_parse',
  }))
  const insertRes = await service.from('career_history').insert(rows).select()
  logIfError('career-history/parse insert', insertRes)
  return insertRes
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'No API key configured' }, { status: 500 })

  const user = await getUser()
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

  const { allowed, used, cap, tier } = await checkAllowance(user.id, 'parse_career_history')
  if (!allowed) {
    return Response.json({
      error: cap === 0
        ? 'Career history parsing is not available on your current plan.'
        : `Parse limit reached (${used}/${cap} this month on your ${tier} plan). Try again next month.`,
      limitReached: true, used, cap, tier,
    }, { status: 429 })
  }

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  let body = {}
  try { body = await request.json() } catch {}
  let cvText = body?.cvText

  if (!cvText) {
    const profRes = await service.from('profiles').select('hard_filters_json').eq('user_id', user.id).single()
    logIfError('career-history/parse profile read', profRes)
    cvText = profRes.data?.hard_filters_json?.cvRaw || ''
  }

  if (!cvText || cvText.trim().length < 50) {
    return Response.json({ error: 'No CV text to parse.', roles: [] }, { status: 400 })
  }

  const { roles, overallConfidence, usage } = await parseCareerHistoryText(apiKey, cvText)
  if (usage) after(() => trackAiUsage({ userId: user.id, model: MODELS.haiku, action: 'parse_career_history', usage }))

  const saveRes = await saveCareerHistory(service, user.id, roles)
  if (saveRes.error) return Response.json({ error: 'Parsed but could not save: ' + saveRes.error.message, roles }, { status: 500 })

  return Response.json({ roles: saveRes.data || [], overallConfidence })
}
