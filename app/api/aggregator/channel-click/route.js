import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { CHANNELS } from '../../../../lib/channel-urls'

// Job Aggregator "last checked" tracking (channel_checks, migration 012).
// Same auth pattern as app/api/profile/save/route.js: authenticate via the
// anon-key SSR client, then write with the service-role client so the
// client never talks to channel_checks directly (no RLS policy needed,
// only the table GRANT — see migration 012's comment on why that matters
// in this codebase specifically).

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// GET -> { indeed: '2026-09-10T08:00:00Z' | null, linkedin: ..., adzuna: ..., target_companies: ... }
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await service()
    .from('channel_checks')
    .select('channel, last_checked_at')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = Object.fromEntries(CHANNELS.map(c => [c, null]))
  for (const row of data || []) result[row.channel] = row.last_checked_at
  return NextResponse.json(result)
}

// POST { channel } -> marks that channel checked now. A real click-through
// and an explicit "dismiss the flag" both call this the same way — both
// mean "I've dealt with this channel for the cadence window", the row
// doesn't distinguish which.
export async function POST(request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channel } = await request.json()
  if (!CHANNELS.includes(channel)) {
    return NextResponse.json({ error: `Unknown channel: ${channel}` }, { status: 400 })
  }

  const { error } = await service()
    .from('channel_checks')
    .upsert({ user_id: user.id, channel, last_checked_at: new Date().toISOString() }, { onConflict: 'user_id,channel' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
