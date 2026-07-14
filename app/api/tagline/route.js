import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { logIfError } from '../../../lib/log-errors'

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// Public — returns the active tagline for the homepage
export async function GET() {
  const res = await service()
    .from('admin_taglines')
    .select('id, tagline_text')
    .eq('active', true)
    .single()
  logIfError('tagline GET', res)
  return NextResponse.json(res.data || null, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
  })
}

// Public — increment impressions or conversions
export async function POST(request) {
  const { id, field } = await request.json()
  if (!id) return NextResponse.json({ ok: false })
  const col = field === 'conversion' ? 'conversions' : 'impressions'
  const sb = service()
  const rowRes = await sb.from('admin_taglines').select(col).eq('id', id).single()
  logIfError('tagline POST select', rowRes)
  const row = rowRes.data
  if (!row) return NextResponse.json({ ok: false })
  const updateRes = await sb.from('admin_taglines').update({ [col]: (row[col] || 0) + 1 }).eq('id', id)
  logIfError('tagline POST update', updateRes)
  return NextResponse.json({ ok: true })
}
