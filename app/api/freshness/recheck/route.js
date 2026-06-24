import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { computeFreshnessState, relativeTime } from '../../../../lib/freshness'

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId, jobLink } = await request.json()
  if (!jobId || !jobLink) {
    return NextResponse.json({ error: 'jobId and jobLink required' }, { status: 400 })
  }

  // HEAD-check the job URL
  let alive = false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(jobLink, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    })
    clearTimeout(timer)
    alive = res.ok
  } catch {
    alive = false
  }

  const now = new Date()
  const newFreshness = alive ? computeFreshnessState(now.toISOString(), now) : 'Expired'
  const newVerifiedAt = now.toISOString()

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  await service
    .from('jobs_cache')
    .update({ freshness: newFreshness, last_verified_at: newVerifiedAt })
    .eq('id', jobId)

  return NextResponse.json({
    freshness: newFreshness,
    relativeTime: relativeTime(newVerifiedAt, now),
    alive,
  })
}
