import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ref } = await req.json()
  if (!ref || ref === user.id) return Response.json({ ok: true })

  // Check not already captured for this referred user
  const { data: existing } = await supabase
    .from('referrals')
    .select('id')
    .eq('referred_user_id', user.id)
    .maybeSingle()
  if (existing) return Response.json({ ok: true })

  await supabase.from('referrals').insert({
    referrer_account_id: ref,
    referred_user_id: user.id,
    status: 'pending',
    commission_rate: 0.08,
  })

  return Response.json({ ok: true })
}
