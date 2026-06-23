import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { sendWelcome } from '../../../../lib/email'

export async function POST(request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = await request.json()

  // All writes use service role — bypasses RLS
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Read existing hard_filters_json so we merge rather than overwrite
  const { data: existing } = await service
    .from('profiles')
    .select('hard_filters_json')
    .eq('user_id', user.id)
    .single()
  const hfj = existing?.hard_filters_json || {}

  // Build merged hard_filters_json — only override keys explicitly passed
  const merged = {
    ...hfj,
    ...(p.excludeSalesQuotas !== undefined  ? { excludeSalesQuotas: p.excludeSalesQuotas } : {}),
    ...(p.benefits           !== undefined  ? { benefits: p.benefits }                     : {}),
    ...(p.surfaces           !== undefined  ? { surfaces: p.surfaces }                     : {}),
    ...(p.seniorities        !== undefined  ? { seniorities: p.seniorities }               : {}),
    ...(p.radiusMiles        !== undefined  ? { radiusMiles: p.radiusMiles }               : {}),
    ...(p.tracks             !== undefined  ? { tracks: p.tracks }                         : {}),
    ...(p.cvRaw              !== undefined  ? { cvRaw: p.cvRaw }                           : {}),
    ...(p.cvKeywords         !== undefined  ? { cvKeywords: p.cvKeywords }                 : {}),
    ...(p.refCode                           ? { refCode: p.refCode }                       : {}),
    // Profile enrichment fields
    ...(p.field              !== undefined  ? { field: p.field }                           : {}),
    ...(p.yearsExperience    !== undefined  ? { yearsExperience: p.yearsExperience }       : {}),
    ...(p.careerSummary      !== undefined  ? { careerSummary: p.careerSummary }           : {}),
    ...(p.wlbPriority        !== undefined  ? { wlbPriority: p.wlbPriority }               : {}),
    // Feature flags (Section C)
    ...(p.wantsGov           !== undefined  ? { wantsGov: p.wantsGov }                     : {}),
    ...(p.openToContract     !== undefined  ? { openToContract: p.openToContract }         : {}),
    ...(p.wantsEasyLife      !== undefined  ? { wantsEasyLife: p.wantsEasyLife }           : {}),
    ...(p.wantsCvGen         !== undefined  ? { wantsCvGen: p.wantsCvGen }                 : {}),
    ...(p.wantsInterviewPrep !== undefined  ? { wantsInterviewPrep: p.wantsInterviewPrep } : {}),
    // Contract details (Section D)
    ...(p.contractTypes      !== undefined  ? { contractTypes: p.contractTypes }           : {}),
    ...(p.ir35Willing        !== undefined  ? { ir35Willing: p.ir35Willing }               : {}),
    ...(p.contractGoal       !== undefined  ? { contractGoal: p.contractGoal }             : {}),
    ...(p.contractorField    !== undefined  ? { contractorField: p.contractorField }       : {}),
  }

  const { error } = await service.from('profiles').upsert({
    user_id: user.id,
    track: p.track || null,
    status: p.status || null,
    target_roles: p.targetRoles || [],
    seniority: p.seniorities?.[0] || null,
    industries: p.industries || [],
    postcode: p.postcode || null,
    max_office_days: p.maxOfficeDays != null ? parseFloat(p.maxOfficeDays) : null,
    salary_floor: p.salaryFloor ? parseInt(p.salaryFloor) * 1000 : null,
    hard_filters_json: merged,
    region: 'uk',
  }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({
    error: error.message, code: error.code, details: error.details, hint: error.hint,
  }, { status: 500 })

  if (p.isFirstSave) {
    after(async () => {
      try { await sendWelcome(user.email, p.name || null) } catch {}
    })
  }

  return NextResponse.json({ ok: true })
}
