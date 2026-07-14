import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkAllowance } from '../../../../lib/allowance'

// Read-only allowance check so the Fresh Scan button can show real state
// ("2 of 3 left today") BEFORE the user clicks, without spending anything —
// checkAllowance only counts existing ai_usage rows, it never calls a model.
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ allowed: false, used: 0, cap: 0, tier: 'free' })

  const result = await checkAllowance(user.id, 'feed_fresh_scan')
  return NextResponse.json(result)
}
