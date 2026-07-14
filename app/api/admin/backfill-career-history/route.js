import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logIfError } from '../../../../lib/log-errors'
import { parseCareerHistoryText, saveCareerHistory } from '../../career-history/parse/route'
import { trackAiUsage } from '../../../../lib/ai-usage'
import { MODELS } from '../../../../lib/anthropic'

// Admin-triggered, one-off: backfill career_history for every existing user
// who has a CV (hard_filters_json.cvRaw) but zero career_history rows --
// i.e. every user who signed up before this feature existed. Not automatic
// and not run on every request; Rob triggers this once from the admin
// area after migration 010 is applied. Don't lose anything: cvRaw is never
// touched or deleted, only read from.

async function getAdminUser(cookieStore) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL || 'robertjamesoxborough@gmail.com'
  if (!user || user.email !== adminEmail) return null
  return user
}

export async function POST() {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No API key configured' }, { status: 500 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const usersRes = await service.from('profiles').select('user_id, hard_filters_json')
  logIfError('backfill-career-history profiles scan', usersRes)
  const profiles = usersRes.data || []

  const existingRes = await service.from('career_history').select('user_id')
  logIfError('backfill-career-history existing scan', existingRes)
  const alreadyHas = new Set((existingRes.data || []).map(r => r.user_id))

  const results = []
  for (const p of profiles) {
    const cvRaw = p.hard_filters_json?.cvRaw
    if (!cvRaw || cvRaw.trim().length < 50) { results.push({ user_id: p.user_id, skipped: 'no cvRaw' }); continue }
    if (alreadyHas.has(p.user_id)) { results.push({ user_id: p.user_id, skipped: 'already has career_history' }); continue }

    try {
      const { roles, overallConfidence, usage } = await parseCareerHistoryText(apiKey, cvRaw)
      if (usage) await trackAiUsage({ userId: p.user_id, model: MODELS.haiku, action: 'parse_career_history', usage })
      await saveCareerHistory(service, p.user_id, roles)
      results.push({ user_id: p.user_id, parsed: roles.length, overallConfidence })
    } catch (e) {
      results.push({ user_id: p.user_id, error: e.message })
    }
  }

  return NextResponse.json({ results, total: profiles.length })
}
