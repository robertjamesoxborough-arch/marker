import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendTrialEnding, sendTrialExpired } from '../../../../lib/email'

export async function GET(request) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date()
  const in1Day = new Date(now.getTime() + 1  * 86400000).toISOString().slice(0, 10)
  const in3Day = new Date(now.getTime() + 3  * 86400000).toISOString().slice(0, 10)
  const today  = now.toISOString().slice(0, 10)

  const { data: authData } = await service.auth.admin.listUsers({ perPage: 1000 })
  const authMap = {}
  ;(authData?.users || []).forEach(u => { authMap[u.id] = u.email })

  const { data: users } = await service
    .from('users')
    .select('id, trial_ends_at')
    .not('trial_ends_at', 'is', null)

  const { data: profiles } = await service
    .from('profiles')
    .select('user_id, name')

  const nameMap = {}
  ;(profiles || []).forEach(p => { nameMap[p.user_id] = p.name })

  let sent3day = 0, sent1day = 0, sentExpired = 0, errors = 0

  for (const u of (users || [])) {
    const endsDate = u.trial_ends_at?.slice(0, 10)
    const email = authMap[u.id]
    const name = nameMap[u.id] || null
    if (!email || !endsDate) continue

    try {
      if (endsDate === in3Day) {
        await sendTrialEnding(email, name, 3)
        sent3day++
      } else if (endsDate === in1Day) {
        await sendTrialEnding(email, name, 1)
        sent1day++
      } else if (endsDate === today) {
        await sendTrialExpired(email, name)
        sentExpired++
      }
    } catch {
      errors++
    }
  }

  return NextResponse.json({ ok: true, sent3day, sent1day, sentExpired, errors })
}
