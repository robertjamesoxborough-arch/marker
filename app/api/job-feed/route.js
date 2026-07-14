import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { scoreMatch } from '../../../lib/match-engine'
import { applyFreshnessToRow, filterAndSortByFreshness } from '../../../lib/freshness'

// Cost rule 7: web_search-derived discovery gets ZERO per-user live path —
// not even an allowance-gated one (unlike feed-web/feed-gov/contractor-roles'
// {fresh:true} exception under rule 1). This route used to call Anthropic's
// web_search_20250305 tool (up to 5 searches) AND scrape arbitrary company
// career-page URLs, per authenticated click. Both are now nightly-cron-only
// (app/api/cron/wishlist-scrape) — this route is a pure, zero-AI-cost cache
// reader, filtered to each user's OWN wishlist companies.
//
// The old generic web_search fallback ("senior manager UK remote"-style
// queries) was NOT carried into the cron — see PROGRESS.md for why it was
// cut rather than converted (redundant with feed-web's existing Adzuna
// coverage, which is more reliable and already nightly/shared).

function rowToJob(row) {
  return {
    id: row.id, title: row.role_title, company: row.company, url: row.link,
    salary: row.salary, location: row.location, score: row.match_score ?? null,
    score_tier: row.score_tier || null, office: 'Unknown', source: 'wishlist_scrape',
    freshness: row.freshness, created: row.posted_at || row.cached_at, foundAt: row.cached_at,
  }
}

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ jobs: [], error: 'Sign in required' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const [{ data: profile }, { data: wishlistRows, error: wishlistErr }] = await Promise.all([
    service.from('profiles')
      .select('target_roles, seniority, industries, postcode, salary_floor, max_office_days, hard_filters_json, track')
      .eq('user_id', user.id).single(),
    service.from('wishlists').select('company').eq('user_id', user.id),
  ])

  // Distinguish a genuine query failure from a genuinely-empty wishlist —
  // showing the "add companies" message for a DB/permissions error would be
  // actively misleading about what's actually wrong.
  if (wishlistErr) return Response.json({ jobs: [], error: 'Could not load your wishlist right now.' }, { status: 500 })

  const myCompanies = new Set((wishlistRows || []).map(w => (w.company || '').toLowerCase().trim()).filter(Boolean))
  if (myCompanies.size === 0) return Response.json({ jobs: [], total: 0, message: 'Add companies to your wishlist to see roles scraped from their career pages.' })

  // Zero AI cost: reads jobs_cache rows the nightly cron/wishlist-scrape +
  // cron/score-cache have already scraped, extracted and baseline-scored.
  const { data: rows } = await service
    .from('jobs_cache')
    .select('*')
    .eq('source', 'manual')
    .contains('track_tags', ['wishlist'])
    .not('scored_at', 'is', null)
    .order('cached_at', { ascending: false })
    .limit(300)

  if (!rows || rows.length === 0) return Response.json({ jobs: [], total: 0 })

  // Filter to THIS user's own wishlist companies — the shared cache holds
  // every user's wishlisted companies, so this is where personalisation
  // happens, deterministically, at zero AI cost.
  const mine = rows.filter(r => myCompanies.has((r.company || '').toLowerCase().trim()))

  const now = new Date()
  const fresh = filterAndSortByFreshness(mine.map(row => applyFreshnessToRow(row, now)))
  const ranked = fresh
    .map(row => ({ row, relevance: scoreMatch(profile, row) }))
    .filter(({ row, relevance }) => (row.match_score ?? 6) >= 5 && relevance.score >= 6)
    .sort((a, b) => b.relevance.score - a.relevance.score)
    .map(({ row }) => rowToJob(row))

  return Response.json({ jobs: ranked.slice(0, 60), total: mine.length })
}
