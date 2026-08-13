import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { applyFreshnessToRow, filterAndSortByFreshness } from '../../../lib/freshness'
import { scoreMatch } from '../../../lib/match-engine'
import { dedupeByContent } from '../../../lib/dedupe-jobs'

// Cost rules 1 + 2: this route only ever READS jobs_cache, already
// baseline-scored ONCE nightly by /api/cron/score-cache (lib/score-jobs-
// batch.js, Haiku, shared across every user). Per-user relevance is applied
// here with the deterministic, zero-AI match engine (lib/match-engine.js)
// and used to SORT the list, not just to exclude hard mismatches — this
// route previously filtered on hard location/seniority mismatches only and
// left everything else in raw cached_at order, which is why the Live Roles
// feed read as an unranked recent dump regardless of the user's profile
// (Stage 44 Critical 1). This never re-scores with a model per request —
// scoreMatch is plain JS run over an already-fetched page of rows.

export async function GET(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json([], { status: 401 })

  const url = new URL(request.url)
  const showExpired = url.searchParams.get('showExpired') === '1'
  const broaden     = url.searchParams.get('broaden') === '1'

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Fetch profile for relevance ranking + location/seniority pre-filter
  const { data: profile } = await service
    .from('profiles')
    .select('target_roles, seniority, industries, max_office_days, salary_floor, postcode, hard_filters_json, track')
    .eq('user_id', user.id)
    .single()

  const { data } = await service
    .from('jobs_cache')
    .select('*')
    .in('source', ['greenhouse', 'gov', 'adzuna'])
    .order('cached_at', { ascending: false })
    .limit(500)

  if (!data) return Response.json([])

  const now = new Date()

  // Apply read-time freshness override (G2 invariant)
  let rows = data.map(row => applyFreshnessToRow(row, now))

  // Filter expired (default off) — its internal sort is superseded by the
  // relevance sort below, matching the pattern already used by feed-web/
  // feed-gov/job-feed/contractor-roles.
  rows = filterAndSortByFreshness(rows, { showExpired })

  // Collapse reposts/cross-source duplicates of the same real ad BEFORE
  // ranking, so a duplicate never displaces a genuinely different role.
  rows = dedupeByContent(rows)

  // Rank every row for THIS user with the deterministic match engine (zero
  // AI cost — safe to run over the whole page on every request). Hard
  // exclusions (location/seniority/role-relevance gate — see the GATING
  // PRINCIPLE docstring in lib/match-engine.js) apply exactly as computed
  // by scoreMatch itself unless ?broaden=1; everything else is SORTED by
  // overall relevance instead of being left in raw cached_at order.
  const ranked = rows.map(row => ({ row, relevance: scoreMatch(profile, row) }))
  const filtered = (!broaden && profile)
    ? ranked.filter(({ relevance }) => !relevance.excluded)
    : ranked
  filtered.sort((a, b) => b.relevance.score - a.relevance.score)

  const jobs = filtered.map(({ row, relevance }) => ({
    id:                        row.id,
    company:                   row.company,
    roleTitle:                 row.role_title,
    link:                      row.link,
    salary:                    row.salary,
    location:                  row.location,
    source:                    row.source,
    trackTags:                 row.track_tags || [],
    foundAt:                   row.cached_at,
    freshness:                 row.freshness,
    relativeTime:              row.relativeTime,
    lastVerifiedAt:            row.last_verified_at,
    adzunaAttributionRequired: row.adzuna_attribution_required,
    matchScore:                row.match_score ?? null,
    relevanceScore:            profile ? relevance.score : null,
    relevanceDimensions:       profile ? relevance.dimensions : null,
    ...(row.raw_json || {}),
  }))

  return Response.json(jobs)
}
