/**
 * lib/scoring.js — Requite unified scoring model.
 * SINGLE SOURCE OF TRUTH for how ANY job is scored anywhere in Requite.
 *
 * Multi-tenant: NOTHING here is hardcoded to a candidate. Every profile
 * string is built at request time from the signed-in user's profiles +
 * career_history rows. Rebuilt fresh for Requite's Supabase architecture.
 *
 * Two tiers share ONE rubric (verbatim in every prompt):
 *   QUICK — feed scans, title/company/location only, Haiku.
 *   FULL  — /api/analyse against the real JD, 8 factors, Sonnet.
 *
 * The FULL overall is computed in code from factors x WEIGHTS
 * (computeOverall). The model never sets its own overall.
 *
 * CJS so it can be tested with `node lib/scoring.test.js`.
 */

// ── Factor weights (8 factors, must sum to 1.0) ────────────────────────────
// Keys match the factor keys returned by /api/analyse and the UI FACTOR_LABELS.
const WEIGHTS = {
  roleSkillsMatch:   0.30, // Skills
  seniorityFit:      0.15, // Seniority
  officeFlexibility: 0.15, // Office flexibility
  industryFit:       0.10, // Industry
  salaryMarket:      0.10, // Salary
  careerGrowth:      0.10, // Growth
  companyCulture:    0.05, // Culture
  paternityLeave:    0.05, // Parental leave
}

// Human-readable label per factor (kept in step with the app UI).
const FACTOR_LABELS = {
  roleSkillsMatch:   'Skills',
  seniorityFit:      'Seniority',
  officeFlexibility: 'Office flexibility',
  industryFit:       'Industry',
  salaryMarket:      'Salary',
  careerGrowth:      'Growth',
  companyCulture:    'Culture',
  paternityLeave:    'Parental leave',
}

// Which model each tier runs on. Maps to keys in lib/anthropic MODELS.
const TIER_MODEL = {
  quick: 'haiku',
  full:  'sonnet',
}

// The neutral score used whenever a factor cannot be judged.
const NEUTRAL = 6

// ── Calibration anchors ────────────────────────────────────────────────────
// Plain-English definitions embedded verbatim in every scoring prompt so the
// quick scan and the full analysis mean the same thing by a given number.
const CALIBRATION = `CALIBRATION ANCHORS (apply these exactly):
- 9.0 = Exceptional fit. Skills, seniority and working pattern all line up with almost nothing to compromise on. A role worth dropping other applications for.
- 8.4 = Strong fit. Clearly worth applying. Minor gaps only (one factor slightly off), none of them dealbreakers.
- 7.0 = Solid, worth a look. Genuinely relevant but with a real trade-off: a stretch on seniority, an extra office day, or a salary at the edge of range.
- 5.0 = Borderline. Some overlap but a material mismatch on skills, level, location or pay. Apply only if options are thin.`

// ── Missing-information rule ────────────────────────────────────────────────
const MISSING_INFO_RULE = `MISSING INFORMATION: Any factor you cannot judge from the information provided scores a neutral ${NEUTRAL}. Never guess generously and never invent detail to fill a gap. A factor you are unsure about is a ${NEUTRAL}, not a high score.`

// ── Scoring scale ──────────────────────────────────────────────────────────
const SCALE_RULE = `SCALE: Whole numbers 1 to 7. For 8 and above use increments of 0.2 only (8.0, 8.2, 8.4 ... 9.8, 10.0). Score each factor 0 to 10 on this scale.`

// ── Weight table (shown to the model for context) ──────────────────────────
const WEIGHT_TABLE = `FACTOR WEIGHTS (the overall is a weighted average of these; it is computed by Requite, not by you):
- Skills 30%
- Seniority 15%
- Office flexibility 15%
- Industry 10%
- Salary 10%
- Growth 10%
- Culture 5%
- Parental leave 5%`

