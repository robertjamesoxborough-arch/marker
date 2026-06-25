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

  const [
    { data: usersData },
    { data: profiles },
    { data: allUsage },
    { data: authData, error: authError },
  ] = await Promise.all([
    service.from('users').select('id, trial_ends_at, created_at, default_account_id'),
    service.from('profiles').select('user_id, track, target_roles, seniority, industries, postcode, hard_filters_json, name'),
    service.from('ai_usage').select('user_id, cost_estimate_gbp, created_at'),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ])

  // Build lookup maps
  const profileMap = {}
  ;(profiles || []).forEach(p => { profileMap[p.user_id] = p })

  const spendMap = {}
  const lastUsageMap = {}
  ;(allUsage || []).forEach(r => {
    spendMap[r.user_id] = (spendMap[r.user_id] || 0) + (r.cost_estimate_gbp || 0)
    if (!lastUsageMap[r.user_id] || r.created_at > lastUsageMap[r.user_id]) {
      lastUsageMap[r.user_id] = r.created_at
    }
  })

  const authUserMap = {}
  ;(authData?.users || []).forEach(u => {
    authUserMap[u.id] = { email: u.email, lastSignIn: u.last_sign_in_at }
  })

  const now = new Date().toISOString()

  const accounts = (usersData || []).map(u => {
    const profile = profileMap[u.id] || {}
    const auth = authUserMap[u.id] || {}
    const hf = profile.hard_filters_json || {}
    const trialExpired = u.trial_ends_at && u.trial_ends_at <= now
    const trialActive = u.trial_ends_at && u.trial_ends_at > now

    return {
      id: u.id,
      email: auth.email || 'n/a',
      name: profile.name || null,
      track: profile.track || null,
      seniority: profile.seniority || null,
      targetRoles: profile.target_roles || [],
      industries: profile.industries || [],
      postcode: profile.postcode || null,
      trialEndsAt: u.trial_ends_at || null,
      trialStatus: trialExpired ? 'expired' : trialActive ? 'active' : 'none',
      signedUpAt: u.created_at,
      lastSignIn: auth.lastSignIn || null,
      lastAiUsage: lastUsageMap[u.id] || null,
      aiSpendGbp: spendMap[u.id] || 0,
      archived: hf.archived || false,
      refCode: hf.refCode || null,
      surfaces: hf.surfaces || {},
    }
  }).sort((a, b) => (b.signedUpAt || '').localeCompare(a.signedUpAt || ''))

  return NextResponse.json({ accounts, total: accounts.length })
}
