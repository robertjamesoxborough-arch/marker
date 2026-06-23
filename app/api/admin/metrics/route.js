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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const [
    { data: users },
    { data: allUsage },
    { data: profiles },
  ] = await Promise.all([
    service.from('users').select('id, trial_ends_at, created_at'),
    service.from('ai_usage').select('action, model, cost_estimate_gbp, input_tokens, output_tokens, created_at').gte('created_at', thirtyDaysAgo),
    service.from('profiles').select('track, hard_filters_json'),
  ])

  // Totals
  const totalUsers = users?.length || 0
  const trialsActive = (users || []).filter(u => u.trial_ends_at && u.trial_ends_at > now).length
  const trialsExpired = (users || []).filter(u => u.trial_ends_at && u.trial_ends_at <= now).length

  const totalSpend = (allUsage || []).reduce((s, r) => s + (r.cost_estimate_gbp || 0), 0)
  const totalCalls = allUsage?.length || 0

  // Spend by action
  const actionMap = {}
  ;(allUsage || []).forEach(r => {
    if (!actionMap[r.action]) actionMap[r.action] = { action: r.action, spend: 0, calls: 0 }
    actionMap[r.action].spend += r.cost_estimate_gbp || 0
    actionMap[r.action].calls += 1
  })
  const spendByAction = Object.values(actionMap).sort((a, b) => b.spend - a.spend)

  // Spend + calls by day (last 30 days)
  const dayMap = {}
  ;(allUsage || []).forEach(r => {
    const day = r.created_at?.slice(0, 10)
    if (!day) return
    if (!dayMap[day]) dayMap[day] = { date: day, spend: 0, calls: 0 }
    dayMap[day].spend += r.cost_estimate_gbp || 0
    dayMap[day].calls += 1
  })
  const spendByDay = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))

  // Signups by day (last 30 days)
  const signupMap = {}
  ;(users || []).filter(u => u.created_at >= thirtyDaysAgo).forEach(u => {
    const day = u.created_at?.slice(0, 10)
    if (!day) return
    signupMap[day] = (signupMap[day] || 0) + 1
  })
  const signupsByDay = Object.entries(signupMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))

  // Track breakdown
  const trackMap = {}
  ;(profiles || []).forEach(p => {
    const t = p.track || 'none'
    trackMap[t] = (trackMap[t] || 0) + 1
  })
  const trackBreakdown = Object.entries(trackMap).map(([track, count]) => ({ track, count })).sort((a, b) => b.count - a.count)

  // Model breakdown
  const modelMap = {}
  ;(allUsage || []).forEach(r => {
    if (!modelMap[r.model]) modelMap[r.model] = { model: r.model, spend: 0, calls: 0 }
    modelMap[r.model].spend += r.cost_estimate_gbp || 0
    modelMap[r.model].calls += 1
  })
  const spendByModel = Object.values(modelMap).sort((a, b) => b.spend - a.spend)

  return NextResponse.json({
    totals: { users: totalUsers, trialsActive, trialsExpired, aiSpendGbp: totalSpend, aiCallsTotal: totalCalls },
    spendByAction,
    spendByDay,
    signupsByDay,
    trackBreakdown,
    spendByModel,
  })
}
