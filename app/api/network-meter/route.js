import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const [rolesRes, employersRes, candidatesRes] = await Promise.all([
    service.from('employer_roles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('source_type', 'requite_managed'),
    service.from('employer_profiles')
      .select('id', { count: 'exact', head: true })
      .in('billing_status', ['trial', 'active']),
    service.from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .not('target_roles', 'is', null),
  ])

  return Response.json({
    roleCount: rolesRes.count || 0,
    employerCount: employersRes.count || 0,
    candidateCount: candidatesRes.count || 0,
  })
}
