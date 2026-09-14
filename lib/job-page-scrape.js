// Zero-AI job-page extraction: a plain HTTP fetch + schema.org JobPosting
// JSON-LD parse, no model call anywhere in this file. Extracted unchanged
// from app/api/analyse/route.js's existing "Strategy 2" page-fetch (that
// route already did this, purely to build its own AI prompt) so the exact
// same proven logic can also answer a cheaper question elsewhere: "what
// job is this URL, structurally" -- used by the duplicate-detection peek
// endpoint (app/api/aggregator/peek-job) to get company/title/location for
// free, before deciding whether a paid /api/analyse call is even needed.
// analyse/route.js itself now calls fetchJobPage() too, so there is exactly
// one implementation of this scrape, not two silently drifting copies.

async function fetchJobPage(jobLink) {
  let html = ''
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 8000)
    const res = await fetch(jobLink, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    })
    if (res.ok) html = await res.text()
  } catch {}
  return html
}

function extractPublishedDate(html) {
  const datePatterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /"datePosted"\s*:\s*"([^"]+)"/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
  ]
  for (const p of datePatterns) {
    const m = html.match(p)
    if (m?.[1]) {
      const d = new Date(m[1])
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) return d.toISOString()
    }
  }
  return null
}

// Returns { title, company, location, pageContent, publishedDate } from the
// first schema.org JobPosting JSON-LD block found, or null if none parses.
// pageContent is the same concatenated-parts string analyse/route.js sends
// to the model; title/company/location are the structured fields the
// duplicate-detection peek endpoint actually wants.
function extractJobPostingJsonLd(html) {
  const publishedDate = extractPublishedDate(html)
  const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1])
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] !== 'JobPosting') continue
        const parts = [
          item.title, item.description, item.hiringOrganization?.name,
          item.jobLocation?.address?.addressLocality,
          item.employmentType, item.baseSalary?.value?.value,
        ].filter(Boolean)
        if (parts.length <= 2) continue
        let itemPublishedDate = publishedDate
        if (item.datePosted && !itemPublishedDate) {
          const d = new Date(item.datePosted)
          if (!isNaN(d.getTime())) itemPublishedDate = d.toISOString()
        }
        return {
          title: item.title || null,
          company: item.hiringOrganization?.name || null,
          location: item.jobLocation?.address?.addressLocality || null,
          pageContent: parts.join(' ').slice(0, 6000),
          publishedDate: itemPublishedDate,
        }
      }
    } catch {}
  }
  return null
}

function extractPlainText(html) {
  const extracted = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return extracted.length > 300 ? extracted.slice(0, 6000) : ''
}

module.exports = { fetchJobPage, extractJobPostingJsonLd, extractPlainText, extractPublishedDate }
