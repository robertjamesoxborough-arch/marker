import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { fetchFromAnyProvider } from '../../../../lib/ats'

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
const COMPANIES = [
  { company: 'Wise',            slug: 'wise',            provider: 'smartrecruiters' },
  { company: 'Tide',             slug: 'tide',             provider: 'greenhouse' },
  { company: 'Cleo',             slug: 'cleo',             provider: 'greenhouse' },
  { company: 'Trustpilot',       slug: 'trustpilot',       provider: 'greenhouse' },
  { company: 'Marshmallow',      slug: 'marshmallow',      provider: 'ashby' },
  { company: 'Zopa',             slug: 'zopa',             provider: 'lever' },
  { company: 'TrueLayer',        slug: 'truelayer',        provider: 'greenhouse' },
  { company: 'Griffin',          slug: 'griffin',          provider: 'ashby' },
  { company: 'ComplyAdvantage',  slug: 'complyadvantage',  provider: 'greenhouse' },
  { company: 'Codat',            slug: 'codat',            provider: 'ashby' },
  { company: 'Paddle',           slug: 'paddle',           provider: 'ashby' },
  { company: 'Multiverse',       slug: 'multiverse',       provider: 'ashby' },
  { company: 'Quantexa',         slug: 'quantexa',         provider: 'ashby' },
  { company: 'Matillion',        slug: 'matillion',        provider: 'lever' },
  { company: 'Gousto',           slug: 'gousto',           provider: 'smartrecruiters' },
  { company: 'Deliveroo',        slug: 'deliveroo',        provider: 'ashby' },
  { company: 'Improbable',       slug: 'improbable',       provider: 'ashby' },
  { company: 'Synthesia',        slug: 'synthesia',        provider: 'ashby' },
  { company: 'Second Nature',    slug: 'secondnature',     provider: 'smartrecruiters' },
  { company: 'Juro',             slug: 'juro',             provider: 'ashby' },
  { company: 'Brandwatch',       slug: 'brandwatch',       provider: 'greenhouse' },
  { company: 'Funding Circle',   slug: 'fundingcircle',    provider: 'ashby' },
  { company: 'Freetrade',        slug: 'freetrade',        provider: 'ashby' },
  { company: 'Miro',             slug: 'miro',             provider: 'ashby' },
  { company: 'Notion',           slug: 'notion',            provider: 'ashby' },
  { company: 'Figma',            slug: 'figma',             provider: 'greenhouse' },
  { company: 'Canva',            slug: 'canva',             provider: 'smartrecruiters' },
  { company: 'Monzo',            slug: 'monzo',             provider: 'greenhouse' },
  { company: 'GoCardless',       slug: 'gocardless',        provider: 'greenhouse' },
  { company: 'Skyscanner',       slug: 'skyscanner',        provider: 'greenhouse' },
  { company: 'Farfetch',         slug: 'farfetch',          provider: 'greenhouse' },
  { company: 'SumUp',            slug: 'sumup',             provider: 'greenhouse' },
  { company: 'Wayve',            slug: 'wayve',             provider: 'greenhouse' },
  { company: 'Graphcore',        slug: 'graphcore',         provider: 'greenhouse' },
  { company: 'Unmind',           slug: 'unmind',            provider: 'ashby' },
  { company: 'Gymshark',         slug: 'gymshark',          provider: 'greenhouse' },
  { company: 'Signal AI',        slug: 'signal-ai',         provider: 'ashby' },
  { company: 'OVO Energy',       slug: 'ovoenergy',         provider: 'greenhouse' },
  { company: 'Pleo',             slug: 'pleo',              provider: 'ashby' },
  { company: 'Thoughtworks',     slug: 'thoughtworks',      provider: 'greenhouse' },
  { company: 'Deliverect',       slug: 'deliverect',        provider: 'lever' },
  { company: 'Benevity',         slug: 'benevity',          provider: 'ashby' },
  { company: 'Wallapop',         slug: 'wallapop',          provider: 'greenhouse' },
]

const UK_PATTERN = /\b(london|uk|england|scotland|wales|remote|hybrid|manchester|edinburgh|bristol|birmingham|leeds|cardiff|belfast|sheffield|cambridge|oxford|brighton|surrey|kent|guildford|reading|milton keynes)\b/i
const NON_UK_PATTERN = /\b(united states|canada|australia|germany|france|spain|netherlands|india|singapore|new york|san francisco|berlin|amsterdam|paris|toronto|sydney|bangalore|dublin(?! road)|warsaw|prague|bucharest|florida|poland|portugal|italy)\b/i

function isUkRole(location) {
  if (!location || location.trim() === '') return true
  if (NON_UK_PATTERN.test(location)) return false
  return UK_PATTERN.test(location)
}

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date().toISOString()
  const rows = []
  const errors = []
  const moved = []

  await Promise.allSettled(
    COMPANIES.map(async ({ company, slug, provider }) => {
      try {
        const found = await fetchFromAnyProvider(slug, provider)
        if (!found) { errors.push(`${company}: no provider returned jobs (all 4 tried)`); return }
        if (found.provider !== provider) moved.push(`${company}: recorded ${provider} -> now ${found.provider}`)

        for (const job of found.jobs) {
          if (!isUkRole(job.location)) continue
          rows.push({
            external_id: `${found.provider}-${slug}-${job.id}`,
            company,
            role_title: job.title,
            link: job.url,
            salary: null,
            location: job.location,
            source: 'greenhouse', // kept for existing readers (feed-cache etc); real provider is in track_tags
            source_type: 'public_listing',
            track_tags: [found.provider],
            cached_at: now,
            adzuna_attribution_required: false,
            raw_json: { department: job.department, ats_provider: found.provider },
          })
        }
      } catch (e) {
        errors.push(`${company}: ${e.message}`)
      }
    })
  )

  const deduped = [...new Map(rows.map(r => [r.external_id, r])).values()]

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
    companies: COMPANIES.length,
    moved,
    errors,
  })
}
