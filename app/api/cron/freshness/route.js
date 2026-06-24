import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { computeFreshnessState } from '../../../../lib/freshness'

const CHUNK = 500

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function GET(request) {
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const now = new Date()
  const errors = []

  // ── jobs_cache ────────────────────────────────────────────────────────────
  const { data: jobRows, error: jobFetchErr } = await supabase
    .from('jobs_cache')
    .select('id, last_verified_at, freshness')

  if (jobFetchErr) {
    return NextResponse.json({ error: jobFetchErr.message }, { status: 500 })
  }

  const jobUpdates = (jobRows || [])
    .map(row => {
      const computed = computeFreshnessState(row.last_verified_at, now)
      return computed !== row.freshness ? { id: row.id, freshness: computed } : null
    })
    .filter(Boolean)

  let jobsUpdated = 0
  for (const batch of chunk(jobUpdates, CHUNK)) {
    const { error } = await supabase
      .from('jobs_cache')
      .upsert(batch, { onConflict: 'id' })
    if (error) errors.push(`jobs_cache: ${error.message}`)
    else jobsUpdated += batch.length
  }

  // ── employer_roles ─────────────────────────────────────────────────────────
  const { data: roleRows, error: roleFetchErr } = await supabase
    .from('employer_roles')
    .select('id, last_verified_at, freshness')

  if (roleFetchErr) errors.push(`employer_roles fetch: ${roleFetchErr.message}`)

  const roleUpdates = (roleRows || [])
    .map(row => {
      const computed = computeFreshnessState(row.last_verified_at, now)
      return computed !== row.freshness ? { id: row.id, freshness: computed } : null
    })
    .filter(Boolean)

  let rolesUpdated = 0
  for (const batch of chunk(roleUpdates, CHUNK)) {
    const { error } = await supabase
      .from('employer_roles')
      .upsert(batch, { onConflict: 'id' })
    if (error) errors.push(`employer_roles: ${error.message}`)
    else rolesUpdated += batch.length
  }

  return NextResponse.json({
    ok: true,
    jobsScanned: (jobRows || []).length,
    jobsUpdated,
    rolesScanned: (roleRows || []).length,
    rolesUpdated,
    errors,
  })
}
