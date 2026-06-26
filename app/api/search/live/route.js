import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { MODELS } from '../../../../lib/anthropic'
import { STYLE_RULES } from '../../../../lib/brand'


const TRACK_QUERIES = {
  standard:       ['head of partnerships', 'director partnerships', 'senior partnerships manager', 'head of growth', 'VP marketing', 'director digital marketing', 'partnerships director'],
  balanced:       ['head of marketing', 'director partnerships', 'senior marketing manager', 'head of digital', 'programme director', 'senior brand manager'],
  parent:         ['head of marketing', 'director marketing', 'senior marketing manager', 'partnerships director', 'head of growth'],
  returner:       ['senior marketing manager', 'partnerships manager', 'head of marketing', 'programme manager', 'digital strategy manager'],
  career_changer: ['marketing manager', 'partnerships manager', 'programme manager', 'digital marketing manager', 'growth manager', 'business development manager'],
}

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const customQuery = body.query?.trim()

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const { data: profile } = await service
    .from('profiles')
    .select('track, target_roles, salary_floor, hard_filters_json')
    .eq('user_id', user.id)
    .single()

  const adzunaId  = process.env.ADZUNA_APP_ID
  const adzunaKey = process.env.ADZUNA_APP_KEY || process.env.ADZUNA_API_KEY
  if (!adzunaId || !adzunaKey) {
    return NextResponse.json({ error: 'Adzuna not configured; add ADZUNA_APP_ID and ADZUNA_APP_KEY in Vercel.' })
  }

  const track      = profile?.track || 'standard'
  const cvRaw      = profile?.hard_filters_json?.cvRaw || ''
  const salaryMin  = profile?.salary_floor || 60000
  const targetRoles = profile?.target_roles || []
  const queries = customQuery
    ? [customQuery]
    : targetRoles.length > 0
      ? targetRoles.slice(0, 6)
      : (TRACK_QUERIES[track] || TRACK_QUERIES.standard).slice(0, 6)

  const allJobs = []
  for (const q of queries) {
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${adzunaId}&app_key=${adzunaKey}&results_per_page=20&what=${encodeURIComponent(q)}&salary_min=${salaryMin}&max_days_old=14&sort_by=date`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = await res.json()
      ;(data.results || []).forEach(j => {
        allJobs.push({
          title:    j.title || '',
          company:  j.company?.display_name || 'Unknown',
          location: j.location?.display_name || '',
          url:      j.redirect_url || '',
          salary:   j.salary_is_predicted === '0'
            ? `£${Math.round(j.salary_min || 0).toLocaleString()}–£${Math.round(j.salary_max || 0).toLocaleString()}`
            : '',
          created: j.created || '',
        })
      })
      if (queries.length > 1) await new Promise(r => setTimeout(r, 350))
    } catch { continue }
  }

  // Dedupe
  const seen = new Set()
  const deduped = allJobs.filter(j => {
    const k = `${j.title}|${j.company}`.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  if (deduped.length === 0) return NextResponse.json({ jobs: [], total: 0 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      jobs: deduped.slice(0, 20).map((j, i) => ({ id: `az-${i}`, ...j, score: 0, signal: 'maybe', reason: 'AI scoring unavailable; no API key.', badge: null, office: 'Unknown', source: 'adzuna', adzunaAttributionRequired: true, foundAt: new Date().toISOString() })),
      total: deduped.length,
    })
  }

  // Cap 3 per company, max 80 to score
  const coCounts = {}
  const toScore = deduped.filter(j => {
    const k = j.company.toLowerCase()
    coCounts[k] = (coCounts[k] || 0) + 1
    return coCounts[k] <= 3
  }).slice(0, 80)

  const rolesStr = targetRoles.length ? targetRoles.join(', ') : 'senior strategic roles'
  const profileCtx = cvRaw
    ? `Candidate CV (first 1500 chars):\n${cvRaw.slice(0, 1500)}`
    : `Candidate looking for: ${rolesStr}. UK-based, senior level.`

  const summaries = toScore.map((j, i) => `[${i}] "${j.title}" at ${j.company} | ${j.location} | ${j.salary}`).join('\n')
  const prompt = `Score these live Adzuna job listings for this candidate:\n${profileCtx}\n\nJOBS:\n${summaries}\n\nReturn JSON array. Each object: {"i":index,"score":1-10,"signal":"apply"/"maybe"/"skip","reason":"one sentence why","badge":"Best Match"/"Strong Fit"/"Worth a Look"/"Stretch"/null,"office":"Remote"/"1 day"/"2 days"/"3+ days"/"Unknown"}.\nScoring: 8+ use 0.2 increments (8.0, 8.2…). Only include score ≥ 5. Return ONLY the JSON array, no markdown.\n\n${STYLE_RULES}`

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELS.haiku, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    const aiData  = await aiRes.json()
    const raw     = aiData.content?.map(c => c.text || '').join('') || '[]'
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let scored    = JSON.parse(cleaned)
    if (!Array.isArray(scored)) scored = [scored]

    const now = new Date().toISOString()
    let jobs = scored.filter(s => (s.score || 0) >= 5).map(s => {
      const orig = toScore[s.i] || {}
      return {
        id: `az-${s.i}-${Date.now()}`,
        title: orig.title, company: orig.company, url: orig.url,
        score: s.score, signal: s.signal, reason: s.reason, badge: s.badge,
        office: s.office, salary: orig.salary, location: orig.location,
        created: orig.created, source: 'adzuna', adzunaAttributionRequired: true, foundAt: now,
      }
    })

    jobs.sort((a, b) => (b.score || 0) - (a.score || 0))
    const caps = {}
    jobs = jobs.filter(j => {
      const k = j.company.toLowerCase()
      caps[k] = (caps[k] || 0) + 1
      return caps[k] <= 2
    })

    return NextResponse.json({ jobs, total: deduped.length, scored: toScore.length })
  } catch (err) {
    return NextResponse.json({ jobs: [], error: err.message, total: deduped.length })
  }
}
