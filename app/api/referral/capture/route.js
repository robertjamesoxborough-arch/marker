import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logIfError } from '../../../../lib/log-errors'

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
  const existingRes = await supabase
    .from('referrals')
    .select('id')
    .eq('referred_user_id', user.id)
    .maybeSingle()
  logIfError('referral/capture existing check', existingRes)
  if (existingRes.data) return Response.json({ ok: true })

  const insertRes = await supabase.from('referrals').insert({
    referrer_account_id: ref,
    referred_user_id: user.id,
    status: 'pending',
    commission_rate: 0.08,
  })
  logIfError('referral/capture insert', insertRes)

  // Previously always returned {ok:true} even when the insert silently
  // failed (this is exactly how the referrals RLS gap -- migration 009 --
  // went unnoticed: the route claimed success on every single real capture
  // attempt regardless of whether a row was ever actually written).
  return Response.json({ ok: !insertRes.error, error: insertRes.error?.message })
}
