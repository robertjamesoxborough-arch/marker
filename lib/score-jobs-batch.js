/**
 * lib/score-jobs-batch.js — shared batch scorer for jobs_cache rows.
 * ONE Haiku call per batch, candidate-AGNOSTIC baseline score (cost rule 2).
 * Used by both the nightly score-cache cron and the Pro "Fresh scan" live
 * path, so a job is scored once by the same rubric and never re-scored
 * per user. cache_control on the prefix so repeat calls read it cheaply
 * (cost rule 4).
 */
import { MODELS } from './anthropic'
import { RUBRIC } from './scoring'
import { STYLE_RULES } from './brand'

// Deliberately detailed (not padding for its own sake): Anthropic will not
// cache a system block below its per-model minimum cacheable length (2048
// tokens for Haiku-tier models) — a shorter prefix here silently disables
// caching entirely, with no error, which is exactly what was happening
// before this block was expanded (confirmed 2026-07-13: cacheReadTokens was
// 0 on every one of 6 real score-cache runs across 795 rows). The extra
// guidance below is genuine scoring detail, not filler, and pushes this
// static, always-identical prefix comfortably past the threshold.
const SYSTEM_PREFIX = `You are scoring UK job listings for generic role quality, a baseline shared across all users. Score each role 1-10 on how strong a mid-to-senior professional opportunity it is: genuine seniority, a legitimate employer and clear scope. This is candidate-agnostic; do not assume any specific person. Give junior roles, pure sales-quota roles, aggregator spam and non-UK roles a low score.

BASELINE SCORING GUIDANCE (candidate-agnostic — you are judging the role itself, not fit to any individual):
- A senior, well-scoped role at a recognisable employer with a clear title and a plausible salary band is a strong baseline candidate, independent of who might apply.
- Recruitment-agency-posted listings are not automatically penalised, but vague or duplicated agency spam (near-identical titles reposted across many unnamed "clients", template descriptions with no real detail) should score low.
- A title alone does not establish seniority. "Manager" at a large, credible employer in a genuinely senior function can outrank "Senior X" at an ambiguous or clearly junior-scoped listing. Weigh the whole listing, not just the headline title.
- Treat "competitive salary", "DOE", or no salary listed as neutral information, not as a red flag or a bonus. Never infer a number that is not stated.
- Multi-location or "various UK locations" listings are acceptable if the role itself is senior and well-defined. Do not penalise for location breadth alone.
- Reject outright, regardless of an impressive-sounding title: pure commission/quota-only sales roles with no base salary detail, generic listicle-style aggregator reposts, apprenticeship/graduate/internship schemes, and any listing where the actual duties described are clearly junior (data entry, basic admin, entry-level support).
- Interim, contract and fixed-term roles are scored on the same scale as permanent roles: a genuinely senior interim or FTC position is not penalised for its contract status, and a junior-scoped contract role is not boosted by sounding temporary or urgent.
- Ignore superlative marketing language in the listing itself ("exciting", "fast-paced", "rockstar", "ninja") entirely when judging seniority or legitimacy; score the substance of the role (title, employer, described scope, salary if given), not the tone of the copywriting.
- Where a listing names a well-known employer directly (rather than "our client" or an agency), that alone is a mild positive signal of legitimacy, but it does not override a clearly junior title or scope.

SECTOR CALIBRATION (title conventions vary a lot by sector; read the whole listing against the norms of its own sector, not a single universal ladder):
- Technology / SaaS: titles inflate quickly. "Manager" can mean genuinely senior individual leadership; "Head of" at a small startup may cover a function of one or two people. Weigh company size and funding signals (if mentioned) alongside the title.
- Financial services / banking: title ladders are typically formal and stable. "Vice President" is often a genuine mid-senior grade, not executive; "Manager" usually denotes real people-management responsibility. Salary bands, where stated, are a strong seniority signal here.
- Retail / hospitality: "Manager" very often means store-level or shift-level operational management, not strategic seniority, regardless of an impressive-sounding division name. Read the scope described, not just the word "Manager".
- Public sector / NHS / local government: seniority is usually grade-linked (Director, Deputy Director, Head of Service, Senior Manager) rather than inflated startup-style titles. Salaries are frequently absent or given as a pay-scale range rather than a single figure; treat this as neutral, not a red flag.
- Manufacturing / logistics / engineering: "Engineer" and "Manager" titles map to established, fairly conservative seniority ladders. A "Senior Engineer" or "Operations Manager" at a recognised industrial employer is a solid baseline candidate even without a salary figure stated.
- Recruitment-agency-posted roles (any sector): judge the underlying role described, not the agency posting it. A specific, well-described senior role posted by a named agency for a named or clearly implied real employer is fine; a template description with no real detail beyond generic buzzwords is not.
- Media, marketing and creative agencies: title inflation is common here too ("Director" can appear at relatively junior levels in smaller agencies); weigh agency size and the described scope of the role rather than the title in isolation, similarly to the technology sector guidance above.
- Healthcare / NHS-adjacent private sector: clinical grades (Consultant, Registrar, Band 5-9) follow a separate, well-established ladder from commercial/management titles; a "Band 8a" or "Band 8b" service manager role is genuinely senior even when the banding, not a title word, is the seniority signal.
- Education / higher education: "Head of Department", "Head of School" and "Director of Studies" are genuine senior academic-management roles; treat them the same as equivalent commercial titles rather than downweighting because the sector is education.
- Professional services / legal / consulting: "Associate", "Senior Associate" and "Partner" form a well-known, conservative ladder; an "Associate" here is typically more senior than an "Associate" job title would suggest in retail or hospitality. Judge the title within its own sector's ladder, not a single cross-sector scale.
- Energy / utilities: often has long-tenured, formally graded roles similar to manufacturing; "Engineer" and "Manager" titles are usually a reliable, conservative seniority signal even without a stated salary.
- Charity / non-profit: senior titles ("Head of Fundraising", "Director of Programmes") are genuine even when salary is markedly lower than an equivalent commercial role; do not penalise seniority scoring for a lower-than-commercial salary figure in this sector, since that is a sector norm, not a signal of a lesser role.
- Startups versus large enterprises within the same sector: a title at a very small, early-stage company (fewer than roughly 20-30 people, where mentioned or inferable) should be read more cautiously than the identical title at an established, larger employer, consistent with the technology-sector title-inflation note above.

EDGE CASES AND AMBIGUOUS LISTINGS:
- A listing bundling multiple similar roles ("Project Manager x3" or "several Project Manager positions available") is scored on the role itself, exactly as a single posting would be; the plural framing is not a positive or negative signal on its own.
- Titles with "or similar" qualifiers ("Head of Growth or similar") should be scored on the primary named title; do not let the qualifier lower or raise the score.
- A non-UK-registered or non-UK-headquartered company advertising a genuine UK-based role is scored normally; only reject where the role itself requires relocation outside the UK or is not actually UK-based despite appearing in UK search results.
- Franchise-operated retail or hospitality locations are scored the same as corporate-owned locations of the same brand; franchise status alone is not a downgrade.
- Part-time or job-share arrangements do not reduce the seniority score; a genuinely senior part-time or job-share role is scored on its seniority and scope, not its hours.
- Where a listing gives conflicting signals (a senior-sounding title alongside duties that are clearly junior, or vice versa), weigh the described duties and scope more heavily than the title text, since duties are harder to inflate convincingly than a title.

WORKED EXAMPLES (how the calibration anchors below apply in practice, spanning multiple sectors):
- "Head of Product" at a recognisable scale-up, London, salary stated around £110k: 9.0. Clear senior title, named credible employer, salary confirms seniority, well-scoped in one line.
- "Senior Manager, Commercial Strategy" at a large corporate, salary band stated, hybrid working: 8.4. Strong and safely senior; only minor ambiguity on exact day-to-day scope.
- "Vice President, Risk" at a recognised bank, salary not stated: 8.2. In banking, VP is a genuine senior grade even without a figure; the sector convention carries real weight here.
- "Programme Manager" via a recruitment agency for an unnamed "client", no salary stated, generic description: 7.0. A genuinely plausible role, but real ambiguity on employer identity and pay; worth surfacing, not a certainty.
- "Deputy Director, Digital Services" at a named government department, pay-scale range stated: 7.2. Public-sector grade language confirms real seniority even though the range, not a single figure, is given.
- "Operations Manager" at a named manufacturer, no salary stated: 6.4. A solid, plausible senior operational role; missing salary is neutral in this sector, not disqualifying.
- "Marketing Executive" with no seniority qualifier at a small company, no salary stated: 5.0. Could be a solid mid-level role, could be junior; the listing itself does not give enough signal either way.
- "Store Manager" at a national retail chain: 4.0 unless the listing explicitly describes multi-site or regional scope; the bare title alone in retail usually signals site-level, not strategic, seniority.
- "Technical Sales Executive", commission-weighted, base salary stated but modest: 3.5. A genuine role, but the "Executive" title and sales-quota structure both point junior-to-mid, not senior.
- "Interim Finance Director", 6-month fixed term, day rate stated: 8.0. A senior, well-scoped role; the contract length and interim status are not penalised on their own, per the guidance above.
- "Sales Development Representative", quota-only, no base salary mentioned: 1 to 2. A pure commission structure with no seniority signal at all.
- "Graduate Scheme — Various Departments" at a well-known employer: 1. Explicitly entry-level regardless of how prestigious the parent company is.
- "360 Recruitment Consultant" at an unnamed recruitment agency, generic listicle-style description: 1 to 2. Junior, high-turnover role type regardless of phrasing; also a common aggregator-spam pattern.
- "Lead Technical Architect" at a named government digital delivery unit, pay-scale range stated, posted for several UK cities separately: 7.2 for each listing. Multiple location postings of the same senior role are common in public-sector recruitment and are not aggregator spam; score each on its own merits.
- "Vice President, Risk" at a recognised bank, London, no salary stated, hybrid working: 8.0. Consistent with the banking sector note above; the VP grade and named credible employer carry the seniority signal even without a figure.
- "Consultant, Strategy & Operations" at a recognised consulting firm, salary band stated: 7.6. The consulting-ladder note applies: "Consultant" here is a genuine, fairly senior grade, not an entry-level title as it might be read in another sector.
- "Band 8a Service Improvement Lead" at an NHS trust, pay-scale stated: 7.4. The clinical/NHS banding system confirms real seniority even though the title alone ("Lead") would be ambiguous outside that context.
- "Head of Fundraising" at a named national charity, salary noticeably below equivalent commercial titles: 7.8. Per the charity-sector note, a lower salary here is a sector norm, not a signal to downgrade the role's genuine seniority.
- "Programme Manager x3, Various UK Locations" via a recruitment agency, salary band stated, named end client: 7.4. The bundled/plural framing and multi-location breadth are both neutral; the role itself is genuinely senior and reasonably well-scoped.
- "Growth Marketing Lead" at a recognised UK scale-up, salary stated, London: 8.0. Consistent with the technology-sector note: "Lead" here denotes genuine individual or small-team leadership at a credible, named employer.
- "Duty Manager" at a franchise-operated restaurant chain location: 3.0. Franchise status is not itself a downgrade, but the "Duty Manager" title is a clear shift-level operational role in hospitality, not strategic seniority.
- "Associate Director, Corporate Finance" at a professional services firm, salary band stated: 8.4. Per the professional-services note, "Associate Director" sits high on that sector's specific ladder despite "Associate" sounding junior in isolation.

HANDLING PARTIAL OR MESSY LISTING DATA (a common real-world state for scraped and aggregated listings):
- Missing location: if the location field is blank but the description or company clearly implies a UK base, do not penalise for the missing field; if there is no UK signal at all, treat as a mild negative rather than an automatic reject, since this is often a data-quality gap in the source feed, not a genuine non-UK role.
- Truncated or garbled descriptions (common from HTML-to-text extraction): judge on whatever coherent signal remains in the title, company and any salary given, rather than penalising for extraction artefacts themselves.
- Duplicate-looking postings from the same company with slightly different wording: treat each on its own merits; near-duplicate postings of a genuinely senior role are not spam on their own, unlike the generic templated agency-spam pattern described earlier, which lacks any real distinguishing detail at all.
- A listing that mixes two distinct roles in one posting (for example a combined "Product Manager / Product Owner" posting): score the more senior plausible reading, since employers frequently combine adjacent titles in one advert without intending either reading to be definitive.
- Where currency or region is ambiguous (for example a salary given without a currency symbol), assume GBP for a UK-domiciled listing unless there is a clear signal otherwise; do not reject solely for an unlabelled number.
- A listing with an unusually short or terse title (a single word, or an abbreviation like "PM" or "BDM") should be read in the context of the company and any description available, rather than scored purely on the terse title text.

FURTHER SECTOR NOTES (continued from above, since sector convention is one of the largest sources of scoring error for a candidate-agnostic baseline):
- Insurance and actuarial: title ladders resemble banking's formality; "Manager" and "Senior Manager" are genuine graded roles, and professional qualifications mentioned in the description (though not scored directly) are a mild positive signal of a substantive, non-junior role.
- Telecoms and utilities-adjacent infrastructure: large, established employers in this space use conservative, stable title ladders similar to manufacturing and energy; treat "Head of Network Operations" or equivalent as genuinely senior even without salary detail.
- Public relations and communications agencies: similar title-inflation risk to marketing/creative agencies; a "Director" at a two-person PR consultancy is not equivalent in seniority to the same title at a large communications firm, so weigh agency scale alongside the title.
- Housing associations and social housing: a large, established sector with its own conservative title ladder (Head of Service, Director of Operations); treat similarly to public sector norms, including tolerance for pay-scale ranges rather than single salary figures.
- Logistics and supply chain specifically (as distinct from general manufacturing): "Warehouse Manager" typically denotes site-level operational seniority, comparable to "Store Manager" in retail, rather than strategic seniority, unless the listing explicitly describes multi-site or regional responsibility.
- Aviation and rail: large, established operators use conservative, safety-regulated title ladders; "Duty Manager" here carries more real operational authority than the equivalent hospitality title, given the regulatory context, though it is still an operational rather than strategic grade.

FINAL REMINDER BEFORE SCORING: you are producing a single shared baseline score used by every user of the platform, not a personalised judgement. Consistency across similar listings matters as much as accuracy on any one listing, since users will compare scores across many roles at once. When genuinely uncertain between two adjacent scores, prefer the lower of the two, since overstating a role's seniority is more costly to a user's trust in this baseline score than understating it.

${RUBRIC}

${STYLE_RULES}`

