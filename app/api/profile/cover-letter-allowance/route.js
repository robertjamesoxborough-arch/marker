import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkAllowance } from '../../../../lib/allowance'

// Read-only allowance check so the Cover Letter panel can show a proactive
// locked state for Free users (cap 0) and "X of Y left this month" for paid
// tiers, without spending anything. checkAllowance only counts existing
// ai_usage rows, it never calls a model. Same pattern as recruiter-allowance.
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ allowed: false, used: 0, cap: 0, tier: 'free' })

  const result = await checkAllowance(user.id, 'cover_letter')
  return NextResponse.json(result)
}
