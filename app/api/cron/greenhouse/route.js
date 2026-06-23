import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


// Companies using Greenhouse ATS with UK presence
const GREENHOUSE_BOARDS = [
  { company: 'Monzo',          token: 'monzo' },
  { company: 'GoCardless',     token: 'gocardless' },
  { company: 'Deliveroo',      token: 'deliveroo' },
  { company: 'Skyscanner',     token: 'skyscanner' },
  { company: 'Octopus Energy', token: 'octopusenergy' },
  { company: 'Farfetch',       token: 'farfetch' },
  { company: 'Bumble',         token: 'bumble' },
  { company: 'Wise',           token: 'wise' },
  { company: 'Checkout.com',   token: 'checkout' },
  { company: 'Starling Bank',  token: 'starlingbank' },
  { company: 'SumUp',          token: 'sumup' },
  { company: 'Gousto',         token: 'gousto' },
  { company: 'Wayve',          token: 'wayve' },
  { company: 'OakNorth',       token: 'oaknorth' },
  { company: 'Zopa',           token: 'zopa' },
  { company: 'Marshmallow',    token: 'marshmallow' },
  { company: 'Curve',          token: 'curve' },
  { company: 'Casumo',         token: 'casumo' },
  { company: 'Paddle',         token: 'paddle' },
  { company: 'Phoebe',         token: 'phoebe' },
]

const UK_PATTERN = /\b(london|uk|england|scotland|wales|remote|hybrid|manchester|edinburgh|bristol|birmingham|leeds|cardiff|belfast|sheffield|cambridge|oxford|brighton|surrey|kent|guildford|reading|milton keynes)\b/i
const NON_UK_PATTERN = /\b(united states|canada|australia|germany|france|spain|netherlands|india|singapore|new york|san francisco|berlin|amsterdam|paris|toronto|sydney|bangalore|dublin(?! road)|warsaw|prague|bucharest)\b/i

function isUkRole(location) {
  if (!location || location.trim() === '') return true
  if (NON_UK_PATTERN.test(location)) return false
  return UK_PATTERN.test(location)
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

  const now = new Date().toISOString()
  const rows = []
  const errors = []

  await Promise.allSettled(
    GREENHOUSE_BOARDS.map(async ({ company, token }) => {
      try {
        const res = await fetch(
          `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
          { headers: { 'User-Agent': 'Marker/1.0' }, signal: AbortSignal.timeout(10000) }
        )
        if (!res.ok) { errors.push(`${company}: HTTP ${res.status}`); return }
        const data = await res.json()
        const jobs = Array.isArray(data.jobs) ? data.jobs : []

        jobs.forEach(job => {
          const location = job.location?.name || ''
          if (!isUkRole(location)) return
          rows.push({
            id: `greenhouse-${job.id}`,
            company,
            role_title: job.title,
            link: job.absolute_url,
            salary: null,
            location,
            source: 'greenhouse',
            cached_at: now,
            raw_json: {
              departments: (job.departments || []).map(d => d.name),
              offices: (job.offices || []).map(o => o.name),
            },
            adzuna_attribution_required: false,
          })
        })
      } catch (e) {
        errors.push(`${company}: ${e.message}`)
      }
    })
  )

  if (rows.length > 0) {
    const { error } = await supabase
      .from('jobs_cache')
      .upsert(rows, { onConflict: 'id' })
    if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
  }

  // Prune stale Greenhouse rows older than 7 days
  await supabase
    .from('jobs_cache')
    .delete()
    .eq('source', 'greenhouse')
    .lt('cached_at', new Date(Date.now() - 7 * 86400000).toISOString())

  return NextResponse.json({ ok: true, inserted: rows.length, companies: GREENHOUSE_BOARDS.length, errors })
}
