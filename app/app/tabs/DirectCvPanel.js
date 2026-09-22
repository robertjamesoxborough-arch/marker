'use client'

import { useState, useEffect } from 'react'
import { Packer } from 'docx'
import { buildCvDocx } from '../../../lib/cv-docx'
import { MetallicCTA, PasteJdCallout, buildCvFallbackPrompt, buildCoverLetterFallbackPrompt } from '../shared'



export default function DirectCvPanel({ allJobs, profile, updateJob, docType = 'cv', prefill, onClearPrefill, contractorAvailable, onSelectContractor }) {
  const isCover = docType === 'cover'
  const eligibleJobs = (allJobs || []).filter(j => j.status && !['saved', 'rejected', 'withdrawn'].includes(j.status))
  const [selectedJobId, setSelectedJobId] = useState(eligibleJobs[0]?.id || '')
  const [effort, setEffort] = useState('standard')
  const [roleType, setRoleType] = useState('permanent') // 'permanent' | 'fte' — 'contract' routes away, never stored here
  const [twoPhase, setTwoPhase] = useState(false) // simple ask-first/write-now binary — not the retired L1/L2/L3 picker
  const [questions, setQuestions] = useState(null) // null = not asked; array once returned
  const [questionAnswers, setQuestionAnswers] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [jdDraft, setJdDraft] = useState('')
  const [showCopyFallback, setShowCopyFallback] = useState(false)
  const [coverAllowance, setCoverAllowance] = useState(null) // { allowed, used, cap, tier } — cover letters only

  // Cover letters are a paid feature; load the allowance so Free users see a
  // locked state up front (not a failed attempt) and paid users see remaining.
  useEffect(() => {
    if (!isCover) return
    fetch('/api/profile/cover-letter-allowance').then(r => r.ok ? r.json() : null).then(d => d && setCoverAllowance(d)).catch(() => {})
  }, [isCover])

  const coverLocked = isCover && coverAllowance && coverAllowance.cap === 0
  const coverRemaining = isCover && coverAllowance && coverAllowance.cap > 0 ? Math.max(0, coverAllowance.cap - coverAllowance.used) : null

  const selectedJob = eligibleJobs.find(j => j.id === selectedJobId) || eligibleJobs[0]

  useEffect(() => { setJdDraft(''); setShowCopyFallback(false); setQuestions(null); setQuestionAnswers([]) }, [selectedJobId])

  // "Tailor CV" clicked on a pipeline card pre-selects that role here.
  useEffect(() => {
    if (!prefill || isCover) return
    const job = eligibleJobs.find(j => j.id === prefill.jobId)
    if (job) setSelectedJobId(prefill.jobId)
    onClearPrefill?.()
  }, [prefill]) // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadDocx(text) {
    const doc = buildCvDocx(text)
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${isCover ? 'Cover letter' : 'CV'} - ${selectedJob?.company || 'tailored'}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Two-phase (Stage 65): when the toggle is on and no questions have been
  // fetched yet, the first click asks 2-4 clarifying questions instead of
  // generating; the same button re-fires this function once answers are in,
  // and `questions` being non-null routes straight to real generation.
  // `skip` bypasses the ask step entirely for this click, for the "skip"
  // fallback link.
  async function generate(jdOverride, { skip } = {}) {
    const jd = jdOverride ?? selectedJob?.jd
    if (!selectedJob?.roleTitle || !jd) {
      setError('Selected role has no job description stored. Paste it below, then generate.')
      return
    }
    setLoading(true); setError('')
    try {
      const endpoint = isCover ? '/api/cv/cover-letter' : '/api/cv/generate'
      const baseBody = isCover
        ? { roleTitle: selectedJob.roleTitle, company: selectedJob.company || '', jd }
        : { roleTitle: selectedJob.roleTitle, company: selectedJob.company || '', jd, effort, roleType }

      if (!isCover && !skip && !questions && twoPhase && effort !== 'quick') {
        const askRes = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...baseBody, askQuestions: true }) })
        const askData = await askRes.json()
        if (askData.error) { setError(askData.error); return }
        if (askData.type === 'questions' && askData.questions?.length > 0) {
          setQuestions(askData.questions)
          setQuestionAnswers(askData.questions.map(() => ''))
          return
        }
        // No questions came back — fall through and generate directly.
      }

      setResult(null)
      const finalBody = questions
        ? { ...baseBody, answers: questions.map((q, i) => ({ question: q, answer: questionAnswers[i] || '' })).filter(a => a.answer.trim()) }
        : baseBody
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalBody),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
      setQuestions(null); setQuestionAnswers([])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Paste-JD path: persist it onto the pipeline item (so it's there next
  // time too) and generate immediately with the pasted text — no need to
  // wait for the updateJob round-trip before this can proceed.
  function saveJdAndGenerate() {
    const jd = jdDraft.trim()
    if (!jd || !selectedJob) return
    updateJob?.(selectedJob.id, { jd })
    generate(jd)
  }

  // Free tier: show the locked door, not a failed attempt — a one-line
  // description of what it produces plus an upgrade prompt (keeps the upsell).
  if (coverLocked) {
    return (
      <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 26 }}>🔒</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>Cover letters</div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', maxWidth: 340, lineHeight: 1.6 }}>
          Requite writes a tailored cover letter for any role in your pipeline, matched to your CV and the job description, and it never invents a number that is not in your CV. Available on Pro (20/month) and Max (60/month).
        </div>
        <MetallicCTA href="/pricing" style={{ width: 'auto', display: 'inline-block', padding: '10px 20px' }}>Upgrade to unlock →</MetallicCTA>
      </div>
    )
  }

  if (eligibleJobs.length === 0) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-mid)', textAlign: 'center' }}>
        No tracked roles yet. Add roles to your pipeline to generate {isCover ? 'cover letters' : 'tailored CVs'}.
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflowY: 'auto' }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
        {isCover
          ? 'Requite writes a tailored cover letter for the selected role, matched to your CV and the JD. It never invents a number that is not in your CV.'
          : 'Generate a tailored CV sent directly to the API. Output displayed here with verified-stats check.'}
      </div>

      {/* Role picker */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--marker-mid)', marginBottom: 5 }}>ROLE</div>
        <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
          style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-text)' }}>
          {eligibleJobs.map(j => (
            <option key={j.id} value={j.id}>{j.roleTitle}{j.company ? `: ${j.company}` : ''} ({j.status})</option>
          ))}
        </select>
      </div>

      {/* One more step before we can tailor for this role: grab the JD and
          drop it in. A normal step in the flow, not a failure state — so no
          warning colours, no "we couldn't find it" framing. */}
      {selectedJob && !selectedJob.jd && (
        <div style={{ padding: 16, borderRadius: 10, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)' }}>
          <PasteJdCallout jobLink={selectedJob.jobLink} subtext="One more step before we can tailor for this role: grab the description from the posting and drop it in below." />
          <textarea value={jdDraft} onChange={e => setJdDraft(e.target.value)} placeholder="Paste the full job description here…" rows={7}
            style={{ display: 'block', width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--marker-border)', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--marker-text)', background: '#fff', resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }} />
          <MetallicCTA onClick={saveJdAndGenerate} disabled={!jdDraft.trim() || loading}>
            {loading ? (isCover ? 'Writing…' : 'Generating…') : 'Save JD & generate →'}
          </MetallicCTA>
        </div>
      )}

      {/* Role type — CV only; Contract routes to the existing contractor
          path rather than being generated here (Stage 65). */}
      {!isCover && selectedJob?.jd && !questions && (
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--marker-mid)', marginBottom: 5 }}>ROLE TYPE</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'permanent', label: 'Permanent' }, { id: 'fte', label: 'FTC' }, ...(contractorAvailable ? [{ id: 'contract', label: 'Contract' }] : [])].map(rt => (
            <button key={rt.id} onClick={() => rt.id === 'contract' ? onSelectContractor?.() : setRoleType(rt.id)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${roleType === rt.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: roleType === rt.id ? 'var(--marker-black)' : 'transparent', color: roleType === rt.id ? 'var(--marker-cream)' : 'var(--marker-text)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              {rt.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Effort — CV only; cover letters have a single mode */}
      {!isCover && selectedJob?.jd && !questions && (
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--marker-mid)', marginBottom: 5 }}>DEPTH</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'quick', label: 'Gap analysis' }, { id: 'standard', label: 'Tailored CV' }, { id: 'deep', label: 'Full rewrite' }].map(e => (
            <button key={e.id} onClick={() => setEffort(e.id)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${effort === e.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: effort === e.id ? 'var(--marker-black)' : 'transparent', color: effort === e.id ? 'var(--marker-cream)' : 'var(--marker-text)', fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              {e.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Two-phase toggle — a simple ask-first/write-now binary, not the
          retired L1/L2/L3 graduated picker (Stage 65). */}
      {!isCover && selectedJob?.jd && effort !== 'quick' && !questions && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', cursor: 'pointer' }}>
          <input type="checkbox" checked={twoPhase} onChange={e => setTwoPhase(e.target.checked)} />
          Ask me a few quick questions first (richer, a little slower)
        </label>
      )}

      {/* Two-phase questions — optional answers, folded straight back into
          the existing answers/answersSection plumbing on the real generate call. */}
      {questions && (
        <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--marker-mid)', textTransform: 'uppercase' }}>A few quick questions (optional)</div>
          {questions.map((q, i) => (
            <div key={i}>
              <div style={{ fontSize: 13, color: 'var(--marker-black)', marginBottom: 4 }}>{q}</div>
              <input value={questionAnswers[i] || ''} onChange={e => setQuestionAnswers(prev => prev.map((a, idx) => idx === i ? e.target.value : a))}
                placeholder="Your answer (optional)…"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--marker-border)', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--marker-text)', background: '#fff', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>
      )}

      {selectedJob?.jd && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => generate()} disabled={loading}
            style={{ flex: 1, padding: '11px', borderRadius: 8, background: loading ? 'var(--marker-mid)' : 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? (isCover ? 'Writing…' : 'Generating…') : (isCover ? 'Write cover letter' : questions ? 'Generate with answers →' : 'Generate')}
          </button>
          {questions && (
            <button onClick={() => generate(undefined, { skip: true })} disabled={loading}
              style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'transparent', color: 'var(--marker-mid)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}>
              Skip →
            </button>
          )}
        </div>
      )}

      {coverRemaining !== null && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textAlign: 'center' }}>{coverRemaining} of {coverAllowance.cap} cover letters left this month</div>
      )}

      {/* One deliberately-kept copy-paste fallback (Stage 44 #7/#8): for
          people who'd rather use their own Claude/ChatGPT than spend an
          in-app allowance. Clearly secondary to the Generate button above. */}
      {selectedJob && !showCopyFallback && (
        <button onClick={() => setShowCopyFallback(true)}
          style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', textDecoration: 'underline', cursor: 'pointer', alignSelf: 'center' }}>
          Prefer to use your own ChatGPT/Claude? Copy the prompt instead →
        </button>
      )}

      {selectedJob && showCopyFallback && (() => {
        const prompt = isCover
          ? buildCoverLetterFallbackPrompt(selectedJob.roleTitle, selectedJob.company, selectedJob.jobLink, profile?.hard_filters_json?.cvRaw, selectedJob.jd)
          : buildCvFallbackPrompt(selectedJob.roleTitle, selectedJob.company, selectedJob.jobLink, profile?.hard_filters_json?.cvRaw, selectedJob.jd)
        return (
          <div style={{ border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>Copy-paste fallback</div>
              <button onClick={() => setShowCopyFallback(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--marker-mid)', cursor: 'pointer', textDecoration: 'underline' }}>Back to Generate</button>
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--marker-black)', color: 'var(--marker-cream)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 6 }}>Copy this prompt</div>
                  <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: 10, maxHeight: 220, overflowY: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', color: 'var(--marker-text)' }}>{prompt}</pre>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(prompt)}
                    style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 8, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Copy prompt
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--marker-black)', color: 'var(--marker-cream)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                <div style={{ fontSize: 13, color: 'var(--marker-text)', paddingTop: 3 }}>Paste it into Claude or ChatGPT in a new tab, and let it write your {isCover ? 'cover letter' : 'CV'}.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--marker-lime)', borderRadius: 8, padding: '10px 12px' }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--marker-black)', color: 'var(--marker-cream)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                <div style={{ fontSize: 13, color: 'var(--marker-black)', fontWeight: 500, paddingTop: 3 }}>Come back to this tab when it's done: nothing here needs saving in the meantime.</div>
              </div>
            </div>
          </div>
        )
      })()}

      {error && <div style={{ padding: 10, borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', fontFamily: 'var(--font-body)', fontSize: 13, color: '#dc2626' }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.atsCheck && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: result.atsCheck.structureOk ? '#f0fdf4' : '#fffbeb', border: `1px solid ${result.atsCheck.structureOk ? '#86efac' : '#fcd34d'}`, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-black)', lineHeight: 1.6 }}>
              <strong>Format &amp; keyword check:</strong> {result.atsCheck.summary}
            </div>
          )}
          {result.flaggedMetrics && result.flaggedMetrics.length > 0 && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontFamily: 'var(--font-body)', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
              <strong>Verified-stats warning:</strong> The following numbers were not found in your stored CV. Review before using: <strong>{result.flaggedMetrics.join(', ')}</strong>
            </div>
          )}
          {result.flaggedMetrics && result.flaggedMetrics.length === 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#166534', letterSpacing: '0.06em' }}>
              VERIFIED: all metrics trace to your stored CV
            </div>
          )}
          <textarea readOnly value={result.type === 'keywords' ? JSON.stringify(result.data, null, 2) : result.text}
            style={{ width: '100%', minHeight: 320, padding: 12, borderRadius: 8, border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-text)', background: 'var(--marker-cream-2)', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => navigator.clipboard.writeText(result.type === 'keywords' ? JSON.stringify(result.data, null, 2) : result.text)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer', color: 'var(--marker-text)' }}>
              Copy to clipboard
            </button>
            {(result.type === 'cv' || result.type === 'cover_letter') && (
              <button onClick={() => downloadDocx(result.text)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-black)', background: 'var(--marker-black)', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer', color: 'var(--marker-cream)' }}>
                Download as Word (.docx)
              </button>
            )}
          </div>
          {result.gapAnalysis && result.gapAnalysis.length > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--marker-mid)', textTransform: 'uppercase' }}>Honest gap check</div>
              {result.gapAnalysis.map((g, i) => (
                <div key={i} style={{ paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? '1px solid var(--marker-border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 4, background: g.severity === 'hard' ? '#FCA5A5' : '#F5E4A0', color: 'var(--marker-black)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{g.severity || 'note'}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>{g.requirement}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.5, marginBottom: 4 }}>{g.note}</div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5, fontStyle: 'italic' }}>{g.reframe}</div>
                </div>
              ))}
            </div>
          )}
          {result.gapAnalysis && result.gapAnalysis.length === 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#166534', letterSpacing: '0.06em' }}>
              NO SIGNIFICANT GAPS FOUND AGAINST THIS JD
            </div>
          )}
        </div>
      )}
    </div>
  )
}