// ── Per-factor criteria ────────────────────────────────────────────────────
// What each score means for each of the 8 factors. Without this the model has
// weights but no definition of a 9 versus a 5 on any individual factor, which
// is where most inconsistency between two scans of the same role came from.
const FACTOR_CRITERIA = `FACTOR CRITERIA (judge every factor independently, then stop; the overall is computed by Requite):

SKILLS (30%). The heaviest factor. Judge on evidenced work, never on job titles.
- 9.0+: the candidate has done this exact job, or one whose day to day work overlaps almost entirely. Core responsibilities map onto evidenced experience, not adjacent experience.
- 8.0 to 8.8: most core responsibilities are directly evidenced. One named requirement is adjacent rather than direct, and a hiring manager would still shortlist on the strength of the rest.
- 7: genuinely relevant with a real gap. The candidate could do the work but would be learning one significant part of it on the job.
- 5: partial overlap only. Some transferable skill, but the centre of the role is something the profile does not evidence.
- 3 or below: a different discipline. Shared vocabulary is not shared skill. Score here whenever the only overlap is generic words such as strategy, digital, technical, commercial or transformation.
Two roles with the same title at different companies are often different jobs. Read the responsibilities, not the header.

SENIORITY (15%). Compare scope and decision rights, not the words in the title.
- 9.0+: the same level of ownership the candidate already holds, or one clear step up with the scope spelled out.
- 8.0 to 8.8: a half step in either direction. A slightly broader remit, or a slightly narrower one at a materially better employer.
- 7: one full level away. A stretch upwards the candidate could argue for, or a step down that is still defensible.
- 5: two levels away in either direction. An upward stretch that needs a leap of faith, or a step down that would read as a retreat.
- 3 or below: three or more levels away. Score here for graduate and entry level listings against an experienced profile, regardless of how the title reads.
Title inflation is common. Head of at a ten person company is usually an individual contributor role. Manager at a large corporate is often a genuine people leadership job. Judge the described scope: budget, headcount, and who signs off.

OFFICE FLEXIBILITY (15%). Score the stated working pattern against the candidate profile.
- 10: fully remote with no attendance expectation stated anywhere in the listing.
- 8.0 to 9.0: remote first with occasional travel, or a hybrid pattern at or below the candidate's stated maximum office days.
- 7: one day per week more than the candidate's stated maximum.
- 5: two days more than the stated maximum.
- 3 or below: three or more days over, or full time on site when the profile asks for flexibility.
Treat marketing language sceptically. Remote first, flexible working and hybrid by default mean nothing on their own. If a specific number of office days appears anywhere in the listing, that number wins over any adjective. If no pattern is stated at all, this is a missing information case, not an optimistic one.

INDUSTRY (10%). Sector relevance, judged on how transferable the work actually is.
- 9.0+: the same sector the candidate has worked in, or one where the buying behaviour, regulation and product model are near identical.
- 8.0 to 8.8: a closely adjacent sector where most of the domain knowledge carries across.
- 7: a different sector with a recognisable structural similarity, for example one regulated consumer business to another.
- 5: unrelated sector, but the function itself travels well.
- 3 or below: a sector that usually requires domain credentials the profile does not evidence, such as clinical, legal or actuarial work.
Sector fit matters less than skills fit. Do not let an exciting industry pull up a weak skills score, and do not punish a strong skills match for an unfamiliar sector.

SALARY (10%). Score the advertised figure against the candidate's stated floor.
- 9.0+: advertised range sits clearly above the floor, or the midpoint is comfortably above it.
- 8.0 to 8.8: range starts at or just above the floor.
- 7: range straddles the floor, so the offer would depend on where in the band the candidate lands.
- 5: range tops out at or just below the floor.
- 3 or below: advertised well below the floor.
If no salary appears, score the neutral and say so. Competitive, market rate, depending on experience and attractive package are not salary information. For day rates, convert at roughly 220 working days a year before comparing, and say that you have done so. Where a listing shows a wide band, for example a spread of more than 40% between bottom and top, treat the bottom as the realistic figure unless the listing ties the top to something the profile evidences.

GROWTH (10%). Where the role leads, judged from the listing rather than from the company's reputation.
- 9.0+: the listing names a progression path, a scope that will expand, or a remit that builds something new.
- 8.0 to 8.8: a role at a company or in a function where the next step is obvious even if unstated.
- 7: a solid role with no stated trajectory either way.
- 5: a maintenance role, or backfill for a position described in purely operational terms.
- 3 or below: a shrinking remit, an explicitly interim scope with no continuation, or a role that would narrow the candidate's experience.

CULTURE (5%). Only score what you can evidence.
- 9.0+: strong, specific and verifiable signals, for example a named and current best employer award, or published policy detail that goes beyond the legal minimum.
- 8.0 to 8.8: consistently positive public reputation on working conditions.
- 7 or the neutral: nothing reliable either way. This is the correct answer most of the time.
- 5: mixed signals, or listing language that points at long hours such as fast paced, wear many hats, hit the ground running or thrive under pressure.
- 3 or below: well documented and current problems with how the employer treats staff.
Never infer culture from a logo, a funding round or a sector. An unfamiliar employer is a neutral, not a low score.

PARENTAL LEAVE (5%). Score only on stated policy.
- 10: 26 weeks or more at full pay, stated explicitly.
- 8.0 to 9.0: meaningfully enhanced above statutory, stated explicitly.
- 7: some enhancement mentioned without figures.
- The neutral: no policy mentioned. Set found to false. This is the correct answer for most listings.
- 3 or below: statutory minimum stated explicitly, where the profile has asked for better.
Never assume a large employer has good policy and never assume a small one does not. Absence of a statement is absence of information.`

