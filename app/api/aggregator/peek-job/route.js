import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { fetchJobPage, extractJobPostingJsonLd } from '../../../../lib/job-page-scrape'

// Zero-AI: what job is this URL, structurally — company/title/location
// only, no model call anywhere in this route. Used by the Aggregator's
// "Bring in for scoring" flow to run duplicate detection BEFORE paying for
// a /api/analyse call, so a duplicate never costs a scoring credit to
// rediscover (Stage 58).
//
// Two ways to answer this for free:
//  1. The link is already in jobs_cache (this app's own nightly ingest) —
//     a plain DB lookup, no fetch needed.
//  2. Otherwise, fetch the page and parse its schema.org JobPosting JSON-LD
//     (lib/job-page-scrape.js — the exact same logic /api/analyse already
//     uses to build its prompt, just read for its structured fields here
//     instead of concatenated into prose).
// If neither yields anything (no jobs_cache row, no parseable JSON-LD —
// common on JS-rendered pages with no structured data), this returns
// { company: null, roleTitle: null, location: null } and the caller falls
// through to paid scoring as normal — there is no AI fallback here, by design.
export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobLink } = await request.json().catch(() => ({}))
  if (!jobLink) return NextResponse.json({ error: 'jobLink required' }, { status: 400 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: cached } = await service
    .from('jobs_cache')
    .select('company, role_title, location, external_id')
    .eq('link', jobLink)
    .limit(1)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      company: cached.company || null,
      roleTitle: cached.role_title || null,
      location: cached.location || null,
      externalId: cached.external_id || null,
      source: 'cache',
    })
  }

  const html = await fetchJobPage(jobLink)
  const jsonLd = html ? extractJobPostingJsonLd(html) : null

  return NextResponse.json({
    company: jsonLd?.company || null,
    roleTitle: jsonLd?.title || null,
    location: jsonLd?.location || null,
    externalId: null,
    source: jsonLd ? 'scrape' : 'none',
  })
}
