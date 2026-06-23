import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ tier: 'free' })

  const { data } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ).from('users').select('tier, trial_ends_at, subscription_ends_at').eq('id', user.id).single()

  const now = new Date().toISOString()
  const trialActive = data?.trial_ends_at && data.trial_ends_at > now
  const tier = data?.tier || (trialActive ? 'trial' : 'free')

  return NextResponse.json({ tier, trialEndsAt: data?.trial_ends_at, subscriptionEndsAt: data?.subscription_ends_at })
}
