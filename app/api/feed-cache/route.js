import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json([], { status: 401 })

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data } = await service
    .from('jobs_cache')
    .select('*')
    .in('source', ['greenhouse', 'gov', 'adzuna'])
    .order('cached_at', { ascending: false })
    .limit(300)

  if (!data) return Response.json([])

  const jobs = data.map(row => ({
    id: row.id,
    company: row.company,
    roleTitle: row.role_title,
    link: row.link,
    salary: row.salary,
    location: row.location,
    source: row.source,
    foundAt: row.cached_at,
    adzunaAttributionRequired: row.adzuna_attribution_required,
    ...(row.raw_json || {}),
  }))

  return Response.json(jobs)
}