// ── Worked examples ────────────────────────────────────────────────────────
// Concrete scoring decisions. These exist because abstract criteria alone
// produced inconsistent factor scores on borderline listings.
const WORKED_EXAMPLES = `WORKED EXAMPLES (how to apply the criteria; the shapes matter, not the specific roles):

Example 1, a strong match scored honestly.
Listing: Senior Partnerships Manager, established fintech, hybrid 2 days, band stated as 85k to 100k, mentions enhanced parental leave.
Profile: partnerships experience at scale, floor 90k, maximum 2 office days, parental leave flagged as important.
Scoring: Skills 9.0 because the responsibilities are the work already evidenced. Seniority 8.4 because it is the same level with a slightly wider remit. Office flexibility 9.0 because 2 days meets the stated maximum exactly. Industry 8.4 for a sector already worked in. Salary 8.0 because the band starts below the floor but the midpoint clears it. Growth 7 because no path is stated. Culture the neutral, nothing verifiable. Parental leave 8.0, enhancement stated without figures.
The lesson: a strong role still collects sevens and neutrals. Do not round everything up because the headline fit is good.

Example 2, the trap of a familiar title.
Listing: Technical Sales Executive, quota carrying, five days on site.
Profile: technical delivery and programme work, no sales quota experience, maximum 2 office days.
Scoring: Skills 2. The only shared word is technical, which is a generic modifier and not evidence of overlap. Seniority 5. Office flexibility 1, three days over the stated maximum. Salary the neutral if the listing shows only commission potential.
The lesson: shared vocabulary is not shared skill. This exact failure previously produced an eight because word overlap was counted rather than actual work.

Example 3, remote washing.
Listing: opens with remote first culture, then states three days per week in the office under working pattern.
Scoring: office flexibility is scored on three days, not on the adjective. If the profile's maximum is 2, this is a 5.
The lesson: a stated number always beats a stated mood.

Example 4, an agency repost with no employer named.
Listing: recruitment agency posting, client described only as a leading brand, no salary, no location detail beyond the city.
Scoring: Culture the neutral because there is no employer to assess. Salary the neutral. Industry the neutral unless the described work makes the sector unambiguous. Score skills and seniority normally from the responsibilities, which are usually still concrete.
The lesson: an anonymous listing produces several neutrals. That is correct behaviour and not a reason to guess.

Example 5, a genuine stretch.
Listing: Director of Partnerships, scope covers a region the candidate has worked in, one clear level above current.
Scoring: Seniority 7, a real stretch that is arguable rather than fanciful. Skills scored on the overlap of the described responsibilities, which may still be 8 or above.
The lesson: a stretch belongs in the seniority score. Do not also mark down skills for the same fact, or the role is punished twice for one gap.`

