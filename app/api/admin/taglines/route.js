import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logIfError } from '../../../../lib/log-errors'

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

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET() {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const { data, error } = await service().from('admin_taglines').select('*').order('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH body: { id } — activates this tagline, deactivates all others
export async function PATCH(request) {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const { id } = await request.json()
  const sb = service()

  const deactivateRes = await sb.from('admin_taglines').update({ active: false }).neq('id', id)
  logIfError('admin/taglines deactivate-others', deactivateRes)
  const { data, error } = await sb.from('admin_taglines').update({ active: true }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST body: { id } — increment impressions
export async function POST(request) {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const { id, field } = await request.json()
  const col = field === 'conversion' ? 'conversions' : 'impressions'
  const sb = service()
  const rowRes = await sb.from('admin_taglines').select(col).eq('id', id).single()
  logIfError('admin/taglines select-count', rowRes)
  const row = rowRes.data
  if (!row) return NextResponse.json({ error: rowRes.error?.message || 'Not found' }, { status: 404 })
  const { data, error } = await sb.from('admin_taglines').update({ [col]: (row[col] || 0) + 1 }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
