import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await request.json().catch(() => ({}))
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: profile } = await service
    .from('profiles')
    .select('hard_filters_json')
    .eq('user_id', user.id)
    .single()

  const existing  = profile?.hard_filters_json?.dismissed || []
  const dismissed = [...new Set([...existing, jobId])]

  await service
    .from('profiles')
    .update({ hard_filters_json: { ...(profile?.hard_filters_json || {}), dismissed } })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