// ── Edge cases ─────────────────────────────────────────────────────────────
// Real listing problems seen repeatedly in scraped and aggregated feeds.
const EDGE_CASES = `EDGE CASES (handle these explicitly rather than guessing):

Contract, interim and fixed term. If the listing is a contract or fixed term role, score it on the work and the rate, and note the basis in the reason. Do not mark a contract down for being a contract unless the profile asks for permanent work. Convert day rates before comparing to a salary floor.

Bundled and duplicate listings. Aggregators sometimes place several roles in one posting, or repost the same role under different titles. Score the role named in the title. If the body describes several distinct jobs, say so in the reason and score the one that best matches the title.

Truncated descriptions. Feed listings are often cut off after a few hundred characters. Score what is present and take the neutral on everything else. A short description is a reason for more neutrals, never a reason for a low score.

Ambiguous or invented titles. Ninja, rockstar, guru, wizard and similar carry no seniority information. Score seniority from the described scope alone. If the scope is not described either, take the neutral.

Location ambiguity. A city name alone does not tell you the working pattern. Treat it as missing information for office flexibility unless attendance is stated. Where a listing names a country the candidate profile does not cover, that belongs in the reason, and it is a hard mismatch rather than a low factor score.

Currency and units. Where pay is stated in a currency other than the profile's, say so and take the neutral rather than converting at a rate you cannot verify. Do not confuse an annual figure with a day rate: a four or five figure number next to per day, daily or outside IR35 is a day rate.

Seniority stated twice and inconsistently. Where a title and the body disagree, for example Junior in the title and eight years required in the body, the body wins and the disagreement goes in the reason.

Stale listings. Do not comment on whether a role is still open, filled or accepting applications. You cannot know this. Score the fit and nothing else.

Internal jargon. Grade, band, level and job family codes are meaningless without the employer's own framework. Ignore them and score the described scope.`

// ── Common scoring errors ──────────────────────────────────────────────────
const ANTI_PATTERNS = `COMMON ERRORS TO AVOID:
- Double counting one gap across several factors. A seniority stretch is a seniority score, not also a skills penalty and a growth penalty.
- Rounding a whole profile up because one factor is excellent. Skills at 9.0 does not make culture anything other than what the evidence says.
- Treating an unknown as a negative. Unknown is the neutral, every time.
- Treating a famous employer as a high culture score, or an unfamiliar one as a low score.
- Scoring the company instead of the role. A strong employer with a poorly matched job is a poorly matched job.
- Writing a reason that restates the title. The reason should name the single thing that decided the score.
- Using the full 1 to 10 range for small differences. Most real listings for a well matched profile land between 5 and 8.4.`

// ── Signal decision ────────────────────────────────────────────────────────
// The schema asks for apply / maybe / dont_apply but nothing previously defined
// the thresholds, so the same listing could come back with different signals.
const SIGNAL_RULE = `SIGNAL DECISION (apply, maybe or dont_apply):

Return dont_apply when any of the following is true, regardless of how strong the rest looks:
- A hard filter in the profile is breached. Hard filters are absolute and they override every factor score.
- Skills scores 3 or below. A different discipline is not worth an application.
- Seniority is three or more levels away in either direction.
- The role requires a credential the profile does not evidence and which cannot be acquired in the hiring window, for example a practising certificate, a specific clearance, or a regulated qualification.

Return apply when all of the following hold:
- Skills is 8.0 or above.
- No hard filter is breached.
- Neither seniority nor office flexibility is below 7.
- Nothing in the listing contradicts the profile's stated non negotiables.

Return maybe for everything else. Maybe is the honest default for a real listing, and a scan that returns mostly maybe is usually working correctly. Do not spread signals artificially to look decisive.

The signal is a judgement about whether to spend an application on this role. It is not a restatement of the overall number, and it is not a prediction of whether the candidate would get the job.`

// ── Output quality ─────────────────────────────────────────────────────────
const REASON_QUALITY = `WRITING THE REASON AND THE NOTES:

The reason is one sentence that names the single thing that decided the score. Someone reading only that sentence should understand why this role ranked where it did.

Do this:
- Name the deciding factor and the evidence. For example: five days on site against a stated maximum of two.
- Be specific about numbers where the listing gives them.
- Say plainly when the deciding factor is an absence. For example: no salary stated, so pay is unscored.

Do not do this:
- Restating the job title or the company name and nothing more.
- Generic praise such as strong match or great opportunity, which carries no information.
- Hedging every clause until the sentence says nothing.
- Commenting on whether the role is still open, filled, closed or accepting applications. You cannot know this from the text.
- Naming the candidate's employers back at them. The reader knows their own history.

Factor notes follow the same rule at smaller scale: one clause of evidence, not a paraphrase of the factor name. A note that says good industry fit is worthless. A note that says same regulated consumer sector, different product line is useful.

Where a factor is the neutral because information is missing, the note should say what was missing, not invent a reason for the score.`

