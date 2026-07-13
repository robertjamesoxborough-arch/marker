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

// Kept small deliberately: each batch is 1 Anthropic call + 1 bulk Supabase
// upsert (was 1 call + up to 40 individual row updates — the actual cause of
// the FUNCTION_INVOCATION_TIMEOUT on a large backlog). 3 batches x 50 rows
// comfortably fits inside a 60s Hobby-plan window; the cron is safely
// re-runnable, so a large backlog (e.g. after a first-ever ingest) just
// takes a few extra invocations to clear, then keeps up nightly from there.
const BATCH = 50
const MAX_BATCHES = 3

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
      .select('id, role_title, company, location, salary, source')
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

    // Bulk write — ONE upsert for the whole batch instead of up to 50
    // sequential row-by-row updates. `id` already exists on every row (it's
    // the real PK from a prior SELECT), so Postgres resolves this as an
    // UPDATE via ON CONFLICT. `source` must be included even though we don't
    // change it: Postgres validates NOT NULL constraints against the full
    // proposed row BEFORE it even reaches ON CONFLICT resolution, and
    // `source` is jobs_cache's only NOT NULL column with no default —
    // omitting it fails with "null value in column source violates not-null
    // constraint" regardless of the conflict path (confirmed against real
    // production rows, 2026-07-13). Stamp scored_at on EVERY row — even ones
    // the model skipped (fall back to the neutral score) — so a job is never
    // reprocessed forever.
    const updates = rows.map((row, i) => ({
      id: row.id,
      source: row.source,
      match_score: scores.has(i) ? scores.get(i) : 6,
      score_tier: 'quick',
      scored_at: nowIso,
      score_breakdown_json: { tier: 'quick', model: 'haiku', baseline: true },
    }))
    const { error: upErr } = await supabase.from('jobs_cache').upsert(updates, { onConflict: 'id' })
    if (upErr) { errors.push('update: ' + upErr.message); break }
    totalScored += updates.length

    if (rows.length < BATCH) break
  }

  // cacheReadTokens > 0 on the 2nd+ batch confirms the rubric prefix is being
  // read from cache (cost rule 4 verification).
  return NextResponse.json({ ok: true, scored: totalScored, batches, cacheReadTokens, errors })
}
