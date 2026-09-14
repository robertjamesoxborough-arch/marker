import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

// GET -> the user's structured dismissed_jobs, for lib/job-match.js to
// compare a brought-in/feed job against ("you dismissed this before").
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await service()
    .from('dismissed_jobs')
    .select('id, external_id, company, role_title, location, dismissed_at')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    records: (data || []).map(r => ({
      id: r.id, externalId: r.external_id, company: r.company, roleTitle: r.role_title,
      location: r.location, dismissedAt: r.dismissed_at,
    })),
  })
}

// POST { jobId, company?, roleTitle?, location?, externalId? } — jobId is
// the URL, kept exactly as before (still the key the feed's dismissed-
// filter Set reads, app/app/page.js). company/roleTitle/location/externalId
// are new and optional: when the caller has them, this ALSO writes a
// structured row into dismissed_jobs (Stage 58) so a future duplicate check
// can compare on more than a URL that may have already changed or expired.
// Dual-write, not a replacement — the existing array is untouched.
export async function POST(request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId, company, roleTitle, location, externalId } = await request.json().catch(() => ({}))
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  const svc = service()

  const { data: profile } = await svc
    .from('profiles')
    .select('hard_filters_json')
    .eq('user_id', user.id)
    .single()

  const existing  = profile?.hard_filters_json?.dismissed || []
  const dismissed = [...new Set([...existing, jobId])]

  await svc
    .from('profiles')
    .update({ hard_filters_json: { ...(profile?.hard_filters_json || {}), dismissed } })
    .eq('user_id', user.id)

  if (company || roleTitle) {
    await svc.from('dismissed_jobs').insert({
      user_id: user.id,
      external_id: externalId || null,
      company: company || null,
      role_title: roleTitle || null,
      location: location || null,
      job_link: jobId,
    })
  }

  return NextResponse.json({ ok: true })
}