// ── Further worked examples ────────────────────────────────────────────────
const MORE_EXAMPLES = `FURTHER WORKED EXAMPLES:

Example 6, a hard filter beats a strong score.
Listing: excellent skills overlap, one level up, well known employer, but five days on site.
Profile: stated maximum of two office days as a hard filter.
Scoring: score the factors honestly, so skills may still be 9.0 and seniority 8.4. Office flexibility is 1. The signal is dont_apply because a hard filter is breached.
The lesson: hard filters change the signal, not the factor scores. Do not suppress a true skills score to justify the signal, and do not soften the signal because the other factors are good.

Example 7, a role with no salary and no employer.
Listing: agency post, responsibilities described in detail, no pay, client unnamed, hybrid two days.
Scoring: skills and seniority scored normally from the detailed responsibilities. Salary the neutral, culture the neutral, industry the neutral unless the work names the sector. Office flexibility scored on the stated two days. Signal maybe.
The lesson: detail in one part of a listing does not license guessing in another.

Example 8, a step down that is still worth it.
Listing: one level below current scope, at an employer with a materially better working pattern and stated enhanced parental leave.
Scoring: seniority 7, because a defensible step down is not a failure. Office flexibility and parental leave score on what is stated. Growth 5 if the remit is described as maintenance.
The lesson: a step down is a seniority score and a growth score. It is not a skills penalty.

Example 9, the contract conversion.
Listing: day rate quoted as 500 per day, outside IR35, six month initial term.
Profile: salary floor of 90,000.
Scoring: 500 multiplied by roughly 220 working days is about 110,000 before the usual contracting caveats, so salary scores above the floor. Say in the reason that the figure is a day rate converted at 220 days.
The lesson: convert before comparing, and show your working in the reason so the number can be challenged.

Example 10, an adjacent sector with strong function fit.
Listing: the same function the candidate performs, in a sector they have never worked in, no regulatory barrier.
Scoring: skills scored on the function overlap, which may be 8.4 or higher. Industry 5. Overall still lands well because skills carries 30% and industry only 10%.
The lesson: the weights already handle sector distance. Do not additionally punish skills for an unfamiliar sector, or the sector is counted twice.`

// ── THE RUBRIC ─────────────────────────────────────────────────────────────
// This exact string is embedded, unmodified, in the quick and the full prompt.
// If a scorer's prompt does not contain this verbatim, it is not a Requite score.
const RUBRIC = `${SCALE_RULE}

${WEIGHT_TABLE}

${CALIBRATION}

${MISSING_INFO_RULE}

${FACTOR_CRITERIA}

${WORKED_EXAMPLES}

${EDGE_CASES}

${ANTI_PATTERNS}

${SIGNAL_RULE}

${REASON_QUALITY}

${MORE_EXAMPLES}`

// ── Candidate profile builder ──────────────────────────────────────────────
// Builds a plain-English profile string from the user's own Supabase rows.
// No hardcoded names, no hardcoded history. Safe on partial profiles.
const BENEFIT_LABELS = {
  enhanced_parental_leave: 'enhanced parental leave',
  term_time:               'term-time working',
  four_day_week:           '4-day week',
  fully_remote:            'fully remote',
  hybrid:                  'hybrid working',
  share_options:           'share options',
  private_health:          'private health insurance',
}

const SENIORITY_LABELS = {
  senior_manager: 'Senior Manager', head_of: 'Head of',
  director: 'Director', vp: 'VP', c_suite: 'C-Suite',
}

