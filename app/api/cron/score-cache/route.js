import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { scoreJobsBatch } from '../../../../lib/score-jobs-batch'

// Cost rule 2: score each cached job ONCE, globally. This nightly cron scores
// rows that were ingested but not yet scored and writes a shared, candidate-
// AGNOSTIC baseline score onto the cache row. User feed clicks read this score
// and apply per-user relevance deterministically (lib/match-engine.js) — they
// never re-score. 500 users therefore never mean 500x scoring.
//
// The scoring call itself (rubric, model, cache_control) lives in
// lib/score-jobs-batch.js, shared with the Pro "Fresh scan" live path in
// /api/feed-web so both write the identical baseline score.

export const maxDuration = 60

const BATCH = 40        // jobs per Haiku call
const MAX_BATCHES = 6   // safety cap per run (240 jobs); the next run picks up the rest

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

    let scores = new Map()
    try {
      const result = await scoreJobsBatch(apiKey, rows)
      scores = result.scores
      cacheReadTokens += result.cacheReadTokens
    } catch (e) {
      errors.push('score: ' + e.message)
      break
    }

    const nowIso = new Date().toISOString()

    // Stamp scored_at on EVERY row in the batch — even ones the model skipped
    // (fall back to the neutral score) — so a job is never reprocessed forever.
    for (let i = 0; i < rows.length; i++) {
      const score = scores.has(i) ? scores.get(i) : 6
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
