import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Interview stage notes (interview_stage_notes, migration 014) — Stage 67.
// Append-only by design: a note logged after one interview stage must
// survive every later save of the same pipeline_items row untouched, so it
// lives here rather than inside pipeline_items.score_breakdown_json (which
// gets wholesale-upserted on every job save — see lib/db.js's jobToRow — a
// real lesson from the personal tracker, where exactly that pattern
// silently clobbered notes). Same auth pattern as
// app/api/aggregator/channel-click/route.js: authenticate via the anon-key
// SSR client, read/write with the service-role client so the browser never
// talks to this table directly — no RLS policy needed, only the table
// GRANT, included in migration 014 from the start.
//
// The GRANT is SELECT + INSERT only (no UPDATE/DELETE) — enforced at the
// database level, not just by this route's own code, so a note can never
// be edited or removed after the fact by any path through this app.

const VALID_STAGES = ['screening', 'hiring_manager', 'panel', 'final', 'task', 'ceo']

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

// GET ?jobId=... -> { notes: [{ id, stage, note, createdAt }, ...] } oldest first
export async function GET(request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobId = new URL(request.url).searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })

  const { data, error } = await service()
    .from('interview_stage_notes')
    .select('id, stage, note, created_at')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    notes: (data || []).map(r => ({ id: r.id, stage: r.stage, note: r.note, createdAt: r.created_at })),
  })
}

// POST { jobId, stage, note } -> appends one note. Never an update, never
// a delete — a correction is a new note, not an edit to an old one, so the
// history stays honest.
export async function POST(request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId, stage, note } = await request.json()
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  if (!VALID_STAGES.includes(stage)) return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 })
  const trimmed = (note || '').trim()
  if (!trimmed) return NextResponse.json({ error: 'Note text is required' }, { status: 400 })

  const { data, error } = await service()
    .from('interview_stage_notes')
    .insert({ user_id: user.id, job_id: jobId, stage, note: trimmed })
    .select('id, stage, note, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: { id: data.id, stage: data.stage, note: data.note, createdAt: data.created_at } })
}
