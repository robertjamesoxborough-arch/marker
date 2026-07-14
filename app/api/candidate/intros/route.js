import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendIntroResponse } from '../../../../lib/email'
import { logIfError } from '../../../../lib/log-errors'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Get all of this candidate's matches
  const matchesRes = await service
    .from('candidate_employer_matches')
    .select('id, employer_role_id, candidate_opted_in, employer_opted_in, match_score')
    .eq('user_id', user.id)
  logIfError('candidate/intros matches', matchesRes)
  const matches = matchesRes.data

  if (!matches?.length) return Response.json({ intros: [] })

  const matchIds = matches.map(m => m.id)

  // Get intro requests for these matches
  const requestsRes = await service
    .from('intro_requests')
    .select('id, match_id, requested_by, status, message, requested_at, responded_at')
    .in('match_id', matchIds)
    .order('requested_at', { ascending: false })
  logIfError('candidate/intros intro_requests', requestsRes)
  const requests = requestsRes.data

  if (!requests?.length) return Response.json({ intros: [] })

  // Get roles for context
  const roleIds = [...new Set(matches.map(m => m.employer_role_id))]
  const rolesRes = await service
    .from('employer_roles')
    .select('id, title, location, salary_min, salary_max, employer_id')
    .in('id', roleIds)
  logIfError('candidate/intros employer_roles', rolesRes)
  const roles = rolesRes.data

  // Get employer company names — ONLY for matches where BOTH sides have opted in (G1 invariant)
  const mutualMatches = matches.filter(m => m.candidate_opted_in && m.employer_opted_in)
  const mutualEmployerIds = [...new Set(
    mutualMatches
      .map(m => (roles || []).find(r => r.id === m.employer_role_id)?.employer_id)
      .filter(Boolean)
  )]
  const { data: employers } = mutualEmployerIds.length
    ? await service.from('employer_profiles').select('id, company_name, user_id').in('id', mutualEmployerIds)
    : { data: [] }

  // Fetch employer contact emails for mutual matches (G1: only exposed when isMutual)
  const employerUserIds = (employers || []).map(e => e.user_id).filter(Boolean)
  const { data: employerUsers } = employerUserIds.length
    ? await service.from('users').select('id, email').in('id', employerUserIds)
    : { data: [] }

  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]))
  const roleMap = Object.fromEntries((roles || []).map(r => [r.id, r]))
  const employerMap = Object.fromEntries((employers || []).map(e => [e.id, e]))
  const employerUserMap = Object.fromEntries((employerUsers || []).map(u => [u.id, u]))
  const mutualMatchIds = new Set(mutualMatches.map(m => m.id))

  const intros = requests.map(req => {
    const match = matchMap[req.match_id]
    const role = match ? roleMap[match.employer_role_id] : null
    const isMutual = mutualMatchIds.has(req.match_id)
    // Company name only revealed after BOTH sides have opted in
    const employer = isMutual && role ? employerMap[role.employer_id] : null

    return {
      requestId: req.id,
      matchId: req.match_id,
      status: req.status,
      requestedAt: req.requested_at,
      respondedAt: req.responded_at,
      // Role info — shown even pre-mutual (no company name until mutual)
      roleTitle: role?.title || 'Role',
      roleLocation: role?.location || null,
      roleSalary: role?.salary_min
        ? `£${role.salary_min}k${role.salary_max ? `–£${role.salary_max}k` : '+'}`
        : null,
      matchScore: match?.match_score ?? null,
      // Company name + employer contact only revealed after BOTH sides have opted in (G1)
      companyName: employer?.company_name || null,
      employerEmail: employer ? (employerUserMap[employer.user_id]?.email || null) : null,
      isMutual,
    }
  })

  return Response.json({ intros })
}

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

  const { requestId, action } = await req.json()
  if (!requestId || !['accept', 'decline'].includes(action)) {
    return Response.json({ error: 'requestId and action (accept|decline) required' }, { status: 400 })
  }

  // Get the intro request
  const introReqRes = await service
    .from('intro_requests')
    .select('id, match_id, status')
    .eq('id', requestId)
    .maybeSingle()
  logIfError('candidate/intros introReq lookup', introReqRes)
  const introReq = introReqRes.data
  if (!introReq) return Response.json({ error: introReqRes.error?.message || 'Request not found' }, { status: introReqRes.error ? 500 : 404 })

  // Verify this match belongs to the authenticated candidate (G1 invariant — auth check)
  const matchRes = await service
    .from('candidate_employer_matches')
    .select('id, user_id, employer_role_id, employer_opted_in')
    .eq('id', introReq.match_id)
    .eq('user_id', user.id)
    .maybeSingle()
  logIfError('candidate/intros match auth-check', matchRes)
  const match = matchRes.data
  if (!match) return Response.json({ error: matchRes.error?.message || 'Not authorised' }, { status: matchRes.error ? 500 : 403 })

  if (introReq.status !== 'pending') {
    return Response.json({ error: 'Already responded', status: introReq.status }, { status: 409 })
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined'
  const eventType = action === 'accept' ? 'intro_accepted' : 'intro_declined'
  const now = new Date().toISOString()

  // Update intro_request
  await service
    .from('intro_requests')
    .update({ status: newStatus, responded_at: now })
    .eq('id', requestId)

  // If accepting: set candidate_opted_in = true on the match
  // employer_opted_in is already true (they set it when requesting)
  let isMutual = false
  if (action === 'accept') {
    await service
      .from('candidate_employer_matches')
      .update({ candidate_opted_in: true })
      .eq('id', match.id)
    isMutual = match.employer_opted_in // both now true → mutual
  }

  // Log intro_receipts — immutable timestamped record (G1 flagship)
  await service.from('intro_receipts').insert({
    match_id: match.id,
    intro_request_id: requestId,
    event_type: eventType,
    meta_json: { responded_by: 'candidate', mutual: isMutual },
  })

  // Fire-and-forget: notify employer of accept/decline
  ;(async () => {
    try {
      const { data: role } = await service.from('employer_roles').select('title, employer_id').eq('id', match.employer_role_id).maybeSingle()
      if (!role) return
      const { data: ep } = await service.from('employer_profiles').select('user_id').eq('id', role.employer_id).maybeSingle()
      if (!ep) return
      const { data: empUser } = await service.from('users').select('email').eq('id', ep.user_id).maybeSingle()
      if (empUser?.email) await sendIntroResponse(empUser.email, role.title, action)
    } catch {}
  })()

  return Response.json({ success: true, status: newStatus, mutual: isMutual })
}
