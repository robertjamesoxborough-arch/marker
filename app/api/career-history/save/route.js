import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { logIfError } from '../../../../lib/log-errors'

// Simple CRUD for career_history, backing the Settings edit UI. Users must
// be able to see and fix what the parser got wrong -- this is a trust
// feature, not a nicety. Any row the user explicitly saves through here is
// marked source:'user' and confidence:'high', clearing whatever review flag
// the original AI parse carried, since the user has now looked at it.

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

export async function GET() {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const res = await service
    .from('career_history')
    .select('id, company, role_title, start_date, end_date, achievements, confidence, source')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })
  logIfError('career-history/save GET', res)

  // achievements is a real Postgres text[] column; the client edits it as a
  // single newline-per-bullet string in a textarea, so flatten it here to
  // keep the client-side contract simple. POST below converts it back.
  const roles = (res.data || []).map(r => ({ ...r, achievements: Array.isArray(r.achievements) ? r.achievements.join('\n') : (r.achievements || '') }))

  return Response.json({ roles })
}

// Body: { roles: [{ id?, company, role_title, start_date, end_date, achievements }] }
// Replaces the user's full career_history with the edited set -- simplest
// correct semantics for a "save my edits" list UI (add/remove/edit all in
// one save), avoiding per-row diffing logic.
export async function POST(request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

  let body = {}
  try { body = await request.json() } catch {}
  const roles = Array.isArray(body?.roles) ? body.roles : null
  if (!roles) return Response.json({ error: 'roles array required' }, { status: 400 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const delRes = await service.from('career_history').delete().eq('user_id', user.id)
  logIfError('career-history/save delete-before-replace', delRes)

  if (roles.length === 0) return Response.json({ roles: [] })

  const rows = roles.map(r => ({
    user_id: user.id,
    company: (r.company || '').trim() || 'Unknown',
    role_title: (r.role_title || '').trim() || 'Unknown',
    start_date: r.start_date || null,
    end_date: r.end_date || null,
    // Client sends a newline-per-bullet string; the column is a real
    // Postgres text[] array, so split it back before inserting.
    achievements: Array.isArray(r.achievements) ? r.achievements.filter(Boolean) : (r.achievements || '').split('\n').map(s => s.trim()).filter(Boolean),
    confidence: 'high',
    source: 'user',
  }))
  const insertRes = await service.from('career_history').insert(rows).select()
  logIfError('career-history/save insert', insertRes)
  if (insertRes.error) return Response.json({ error: insertRes.error.message }, { status: 500 })

  return Response.json({ roles: insertRes.data })
}
