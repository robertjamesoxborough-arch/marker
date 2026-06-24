import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { scoreMatch } from '../../../../lib/match-engine'

// Infer a readable city name from UK postcode area
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
  const { data: ep } = await service.from('employer_profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (!ep) return Response.json({ error: 'No employer profile' }, { status: 403 })

  const { data: role } = await service
    .from('employer_roles')
    .select('*')
    .eq('id', roleId)
    .eq('employer_id', ep.id)
    .maybeSingle()
  if (!role) return Response.json({ error: 'Role not found' }, { status: 404 })

  // Fetch candidate pool — those who have completed enough of their profile
  const { data: candidates } = await service
    .from('profiles')
    .select('user_id, target_roles, seniority, industries, postcode, max_office_days, salary_floor, track, hard_filters_json')
    .not('target_roles', 'is', null)
    .not('seniority', 'is', null)
    .limit(200)

  if (!candidates?.length) return Response.json({ shortlist: [], totalCandidates: 0 })

  // Convert employer role → "job" shape for scoreMatch
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

  // Score every candidate against the role
  const scored = candidates
    .map(profile => ({ profile, ...scoreMatch(profile, roleAsJob) }))
    .sort((a, b) => b.score - a.score)

  const top25 = scored.slice(0, 25)

  // Upsert matches into DB for later opt-in / intro flow
  await service.from('candidate_employer_matches').upsert(
    top25.map(c => ({
      user_id: c.profile.user_id,
      employer_role_id: roleId,
      match_score: c.score,
      match_json: { dimensions: c.dimensions },
    })),
    { onConflict: 'user_id,employer_role_id' }
  )

  const shortlist = top25.map((c, idx) => anonymise(c.profile, c, idx))

  return Response.json({
    shortlist,
    totalCandidates: candidates.length,
    roleTitle: role.title,
  })
}
