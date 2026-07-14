import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { logIfError } from '../../../../lib/log-errors'

// GET — returns the full structured profile record + career_history + wishlists
// for the Memory Card and ai-context assembly.
export async function GET() {
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

  const [profileRes, historyRes, wishlistRes] = await Promise.all([
    service.from('profiles')
      .select('track, status, target_roles, seniority, industries, postcode, max_office_days, salary_floor, hard_filters_json')
      .eq('user_id', user.id)
      .single(),
    service.from('career_history')
      .select('id, role_title, company, start_date, end_date, achievements')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false }),
    service.from('wishlists')
      .select('id, company, careers_url')
      .eq('user_id', user.id),
  ])

  logIfError('profile/memory profiles', profileRes)
  logIfError('profile/memory career_history', historyRes)
  logIfError('profile/memory wishlists', wishlistRes)

  return Response.json({
    profile:       profileRes.data  || null,
    careerHistory: historyRes.data  || [],
    wishlists:     wishlistRes.data || [],
  })
}
