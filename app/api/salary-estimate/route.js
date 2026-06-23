// Salary estimation — Adzuna histogram (free) + static seniority floor check
// No Claude usage. Results persisted in IndexedDB — only fetched once per job.

const SENIORITY_FLOORS = [
  { match: ['chief', 'cto', 'cmo', 'coo', 'cpo'], floor: 150, cap: 250 },
  { match: ['vp ', 'vice president'], floor: 120, cap: 180 },
  { match: ['director'], floor: 90, cap: 160 },
  { match: ['deputy director'], floor: 80, cap: 130 },
  { match: ['head of'], floor: 85, cap: 140 },
  { match: ['principal'], floor: 80, cap: 120 },
  { match: ['senior manager', 'sr manager'], floor: 75, cap: 115 },
  { match: ['senior', 'sr '], floor: 65, cap: 100 },
  { match: ['manager'], floor: 55, cap: 90 },
  { match: ['lead'], floor: 60, cap: 95 },
  { match: ['specialist', 'consultant'], floor: 45, cap: 75 },
  { match: ['coordinator', 'executive', 'associate'], floor: 28, cap: 55 },
]

function getSeniorityBounds(roleTitle) {
  const t = (roleTitle || '').toLowerCase()
  for (const s of SENIORITY_FLOORS) {
    if (s.match.some(k => t.includes(k))) return s
  }
  return { floor: 45, cap: 100 }
}

function staticEstimate(roleTitle) {
  const bounds = getSeniorityBounds(roleTitle)
  return { min: bounds.floor, max: bounds.cap, source: 'estimate' }
}

export async function POST(req) {
  const { roleTitle, company } = await req.json()
  if (!roleTitle) return Response.json({ salary: null })

  const adzunaId = process.env.ADZUNA_APP_ID
  const adzunaKey = process.env.ADZUNA_APP_KEY
  const bounds = getSeniorityBounds(roleTitle)

  if (adzunaId && adzunaKey) {
    try {
      // Use specific query — include seniority keyword to tighten the histogram
      const query = encodeURIComponent(roleTitle)
      const url = `https://api.adzuna.com/v1/api/jobs/gb/histogram?app_id=${adzunaId}&app_key=${adzunaKey}&what=${query}&content-type=application/json`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = await res.json()
        const buckets = data.histogram
        if (buckets && Object.keys(buckets).length > 0) {
          const entries = Object.entries(buckets)
            .map(([k, v]) => ({ salary: parseInt(k), count: v }))
            // Filter to sensible UK range — ignore anything below seniority floor
            .filter(e => e.salary >= bounds.floor * 1000 && e.salary <= bounds.cap * 1000)
            .sort((a, b) => a.salary - b.salary)

          if (entries.length >= 2) {
            const total = entries.reduce((s, e) => s + e.count, 0)
            let cumulative = 0
            let p25 = entries[0].salary
            let p75 = entries[entries.length - 1].salary

            for (const e of entries) {
              cumulative += e.count
              if (cumulative / total >= 0.25 && p25 === entries[0].salary) p25 = e.salary
              if (cumulative / total >= 0.75) { p75 = e.salary; break }
            }

            const min = Math.round(p25 / 1000)
            const max = Math.round(p75 / 1000)

            // Sanity check: if Adzuna result is suspiciously below floor, use static
            if (min >= bounds.floor && max <= bounds.cap + 20) {
              return Response.json({ salary: { min, max, source: 'adzuna' } })
            }
          }
        }
      }
    } catch {}
  }

  return Response.json({ salary: staticEstimate(roleTitle) })
}
