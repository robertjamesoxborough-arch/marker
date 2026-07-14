import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { scoreMatch } from '../../../../lib/match-engine'
import { logIfError } from '../../../../lib/log-errors'

function inferLocationArea(postcode) {
  if (!postcode) return 'Location undisclosed'
  const area = postcode.trim().toUpperCase().replace(/\s.*$/, '').replace(/\d+.*$/, '')
  const LONDON = ['SW', 'SE', 'EC', 'WC', 'W', 'N', 'NW', 'E', 'EN', 'HA', 'TW', 'KT', 'SM', 'CR', 'BR', 'DA', 'RM', 'IG', 'WD']
  if (LONDON.some(a => area === a || area.startsWith(a))) return 'London'
  const MAP = { M: 'Manchester', B: 'Birmingham', LS: 'Leeds', BS: 'Bristol', L: 'Liverpool', G: 'Glasgow', EH: 'Edinburgh', CF: 'Cardiff', S: 'Sheffield', NG: 'Nottingham', NE: 'Newcastle', OX: 'Oxford', CB: 'Cambridge' }
  return MAP[area] || (area ? `${area} area` : 'UK')
}

function anonymise(profile, scored, idx) {
  return {
    candidateRef: `C${String(idx + 1).padStart(2, '0')}`,
    score: scored.score,
    dimensions: scored.dimensions,
    seniority: profile.seniority || 'Not specified',
    targetRoles: profile.target_roles
      ? (Array.isArray(profile.target_roles) ? profile.target_roles.slice(0, 3) : [profile.target_roles])
      : [],
    industries: Array.isArray(profile.industries) ? profile.industries.slice(0, 3) : [],
    locationArea: inferLocationArea(profile.postcode),
    maxOfficeDays: profile.max_office_days ?? null,
    track: profile.track || 'standard',
    salaryFloor: profile.salary_floor ? `£${Math.round(profile.salary_floor / 1000)}k+` : null,
  }
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

  const { roleId } = await req.json()
  if (!roleId) return Response.json({ error: 'roleId required' }, { status: 400 })

  // Verify employer owns this role
  const epRes = await service.from('employer_profiles').select('id').eq('user_id', user.id).maybeSingle()
  logIfError('employer/shortlist employer_profiles', epRes)
  const ep = epRes.data
  if (!ep) return Response.json({ error: epRes.error?.message || 'No employer profile' }, { status: epRes.error ? 500 : 403 })

  const roleRes = await service
    .from('employer_roles')
    .select('*')
    .eq('id', roleId)
    .eq('employer_id', ep.id)
    .maybeSingle()
  logIfError('employer/shortlist employer_roles', roleRes)
  const role = roleRes.data
  if (!role) return Response.json({ error: roleRes.error?.message || 'Role not found' }, { status: roleRes.error ? 500 : 404 })

  // Fetch candidate pool
  const candidatesRes = await service
    .from('profiles')
    .select('user_id, target_roles, seniority, industries, postcode, max_office_days, salary_floor, track, hard_filters_json')
    .not('target_roles', 'is', null)
    .not('seniority', 'is', null)
    .limit(200)
  logIfError('employer/shortlist profiles', candidatesRes)
  const candidates = candidatesRes.data

  if (!candidates?.length) return Response.json({ shortlist: [], totalCandidates: 0 })

  // Convert employer role → job format for scoreMatch
  const salaryStr = role.salary_min
    ? `£${role.salary_min}k${role.salary_max ? ` - £${role.salary_max}k` : '+'}`
    : ''
  const roleAsJob = {
    role_title: role.title,
    company: '',
    location: role.location || '',
    salary: salaryStr,
    freshness: 'Fresh',
    raw_json: { description: role.description || '', location: role.location || '' },
    cached_at: new Date().toISOString(),
  }

  // Score every candidate
  const scored = candidates
    .map(profile => ({ profile, ...scoreMatch(profile, roleAsJob) }))
    .sort((a, b) => b.score - a.score)

  const top25 = scored.slice(0, 25)

  // Upsert matches
  await service.from('candidate_employer_matches').upsert(
    top25.map(c => ({
      user_id: c.profile.user_id,
      employer_role_id: roleId,
      match_score: c.score,
      match_json: { dimensions: c.dimensions },
    })),
    { onConflict: 'user_id,employer_role_id' }
  )

  // ── Fetch match IDs + opt-in status post-upsert ──
  const { data: matchRows } = await service
    .from('candidate_employer_matches')
    .select('id, user_id, candidate_opted_in, employer_opted_in')
    .eq('employer_role_id', roleId)
    .in('user_id', top25.map(c => c.profile.user_id))

  const matchMap = Object.fromEntries((matchRows || []).map(m => [m.user_id, m]))

  // Fetch intro statuses for these matches
  const matchIds = (matchRows || []).map(m => m.id)
  const introMap = {}
  const introRespondedMap = {}
  if (matchIds.length > 0) {
    const { data: introReqs } = await service
      .from('intro_requests')
      .select('match_id, status, responded_at')
      .in('match_id', matchIds)
      .order('requested_at', { ascending: false })
    for (const req of introReqs || []) {
      if (!introMap[req.match_id]) {
        introMap[req.match_id] = req.status
        introRespondedMap[req.match_id] = req.responded_at
      }
    }
  }

  // ── PII reveal: candidate email only after BOTH sides opt in (G1 invariant) ──
  const mutualUserIds = (matchRows || [])
    .filter(m => m.candidate_opted_in && m.employer_opted_in)
    .map(m => m.user_id)
  const emailMap = {}
  if (mutualUserIds.length > 0) {
    const { data: userRows } = await service
      .from('users')
      .select('id, email')
      .in('id', mutualUserIds)
    for (const u of userRows || []) emailMap[u.id] = u.email
  }

  // Build enriched shortlist — anonymised by default, PII added only on mutual
  const shortlist = top25.map((c, idx) => {
    const match = matchMap[c.profile.user_id]
    const introStatus = match ? (introMap[match.id] || 'none') : 'none'
    const isMutual = !!(match?.candidate_opted_in && match?.employer_opted_in)
    const base = anonymise(c.profile, c, idx)
    return {
      ...base,
      matchId: match?.id || null,
      introStatus,
      introRespondedAt: match ? (introRespondedMap[match.id] || null) : null,
      ...(isMutual && emailMap[c.profile.user_id]
        ? { candidateEmail: emailMap[c.profile.user_id] }
        : {}),
    }
  })

  return Response.json({
    shortlist,
    totalCandidates: candidates.length,
    roleTitle: role.title,
  })
}
