'use client'

import { useState, useEffect, useRef } from 'react'
import { track } from '@vercel/analytics'
import { INTERVIEW_STAGES, PasteJdCallout, ProgressBar, STEPS_PREP, renderPrepMarkdown } from '../shared'

const NAV_SECTIONS = [
  { id: 'sec-essentials', label: 'Essentials' },
  { id: 'sec-company',    label: 'Company' },
  { id: 'sec-alignment',  label: 'Alignment' },
  { id: 'sec-questions',  label: 'Questions' },
  { id: 'sec-stories',    label: 'Stories' },
  { id: 'sec-ask',        label: 'Ask them' },
  { id: 'sec-watch',      label: 'Watch outs' },
  { id: 'sec-checklist',  label: 'Checklist' },
]

const KICKER = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 7 }

export default function PrepTab({ jobs, profile, updateJob, onSwitchToPipeline, prefill, onClearPrefill }) {
  const activeJobs = jobs
    .filter(j => ['applied', 'interviewing', 'offer'].includes(j.status))
    .sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0))
  const [selectedJobId, setSelectedJobId] = useState(activeJobs[0]?.id || '')
  const [mode, setMode]                   = useState('prep')
  const [stage, setStage]                 = useState('hiring_manager')
  const [interviewer, setInterviewer]     = useState('')
  const [jdText, setJdText]               = useState('')
  const [cvBase64, setCvBase64]           = useState('')
  const [cvFileName, setCvFileName]       = useState('')
  const [generating, setGenerating]       = useState(false)
  const [pack, setPack]                   = useState(null)     // structured prep pack (mode === 'prep')
  const [result, setResult]               = useState('')       // negotiation markdown (mode === 'negotiate')
  const [error, setError]                 = useState('')
  const [copied, setCopied]               = useState(false)
  const [salary, setSalary]               = useState(null)
  const [offerAmount, setOfferAmount]     = useState('')
  const [targetAmount, setTargetAmount]   = useState('')
  const [negoNotes, setNegoNotes]         = useState('')

  // Feature 3 — two-mode assistant
  const [assistMode, setAssistMode]       = useState('prep')   // 'prep' | 'live'
  const [liveExpanded, setLiveExpanded]   = useState(true)
  const [liveQuestion, setLiveQuestion]   = useState('')
  const [liveAnswer, setLiveAnswer]       = useState('')
  const [liveLoading, setLiveLoading]     = useState(false)
  const [liveError, setLiveError]         = useState('')

  // Feature 1 — "Vary it" reveals the framework skeleton per question
  const [variedIdx, setVariedIdx]         = useState(() => new Set())

  // Feature 2 — stage memory
  const [notes, setNotes]                 = useState([])
  const [notesLoading, setNotesLoading]   = useState(false)
  const [noteDraft, setNoteDraft]         = useState('')
  const [noteSaving, setNoteSaving]       = useState(false)

  const resultsRef = useRef(null)

  const selectedJob = jobs.find(j => j.id === selectedJobId) || null

  useEffect(() => {
    if (!selectedJob?.roleTitle) { setSalary(null); return }
    setSalary(null)
    const body = { roleTitle: selectedJob.roleTitle, company: selectedJob.company || '' }
    if (profile?.seniority) body.profileSeniority = profile.seniority
    fetch('/api/salary-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.salary) setSalary(d.salary) }).catch(() => {})
  }, [selectedJobId])

  // job.jd is the single source of truth — pulled from wherever it was
  // pasted (scorer, CV, cover letter) so interview prep never asks again.
  useEffect(() => {
    setJdText(selectedJob?.jd || '')
  }, [selectedJobId]) // eslint-disable-line react-hooks/exhaustive-deps

  // A pipeline card's "Prep now" reveal (Today, once a role hits
  // Interviewing) pre-selects that role here and jumps straight in.
  useEffect(() => {
    if (!prefill) return
    const job = activeJobs.find(j => j.id === prefill.jobId)
    if (job) { setSelectedJobId(prefill.jobId); setMode('prep') }
    onClearPrefill?.()
  }, [prefill]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cached pack read (Stage 67) — a pack already built for this exact
  // role+stage is stored on the job itself (pipeline_items.score_breakdown_
  // json, safe to overwrite wholesale unlike the notes table below), so
  // returning to it — including walking into the actual interview and
  // reopening Requite — is a zero-latency local read, not a live call.
  useEffect(() => {
    setPack(null); setError(''); setAssistMode('prep'); setVariedIdx(new Set())
    const cached = selectedJob?.interviewPrepByStage?.[stage]
    if (cached?.pack) setPack(cached.pack)
  }, [selectedJobId, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live mode resets to expanded on every entry — Feature 3's explicit
  // requirement that it can never be accidentally left tucked away.
  useEffect(() => {
    if (assistMode === 'live') setLiveExpanded(true)
  }, [assistMode])

  // Stage notes — load whenever the selected role changes (all stages,
  // chronological; not stage-filtered, since a prior stage's note is
  // exactly what later-stage prep needs to see).
  useEffect(() => {
    if (!selectedJobId) { setNotes([]); return }
    setNotesLoading(true)
    fetch(`/api/interview-prep/stage-notes?jobId=${encodeURIComponent(selectedJobId)}`)
      .then(r => r.ok ? r.json() : { notes: [] })
      .then(d => setNotes(d.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false))
  }, [selectedJobId])

  function handleCvFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCvFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const result = ev.target.result
      const b64 = typeof result === 'string' ? result.split(',')[1] : btoa(String.fromCharCode(...new Uint8Array(result)))
      setCvBase64(b64)
    }
    if (file.type === 'application/pdf') {
      reader.readAsDataURL(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  }

  async function generate() {
    if (!selectedJob || generating) return
    setGenerating(true)
    setError('')
    try {
      if (mode === 'negotiate') {
        setResult('')
        const res = await fetch('/api/negotiation-prep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleTitle: selectedJob.roleTitle, company: selectedJob.company, offerAmount: offerAmount.trim(), targetAmount: targetAmount.trim(), notes: negoNotes.trim(), jdText: (selectedJob.jd || '').slice(0, 2000) }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Generation failed'); return }
        setResult(data.prep || '')
      } else {
        setPack(null)
        const trimmedJd = jdText.trim()
        if (trimmedJd && trimmedJd !== (selectedJob.jd || '')) updateJob?.(selectedJob.id, { jd: trimmedJd })
        const res = await fetch('/api/interview-prep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job: selectedJob, stage, interviewer: interviewer.trim(), jdText: trimmedJd, cvBase64: cvBase64 || undefined }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Generation failed'); return }
        track('interview_prep_generated', { stage })
        setPack(data.pack)
        setAssistMode('prep')
        setVariedIdx(new Set())
        // Cache the freshly built pack on the job itself, keyed by stage,
        // merged with whatever other stages' packs are already cached —
        // never clobbering them.
        const existing = selectedJob.interviewPrepByStage || {}
        updateJob?.(selectedJob.id, { interviewPrepByStage: { ...existing, [stage]: { pack: data.pack, generatedAt: new Date().toISOString() } } })
      }
    } catch {
      setError('Request failed. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function addNote() {
    const text = noteDraft.trim()
    if (!text || !selectedJobId || noteSaving) return
    setNoteSaving(true)
    try {
      const res = await fetch('/api/interview-prep/stage-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJobId, stage, note: text }),
      })
      const data = await res.json()
      if (res.ok && data.note) {
        setNotes(prev => [...prev, data.note])
        setNoteDraft('')
      }
    } catch { /* leave draft in place so nothing typed is lost */ }
    finally { setNoteSaving(false) }
  }

  async function askLive() {
    const q = liveQuestion.trim()
    if (!q || liveLoading) return
    setLiveLoading(true); setLiveError(''); setLiveAnswer('')
    try {
      const packSummary = pack ? `${pack.tldr?.roleSummary || ''} Key focus: ${pack.tldr?.landThis || ''}`.trim() : ''
      const res = await fetch('/api/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'live', job: selectedJob, stage, question: q, packSummary }),
      })
      const data = await res.json()
      if (!res.ok) { setLiveError(data.error || 'Could not get an answer'); return }
      setLiveAnswer(data.answer || '')
    } catch {
      setLiveError('Request failed. Try again.')
    } finally {
      setLiveLoading(false)
    }
  }

  function copy() {
    const text = mode === 'negotiate' ? result : JSON.stringify(pack, null, 2)
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function jumpTo(id) {
    resultsRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleVary(i) {
    setVariedIdx(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })
  }

  if (activeJobs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO APPLIED ROLES</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>Mark a role as Applied first</div>
        <div style={{ fontSize: 14, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>Interview prep is available for roles at the Applied, Interviewing, or Offer stage in your pipeline.</div>
        {onSwitchToPipeline && (
          <button onClick={onSwitchToPipeline} style={{ marginTop: 4, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Go to Pipeline →</button>
        )}
      </div>
    )
  }

  const offerJobs = activeJobs.filter(j => j.status === 'offer')
  const showForwardNudge = mode === 'prep' && selectedJob && ['considering', 'to_apply', 'applied'].includes(selectedJob.status)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Tab purpose header + mode toggle */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--marker-border)', marginBottom: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>
          {mode === 'negotiate' ? 'Negotiate your offer' : 'Prep for your interview'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
          {mode === 'negotiate'
            ? 'Scripts, counter-offer strategy, and BATNA for your offer-stage role, grounded in your profile and market data.'
            : 'Pick a role and get a full prep pack: what the role actually is, ready-to-speak answers for the likely questions, and a Live mode for the room itself.'}
        </div>
        {offerJobs.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {[{ id: 'prep', label: 'Interview prep' }, { id: 'negotiate', label: 'Negotiate offer' }].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setPack(null); setResult(''); setError('') }}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${mode === m.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: mode === m.id ? 'var(--marker-black)' : 'transparent', color: mode === m.id ? 'var(--marker-cream)' : 'var(--marker-text)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

    <div style={{ padding: '16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Job selector */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Role</label>
        <select value={selectedJobId} onChange={e => { setSelectedJobId(e.target.value); setError('') }}
          style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}>
          {(mode === 'negotiate' ? offerJobs : activeJobs).map(j => <option key={j.id} value={j.id}>{j.company}: {j.roleTitle || 'Untitled'}</option>)}
        </select>
        {salary && (
          <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
            Market rate for this role: <span style={{ color: 'var(--marker-black)', fontWeight: 700 }}>{salary.source === 'adzuna' ? `£${salary.min}k–£${salary.max}k` : `~£${salary.min}k–£${salary.max}k (est)`}</span>
            <span style={{ marginLeft: 6, color: 'var(--marker-border)' }}>· {salary.source === 'adzuna' ? 'Adzuna data' : 'Static estimate'}</span>
          </div>
        )}
      </div>

      {/* Forwards-only pipeline move — explicit, never silent, never backward */}
      {showForwardNudge && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div style={{ flex: 1, fontSize: 12, color: '#92400E' }}>Prepping for an interview? Your pipeline still shows this as <strong>{selectedJob.status}</strong>.</div>
          <button onClick={() => updateJob?.(selectedJob.id, { status: 'interviewing' })}
            style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, background: '#92400E', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 5, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            Move to Interviewing →
          </button>
        </div>
      )}

      {/* Interview prep inputs */}
      {mode === 'prep' && (<>
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Interview stage</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {INTERVIEW_STAGES.map(s => (
            <button key={s.id} onClick={() => setStage(s.id)} style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: `1px solid ${stage === s.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: stage === s.id ? 'var(--marker-black)' : 'var(--marker-cream-2)', color: stage === s.id ? 'var(--marker-cream)' : 'var(--marker-text)', cursor: 'pointer' }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.55, marginTop: 2 }}>{s.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Stage memory — prior notes feed later-stage generation and
          outrank the JD in the prompt (see the route). Shown regardless of
          which stage is currently selected: a note from screening is still
          exactly what final-round prep needs to see. */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>
          Notes from this process <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(what actually happened — feeds every later prep pack)</span>
        </label>
        {notes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {notes.map(n => (
              <div key={n.id} style={{ padding: '7px 10px', borderRadius: 6, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
                  {INTERVIEW_STAGES.find(s => s.id === n.stage)?.label || n.stage} · {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.5 }}>{n.note}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="e.g. They flagged my lack of X as a concern…"
            onKeyDown={e => { if (e.key === 'Enter') addNote() }}
            style={{ flex: 1, padding: '8px 10px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 6, background: '#fff', color: 'var(--marker-text)', outline: 'none', fontFamily: 'var(--font-body)' }} />
          <button onClick={addNote} disabled={!noteDraft.trim() || noteSaving}
            style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, background: noteDraft.trim() ? 'var(--marker-black)' : 'var(--marker-border)', color: noteDraft.trim() ? 'var(--marker-cream)' : 'var(--marker-mid)', border: 'none', padding: '0 12px', borderRadius: 6, cursor: noteDraft.trim() ? 'pointer' : 'default', letterSpacing: '0.04em' }}>
            {noteSaving ? '…' : 'ADD'}
          </button>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Interviewer name / title <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional)</span></label>
        <input value={interviewer} onChange={e => setInterviewer(e.target.value)} placeholder="e.g. Sarah Chen, Head of Department" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
      </div>
      <div>
        {selectedJob?.jd ? (
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Job description <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(pulled from this role, edit if needed)</span></label>
        ) : (
          <PasteJdCallout subtext="Claude will research the company live via web search regardless, but the JD is what makes prep specific to this role." />
        )}
        <textarea value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the full job description here…" rows={selectedJob?.jd ? 4 : 7} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>CV you submitted <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional; PDF only, for targeted STAR answers)</span></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-black)', color: 'var(--marker-cream)', padding: '4px 10px', borderRadius: 4, letterSpacing: '0.04em', flexShrink: 0 }}>CHOOSE FILE</span>
          <span style={{ fontSize: 12, color: cvFileName ? 'var(--marker-text)' : 'var(--marker-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cvFileName || 'No file chosen'}</span>
          <input type="file" accept=".pdf" onChange={handleCvFile} style={{ display: 'none' }} />
        </label>
      </div>
      </>)}

      {/* Negotiation inputs */}
      {mode === 'negotiate' && (<>
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Offer received <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional)</span></label>
        <input value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="e.g. £85,000 + 10% bonus" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Your target <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional)</span></label>
        <input value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="e.g. £95,000 + equity" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Notes <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(competing offers, walk-away, must-haves)</span></label>
        <textarea value={negoNotes} onChange={e => setNegoNotes(e.target.value)} placeholder="e.g. Competing offer at £90k. Must have fully remote. Walk-away under £80k." rows={3} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      </>)}

      <button
        onClick={generate}
        disabled={generating || !selectedJob}
        style={{ background: !selectedJob ? 'var(--marker-border)' : 'var(--marker-black)', color: !selectedJob ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: !selectedJob ? 'default' : 'pointer' }}
      >
        {generating ? 'Generating…' : mode === 'negotiate' ? 'Generate negotiation pack' : pack ? 'Regenerate prep pack' : 'Generate prep pack'}
      </button>

      {generating && (
        <div style={{ padding: '16px 0 4px' }}>
          <ProgressBar duration={mode === 'negotiate' ? 15 : 50} steps={STEPS_PREP} slowAt={mode === 'negotiate' ? 10 : 32} slowMsg={mode === 'negotiate' ? 'Preparing your negotiation scripts and market analysis…' : "Web search adds time here; Claude's looking up the actual company, not guessing from training data."} />
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#B91C1C', padding: '10px 12px', background: '#FEE2E2', borderRadius: 8 }}>{error}</div>}

      {/* Negotiation result — unchanged markdown rendering */}
      {mode === 'negotiate' && result && (
        <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Negotiation pack</div>
            <button onClick={copy} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: copied ? 'var(--marker-lime)' : 'var(--marker-border)', color: 'var(--marker-black)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em' }}>
              {copied ? 'COPIED ✓' : 'COPY'}
            </button>
          </div>
          <div style={{ padding: 14, fontSize: 12, maxHeight: 600, overflowY: 'auto', fontFamily: 'var(--font-body)' }}>
            {renderPrepMarkdown(result)}
          </div>
        </div>
      )}

      {/* ── Feature 4: TLDR hero + sticky nav + sectioned pack ── */}
      {mode === 'prep' && pack && (
        <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>

          {/* TLDR hero — always visible, never scrolls away */}
          <div style={{ padding: '14px 16px', background: 'var(--marker-black)', color: 'var(--marker-cream)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>What this role actually is</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 10 }}>{pack.tldr?.roleSummary}</div>
            {pack.tldr?.decidingFactors?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {pack.tldr.decidingFactors.map((f, i) => (
                  <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 9px', borderRadius: 5, background: 'rgba(198,244,50,0.18)', border: '1px solid rgba(198,244,50,0.4)', color: 'var(--marker-lime)' }}>{f}</span>
                ))}
              </div>
            )}
            {pack.tldr?.landThis && (
              <div style={{ fontSize: 12, lineHeight: 1.5, padding: '8px 10px', background: 'rgba(198,244,50,0.1)', borderRadius: 6, borderLeft: '3px solid var(--marker-lime)' }}>
                <strong>Land this above all:</strong> {pack.tldr.landThis}
              </div>
            )}
            {pack.tldr?.whatsChanged && (
              <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 8, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>
                What&apos;s changed since the JD: {pack.tldr.whatsChanged}
              </div>
            )}
          </div>

          {/* Prep / Live toggle */}
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream)' }}>
            {[{ id: 'prep', label: 'Prep' }, { id: 'live', label: 'Live' }].map(m => (
              <button key={m.id} onClick={() => setAssistMode(m.id)}
                style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1px solid ${assistMode === m.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: assistMode === m.id ? 'var(--marker-black)' : 'transparent', color: assistMode === m.id ? 'var(--marker-cream)' : 'var(--marker-text)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                {m.label}
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button onClick={copy} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: copied ? 'var(--marker-lime)' : 'var(--marker-border)', color: 'var(--marker-black)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {copied ? 'COPIED ✓' : 'COPY'}
              </button>
            </div>
          </div>

          {assistMode === 'live' ? (
            <div style={{ padding: 14 }}>
              <button onClick={() => setLiveExpanded(o => !o)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '9px 12px', cursor: 'pointer', marginBottom: liveExpanded ? 10 : 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>QUICK-TAP CUES ({pack.liveCues?.length || 0})</span>
                <span style={{ fontSize: 12 }}>{liveExpanded ? '▾' : '▸'}</span>
              </button>
              {liveExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {(pack.liveCues || []).map((c, i) => <LiveCueCard key={i} cue={c} />)}
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--marker-border)', paddingTop: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginBottom: 6 }}>SOMETHING ELSE? ASK NOW</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={liveQuestion} onChange={e => setLiveQuestion(e.target.value)} placeholder="Type what they just asked…"
                    onKeyDown={e => { if (e.key === 'Enter') askLive() }}
                    style={{ flex: 1, padding: '9px 10px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 6, background: '#fff', color: 'var(--marker-text)', outline: 'none', fontFamily: 'var(--font-body)' }} />
                  <button onClick={askLive} disabled={!liveQuestion.trim() || liveLoading}
                    style={{ flexShrink: 0, background: liveQuestion.trim() ? 'var(--marker-black)' : 'var(--marker-border)', color: liveQuestion.trim() ? 'var(--marker-cream)' : 'var(--marker-mid)', border: 'none', padding: '0 14px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: liveQuestion.trim() ? 'pointer' : 'default' }}>
                    {liveLoading ? 'A few secs…' : 'Ask'}
                  </button>
                </div>
                {liveError && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 8 }}>{liveError}</div>}
                {liveAnswer && (
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #86EFAC' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#166534', letterSpacing: '0.04em', marginBottom: 4 }}>SAY:</div>
                    <div style={{ fontSize: 13, color: 'var(--marker-black)', lineHeight: 1.55 }}>{liveAnswer}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Sticky section nav */}
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 12px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream)', position: 'sticky', top: 0, zIndex: 1 }}>
                {NAV_SECTIONS.map(s => (
                  <button key={s.id} onClick={() => jumpTo(s.id)}
                    style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.03em', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 5, padding: '5px 9px', color: 'var(--marker-text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div ref={resultsRef} style={{ padding: 14, fontSize: 12, maxHeight: 560, overflowY: 'auto', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', gap: 20 }}>

                <section id="sec-essentials">
                  <div style={KICKER}>JD essentials — what this role actually wants</div>
                  {renderPrepMarkdown(pack.jdEssentials)}
                </section>

                <section id="sec-company">
                  <div style={KICKER}>Company intel</div>
                  {renderPrepMarkdown(pack.companyIntel)}
                </section>

                <section id="sec-alignment">
                  <div style={KICKER}>Role alignment</div>
                  {renderPrepMarkdown(pack.roleAlignment)}
                </section>

                <section id="sec-questions">
                  <div style={KICKER}>Likely questions — scripted answers</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(pack.likelyQuestions || []).map((q, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid var(--marker-border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>{q.question}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#166534', background: '#F0FDF4', border: '1px solid #86EFAC', padding: '2px 7px', borderRadius: 4, marginTop: 2 }}>SAY</span>
                          <div style={{ fontSize: 12.5, color: 'var(--marker-text)', lineHeight: 1.65, fontStyle: 'italic' }}>&ldquo;{q.say}&rdquo;</div>
                        </div>
                        <button onClick={() => toggleVary(i)} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', textDecoration: 'underline', cursor: 'pointer', letterSpacing: '0.03em' }}>
                          {variedIdx.has(i) ? 'Hide framework' : 'Vary it — show the framework instead'}
                        </button>
                        {variedIdx.has(i) && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--marker-border)', fontSize: 11.5, color: 'var(--marker-mid)', lineHeight: 1.6 }}>{q.framework}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section id="sec-stories">
                  <div style={KICKER}>Stories to prepare (STAR)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(pack.stories || []).map((s, i) => (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid var(--marker-border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 6 }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.6 }}><strong>Situation:</strong> {s.situation}</div>
                        <div style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.6 }}><strong>Action:</strong> {s.action}</div>
                        <div style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.6 }}><strong>Result:</strong> {s.result}</div>
                        <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6, fontStyle: 'italic', marginTop: 4 }}>{s.why}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section id="sec-ask">
                  <div style={KICKER}>Questions to ask them</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                    {(pack.questionsToAsk || []).map((q, i) => <li key={i} style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.7, marginBottom: 3 }}>{q}</li>)}
                  </ul>
                </section>

                <section id="sec-watch">
                  <div style={KICKER}>Watch outs</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                    {(pack.watchOuts || []).map((w, i) => <li key={i} style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.7, marginBottom: 3 }}>{w}</li>)}
                  </ul>
                </section>

                <section id="sec-checklist">
                  <div style={KICKER}>Prep checklist</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                    {(pack.checklist || []).map((c, i) => <li key={i} style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.7, marginBottom: 3 }}>{c}</li>)}
                  </ul>
                </section>
              </div>
            </>
          )}
        </div>
      )}

      <div className="legal-line">{mode === 'negotiate' ? 'AI negotiation coaching. Market data from Adzuna. Verify figures independently.' : 'Live web research via Claude, cost absorbed by Requite. Pack build takes 30–60 seconds; Live mode cues are instant, free-text answers take a few seconds.'}</div>
    </div>
    </div>
  )
}

function LiveCueCard({ cue }) {
  const [open, setOpen] = useState(false)
  return (
    <button onClick={() => setOpen(o => !o)}
      style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--marker-border)', background: open ? '#F0FDF4' : '#fff', cursor: 'pointer' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--marker-black)' }}>{cue.trigger}</div>
      {open && <div style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.55, marginTop: 6 }}>{cue.cue}</div>}
    </button>
  )
}
