import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Session O legal hardening, item 5: one boolean per ingest source, checked
// by every cron before it runs (lib/source-flags.js). If a provider
// complains, flip it off here -- no deploy needed.

const SOURCES = ['adzuna', 'gov', 'ats', 'contract', 'wishlist_scrape']

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

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET() {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const { data, error } = await service().from('admin_feature_flags').select('flag_key, enabled, notes').is('account_id', null).in('flag_key', SOURCES.map(s => `source_${s}`))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byKey = Object.fromEntries((data || []).map(r => [r.flag_key, r]))
  const flags = SOURCES.map(s => ({
    source: s,
    flag_key: `source_${s}`,
    enabled: byKey[`source_${s}`] ? byKey[`source_${s}`].enabled : true,
    notes: byKey[`source_${s}`]?.notes || '',
  }))
  return NextResponse.json({ flags })
}

// Body: { source, enabled }
export async function POST(request) {
  const cookieStore = await cookies()
  if (!await getAdminUser(cookieStore)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  const { source, enabled } = await request.json()
  if (!SOURCES.includes(source)) return NextResponse.json({ error: 'Unknown source' }, { status: 400 })

  // No unique constraint on flag_key in the real schema (confirmed live,
  // not assumed) -- a plain onConflict upsert 42P10s. Select-then-update-or-
  // insert instead.
  const sb = service()
  const flagKey = `source_${source}`
  const existing = await sb.from('admin_feature_flags').select('id').eq('flag_key', flagKey).is('account_id', null).maybeSingle()
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 })

  const result = existing.data
    ? await sb.from('admin_feature_flags').update({ enabled: !!enabled }).eq('id', existing.data.id)
    : await sb.from('admin_feature_flags').insert({ flag_key: flagKey, enabled: !!enabled, track: null, account_id: null })

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
