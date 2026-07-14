import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { applyFreshnessToRow, filterAndSortByFreshness } from '../../../lib/freshness'
import { scoreMatch } from '../../../lib/match-engine'

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

  // Fetch profile for location/seniority pre-filter
  const { data: profile } = await service
    .from('profiles')
    .select('target_roles, seniority, max_office_days, salary_floor, tracks, hard_filters_json')
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

  // Hard location/seniority pre-filter (skip if ?broaden=1 or no profile)
  if (!broaden && profile) {
    rows = rows.filter(row => {
      const { dimensions } = scoreMatch(profile, row)
      // Score of 1 = hard structural mismatch (wrong country / wildly wrong seniority)
      if (dimensions.locationFit?.score === 1)  return false
      if (dimensions.seniorityFit?.score === 1) return false
      return true
    })
  }

  // Filter expired (default off) and sort Fresh → Aging → Stale → Expired
  rows = filterAndSortByFreshness(rows, { showExpired })

  const jobs = rows.map(row => ({
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
    ...(row.raw_json || {}),
  }))

  return Response.json(jobs)
}
