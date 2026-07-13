import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { MODELS } from '../../../../lib/anthropic'
import { RUBRIC } from '../../../../lib/scoring'
import { STYLE_RULES } from '../../../../lib/brand'

// Cost rule 2: score each cached job ONCE, globally. This nightly cron scores
// rows that were ingested but not yet scored and writes a shared, candidate-
// AGNOSTIC baseline score onto the cache row. User feed clicks read this score
// and apply per-user relevance deterministically (lib/match-engine.js) — they
// never re-score. 500 users therefore never mean 500x scoring.

export const maxDuration = 60

const BATCH = 40        // jobs per Haiku call
const MAX_BATCHES = 6   // safety cap per run (240 jobs); the next run picks up the rest

// Static, cacheable prefix — identical every batch and every night, so the
// rubric is read at ~10% input price after the first call (cost rule 4).
// Embeds the shared lib/scoring.js RUBRIC verbatim.
const SYSTEM_PREFIX = `You are scoring UK job listings for generic role quality, a baseline shared across all users. Score each role 1-10 on how strong a mid-to-senior professional opportunity it is: genuine seniority, a legitimate employer and clear scope. This is candidate-agnostic; do not assume any specific person. Give junior roles, pure sales-quota roles, aggregator spam and non-UK roles a low score.

${RUBRIC}

${STYLE_RULES}`

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No ANTHROPIC_API_KEY' }, { status: 500 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  let totalScored = 0
  let cacheReadTokens = 0   // proof that prompt caching is firing (cost rule 4)
  let batches = 0
  const errors = []

  for (let b = 0; b < MAX_BATCHES; b++) {
    const { data: rows, error } = await supabase
      .from('jobs_cache')
      .select('id, role_title, company, location, salary')
      .is('scored_at', null)
      .limit(BATCH)
    if (error) { errors.push('select: ' + error.message); break }
    if (!rows || rows.length === 0) break
    batches++

    const jobsBlock = rows
      .map((r, i) => `[${i}] "${r.role_title || 'Unknown'}" at ${r.company || 'Unknown'} | ${r.location || ''} | ${r.salary || ''}`)
      .join('\n')
    const userMsg = `JOBS:\n${jobsBlock}\n\nReturn ONLY a JSON array, one object per job: {"i": index, "score": 1-10}. No markdown.`

    let scored = []
    try {
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
      cacheReadTokens += aiData.usage?.cache_read_input_tokens || 0
      const text = aiData.content?.map(c => c.text || '').join('') || '[]'
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const match = cleaned.match(/\[[\s\S]*\]/)
      scored = match ? JSON.parse(match[0]) : []
    } catch (e) {
      errors.push('score: ' + e.message)
      break
    }

    const nowIso = new Date().toISOString()
    const byIndex = new Map(
      (Array.isArray(scored) ? scored : [])
        .filter(s => s && typeof s.i === 'number')
        .map(s => [s.i, s])
    )

    // Stamp scored_at on EVERY row in the batch — even ones the model skipped
    // (fall back to the neutral score) — so a job is never reprocessed forever.
    for (let i = 0; i < rows.length; i++) {
      const s = byIndex.get(i)
      const raw = s ? Number(s.score) : NaN
      const score = Number.isFinite(raw) ? Math.max(0, Math.min(10, raw)) : 6
      const { error: upErr } = await supabase
        .from('jobs_cache')
        .update({
          match_score: score,
          score_tier: 'quick',
          scored_at: nowIso,
          score_breakdown_json: { tier: 'quick', model: 'haiku', baseline: true },
        })
        .eq('id', rows[i].id)
      if (upErr) { errors.push('update: ' + upErr.message); break }
      totalScored++
    }

    if (rows.length < BATCH) break
  }

  // cacheReadTokens > 0 on the 2nd+ batch confirms the rubric prefix is being
  // read from cache (cost rule 4 verification).
  return NextResponse.json({ ok: true, scored: totalScored, batches, cacheReadTokens, errors })
}
