import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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

  const { data: ep } = await service.from('employer_profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (!ep) return Response.json({ roles: [] })

  const { data: roles } = await service
    .from('employer_roles')
    .select('*')
    .eq('employer_id', ep.id)
    .order('created_at', { ascending: false })

  return Response.json({ roles: roles || [] })
}

export async function POST(req) {
  const user = await getAuth()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { title, description, location, salary_min, salary_max } = await req.json()
  if (!title?.trim()) return Response.json({ error: 'title is required' }, { status: 400 })

  const { data: ep } = await service.from('employer_profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (!ep) return Response.json({ error: 'Employer profile not found. Create one first.' }, { status: 400 })

  const { data: role, error } = await service
    .from('employer_roles')
    .insert({
      employer_id: ep.id,
      title: title.trim(),
      description: description?.trim() || null,
      location: location?.trim() || null,
      salary_min: salary_min ? parseInt(salary_min) : null,
      salary_max: salary_max ? parseInt(salary_max) : null,
      source_type: 'requite_managed',  // G1 invariant — every role through this API is managed
      status: 'active',
      freshness: 'Fresh',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ role })
}
