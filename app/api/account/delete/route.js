import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Delete in order of FK dependencies
  await service.from('pipeline_items').delete().eq('user_id', user.id)
  await service.from('profiles').delete().eq('user_id', user.id)
  await service.from('account_members').delete().eq('user_id', user.id)
  await service.from('users').delete().eq('id', user.id)

  // Delete the auth user (requires service role)
  await service.auth.admin.deleteUser(user.id)

  return Response.json({ ok: true })
}
