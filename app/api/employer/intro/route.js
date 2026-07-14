import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendIntroRequest } from '../../../../lib/email'
import { logIfError } from '../../../../lib/log-errors'

export async function POST(req) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { matchId, message } = await req.json()
  if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })

  // Verify employer has a profile
  const epRes = await service
    .from('employer_profiles')
    .select('id, company_name')
    .eq('user_id', user.id)
    .maybeSingle()
  logIfError('employer/intro employer_profiles', epRes)
  const ep = epRes.data
  if (!ep) return Response.json({ error: epRes.error?.message || 'No employer profile' }, { status: epRes.error ? 500 : 403 })

  // Get the match
  const matchRes = await service
    .from('candidate_employer_matches')
    .select('id, user_id, employer_role_id, candidate_opted_in, employer_opted_in')
    .eq('id', matchId)
    .maybeSingle()
  logIfError('employer/intro candidate_employer_matches', matchRes)
  const match = matchRes.data
  if (!match) return Response.json({ error: matchRes.error?.message || 'Match not found' }, { status: matchRes.error ? 500 : 404 })

  // Verify employer owns the role for this match
  const roleRes = await service
    .from('employer_roles')
    .select('id, title')
    .eq('id', match.employer_role_id)
    .eq('employer_id', ep.id)
    .maybeSingle()
  logIfError('employer/intro employer_roles', roleRes)
  const role = roleRes.data
  if (!role) return Response.json({ error: roleRes.error?.message || 'Not authorised for this match' }, { status: roleRes.error ? 500 : 403 })

  // Idempotent: if a non-declined request already exists, return it
  const { data: existing } = await service
    .from('intro_requests')
    .select('id, status')
    .eq('match_id', matchId)
    .eq('requested_by', 'employer')
    .neq('status', 'declined')
    .maybeSingle()
  if (existing) {
    return Response.json({ alreadyRequested: true, status: existing.status, introRequestId: existing.id })
  }

  // Set employer_opted_in = true on the match
  await service
    .from('candidate_employer_matches')
    .update({ employer_opted_in: true })
    .eq('id', matchId)

  // Create intro_requests row
  const { data: introReq, error: irErr } = await service
    .from('intro_requests')
    .insert({
      match_id: matchId,
      requested_by: 'employer',
      status: 'pending',
      message: message || null,
    })
    .select('id')
    .single()
  if (irErr) return Response.json({ error: 'Failed to create intro request' }, { status: 500 })

  // Log intro_receipts: intro_sent
  await service.from('intro_receipts').insert({
    match_id: matchId,
    intro_request_id: introReq.id,
    event_type: 'intro_sent',
    meta_json: { requested_by: 'employer', role_title: role.title },
  })

  // Fire-and-forget: notify candidate
  ;(async () => {
    try {
      const { data: candidateUser } = await service.from('users').select('email').eq('id', match.user_id).maybeSingle()
      if (candidateUser?.email) await sendIntroRequest(candidateUser.email, role.title)
    } catch {}
  })()

  return Response.json({ success: true, introRequestId: introReq.id, status: 'pending' })
}
