'use client'

import { FUNNEL, ScoreBadge, scoreTierOf } from '../shared'

export default function StatsTab({ jobs }) {
  const total = jobs.length
  const scored = jobs.filter(j => parseFloat(j.score) > 0)
  const maxCount = Math.max(...FUNNEL.map(f => jobs.filter(j => j.status === f.id).length), 1)

  const topJobs = [...scored].sort((a, b) => parseFloat(b.score) - parseFloat(a.score)).slice(0, 5)

  const scoreBuckets = [
    { label: '9-10', min: 9, max: 10, color: 'var(--marker-black)' },
    { label: '7-8',  min: 7, max: 9,  color: 'var(--marker-lime)' },
    { label: '5-6',  min: 5, max: 7,  color: '#FCD34D' },
    { label: '1-4',  min: 0, max: 5,  color: '#FCA5A5' },
  ]

  // KPI calculations
  const applied     = jobs.filter(j => ['applied', 'interviewing', 'offer', 'rejected'].includes(j.status)).length
  const interviews  = jobs.filter(j => ['interviewing', 'offer'].includes(j.status)).length
  const offers      = jobs.filter(j => j.status === 'offer').length
  const intRate     = applied > 0 ? Math.round((interviews / applied) * 100) : 0
  const avgApplied  = (() => { const a = jobs.filter(j => j.status === 'applied' && parseFloat(j.score) > 0); return a.length ? (a.reduce((s, j) => s + parseFloat(j.score), 0) / a.length).toFixed(1) : null })()
  const avgInterv   = (() => { const a = jobs.filter(j => ['interviewing', 'offer'].includes(j.status) && parseFloat(j.score) > 0); return a.length ? (a.reduce((s, j) => s + parseFloat(j.score), 0) / a.length).toFixed(1) : null })()

  // Score band breakdown
  const BANDS = [
    { label: '9-10',  min: 9,  max: 11 },
    { label: '7-8.9', min: 7,  max: 9  },
    { label: '5-6.9', min: 5,  max: 7  },
    { label: '<5',    min: 0,  max: 5  },
  ]

  // Effort level breakdown
  const EFFORT_LABELS = { 1: 'L1: Keywords', 2: 'L2: Guided', 3: 'L3: Deep' }

  // Source breakdown
  const SOURCE_BREAKDOWN = [
    { key: 'greenhouse', label: 'Company board' },
    { key: 'adzuna',     label: 'Adzuna' },
    { key: 'gov_search', label: 'Civil Service' },
  ]

  if (total === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO DATA YET</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>Add roles to see stats</div>
        <div style={{ fontSize: 14, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>Your pipeline stats appear once you've added and scored some roles.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Applied', value: applied },
          { label: 'Interviews', value: interviews },
          { label: 'Int. rate', value: applied > 0 ? `${intRate}%` : '–' },
          { label: 'Offers', value: offers },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>{value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Score comparison insight */}
      {avgApplied && avgInterv && (
        <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-lime)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Score insight</div>
          <div style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.5 }}>
            You applied to roles averaging <strong>{avgApplied}</strong>, but interviewed for roles averaging <strong>{avgInterv}</strong>.
            {parseFloat(avgInterv) > parseFloat(avgApplied) + 0.5 ? ' Higher-scored roles are converting; keep prioritising them.' : ''}
          </div>
        </div>
      )}

      {/* Pipeline funnel */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Pipeline funnel</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {FUNNEL.map(({ id, label, color }) => {
            const count = jobs.filter(j => j.status === id).length
            if (count === 0 && id !== 'applied') return null
            const pct = Math.max((count / maxCount) * 100, count > 0 ? 6 : 0)
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', width: 110, textAlign: 'right', flexShrink: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{label}</div>
                <div style={{ flex: 1, height: 20, background: 'var(--marker-border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: count > 0 ? 6 : 0 }}>
                    {count > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-black)', fontWeight: 600 }}>{count}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Score distribution */}
      {scored.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Score distribution</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60 }}>
            {scoreBuckets.map(({ label, min, max, color }) => {
              const count = scored.filter(j => parseFloat(j.score) >= min && parseFloat(j.score) < max).length
              const maxBucket = Math.max(...scoreBuckets.map(b => scored.filter(j => parseFloat(j.score) >= b.min && parseFloat(j.score) < b.max).length), 1)
              const h = count > 0 ? Math.max((count / maxBucket) * 52, 8) : 0
              return (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>{count || ''}</div>
                  <div style={{ width: '100%', height: h, background: h > 0 ? color : 'var(--marker-border)', borderRadius: '3px 3px 0 0', border: '1px solid var(--marker-border)' }} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top scoring roles */}
      {topJobs.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Top scored roles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topJobs.map(job => (
              <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '–'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2 }}>{job.company}</div>
                </div>
                <ScoreBadge score={job.score} tier={scoreTierOf(job)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score band breakdown */}
      {applied > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Score band → interview rate</div>
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 60px', padding: '6px 12px', borderBottom: '1px solid var(--marker-border)' }}>
              {['Band', 'Applied', 'Interviewed', 'Rate'].map(h => <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</div>)}
            </div>
            {BANDS.map(({ label, min, max }) => {
              const bandApplied = jobs.filter(j => ['applied','interviewing','offer','rejected'].includes(j.status) && parseFloat(j.score) >= min && parseFloat(j.score) < max).length
              const bandInterv  = jobs.filter(j => ['interviewing','offer'].includes(j.status) && parseFloat(j.score) >= min && parseFloat(j.score) < max).length
              const rate = bandApplied > 0 ? Math.round((bandInterv / bandApplied) * 100) : 0
              return (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 60px', padding: '8px 12px', borderBottom: '1px solid var(--marker-border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-text)', fontWeight: 500 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{bandApplied}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{bandInterv}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: rate >= 30 ? '#16a34a' : rate > 0 ? 'var(--marker-text)' : 'var(--marker-mid)' }}>{bandApplied > 0 ? `${rate}%` : '–'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CV effort level breakdown */}
      {jobs.some(j => j.cvEffortLevel) && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>CV effort → interview rate</div>
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 60px', padding: '6px 12px', borderBottom: '1px solid var(--marker-border)' }}>
              {['Effort', 'Applied', 'Interviewed', 'Rate'].map(h => <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</div>)}
            </div>
            {[1, 2, 3].map(level => {
              const lvJobs    = jobs.filter(j => j.cvEffortLevel === level)
              const lvApplied = lvJobs.filter(j => ['applied','interviewing','offer','rejected'].includes(j.status)).length
              const lvInterv  = lvJobs.filter(j => ['interviewing','offer'].includes(j.status)).length
              const rate = lvApplied > 0 ? Math.round((lvInterv / lvApplied) * 100) : 0
              if (lvJobs.length === 0) return null
              return (
                <div key={level} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 60px', padding: '8px 12px', borderBottom: '1px solid var(--marker-border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-text)', fontWeight: 500 }}>{EFFORT_LABELS[level]}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{lvApplied}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{lvInterv}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: rate >= 30 ? '#16a34a' : rate > 0 ? 'var(--marker-text)' : 'var(--marker-mid)' }}>{lvApplied > 0 ? `${rate}%` : '–'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      {(() => {
        const insights = []
        const topBandApplied = jobs.filter(j => ['applied','interviewing','offer','rejected'].includes(j.status) && parseFloat(j.score) >= 9).length
        const topBandInterv  = jobs.filter(j => ['interviewing','offer'].includes(j.status) && parseFloat(j.score) >= 9).length
        if (topBandApplied >= 3 && topBandInterv / topBandApplied >= 0.4) {
          insights.push(`Roles scored 9-10 converted at ${Math.round((topBandInterv/topBandApplied)*100)}% . Prioritise these above all else.`)
        }
        const l3Jobs = jobs.filter(j => j.cvEffortLevel === 3)
        const l1Jobs = jobs.filter(j => j.cvEffortLevel === 1)
        const l3App  = l3Jobs.filter(j => ['applied','interviewing','offer','rejected'].includes(j.status)).length
        const l1App  = l1Jobs.filter(j => ['applied','interviewing','offer','rejected'].includes(j.status)).length
        const l3Rate = l3App > 0 ? l3Jobs.filter(j => ['interviewing','offer'].includes(j.status)).length / l3App : 0
        const l1Rate = l1App > 0 ? l1Jobs.filter(j => ['interviewing','offer'].includes(j.status)).length / l1App : 0
        if (l3App >= 2 && l1App >= 2 && l3Rate > l1Rate) {
          insights.push(`Level 3 tailored CVs got ${Math.round((l3Rate - l1Rate)*100)}% more interviews than Level 1 . Consider trusting the AI more.`)
        }
        if (insights.length === 0) return null
        return (
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Insights</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ padding: '10px 14px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-lime)', borderRadius: 8, fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.5 }}>
                  {ins}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

    </div>
  )
}
