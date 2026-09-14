'use client'

import { useState } from 'react'
import { BALANCED_COMPANIES, BALANCED_SECTORS } from '../shared'

export default function BalancedTab({ jobs: pipelineJobs, addJob }) {
  const [sector, setSector] = useState('All')

  const filtered = sector === 'All'
    ? BALANCED_COMPANIES
    : sector === 'Other'
    ? BALANCED_COMPANIES.filter(c => !['Finance', 'Media', 'Tech', 'Public Sector', 'Fintech', 'Energy', 'Regulator', 'Charity', 'Insurance', 'Healthcare'].includes(c.sector))
    : BALANCED_COMPANIES.filter(c => c.sector === sector || (sector === 'Finance' && ['Finance', 'Insurance'].includes(c.sector)))

  const watchedCompanies = new Set(pipelineJobs.map(j => j.company?.toLowerCase().trim()))

  function watch(c) {
    addJob({
      id: crypto.randomUUID(),
      company: c.co,
      roleTitle: '',
      jobLink: c.careers || '',
      link: c.careers || '',
      officeDays: parseFloat(c.office) || 2,
      status: 'watchlist',
      ranking: 1,
      signal: '',
      signalReason: '',
      score: 0,
      scoreBreakdown: '',
      jd: `Glassdoor WLB: ${c.wlb}/5 from ${c.reviews} reviews · Leave: ${c.leave} · Office: ${c.office} · ${c.note}`,
      addedAt: new Date().toISOString(),
    })
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '4px solid var(--marker-lime)', borderRadius: '0 10px 10px 0', padding: '12px 14px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 4 }}>What is Work-Life Balance (WLB)?</div>
        <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>WLB is how well a job fits around the rest of your life: hours, flexibility, parental leave, culture, and whether you're actually expected to switch off. Job ads claim it. Glassdoor reviews measure it. This list uses ≥500 Glassdoor reviews plus Working Families benchmark data, so you can research before you apply.</div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--marker-black)' }}>Watch</strong> adds a company to your pipeline Watchlist, no role yet, just a signal to keep an eye on them. You'll see them in your Pipeline under <em>Watching</em>, and if they appear in your live job feed they'll be highlighted.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {BALANCED_SECTORS.map(s => (
          <button key={s} onClick={() => setSector(s)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', background: s === sector ? 'var(--marker-black)' : 'transparent', color: s === sector ? 'var(--marker-cream)' : 'var(--marker-mid)', border: `1px solid ${s === sector ? 'var(--marker-black)' : 'var(--marker-border)'}`, fontFamily: 'var(--font-body)' }}>{s}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(c => {
          const isWatched = watchedCompanies.has(c.co.toLowerCase().trim())
          return (
            <div key={c.co} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    {c.careers
                      ? <a href={c.careers} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--marker-black)', fontSize: 15, textDecoration: 'none' }}>{c.co} →</a>
                      : <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--marker-black)', fontSize: 15 }}>{c.co}</span>
                    }
                    {c.wf && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, background: 'var(--marker-lime)', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-black)', letterSpacing: '0.04em', flexShrink: 0 }}>WORKING FAMILIES</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.sector}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: parseFloat(c.wlb) >= 4.4 ? 'var(--marker-lime)' : '#F0E0A8', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-black)' }}>WLB {c.wlb}/5 · {c.reviews} reviews</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>Leave {c.leave}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>Office {c.office}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <div style={{ background: 'var(--marker-lime)', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, padding: '2px 8px', borderRadius: 5, color: 'var(--marker-black)' }}>{c.score}</div>
                  <button onClick={() => !isWatched && watch(c)} disabled={isWatched} style={{ background: isWatched ? 'var(--marker-border)' : 'var(--marker-black)', color: isWatched ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isWatched ? 'default' : 'pointer' }}>
                    {isWatched ? 'Added ✓' : 'Watch'}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5, paddingTop: 8, borderTop: '1px solid var(--marker-border)' }}>{c.note}</div>
            </div>
          )
        })}
      </div>

      {/* Role titles */}
      <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Best titles for senior + balanced</div>
          <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 4, lineHeight: 1.5 }}>Title semantics below are specific to office/corporate roles — in clinical, trades, and education, WLB signals come from shift patterns, staffing ratios and term structure rather than the title itself, so the same idea applies but the giveaways differ.</div>
        </div>
        {[
          { title: 'Programme Manager',        why: 'Structured delivery, clear scope, rarely on-call' },
          { title: 'Partnerships Lead',         why: 'Relationship-led, outcome-focused, low-crisis profile' },
          { title: 'Digital Strategy Manager',  why: 'Advisory remit, cross-functional, rarely firefighting' },
          { title: 'Product Manager (platform)',why: 'Internal tooling orgs tend to have calmer roadmaps' },
          { title: 'Operations Lead',           why: 'Process-oriented, stable timelines, measurable scope' },
          { title: 'Marketing Manager (brand)', why: 'Avoid "Growth" in the title; often means startup hours' },
        ].map((r, i, arr) => (
          <div key={r.title} style={{ padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--marker-border)' : 'none', display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', minWidth: 180, flexShrink: 0 }}>{r.title}</div>
            <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.4 }}>{r.why}</div>
          </div>
        ))}
      </div>

      {/* Search tips */}
      <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>How to find balanced roles</div>
        </div>
        {[
          { tip: 'LinkedIn',          detail: '"Senior product manager remote £80k". Apply "Easy Apply off" + "Under 10 applicants" filters' },
          { tip: 'Glassdoor filter',  detail: 'Company filter → Work/Life Balance ≥ 4.0 → sort by most recent reviews' },
          { tip: 'Escape the City',   detail: '"Purpose-driven" filter surfaces B Corps, charities, and public sector orgs' },
          { tip: 'Working Families',  detail: 'workingfamilies.org.uk/top-employers: annual verified list of family-friendly UK employers' },
          { tip: 'Civil Service Jobs',detail: 'civilservicejobs.service.gov.uk: Director/Deputy Director level, flexible working by default' },
        ].map((t, i, arr) => (
          <div key={t.tip} style={{ padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--marker-border)' : 'none' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-black)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>{t.tip}</div>
            <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{t.detail}</div>
          </div>
        ))}
      </div>

      <div className="legal-line">Glassdoor WLB ratings from public reviews (≥500 reviews threshold). Parental leave from employer policy pages. Working Families citations from their published Top Employers list. Verify all data with the employer before relying on it. Last updated May 2025.</div>
    </div>
  )
}
