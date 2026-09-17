import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// AUDIT STAGE 2 (L3), FIXED IN STAGE 77 -- do not reintroduce this bug.
// This route had NO auth at all and NO length cap on `links`: a single
// anonymous POST with an arbitrarily large array made this server fetch
// every one of those URLs. Confirmed live: an unauthenticated POST with an
// empty array returned 200 (not tested with a real payload, to avoid making
// outbound requests as part of the audit, but nothing in the code would have
// stopped one). No AI cost here, but unbounded Vercel compute/egress, and it
// made Requite an open request-amplifier pointed at whatever URLs a caller
// supplied -- a real abuse and reputational exposure independent of billing.
//
// The one real caller (app/app/page.js's checkDeadLinks) only ever sends the
// user's OWN active pipeline links, which this app's own guidance elsewhere
// says should be a handful (5-8 active roles), so both caps below are sized
// with generous headroom for genuine use and are about bounding abuse, not
// normal use.
const MAX_LINKS_PER_REQUEST = 50
const MAX_LINKS_PER_DAY = 200

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Reuses admin_metrics_cache (already used the same way by lib/adzuna-budget.js
// for a global daily counter) rather than a new table, keyed per user per day.
// This is not an AI cost, so it does not belong in ai_usage/checkAllowance --
// it is a plain request-rate guard.
async function reserveDailyLinks(userId, count) {
  const key = `check_links:${userId}:${new Date().toISOString().slice(0, 10)}`
  const svc = service()
  const { data } = await svc.from('admin_metrics_cache').select('value').eq('metric', key).maybeSingle()
  const used = data?.value?.count || 0
  if (used + count > MAX_LINKS_PER_DAY) return { allowed: false, used }
  await svc.from('admin_metrics_cache').upsert(
    { metric: key, value: { count: used + count }, computed_at: new Date().toISOString() },
    { onConflict: 'metric' }
  )
  return { allowed: true, used: used + count }
}

export async function POST(req) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

  const { links } = await req.json()
  if (!links || !links.length) return Response.json({ results: [] })

  const capped = links.slice(0, MAX_LINKS_PER_REQUEST)

  const dayBudget = await reserveDailyLinks(user.id, capped.length)
  if (!dayBudget.allowed) {
    return Response.json({
      results: [],
      error: `You've checked ${dayBudget.used} links today; that's the daily limit. Try again tomorrow.`,
    }, { status: 429 })
  }

  const results = await Promise.allSettled(
    capped.map(async ({ id, url }) => {
      try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { id, url, status: 'error' }
        }
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow',
        })
        clearTimeout(timeout)
        return { id, url, status: res.ok ? 'alive' : 'dead', code: res.status }
      } catch {
        return { id, url, status: 'error' }
      }
    })
  )

  return Response.json({ results: results.map(r => r.status === 'fulfilled' ? r.value : { id: 'unknown', status: 'error' }) })
}
