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
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const [profileResult, pipelineResult, userResult] = await Promise.all([
    service.from('profiles').select('*').eq('user_id', user.id).single(),
    service.from('pipeline_items').select('*').eq('user_id', user.id),
    service.from('users').select('email, created_at, trial_ends_at').eq('id', user.id).single(),
  ])

  const profile = profileResult.data || {}
  const pipeline = pipelineResult.data || []
  const userData = userResult.data || {}

  // Strip internal columns, keep user-meaningful data
  const { hard_filters_json, ...profilePublic } = profile
  const cvRaw = hard_filters_json?.cvRaw || null

  const exportPayload = {
    exported_at: new Date().toISOString(),
    account: {
      email: user.email,
      created_at: userData.created_at,
      trial_ends_at: userData.trial_ends_at,
    },
    profile: {
      ...profilePublic,
      cv_text: cvRaw,
      work_preferences: {
        max_office_days: profile.max_office_days,
        salary_floor: profile.salary_floor,
        postcode: profile.postcode,
        exclude_sales_quotas: hard_filters_json?.excludeSalesQuotas || false,
      },
    },
    pipeline: pipeline.map(row => ({
      id: row.id,
      company: row.custom_company,
      role: row.custom_role,
      status: row.status,
      score: row.score,
      signal: row.signal,
      office_days: row.office_days,
      job_link: row.job_link,
      notes: row.notes,
      added_at: row.applied_at,
      score_breakdown: row.score_breakdown_json,
    })),
  }

  return new Response(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="marker-data-export-${new Date().toISOString().split('T')[0]}.json"`,
    },
  })
}