function buildCandidateProfile(profile, careerHistory) {
  if (!profile) return 'No candidate profile on file. Score conservatively on the information available.'

  const hfj = profile.hard_filters_json || {}
  const parts = []

  const roles = (profile.target_roles || []).join(', ')
  if (roles) parts.push(`Target roles: ${roles}.`)

  // Seniority can live in either a single string or a seniorities[] array.
  const seniorities = (profile.seniorities || [])
    .map(s => SENIORITY_LABELS[s] || s).filter(Boolean)
  if (profile.seniority) parts.push(`Seniority: ${profile.seniority}.`)
  else if (seniorities.length) parts.push(`Seniority: ${seniorities.join(' or ')}.`)

  const industries = (profile.industries || []).join(', ')
  if (industries) parts.push(`Industries: ${industries}.`)
  else if (hfj.field) parts.push(`Field/sector: ${Array.isArray(hfj.field) ? hfj.field.join(', ') : hfj.field}.`)

  if (profile.max_office_days != null) parts.push(`Max office days per week: ${profile.max_office_days}.`)
  if (profile.postcode) parts.push(`Based near: ${profile.postcode}.`)
  if (profile.salary_floor) parts.push(`Salary floor: £${Math.round(profile.salary_floor / 1000)}k.`)
  if (hfj.yearsExperience) parts.push(`${hfj.yearsExperience} years experience.`)

  const keywords = (hfj.cvKeywords || []).join(', ')
  if (keywords) parts.push(`Key skills: ${keywords}.`)

  const benefits = (hfj.benefits || []).map(b => BENEFIT_LABELS[b] || b).filter(Boolean)
  if (benefits.length) parts.push(`Preferred benefits: ${benefits.join(', ')}.`)

  const tracks = profile.tracks || (profile.track ? [profile.track] : [])
  if (tracks.length) parts.push(`Career track: ${tracks.join(', ')}.`)

  // Up to 3 most-recent roles from career_history (newest first).
  if (Array.isArray(careerHistory) && careerHistory.length > 0) {
    const recent = careerHistory.slice(0, 3).map(h => {
      const from = h.start_date ? String(h.start_date).slice(0, 7) : '?'
      const to   = h.end_date   ? String(h.end_date).slice(0, 7)   : 'present'
      return `${h.role_title} at ${h.company} (${from}–${to})`
    })
    parts.push(`Recent experience: ${recent.join('; ')}.`)
  }

  return parts.join(' ') || 'Sparse candidate profile. Score conservatively on the information available.'
}

// ── Deterministic overall ──────────────────────────────────────────────────
function factorScore(v) {
  const n = typeof v === 'object' && v !== null ? v.score : v
  const num = Number(n)
  return Number.isFinite(num) ? Math.max(0, Math.min(10, num)) : null
}

// Round a raw weighted average onto the Requite scale.
function roundToScale(x) {
  const c = Math.max(0, Math.min(10, x))
  if (c >= 8) return Math.round(c * 5) / 5 // nearest 0.2 in the 8+ band
  return Math.round(c)                     // whole numbers below 8
}

/**
 * Compute the FULL overall in code from the 8 factor scores.
 * Missing / unparseable factors fall back to the neutral score.
 * @returns {{ raw:number, score:number, usedNeutralFor:string[] }}
 */
function computeOverall(factors) {
  const f = factors || {}
  let raw = 0
  const usedNeutralFor = []
  for (const key of Object.keys(WEIGHTS)) {
    let s = factorScore(f[key])
    if (s === null) { s = NEUTRAL; usedNeutralFor.push(key) }
    raw += s * WEIGHTS[key]
  }
  raw = Math.round(raw * 100) / 100
  return { raw, score: roundToScale(raw), usedNeutralFor }
}

// ── Prompt builders (both embed RUBRIC verbatim) ───────────────────────────

// FULL scorer system prompt (Sonnet / Haiku for /api/analyse).
// hardFilters is the caller's pre-built hard-filter block (may be empty).
function buildFullSystem(candidateProfile, hardFilters, jsonSchema, styleRules) {
  return `You are a senior job matching assistant. Analyse the job description against the candidate profile below and return structured JSON scores.

CANDIDATE:
${candidateProfile}

${RUBRIC}${hardFilters ? '\n\nHARD FILTERS (apply before scoring):\n' + hardFilters : ''}

${jsonSchema}

${styleRules || ''}`.trim()
}

module.exports = {
  WEIGHTS,
  FACTOR_LABELS,
  TIER_MODEL,
  NEUTRAL,
  CALIBRATION,
  MISSING_INFO_RULE,
  SCALE_RULE,
  WEIGHT_TABLE,
  FACTOR_CRITERIA,
  WORKED_EXAMPLES,
  EDGE_CASES,
  ANTI_PATTERNS,
  SIGNAL_RULE,
  REASON_QUALITY,
  MORE_EXAMPLES,
  RUBRIC,
  buildCandidateProfile,
  computeOverall,
  roundToScale,
  buildFullSystem,
}
