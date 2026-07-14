import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { MODELS } from '../../../../lib/anthropic'
import { STYLE_RULES } from '../../../../lib/brand'
import { safeFetch } from '../../../../lib/safe-fetch'

// Nightly, shared ingest for job-feed's career-page discovery. Was
// previously a per-user, on-demand career-page scrape + web_search combo
// (cost rules 1 + 7 violation — moved here). Scrapes the UNION of company
// career pages across ALL users' wishlists ONCE (shared cost, cost rule 1),
// extracts job postings with ONE Sonnet call (shared, candidate-agnostic
// extraction — cost rule 2), and inserts them UNSCORED into jobs_cache.
// The existing cron/score-cache sweep (source-agnostic) picks these rows up
// and scores them via the shared Haiku baseline — no separate scoring call
// needed here. job-feed itself (rewritten) reads this cache, filtered to
// each user's OWN wishlist companies, with zero AI cost at read time.
//
// The generic Sonnet web_search fallback (job-feed's old "senior manager UK
// remote"-style queries) is NOT carried over here — see PROGRESS.md for why
// it was cut rather than converted.

export const maxDuration = 60

const MAX_COMPANIES = 30 // bounds runtime/cost per run; a larger wishlist union just takes a few nights to fully cycle

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)
}

// Stable across nightly runs for the same still-open posting (same company/
// title/url text), so cron/score-cache and this cron's own upsert correctly
// treat an unchanged posting as the same row rather than duplicating it.
function externalIdFor(company, title, url) {
  const raw = `wishlist-${company}-${title}-${url}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 200)
  return raw
}

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

  const errors = []

  // Shared union of company career pages across ALL users' wishlists — this
  // is the whole point: one scrape per company benefits every user who has
  // it wishlisted, not one scrape per user.
  const { data: wishlistRows, error: wlErr } = await supabase
    .from('wishlists')
    .select('company, careers_url')
    .not('careers_url', 'is', null)
  if (wlErr) return NextResponse.json({ error: wlErr.message }, { status: 500 })

  const seenCompany = new Set()
  const targets = []
  for (const row of wishlistRows || []) {
    const key = (row.company || '').toLowerCase().trim()
    if (!key || seenCompany.has(key)) continue
    seenCompany.add(key)
    targets.push(row)
  }
  const toScrape = targets.slice(0, MAX_COMPANIES)

  const snippets = []
  for (const { company, careers_url } of toScrape) {
    try {
      const res = await safeFetch(careers_url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      })
      if (!res.ok) { errors.push(`${company}: HTTP ${res.status}`); continue }
      const html = await res.text()
      const text = stripHtml(html)
      if (text.length > 200) snippets.push({ company, url: careers_url, content: text })
    } catch (e) {
      errors.push(`${company}: ${e.message}`)
    }
  }

  if (snippets.length === 0) {
    return NextResponse.json({ ok: true, companies: toScrape.length, scraped: 0, extracted: 0, errors })
  }

  // ONE shared, candidate-agnostic extraction call for the whole batch —
  // not personalised (no candidate profile here), matching cost rule 2:
  // this describes what roles exist, it does not judge fit for anyone.
  const batchContent = snippets.map((s, i) => `--- SOURCE ${i + 1}: ${s.company} ---\nURL: ${s.url}\n${s.content}`).join('\n\n')
  const prompt = `Extract individual job listings from the career-page content below. This is a shared, candidate-agnostic extraction — describe what roles exist, do not judge fit for any specific person.

SOURCES:
${batchContent.slice(0, 25000)}

Return ONLY a JSON array (no markdown, no explanation). Each object:
{"company": "Exact company name as given in the SOURCE label", "title": "Exact job title", "url": "Direct link to the posting if one is given, else the source URL", "location": "Location if stated, else empty string", "salary": "Salary if stated, else empty string"}

Rules:
- Maximum 5 postings per company — the most senior/substantive ones if there are more.
- Skip anything that is not clearly a specific, named job opening (nav links, generic "join us" copy, cookie banners).
- Return an empty array if a source has no genuine listings.

${STYLE_RULES}`

  let extracted = []
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELS.sonnet, max_tokens: 3900, messages: [{ role: 'user', content: prompt }] }),
    })
    const aiData = await aiRes.json()
    const text = (aiData.content || []).map(c => c.text || '').join('') || '[]'
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    extracted = match ? JSON.parse(match[0]) : []
    if (!Array.isArray(extracted)) extracted = [extracted]
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'extraction: ' + e.message, companies: toScrape.length, scraped: snippets.length, errors })
  }

  const now = new Date().toISOString()
  const rows = extracted
    .filter(j => j?.company && j?.title)
    .map(j => ({
      external_id: externalIdFor(j.company, j.title, j.url || ''),
      company: j.company,
      role_title: j.title,
      link: j.url || snippets.find(s => s.company === j.company)?.url || '',
      location: j.location || '',
      salary: j.salary || null,
      source: 'manual',
      source_type: 'public_listing',
      track_tags: ['wishlist'],
      cached_at: now,
      last_verified_at: now,
      adzuna_attribution_required: false,
      raw_json: {},
      // scored_at deliberately omitted (null) — cron/score-cache's existing,
      // source-agnostic sweep scores these via the shared Haiku baseline.
    }))

  const deduped = [...new Map(rows.map(r => [r.external_id, r])).values()]

  if (deduped.length > 0) {
    const { error } = await supabase.from('jobs_cache').upsert(deduped, { onConflict: 'external_id' })
    if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
  }

  // Prune wishlist-sourced rows older than 14 days (career pages change less
  // often than aggregator listings; a shorter window would re-scrape the
  // same still-open postings every few days for no benefit).
  await supabase
    .from('jobs_cache')
    .delete()
    .eq('source', 'manual')
    .contains('track_tags', ['wishlist'])
    .lt('cached_at', new Date(Date.now() - 14 * 86400000).toISOString())

  return NextResponse.json({
    ok: true,
    companies: toScrape.length,
    scraped: snippets.length,
    extracted: deduped.length,
    errors,
  })
}
