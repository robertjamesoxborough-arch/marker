import { createClient } from '@supabase/supabase-js'

// Session O legal hardening: respect robots.txt before scraping any career
// page. Cached via the existing admin_metrics_cache table (id/metric/value/
// computed_at -- otherwise unused) so a nightly cron run doesn't re-fetch
// the same company's robots.txt every single night; a 24h TTL is generous
// given robots.txt files change rarely and this cron itself only runs once
// a night.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const REQUITE_USER_AGENT = 'RequiteBot/1.0 (+https://marker-silk.vercel.app; contact: support@upstreaminsights.co.uk)'

function parseRobotsTxt(text) {
  // Minimal, deliberately conservative parser: collects Disallow rules that
  // apply to us (a block naming our user-agent, or the wildcard "*" block
  // when no specific block names us). Does not implement Allow-overrides-
  // Disallow precedence or wildcard path matching -- if in doubt, we treat
  // a path as disallowed rather than risk crawling something we shouldn't.
  //
  // Standard robots.txt grouping: consecutive "User-agent:" lines belong to
  // the SAME block; a "Disallow:"/"Allow:" line closes that block, so the
  // next "User-agent:" line starts a new one.
  const lines = text.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean)
  const blocks = [] // { agents: [], disallow: [], rulesStarted: bool }
  let current = null
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (key === 'user-agent') {
      if (!current || current.rulesStarted) {
        current = { agents: [], disallow: [], rulesStarted: false }
        blocks.push(current)
      }
      current.agents.push(value.toLowerCase())
    } else if (key === 'disallow' && current) {
      current.rulesStarted = true
      if (value) current.disallow.push(value)
    } else if (key === 'allow' && current) {
      current.rulesStarted = true
    }
  }

  const ourAgent = 'requitebot'
  const specific = blocks.find(b => b.agents.some(a => a.includes(ourAgent)))
  const wildcard = blocks.find(b => b.agents.includes('*'))
  const applicable = specific || wildcard
  return applicable ? applicable.disallow : []
}

async function getCache(service, origin) {
  const res = await service.from('admin_metrics_cache').select('value, computed_at').eq('metric', `robots:${origin}`).maybeSingle()
  if (res.error || !res.data) return null
  const age = Date.now() - new Date(res.data.computed_at).getTime()
  if (age > CACHE_TTL_MS) return null
  return res.data.value?.disallow ?? null
}

async function setCache(service, origin, disallowRules) {
  await service.from('admin_metrics_cache').upsert({
    metric: `robots:${origin}`,
    value: { disallow: disallowRules },
    computed_at: new Date().toISOString(),
  }, { onConflict: 'metric' })
}

// Returns true if we're allowed to crawl `url` under its site's robots.txt.
// Fails open (allowed:true) only on a genuine fetch/parse failure -- a
// missing or unreachable robots.txt is not a disallow signal, per the
// standard.
export async function isAllowedByRobots(url) {
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  let origin, pathname
  try {
    const parsed = new URL(url)
    origin = parsed.origin
    pathname = parsed.pathname || '/'
  } catch {
    return { allowed: false, reason: 'invalid URL' }
  }

  let disallow = await getCache(service, origin)
  if (disallow === null) {
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': REQUITE_USER_AGENT },
      })
      disallow = res.ok ? parseRobotsTxt(await res.text()) : []
    } catch {
      disallow = [] // no reachable robots.txt -- not a disallow signal
    }
    await setCache(service, origin, disallow)
  }

  const blocked = disallow.some(rule => rule === '/' || pathname.startsWith(rule))
  return { allowed: !blocked, reason: blocked ? `disallowed by robots.txt (${origin})` : null }
}
