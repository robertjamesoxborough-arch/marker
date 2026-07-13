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

const SYSTEM_PREFIX = `You are scoring UK job listings for generic role quality, a baseline shared across all users. Score each role 1-10 on how strong a mid-to-senior professional opportunity it is: genuine seniority, a legitimate employer and clear scope. This is candidate-agnostic; do not assume any specific person. Give junior roles, pure sales-quota roles, aggregator spam and non-UK roles a low score.

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
