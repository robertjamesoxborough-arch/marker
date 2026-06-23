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

export async function POST(request) {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const userId = body.userId || null // optional — if provided, reset only that user

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  let query = service.from('profiles').update({ track: null })
  if (userId) {
    query = query.eq('user_id', userId)
  } else {
    query = query.not('user_id', 'is', null)
  }

  const { error } = await query.select('user_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    reset: userId ? 'single' : 'all',
    userId: userId || null,
  })
}
