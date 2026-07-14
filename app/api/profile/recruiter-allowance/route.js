import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkAllowance } from '../../../../lib/allowance'

// Read-only allowance check so the Recruiter panel can show real state
// ("3 of 5 left this month") BEFORE the user generates, without spending
// anything — checkAllowance only counts existing ai_usage rows, it never
// calls a model. Same pattern as profile/fresh-scan-allowance.
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ allowed: false, used: 0, cap: 0, tier: 'free' })

  const result = await checkAllowance(user.id, 'recruiter_search')
  return NextResponse.json(result)
}
