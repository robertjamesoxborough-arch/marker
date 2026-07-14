import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { pullAtsRows, ATS_COMPANIES } from '../../../../lib/ats'
import { isSourceEnabled } from '../../../../lib/source-flags'

// Multi-ATS nightly ingest — replaces cron/greenhouse. 14 of the previous
// 20 Greenhouse-only boards had 404'd (companies silently migrated ATS
// provider), leaving feed coverage thin. Rewritten to cover Greenhouse,
// Lever, Ashby and SmartRecruiters behind lib/ats.js's shared interface.
//
// Workday intentionally excluded pending legal review — undocumented
// endpoint, commercial risk.
//
// Auto-detect: fetchFromAnyProvider tries each company's recorded provider
// first, then the other three, so a company that migrates ATS again is
// still found automatically rather than silently 404ing — the exact
// failure mode that caused this rewrite. `moved` in the response reports
// any company whose live provider no longer matches its recorded one.
//
// Cost rules still apply: nightly-shared only (rule 1), rows inserted
// UNSCORED and picked up by the existing source-agnostic cron/score-cache
// sweep — the same shared Haiku baseline as every other feed (rule 2), no
// per-user path of any kind.
//
// `source: 'greenhouse'` is kept for every provider (not a new enum value —
// avoids a migration) since this cron directly replaces cron/greenhouse and
// every existing reader (feed-cache, lib/db.js) already filters on
// source='greenhouse'; the real provider is recorded in track_tags instead
// so nothing is lost for debugging.
//
// 43 companies verified live (2026-07-14) before shipping — every slug
// below actually returned real job listings at verification time; none are
// guessed. Weighted toward established/scale-stage UK-relevant employers
// over early-stage hypergrowth, matching Requite's target audience.

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!await isSourceEnabled('ats')) {
    return NextResponse.json({ ok: true, skipped: 'source_ats disabled via admin kill switch' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date().toISOString()
  const errors = []
  // Shared pull (lib/ats.js) — same free-board logic the fresh-scan path reuses.
  const { rows: deduped, moved } = await pullAtsRows(now)

  if (deduped.length > 0) {
    const { error } = await supabase
      .from('jobs_cache')
      .upsert(deduped, { onConflict: 'external_id' })
    if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
  }

  // Prune stale ATS-sourced rows older than 7 days (same window cron/greenhouse used)
  await supabase
    .from('jobs_cache')
    .delete()
    .eq('source', 'greenhouse')
    .lt('cached_at', new Date(Date.now() - 7 * 86400000).toISOString())

  return NextResponse.json({
    ok: true,
    inserted: deduped.length,
    companies: ATS_COMPANIES.length,
    moved,
    errors,
  })
}
