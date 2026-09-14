import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkAllowance } from '../../../../lib/allowance'

// Read-only allowance check for the Aggregator's "Bring in for scoring"
// bulk paste — reuses the SAME 'analyse' bucket as the single-role scorer
// (EngineTab). There is deliberately no separate allowance for bulk
// bring-in: it's the same scoring call repeated, so it must draw from the
// same capped bucket, not a second uncapped one. Same pattern as
// cover-letter-allowance/fresh-scan-allowance.
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ allowed: false, used: 0, cap: 0, tier: 'free' })

  const result = await checkAllowance(user.id, 'analyse')
  return NextResponse.json(result)
}
