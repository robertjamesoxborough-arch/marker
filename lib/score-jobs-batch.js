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
