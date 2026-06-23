import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


const INACTIVE_DAYS = 30

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // List all users from auth, find those inactive for 30+ days
  const { data: authData, error: authError } = await service.auth.admin.listUsers({ perPage: 1000 })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const inactiveIds = (authData?.users || [])
    .filter(u => u.last_sign_in_at && u.last_sign_in_at < cutoff)
    .map(u => u.id)

  if (inactiveIds.length === 0) {
    return NextResponse.json({ ok: true, archived: 0 })
  }

  // Fetch their profiles to merge into hard_filters_json
  const { data: profiles } = await service
    .from('profiles')
    .select('user_id, hard_filters_json')
    .in('user_id', inactiveIds)

  if (!profiles?.length) return NextResponse.json({ ok: true, archived: 0 })

  let archived = 0
  for (const profile of profiles) {
    const existing = profile.hard_filters_json || {}
    if (existing.archived) continue // already archived
    const { error } = await service.from('profiles').update({
      hard_filters_json: {
        ...existing,
        archived: true,
        archivedAt: new Date().toISOString(),
      },
    }).eq('user_id', profile.user_id)
    if (!error) archived++
  }

  return NextResponse.json({ ok: true, archived, checked: inactiveIds.length })
}
