'use client'

import { useState, useEffect } from 'react'
import { matchJob } from '../../../lib/job-match'
import { buildChannelUrls, CHANNELS, CHANNEL_LABELS, isChannelOverdue } from '../../../lib/channel-urls'
import { MAX_BRING_IN_BATCH, CHANNEL_CADENCE_LABEL, channelTimeAgo, MetallicCTA, PasteJdCallout, describeDuplicateMatch, VerdictCard } from '../shared'

export default function AggregatorTab({ profile, addJob, onTabSwitch, pipelineJobs, dismissedJobs }) {
  const targetRoles = profile?.target_roles || []
  const [channelChecks, setChannelChecks] = useState(null)

  // Dashboard-wide duplicate detection (Stage 58) — records to check a
  // brought-in job against, built from what's already loaded at the top
  // level (no extra fetch). See lib/job-match.js for the matcher itself.
  const dupeRecords = (pipelineJobs || []).map(j => ({
    id: j.id, source: 'pipeline', status: j.status, company: j.company, roleTitle: j.roleTitle, location: j.location, externalId: j.externalId, appliedAt: j.appliedAt,
  })).concat((dismissedJobs || []).map(d => ({
    id: d.id, source: 'dismissed', company: d.company, roleTitle: d.roleTitle, location: d.location, externalId: d.externalId,
  })))

  useEffect(() => {
    fetch('/api/aggregator/channel-click')
      .then(r => r.json())
      .then(setChannelChecks)
      .catch(() => setChannelChecks({}))
  }, [])

  function recordClick(channel) {
    const now = new Date().toISOString()
    setChannelChecks(prev => ({ ...(prev || {}), [channel]: now }))
    fetch('/api/aggregator/channel-click', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel }),
    }).catch(() => {})
  }

  // Bring-in-for-scoring
  const [bringInOpen, setBringInOpen] = useState(false)
  const [bringInText, setBringInText] = useState('')
  const [allowance, setAllowance] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [scoreResults, setScoreResults] = useState([])
  const [addedIds, setAddedIds] = useState({})

  function openBringIn() {
    setBringInOpen(true)
    setScoreResults([])
    fetch('/api/aggregator/bring-in-allowance').then(r => r.json()).then(setAllowance).catch(() => setAllowance(null))
  }

  const allLines = bringInText.split('\n').map(l => l.trim()).filter(Boolean)
  const bringInLines = allLines.slice(0, MAX_BRING_IN_BATCH)
  const overBatchLimit = allLines.length > MAX_BRING_IN_BATCH

  // Scores a single line and writes its result — shared by the main batch
  // loop and the per-row "Score anyway" override on a flagged duplicate.
  async function scoreLine(line, idx, isUrl) {
    setScoreResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'scoring' } : r))
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUrl ? { jobLink: line } : { jdText: line }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setScoreResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'error', error: data.error || 'Failed' } : r))
        return { ok: false, limitReached: !!data.limitReached || res.status === 429 }
      }
      // A JD-paste (no URL) only reveals company/role AFTER scoring — this
      // is the one case the pre-scoring check can't cover for free (see
      // lib/job-page-scrape.js header). Check now so the trust benefit
      // still lands, even though the credit was already spent this time.
      const postScoreMatch = !isUrl
        ? matchJob({ company: data.company, roleTitle: data.roleTitle, location: null, externalId: null }, dupeRecords)
        : null
      setScoreResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'done', input: line, isUrl, data, dupeMatch: postScoreMatch } : r))
      return { ok: true }
    } catch {
      setScoreResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'error', error: 'Request failed' } : r))
      return { ok: false }
    }
  }

  async function runBringIn() {
    setConfirmOpen(false)
    setScoring(true)
    setScoreResults(bringInLines.map(l => ({ input: l, status: 'pending' })))
    for (let i = 0; i < bringInLines.length; i++) {
      const line = bringInLines[i]
      const isUrl = /^https?:\/\//i.test(line)

      // Pre-scoring duplicate check (the cost-saving half of Stage 58):
      // for a URL, get company/role/location for free first (jobs_cache
      // lookup, else a zero-AI schema.org scrape) and check BEFORE paying
      // for /api/analyse. A JD-only paste has nothing to check yet — see
      // scoreLine's post-score check for that case.
      if (isUrl) {
        setScoreResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'checking' } : r))
        try {
          const peekRes = await fetch('/api/aggregator/peek-job', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobLink: line }),
          })
          const peek = await peekRes.json()
          if (peek.company) {
            const match = matchJob({ company: peek.company, roleTitle: peek.roleTitle, location: peek.location, externalId: peek.externalId }, dupeRecords)
            if (match?.tier === 'strong') {
              setScoreResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'duplicate', input: line, isUrl, peek, dupeMatch: match } : r))
              continue // no /api/analyse call — no credit spent on a known duplicate
            }
            if (match?.tier === 'soft') {
              // Non-blocking — still score, just carries the note through.
              const result = await scoreLine(line, i, isUrl)
              if (result.ok) setScoreResults(prev => prev.map((r, idx) => idx === i ? { ...r, dupeMatch: match } : r))
              if (!result.ok && result.limitReached) { setScoreResults(prev => prev.map((r, idx) => idx > i ? { ...r, status: 'skipped' } : r)); break }
              continue
            }
          }
        } catch { /* peek failed — fall through to scoring as normal */ }
      }

      const result = await scoreLine(line, i, isUrl)
      if (!result.ok && result.limitReached) {
        setScoreResults(prev => prev.map((r, idx) => idx > i ? { ...r, status: 'skipped' } : r))
        break
      }
    }
    setScoring(false)
  }

  function addResultToPipeline(r, idx) {
    if (addedIds[idx]) return
    const data = r.data
    // addJob itself re-runs the same duplicate check (it's the single
    // dashboard-wide choke point) — this is deliberately not skipped just
    // because bring-in already checked once; a SOFT match here still rides
    // through as possibleDuplicateOf via that shared path.
    addJob({
      id: crypto.randomUUID(),
      company: data.company || 'Unknown',
      roleTitle: data.roleTitle || 'Unknown',
      location: r.peek?.location || null,
      externalId: r.peek?.externalId || null,
      jobLink: r.isUrl ? r.input : '',
      link: r.isUrl ? r.input : '',
      officeDays: data.officeDays ?? 2,
      status: data.signal === 'dont_apply' ? 'no_jobs' : 'considering',
      ranking: 1,
      signal: data.signal || '',
      signalReason: data.signalReason || '',
      score: parseFloat(data.score) || 0,
      scoreBreakdown: JSON.stringify({ factors: data.factors, officeDays: data.officeDays }),
      factors: data.factors,
      jd: r.isUrl ? (data.extractedJd || '') : r.input,
      source: 'aggregator_bring_in',
      addedAt: new Date().toISOString(),
    })
    setAddedIds(prev => ({ ...prev, [idx]: true }))
  }

  // Override for a row flagged 'duplicate' by the pre-scoring check — the
  // user gets the final call, this never permanently blocks scoring.
  function scoreAnyway(idx) {
    const r = scoreResults[idx]
    if (!r) return
    scoreLine(r.input, idx, r.isUrl)
  }

  return (
    <div style={{ padding: '18px 16px 40px' }}>
      <div className="kicker holo-text" style={{ marginBottom: 6 }}>Daily sweep</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>
        Job Aggregator
      </div>
      <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6, maxWidth: 620, marginBottom: 10 }}>
        We build the search links, you check the results. Requite never pulls or stores anything from LinkedIn, Indeed, or Adzuna&apos;s own site: every button below opens that channel&apos;s own results in a new tab, built from your profile.
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', letterSpacing: '0.04em', marginBottom: 24 }}>
        Honest limitation: LinkedIn ignores the location we send it, so LinkedIn links below are UK-wide, not &quot;near you&quot;. Indeed and Adzuna do respect your location and radius.
      </div>

      {targetRoles.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 12 }}>Add at least one target role in Settings to get your search links.</div>
          <a href="/settings" style={{ fontSize: 12, fontWeight: 500, color: 'var(--marker-black)' }}>Go to Settings →</a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {targetRoles.map(role => {
            const urls = buildChannelUrls(role, profile)
            return (
              <div key={role} style={{ border: '1px solid var(--marker-border)', borderRadius: 10, padding: '14px 16px', background: '#fff' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 10 }}>{role}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={urls.indeed} target="_blank" rel="noopener noreferrer" onClick={() => recordClick('indeed')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', color: 'var(--marker-black)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                    Indeed ↗
                  </a>
                  <a href={urls.linkedin} target="_blank" rel="noopener noreferrer" onClick={() => recordClick('linkedin')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', color: 'var(--marker-black)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                    LinkedIn (UK-wide) ↗
                  </a>
                  <a href={urls.adzuna} target="_blank" rel="noopener noreferrer" onClick={() => recordClick('adzuna')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', color: 'var(--marker-black)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                    Adzuna ↗
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cadence tracker */}
      <div style={{ border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '10px 16px', background: 'var(--marker-cream-2)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--marker-mid)' }}>
          Research cadence
        </div>
        {CHANNELS.map((c, i) => {
          const lastChecked = channelChecks?.[c]
          const overdue = channelChecks && isChannelOverdue(c, lastChecked)
          return (
            <div key={c} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--marker-border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: overdue ? '#EF4444' : 'var(--marker-lime)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>{CHANNEL_LABELS[c]}</div>
                  <div style={{ fontSize: 11, color: 'var(--marker-mid)' }}>{CHANNEL_CADENCE_LABEL[c]} · {channelTimeAgo(lastChecked)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {overdue && <span className="chip" style={{ fontSize: 9, padding: '3px 7px', background: '#FCA5A5', border: 'none' }}>OVERDUE</span>}
                {c === 'target_companies' && (
                  <button onClick={() => { recordClick(c); onTabSwitch && onTabSwitch('Discover') }} style={{ background: 'none', border: 'none', color: 'var(--marker-black)', fontSize: 11, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>Open →</button>
                )}
                <button onClick={() => recordClick(c)} title="Mark as checked / dismiss" style={{ background: 'none', border: '1px solid var(--marker-border)', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1 }}>✕</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Specialist board — roadmap placeholder, honest gap */}
      <div style={{ border: '1px dashed var(--marker-border)', borderRadius: 10, padding: '14px 16px', marginBottom: 28, background: 'var(--marker-cream-2)' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 4 }}>Coming soon: your specialist board</div>
        <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
          Healthcare, education, and trades each have their own primary hiring channel (NHS Jobs, teaching-vacancy portals, trade-body boards) that isn&apos;t wired up here yet, and we haven&apos;t faked it with a generic search link. Roadmap item, not built.
        </div>
      </div>

      {/* Bring in for scoring */}
      <div style={{ border: '1px solid var(--marker-border)', borderRadius: 10, padding: '18px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 6 }}>Bring in for scoring</div>
        <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 12 }}>
          Found something on one of the channels above? Paste the links (or the job descriptions) back here, one per line, and score them against your profile.
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', letterSpacing: '0.02em', lineHeight: 1.7, marginBottom: 14, padding: '10px 12px', background: 'var(--marker-cream-2)', borderRadius: 8 }}>
          Target, don&apos;t spray: tailored applications land interviews at roughly 3x the rate of generic ones (~7-9% vs ~2-3%, based on analysis of 500,000+ real applications). Score first, apply to the few that fit, not everything you find. <a href="https://wellfound.com/blog/how-to-double-your-interview-rate-what-500-000-job-applications-revealed" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--marker-mid)' }}>Source ↗</a>
        </div>

        {!bringInOpen ? (
          <MetallicCTA onClick={openBringIn} style={{ width: 'auto', display: 'inline-block', padding: '10px 20px', fontSize: 13 }}>
            Bring in roles to score
          </MetallicCTA>
        ) : (
          <div>
            <PasteJdCallout label="Paste links or job descriptions" subtext={`One per line, up to ${MAX_BRING_IN_BATCH} at a time.`} />
            <textarea
              value={bringInText}
              onChange={e => setBringInText(e.target.value)}
              placeholder={`https://...\nhttps://...`}
              rows={5}
              style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-mono)', marginBottom: 8 }}
            />
            {overBatchLimit && (
              <div style={{ fontSize: 11, color: '#B45309', marginBottom: 8 }}>Only the first {MAX_BRING_IN_BATCH} lines will be scored this run: paste the rest in a second batch.</div>
            )}
            {allowance && (
              <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 12 }}>
                {allowance.cap === 0
                  ? 'Scoring is not available on your current plan.'
                  : `${Math.max(allowance.cap - allowance.used, 0)} of ${allowance.cap} scoring credits left this month (shared with the single-role scorer).`}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={bringInLines.length === 0 || scoring || !allowance || allowance.cap === 0}
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '9px 18px', opacity: (bringInLines.length === 0 || scoring || !allowance || allowance.cap === 0) ? 0.5 : 1 }}
              >
                {scoring ? 'Scoring…' : `Score ${bringInLines.length || ''} role${bringInLines.length === 1 ? '' : 's'}`}
              </button>
              <button onClick={() => { setBringInOpen(false); setBringInText(''); setScoreResults([]) }} style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>

            {scoreResults.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scoreResults.map((r, i) => (
                  <div key={i} style={{ borderRadius: 6, background: r.status === 'duplicate' ? '#FEF3C7' : 'var(--marker-cream-2)', padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ flexShrink: 0, width: 68, fontFamily: 'var(--font-mono)', fontSize: 10, color: r.status === 'done' ? 'var(--marker-black)' : r.status === 'error' ? '#B91C1C' : r.status === 'duplicate' ? '#92400E' : 'var(--marker-mid)' }}>
                        {r.status === 'done' ? `Score ${parseFloat(r.data?.score) || 0}` : r.status === 'scoring' ? 'Scoring…' : r.status === 'checking' ? 'Checking…' : r.status === 'error' ? 'Failed' : r.status === 'skipped' ? 'Skipped' : r.status === 'duplicate' ? 'Already have' : 'Waiting'}
                      </span>
                      <span style={{ flex: 1, color: 'var(--marker-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.status === 'done' ? `${r.data?.company || 'Unknown'} · ${r.data?.roleTitle || 'Unknown'}` : r.status === 'duplicate' ? `${r.peek?.company || 'Unknown'} · ${r.peek?.roleTitle || 'Unknown'}` : r.input}
                      </span>
                      {r.status === 'done' && (
                        <button onClick={() => addResultToPipeline(r, i)} disabled={!!addedIds[i]} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: addedIds[i] ? 'default' : 'pointer', background: addedIds[i] ? 'var(--marker-border)' : 'var(--marker-black)', color: addedIds[i] ? 'var(--marker-mid)' : 'var(--marker-cream)' }}>
                          {addedIds[i] ? 'Added ✓' : '+ Add'}
                        </button>
                      )}
                      {r.status === 'duplicate' && (
                        <button onClick={() => scoreAnyway(i)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: '1px solid #92400E', background: 'none', color: '#92400E', cursor: 'pointer' }}>
                          Score anyway
                        </button>
                      )}
                    </div>
                    {r.status === 'duplicate' && r.dupeMatch && (
                      <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>
                        {describeDuplicateMatch(r.dupeMatch)} No scoring credit spent.
                      </div>
                    )}
                    {r.status === 'done' && r.dupeMatch?.tier === 'soft' && (
                      <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>
                        Might be the same as {r.dupeMatch.record.company} · {r.dupeMatch.record.roleTitle}, worth a check.
                      </div>
                    )}
                    {/* Verdict — plain-English read + desirability/
                        competitiveness split beneath the scan line, replacing
                        a bare score as the only signal (Stage 66). */}
                    {r.status === 'done' && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--marker-border)' }}>
                        <VerdictCard job={{ score: r.data?.score, signal: r.data?.signal, signalReason: r.data?.signalReason, factors: r.data?.factors, officeDays: r.data?.officeDays }} compact />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 360, width: '100%' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 10 }}>Score {bringInLines.length} role{bringInLines.length === 1 ? '' : 's'}?</div>
            <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 16 }}>
              This uses up to {bringInLines.length} of your {allowance?.cap ?? '?'} monthly scoring credits ({Math.max((allowance?.cap ?? 0) - (allowance?.used ?? 0), 0)} left right now, shared with the single-role scorer). You choose which results to add to your pipeline afterwards, nothing is added automatically.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={runBringIn} className="btn btn-primary" style={{ fontSize: 13, padding: '9px 16px' }}>Confirm</button>
              <button onClick={() => setConfirmOpen(false)} style={{ background: 'none', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--marker-text)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
