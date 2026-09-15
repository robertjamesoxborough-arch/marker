'use client'

import { useState } from 'react'
import { track } from '@vercel/analytics'
import { COLUMNS, PasteJdCallout, ProgressBar, STEPS_ANALYSE, VerdictCard } from '../shared'

export default function EngineTab({ profile, jobs: pipelineJobs, addJob, updateJob, stripped = false }) {
  const [url,          setUrl]          = useState('')
  const [jd,           setJd]           = useState('')
  const [roleInput,    setRoleInput]    = useState('')
  const [coInput,      setCoInput]      = useState('')
  const [analysing,    setAnalysing]    = useState(false)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState('')
  const [added,        setAdded]        = useState(false)
  const [autoAdded,    setAutoAdded]    = useState(false)
  const [pullStatus,   setPullStatus]   = useState('idle') // 'idle' | 'success' | 'failed'
  const [salary,       setSalary]       = useState(null)
  const [salaryLoading,setSalaryLoading]= useState(false)
  const [copied,       setCopied]       = useState(null)

  function copyTip(text, idx) {
    navigator.clipboard.writeText(text).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 2000) })
  }

  const activeJobs = pipelineJobs
    .filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))
    .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))
    .slice(0, 12)

  // Bug 7: recently added jobs with no score (added < 24h ago)
  const recentUnscoredJobs = pipelineJobs.filter(j => {
    if (parseFloat(j.score) > 0) return false
    if (!j.addedAt) return false
    return Date.now() - new Date(j.addedAt).getTime() < 24 * 60 * 60 * 1000
  })

  async function analyse() {
    if (!url.trim() && !jd.trim()) return
    // A "pull attempt" is a link submitted with no JD text already in hand —
    // that's the only case where success/failure of the auto-fetch matters.
    const wasPullAttempt = !!url.trim() && !jd.trim()
    setAnalysing(true); setResult(null); setError(''); setAdded(false); setAutoAdded(false); setSalary(null); setSalaryLoading(false); setPullStatus('idle')
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobLink: url.trim() || null, jdText: jd.trim() || null, roleTitle: roleInput.trim() || null, company: coInput.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Analysis failed')
        // Only blame the link for a content-retrieval failure, not an
        // unrelated gate like a monthly allowance limit.
        if (wasPullAttempt && !data.limitReached) setPullStatus('failed')
        return
      }
      const pulledJd = wasPullAttempt ? (data.extractedJd || '').trim() : ''
      const finalJd = jd.trim() || pulledJd
      if (wasPullAttempt) {
        if (pulledJd) { setJd(pulledJd); setPullStatus('success') }
        else setPullStatus('failed')
      }
      setResult(data)
      track('role_scored', { signal: data.signal || 'none' })
      if (data.roleTitle && !roleInput) setRoleInput(data.roleTitle)
      if (data.company && !coInput) setCoInput(data.company)
      // G4: auto-capture every analysed URL to Watchlist — no manual step required
      if (url.trim() && !pipelineJobs.some(j => j.jobLink === url.trim() || j.link === url.trim())) {
        addJob({
          id: crypto.randomUUID(),
          company: data.company || coInput.trim() || 'Unknown',
          roleTitle: data.roleTitle || roleInput.trim() || 'Unknown',
          jobLink: url.trim(),
          link: url.trim(),
          officeDays: data.officeDays ?? 2,
          status: 'watchlist',
          ranking: 1,
          signal: data.signal || '',
          signalReason: data.signalReason || '',
          score: parseFloat(data.score) || 0,
          scoreBreakdown: JSON.stringify({ factors: data.factors, officeDays: data.officeDays }),
          factors: data.factors,
          jd: finalJd,
          source: 'analyse',
          addedAt: new Date().toISOString(),
        })
        if (url.trim()) fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: url.trim(), company: data.company, roleTitle: data.roleTitle }) }).catch(() => {})
        setAutoAdded(true)
      }
      // Bug 3: auto-fetch salary for score ≥ 5
      if (parseFloat(data.score) >= 5) {
        setSalaryLoading(true)
        fetch('/api/salary-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleTitle: data.roleTitle || roleInput.trim(), company: data.company || coInput.trim() }) })
          .then(r => r.json()).then(d => { if (d.salary) setSalary(d.salary) }).catch(() => {}).finally(() => setSalaryLoading(false))
      }
    } catch {
      setError('Request failed. Check your connection and try again.')
      if (wasPullAttempt) setPullStatus('failed')
    } finally {
      setAnalysing(false)
    }
  }

  function addToPipeline() {
    if (!result || added) return
    // Bug 2: correct status mapping from signal
    const pipelineStatus = result.signal === 'dont_apply' ? 'no_jobs' : 'considering'
    addJob({
      id: crypto.randomUUID(),
      company: result.company || coInput.trim() || 'Unknown',
      roleTitle: result.roleTitle || roleInput.trim() || 'Unknown',
      jobLink: url.trim(),
      link: url.trim(),
      officeDays: result.officeDays ?? 2,
      status: pipelineStatus,
      ranking: 1,
      signal: result.signal || '',
      signalReason: result.signalReason || '',
      score: parseFloat(result.score) || 0,
      scoreBreakdown: JSON.stringify({ factors: result.factors, officeDays: result.officeDays }),
      factors: result.factors,
      jd: jd.trim(),
      source: 'analyse',
      addedAt: new Date().toISOString(),
    })
    // Bug 5: also insert into dismissed_jobs so job won't re-appear in feed
    if (url.trim()) {
      fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: url.trim(), company: result.company, roleTitle: result.roleTitle }) }).catch(() => {})
    }
    setAdded(true)
  }

  const alreadyAdded = pipelineJobs.some(j => j.jobLink === url.trim() || j.link === url.trim())
  const canAdd = !!result && !added && !alreadyAdded

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Tab purpose header ── */}
      {!stripped && (
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>Score a job</div>
          <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>Drop in a link and we&apos;ll try to pull the details in, or paste the job description straight in: either way Requite scores it, tailors your CV, and preps your interview against it in about 30 seconds.</div>
        </div>
      )}

      {/* ── Pipeline summary strip ── */}
      {!stripped && activeJobs.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Active pipeline</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>{pipelineJobs.filter(j => !['watchlist','no_jobs','rejected'].includes(j.status)).length} roles</div>
            </div>
            {activeJobs.map((job, i) => {
              const s = parseFloat(job.score) || 0
              const sTop = s >= 9
              const sBg = sTop ? undefined : s >= 7 ? 'var(--marker-lime)' : s >= 5 ? 'var(--marker-cream)' : 'var(--marker-border)'
              return (
                <div key={job.id} style={{ padding: '8px 14px', borderBottom: i < activeJobs.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={sTop ? 'holo-foil' : ''} style={{ background: sTop ? undefined : sBg, fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4, color: 'var(--marker-black)', flexShrink: 0, minWidth: 28, textAlign: 'center' }}>
                    {s > 0 ? job.score : '–'}
                  </div>
                  {job.signal && <span style={{ background: job.signal === 'apply' ? 'var(--marker-lime)' : job.signal === 'maybe' ? '#F5E4A0' : '#FCA5A5', fontFamily: 'var(--font-mono)', fontSize: 8, padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--marker-black)', flexShrink: 0 }}>{job.signal}</span>}
                  <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}{job.roleTitle ? ` · ${job.roleTitle}` : ''}</div>
                  {updateJob
                    ? <select value={job.status} onChange={e => updateJob(job.id, { status: e.target.value })} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-mid)', flexShrink: 0, background: 'transparent', border: '1px solid var(--marker-border)', borderRadius: 4, padding: '2px 2px', cursor: 'pointer' }}>
                        {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', flexShrink: 0, textTransform: 'uppercase' }}>{(job.status || '').replace('_', ' ')}</span>
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recently added with no score */}
      {!stripped && recentUnscoredJobs.length > 0 && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: '0 8px 8px 0', padding: '10px 14px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Recently added: score these?</div>
            {recentUnscoredJobs.map(j => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12, color: 'var(--marker-text)' }}>
                <span>{j.company}{j.roleTitle ? ` · ${j.roleTitle}` : ''}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>no score yet</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Analyse input ── */}
      <div style={{ padding: stripped ? '20px 16px 14px' : '16px 16px 14px', borderBottom: '1px solid var(--marker-border)' }}>
        {stripped && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 4, letterSpacing: '-0.02em' }}>Score a role</div>
        )}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: stripped ? 14 : 17, fontWeight: 500, color: stripped ? 'var(--marker-mid)' : 'var(--marker-black)', marginBottom: 3, display: stripped ? 'none' : 'block' }}>Add a role</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 14, lineHeight: 1.6 }}>Drop in a link and we&apos;ll try to pull the details in, or paste the job description straight in below.</div>

        {/* Link — an accelerator, shown up front, never hidden */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Job link <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </div>
          {pullStatus === 'failed' ? (
            <>
              <a href={url.trim()} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 10, background: 'linear-gradient(90deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #C77DFF)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, textDecoration: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.25)', marginBottom: 6 }}>
                Open the job page ↗
              </a>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', lineHeight: 1.6 }}>Some job sites let us pull details in automatically; many block it, so pasting is the sure way.</div>
              <button onClick={() => setPullStatus('idle')} style={{ background: 'none', border: 'none', padding: '4px 0 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)', textDecoration: 'underline', cursor: 'pointer' }}>Try a different link</button>
            </>
          ) : (
            <input value={url} onChange={e => { setUrl(e.target.value); if (pullStatus !== 'idle') setPullStatus('idle') }} onKeyDown={e => e.key === 'Enter' && !analysing && analyse()}
              placeholder="Job URL, e.g. https://monzo.com/careers/jobs/…"
              style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', boxSizing: 'border-box' }} />
          )}
        </div>

        {pullStatus === 'success' && (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--marker-lime)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--marker-black)' }}>
            ✓ Pulled the details in for you
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <PasteJdCallout subtext="This is what actually gets scored: a link alone doesn't always pull cleanly." />
          <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description…" rows={7}
            style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <input value={roleInput} onChange={e => setRoleInput(e.target.value)} placeholder="Role title (optional)" style={{ padding: '8px 12px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }} />
          <input value={coInput} onChange={e => setCoInput(e.target.value)} placeholder="Company (optional)" style={{ padding: '8px 12px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }} />
        </div>
        <button onClick={analyse} disabled={analysing || (!url.trim() && !jd.trim())}
          style={{ display: 'block', width: '100%', padding: '11px', background: analysing || (!url.trim() && !jd.trim()) ? 'var(--marker-border)' : 'var(--marker-black)', color: analysing || (!url.trim() && !jd.trim()) ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: analysing || (!url.trim() && !jd.trim()) ? 'default' : 'pointer' }}>
          {analysing ? 'Analysing (20–60s)…' : 'Analyse role →'}
        </button>
      </div>

      {/* ── Results ── */}
      <div style={{ padding: '14px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {analysing && (
          <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)' }}>Analysing role</div>
            <ProgressBar duration={45} steps={STEPS_ANALYSE} slowAt={38} slowMsg="Taking a bit longer; Claude's searching the web for this one rather than reading the page directly. Worth the wait." />
          </div>
        )}
        {error && !analysing && <div style={{ fontSize: 12, color: '#B91C1C', padding: '12px 14px', background: '#FEE2E2', borderRadius: 10 }}>{error}</div>}
        {!analysing && !result && !error && (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Full role breakdown</div>
            <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>Paste any job URL above. Claude fetches the JD, searches for company culture data, and scores the role across 8 factors.</div>
          </div>
        )}
        {result && !analysing && (
          <>
            <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 14, padding: 16 }}>
              <VerdictCard job={result} showFactors />
              {(result._usedWebSearch || salaryLoading || salary) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--marker-border)' }}>
                  {result._usedWebSearch && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-border)', padding: '3px 7px', borderRadius: 4 }}>web search used</span>}
                  {salaryLoading && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-border)', padding: '3px 7px', borderRadius: 4 }}>fetching salary…</span>}
                  {salary && <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 8px', borderRadius: 5 }}>{salary.source === 'adzuna' ? `£${salary.min}k–£${salary.max}k` : `~£${salary.min}k–£${salary.max}k (est)`}</span>}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {url.trim() && (
                <a href={url.trim()} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: 10, border: '1px solid var(--marker-border)', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', fontWeight: 500, textDecoration: 'none' }}>
                  View job ↗
                </a>
              )}
              <button onClick={!autoAdded ? addToPipeline : undefined} disabled={added || alreadyAdded}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: autoAdded ? 'rgba(198,244,50,0.3)' : (added || alreadyAdded) ? 'var(--marker-border)' : 'var(--marker-black)', color: (added || alreadyAdded || autoAdded) ? 'var(--marker-black)' : 'var(--marker-cream)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: (added || alreadyAdded) ? 'default' : 'pointer' }}>
                {autoAdded ? 'Watchlisted ✓: see Pipeline tab' : (added || alreadyAdded) ? 'In pipeline ✓' : `+ Add to pipeline${result.signal === 'apply' ? ': apply!' : ''}`}
              </button>
            </div>
            <div className="legal-line">AI-generated analysis. Review before making decisions. Web search used for company data. May not reflect current policies.</div>
          </>
        )}
      </div>

    </div>
  )
}
