import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Deliberately separate from /api/profile/save, which always re-derives every
// top-level profile column (target_roles, seniority, salary_floor, etc.) from
// its full payload -- calling it with just {weeklyPreference} would silently
// null out the rest of the user's profile. This route only ever touches
// hard_filters_json.weeklyPreference, read-merge-write, nothing else.
const MAX_LEN = 300

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ weeklyPreference: '' })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data } = await service.from('profiles').select('hard_filters_json').eq('user_id', user.id).single()
  return NextResponse.json({ weeklyPreference: data?.hard_filters_json?.weeklyPreference || '' })
}

export async function POST(req) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const weeklyPreference = String(body?.weeklyPreference || '').trim().slice(0, MAX_LEN)

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: existing } = await service.from('profiles').select('hard_filters_json').eq('user_id', user.id).single()
  const hfj = existing?.hard_filters_json || {}

  const { error } = await service
    .from('profiles')
    .update({ hard_filters_json: { ...hfj, weeklyPreference } })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, weeklyPreference })
}
