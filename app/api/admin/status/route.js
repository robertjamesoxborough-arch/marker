import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function getAdminUser(cookieStore) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL || 'robertjamesoxborough@gmail.com'
  if (!user || user.email !== adminEmail) return null
  return user
}

export async function GET() {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: allJobs },
    { count: recentAiCalls },
    { count: totalAiCalls },
  ] = await Promise.all([
    service.from('jobs_cache').select('source, cached_at').order('cached_at', { ascending: false }),
    service.from('ai_usage').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
    service.from('ai_usage').select('*', { count: 'exact', head: true }),
  ])

  // Latest cached_at and job count per source
  const latestMap = {}
  const countMap = {}
  ;(allJobs || []).forEach(j => {
    countMap[j.source] = (countMap[j.source] || 0) + 1
    if (!latestMap[j.source] || j.cached_at > latestMap[j.source]) {
      latestMap[j.source] = j.cached_at
    }
  })

  const crons = [
    { id: 'greenhouse', label: 'Greenhouse',           schedule: '2am UTC daily',  source: 'greenhouse' },
    { id: 'adzuna',     label: 'Adzuna',               schedule: '3am UTC daily',  source: 'adzuna'     },
    { id: 'gov',        label: 'Gov / Civil Service',  schedule: '4am UTC daily',  source: 'gov'        },
    { id: 'archive',    label: 'Archive inactive',     schedule: '5am UTC daily',  source: null         },
  ]

  const cronStatus = crons.map(c => ({
    id:        c.id,
    label:     c.label,
    schedule:  c.schedule,
    lastRun:   c.source ? (latestMap[c.source] || null) : null,
    jobCount:  c.source ? (countMap[c.source] || 0)    : null,
  }))

  return NextResponse.json({
    cronStatus,
    aiCalls24h:   recentAiCalls  || 0,
    aiCallsTotal: totalAiCalls   || 0,
    envCheck: {
      adzunaConfigured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY),
      cronSecretSet:    !!process.env.CRON_SECRET,
      serviceRoleSet:   !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  })
}