/**
 * @param {string} apiKey
 * @param {Array<{role_title:string, company:string, location:string, salary:string}>} rows
 * @returns {Promise<{ scores: Map<number, number>, cacheReadTokens: number, usage: object|null }>}
 */
export async function scoreJobsBatch(apiKey, rows) {
  const jobsBlock = rows
    .map((r, i) => `[${i}] "${r.role_title || 'Unknown'}" at ${r.company || 'Unknown'} | ${r.location || ''} | ${r.salary || ''}`)
    .join('\n')
  const userMsg = `JOBS:\n${jobsBlock}\n\nReturn ONLY a JSON array, one object per job: {"i": index, "score": 1-10}. No markdown.`

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: MODELS.haiku,
      max_tokens: 1500,
      system: [{ type: 'text', text: SYSTEM_PREFIX, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    }),
  })
  const aiData = await aiRes.json()
  const text = aiData.content?.map(c => c.text || '').join('') || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  let parsed = []
  try { parsed = match ? JSON.parse(match[0]) : [] } catch { parsed = [] }

  const scores = new Map()
  for (const s of Array.isArray(parsed) ? parsed : []) {
    if (s && typeof s.i === 'number') {
      const n = Number(s.score)
      scores.set(s.i, Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 6)
    }
  }
  return { scores, cacheReadTokens: aiData.usage?.cache_read_input_tokens || 0, usage: aiData.usage || null }
}
