import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { logIfError } from '../../../../lib/log-errors'

async function getAuth() {
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
  const user = await getAuth()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const res = await service.from('employer_profiles').select('*').eq('user_id', user.id).maybeSingle()
  logIfError('employer/profile GET', res)
  return Response.json({ profile: res.data || null })
}

export async function POST(req) {
  const user = await getAuth()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { company_name, company_size, sector, website_url } = await req.json()

  if (!company_name?.trim()) return Response.json({ error: 'company_name is required' }, { status: 400 })

  const userRowRes = await service.from('users').select('default_account_id').eq('id', user.id).single()
  logIfError('employer/profile users lookup', userRowRes)
  const userRow = userRowRes.data
  if (!userRow?.default_account_id) return Response.json({ error: userRowRes.error?.message || 'Account not found' }, { status: 400 })

  const existingRes = await service.from('employer_profiles').select('id').eq('user_id', user.id).maybeSingle()
  logIfError('employer/profile existing check', existingRes)
  const existing = existingRes.data

  if (existing) {
    const { data, error } = await service.from('employer_profiles')
      .update({ company_name: company_name.trim(), company_size, sector, website_url })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ profile: data })
  } else {
    const { data, error } = await service.from('employer_profiles')
      .insert({
        user_id: user.id,
        account_id: userRow.default_account_id,
        company_name: company_name.trim(),
        company_size,
        sector,
        website_url,
        billing_status: 'trial',
      })
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ profile: data })
  }
}
