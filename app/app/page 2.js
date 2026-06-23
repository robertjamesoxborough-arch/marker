'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { loadJobs, saveJobs, updateJobInDb, deleteJobFromDb, getProfile, loadFeedFromDb } from '../../lib/db'
import { createClient } from '../../lib/supabase/client'
import s from './dashboard.module.css'

// ── Shared primitives ──────────────────────────────────────────────

function Logo({ size = 18 }) {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--marker-black)', display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      marker
      <span className="holo-dot" style={{ display: 'inline-block', width: '0.32em', height: '0.32em', borderRadius: '50%', marginLeft: '0.05em', position: 'relative', top: '-0.55em', flexShrink: 0 }} />
    </span>
  )
}

function AdzunaBadge() {
  return <div className="adzuna-badge">Jobs by Adzuna</div>
}

function ScoreBadge({ score }) {
  const n = parseFloat(score) || 0
  const top = n >= 9
  const bg = top ? undefined : n >= 7 ? 'var(--marker-lime)' : n >= 5 ? 'var(--marker-cream)' : 'var(--marker-border)'
  const border = top ? 'transparent' : n >= 7 ? 'var(--marker-lime)' : 'var(--marker-border)'
  return (
    <div className={top ? 'holo-foil' : ''} style={{ background: bg, border: `1px solid ${border}`, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, padding: '2px 8px', borderRadius: 5, color: 'var(--marker-black)', flexShrink: 0 }}>
      {n > 0 ? score : '–'}
    </div>
  )
}

function OfficeBadge({ days }) {
  if (days === undefined || days === null) return null
  const d = parseFloat(days)
  const bg = d <= 1 ? 'var(--marker-lime)' : d <= 2 ? '#F0E0A8' : '#E8B8B8'
  const label = d === 0 ? 'Remote' : `${d}d`
  return <span style={{ background: bg, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, color: 'var(--marker-black)' }}>{label}</span>
}

function SignalBadge({ signal }) {
  if (!signal) return null
  const bg = signal === 'apply' ? 'var(--marker-lime)' : signal === 'maybe' ? '#F0E0A8' : '#E8B8B8'
  return <span style={{ background: bg, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-black)' }}>{signal}</span>
}

// ── Pipeline card — matches ProductMobileUI.jsx exactly ───────────

function PipelineCard({ job, onEditDetails, onDelete, onScore, onTailorCv }) {
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const bd = (() => { try { return typeof job.scoreBreakdown === 'string' ? JSON.parse(job.scoreBreakdown) : (job.scoreBreakdown || {}) } catch { return {} } })()
  const factors = job.factors || bd.factors || null
  const isAdzuna = job.source === 'adzuna' || bd.source === 'adzuna'

  return (
    <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '—'}</div>
        </div>
        <ScoreBadge score={job.score} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <SignalBadge signal={job.signal} />
        <OfficeBadge days={job.officeDays} />
        {bd.salary && <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4 }}>{bd.salary}</span>}
        {bd.wlb && <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4 }}>WLB {bd.wlb}</span>}
      </div>

      {job.signal === 'skip' && job.signalReason && (
        <div style={{ fontSize: 11, color: 'var(--marker-mid)', fontStyle: 'italic', lineHeight: 1.4, marginBottom: 8 }}>{job.signalReason}</div>
      )}

      {breakdownOpen && factors && (
        <div style={{ marginBottom: 8, padding: 10, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
            {Object.entries(factors).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--marker-border)' }}>
                <span style={{ color: 'var(--marker-mid)', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span style={{ color: 'var(--marker-black)' }}>{typeof v === 'object' ? (v.score ?? v.found ?? JSON.stringify(v)) : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid var(--marker-border)', marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => onTailorCv(job)} style={{ flex: 1, minWidth: 80, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Tailor CV</button>
        <button onClick={() => setBreakdownOpen(o => !o)} style={{ flex: 1, minWidth: 80, background: 'transparent', color: 'var(--marker-text)', border: '1px solid var(--marker-border)', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
          {breakdownOpen ? 'Hide' : 'Breakdown'}
        </button>
        {job.jobLink && (
          <button onClick={() => onScore(job)} style={{ flex: 1, minWidth: 60, background: job.score ? 'transparent' : 'var(--marker-lime)', color: 'var(--marker-black)', border: job.score ? '1px solid var(--marker-border)' : 'none', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>{job.score ? 'Re-score' : 'Score'}</button>
        )}
        <button onClick={() => onEditDetails(job)} style={{ background: 'transparent', color: 'var(--marker-mid)', border: '1px solid var(--marker-border)', padding: '7px 9px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }} title="Edit details">✏️</button>
        {isAdzuna && <AdzunaBadge />}
      </div>
    </div>
  )
}

// ── Column definitions ────────────────────────────────────────────

const COLUMNS = [
  { id: 'watchlist',      label: 'Watchlist' },
  { id: 'no_jobs',        label: 'No jobs' },
  { id: 'considering',    label: 'Worth applying?' },
  { id: 'to_apply',       label: 'Going to apply' },
  { id: 'applied',        label: 'Applied' },
  { id: 'interviewing',   label: 'Interviewing' },
  { id: 'offer',          label: 'Offer' },
  { id: 'rejected',       label: 'Rejected' },
]

// ── Add job modal ─────────────────────────────────────────────────

function AddJobModal({ onClose, onAdd }) {
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [jobLink, setJobLink] = useState('')
  const [office, setOffice] = useState('2')
  const [status, setStatus] = useState('considering')

  function submit() {
    if (!company.trim()) return
    onAdd({ id: crypto.randomUUID(), company: company.trim(), roleTitle: role.trim(), jobLink: jobLink.trim(), officeDays: parseFloat(office) || 2, status, ranking: 1, signal: '', signalReason: '', score: 0, scoreBreakdown: '', jd: '', link: '', addedAt: new Date().toISOString() })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, marginBottom: 20 }}>Add role</div>
        {[
          { label: 'Company', value: company, set: setCompany, placeholder: 'Monzo', required: true },
          { label: 'Role title', value: role, set: setRole, placeholder: 'Staff Product Manager' },
          { label: 'Job link', value: jobLink, set: setJobLink, placeholder: 'https://...' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>{f.label}{f.required && ' *'}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Office days / wk</label>
            <input type="number" min="0" max="5" step="0.5" value={office} onChange={e => setOffice(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Column</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={submit} className="btn btn-primary" disabled={!company.trim()}>Add role</button>
        </div>
      </div>
    </div>
  )
}

// ── Edit job modal ────────────────────────────────────────────────

function EditJobModal({ job, onClose, onSave, onDelete }) {
  const [company, setCompany]   = useState(job.company || '')
  const [role, setRole]         = useState(job.roleTitle || '')
  const [jobLink, setJobLink]   = useState(job.jobLink || '')
  const [office, setOffice]     = useState(String(job.officeDays ?? 2))
  const [status, setStatus]     = useState(job.status || 'watchlist')
  const [notes, setNotes]       = useState(job.jd || '')

  function save() {
    if (!company.trim()) return
    onSave({ ...job, company: company.trim(), roleTitle: role.trim(), jobLink: jobLink.trim(), officeDays: parseFloat(office) || 2, status, jd: notes })
    onClose()
  }

  function remove() {
    if (!confirm(`Remove ${job.company || 'this role'}?`)) return
    onDelete(job.id)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, marginBottom: 20 }}>Edit role</div>
        {[
          { label: 'Company *', value: company, set: setCompany, placeholder: 'Monzo' },
          { label: 'Role title', value: role, set: setRole, placeholder: 'Head of Partnerships' },
          { label: 'Job link', value: jobLink, set: setJobLink, placeholder: 'https://...' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>{f.label}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Office days / wk</label>
            <input type="number" min="0" max="5" step="0.5" value={office} onChange={e => setOffice(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Pipeline stage</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box' }}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Paste the JD, add notes…" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button onClick={remove} style={{ background: 'none', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Remove</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button onClick={save} className="btn btn-primary" disabled={!company.trim()}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Interview Prep tab ────────────────────────────────────────────

const INTERVIEW_STAGES = [
  { id: 'screening',      label: 'Screening call',    sub: 'HR / talent, 20-30 min' },
  { id: 'hiring_manager', label: 'Hiring manager',    sub: 'Deep role + competency' },
  { id: 'panel',          label: 'Panel',             sub: 'Multiple stakeholders' },
  { id: 'task',           label: 'Task / case study', sub: 'Presentation or exercise' },
  { id: 'final',          label: 'Final round',       sub: 'Last 2-3 candidates' },
  { id: 'ceo',            label: 'CEO / exec',        sub: 'Strategic, vision-level' },
]

function PrepTab({ jobs }) {
  const activeJobs = jobs.filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))
  const [selectedJobId, setSelectedJobId] = useState(activeJobs[0]?.id || '')
  const [stage, setStage]                 = useState('hiring_manager')
  const [interviewer, setInterviewer]     = useState('')
  const [jdText, setJdText]               = useState('')
  const [generating, setGenerating]       = useState(false)
  const [result, setResult]               = useState('')
  const [error, setError]                 = useState('')
  const [copied, setCopied]               = useState(false)

  const selectedJob = jobs.find(j => j.id === selectedJobId) || null

  async function generate() {
    if (!selectedJob || generating) return
    setGenerating(true)
    setResult('')
    setError('')
    try {
      const res = await fetch('/api/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: selectedJob, stage, interviewer: interviewer.trim(), jdText: jdText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Generation failed'); return }
      track('interview_prep_generated', { stage })
      setResult(data.prep || '')
    } catch {
      setError('Request failed — try again.')
    } finally {
      setGenerating(false)
    }
  }

  function copy() {
    navigator.clipboard.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  if (activeJobs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO ACTIVE ROLES</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>Add roles to your pipeline first</div>
        <div style={{ fontSize: 14, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>Interview prep is generated for roles in your pipeline at the considering, applying, applied, or interviewing stage.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 4 }}>Interview Prep</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>Company research + tailored questions + STAR stories · powered by Claude</div>
      </div>

      {/* Job selector */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Role</label>
        <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}>
          {activeJobs.map(j => <option key={j.id} value={j.id}>{j.company} — {j.roleTitle || 'Untitled'}</option>)}
        </select>
      </div>

      {/* Stage selector */}
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

      {/* Interviewer */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Interviewer name / title <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional)</span></label>
        <input value={interviewer} onChange={e => setInterviewer(e.target.value)} placeholder="e.g. Sarah Chen, VP Product" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
      </div>

      {/* JD paste */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Job description <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(paste for best results)</span></label>
        <textarea value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the JD here — Claude will research the company live via web search regardless…" rows={4} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', resize: 'vertical', lineHeight: 1.5 }} />
      </div>

      <button
        onClick={generate}
        disabled={generating || !selectedJob}
        style={{ background: !selectedJob ? 'var(--marker-border)' : 'var(--marker-black)', color: !selectedJob ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: !selectedJob ? 'default' : 'pointer' }}
      >
        {generating ? 'Researching + generating (30-60s)…' : 'Generate prep pack'}
      </button>

      {error && <div style={{ fontSize: 12, color: '#B91C1C', padding: '10px 12px', background: '#FEE2E2', borderRadius: 8 }}>{error}</div>}

      {result && (
        <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Prep pack</div>
            <button onClick={copy} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: copied ? 'var(--marker-lime)' : 'var(--marker-border)', color: 'var(--marker-black)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em' }}>
              {copied ? 'COPIED ✓' : 'COPY'}
            </button>
          </div>
          <div style={{ padding: 14, fontSize: 12, lineHeight: 1.7, color: 'var(--marker-text)', whiteSpace: 'pre-wrap', maxHeight: 600, overflowY: 'auto', fontFamily: 'var(--font-body)' }}>
            {result}
          </div>
        </div>
      )}

      <div className="legal-line">Live web research included. Takes 30-60 seconds. Uses your Anthropic API key.</div>
    </div>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────

const FUNNEL = [
  { id: 'watchlist',   label: 'Watchlist',       color: 'var(--marker-border)' },
  { id: 'considering', label: 'Worth applying?',  color: '#C4B5FD' },
  { id: 'to_apply',    label: 'Going to apply',   color: '#93C5FD' },
  { id: 'applied',     label: 'Applied',          color: 'var(--marker-lime)' },
  { id: 'interviewing',label: 'Interviewing',     color: '#FCD34D' },
  { id: 'offer',       label: 'Offer',            color: '#6EE7B7' },
  { id: 'rejected',    label: 'Rejected',         color: '#FCA5A5' },
]

function StatsTab({ jobs }) {
  const total = jobs.length
  const scored = jobs.filter(j => parseFloat(j.score) > 0)
  const avgScore = scored.length ? (scored.reduce((s, j) => s + parseFloat(j.score), 0) / scored.length).toFixed(1) : null
  const maxCount = Math.max(...FUNNEL.map(f => jobs.filter(j => j.status === f.id).length), 1)

  const topJobs = [...scored].sort((a, b) => parseFloat(b.score) - parseFloat(a.score)).slice(0, 5)

  const scoreBuckets = [
    { label: '9-10', min: 9, max: 10, color: 'var(--marker-black)' },
    { label: '7-8',  min: 7, max: 9,  color: 'var(--marker-lime)' },
    { label: '5-6',  min: 5, max: 7,  color: '#FCD34D' },
    { label: '1-4',  min: 0, max: 5,  color: '#FCA5A5' },
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

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'Total roles', value: total },
          { label: 'Scored', value: `${scored.length}/${total}` },
          { label: 'Avg score', value: avgScore ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>{value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>

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
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '—'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2 }}>{job.company}</div>
                </div>
                <ScoreBadge score={job.score} />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── CV Generator tab ──────────────────────────────────────────────

const EFFORT_LEVELS = [
  { id: 'none',   label: 'Zero effort', sub: 'AI writes now — no questions',     cvEffort: 'standard' },
  { id: 'light',  label: 'Light',       sub: '2 questions · adds real context',   cvEffort: 'standard' },
  { id: 'medium', label: 'Medium',      sub: '4 questions · stronger tailoring',  cvEffort: 'deep'     },
  { id: 'deep',   label: 'Deep',        sub: '7 questions · maximum precision',   cvEffort: 'deep'     },
]

function CvTab({ profile, jobs: allJobs, updateJob, prefill, onClearPrefill }) {
  const cvRaw = profile?.hard_filters_json?.cvRaw || ''
  const pipelineJobs = (allJobs || []).filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))

  const [step,          setStep]          = useState('setup')
  const [mode,          setMode]          = useState('cv')
  const [effort,        setEffort]        = useState('light')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [jdText,        setJdText]        = useState('')
  const [manualTitle,   setManualTitle]   = useState('')
  const [manualCompany, setManualCompany] = useState('')
  const [useManual,     setUseManual]     = useState(false)
  const [questions,     setQuestions]     = useState([])
  const [answers,       setAnswers]       = useState({})
  const [loadingQ,      setLoadingQ]      = useState(false)
  const [generating,    setGenerating]    = useState(false)
  const [result,        setResult]        = useState(null)
  const [error,         setError]         = useState('')
  const [copied,        setCopied]        = useState(false)
  const [markedApplied, setMarkedApplied] = useState(false)

  const selectedJob = pipelineJobs.find(j => j.id === selectedJobId) || null

  useEffect(() => {
    if (!prefill) return
    if (prefill.jobId) {
      setSelectedJobId(prefill.jobId)
      setUseManual(false)
    } else if (prefill.jobTitle) {
      setManualTitle(prefill.jobTitle)
      setManualCompany(prefill.company || '')
      setUseManual(true)
    }
    onClearPrefill?.()
  }, [prefill])

  useEffect(() => {
    if (!useManual && selectedJob) setJdText(selectedJob.jd || '')
  }, [selectedJobId, useManual])

  const roleTitle = useManual ? manualTitle : (selectedJob?.roleTitle || '')
  const company   = useManual ? manualCompany : (selectedJob?.company || '')

  function reset() {
    setStep('setup'); setResult(null); setError(''); setQuestions([]); setAnswers({}); setMarkedApplied(false)
  }

  async function proceed() {
    if (!roleTitle.trim()) { setError('Select a role or enter a job title.'); return }
    setError('')
    if (effort === 'none') { await doGenerate([]); return }
    setLoadingQ(true)
    try {
      const res = await fetch('/api/cv/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleTitle, company, jd: jdText, mode, effort }),
      })
      const data = await res.json()
      const qs = data.questions || []
      if (qs.length === 0) { await doGenerate([]); return }
      setQuestions(qs)
      setAnswers(Object.fromEntries(qs.map((_, i) => [i, ''])))
      setStep('questions')
    } catch {
      setError('Failed to load questions — generating directly.')
      await doGenerate([])
    } finally {
      setLoadingQ(false)
    }
  }

  async function doGenerate(answersArr) {
    setGenerating(true); setResult(null); setError('')
    try {
      const el = EFFORT_LEVELS.find(e => e.id === effort)
      const endpoint = mode === 'cover' ? '/api/cv/cover-letter' : '/api/cv/generate'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleTitle: roleTitle.trim(), company: company.trim(), jd: jdText.trim(), effort: el?.cvEffort || 'standard', answers: answersArr }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Generation failed'); return }
      track(mode === 'cover' ? 'cover_letter_generated' : 'cv_generated', { effort })
      setResult(data); setStep('result')
    } catch {
      setError('Request failed — try again.')
    } finally {
      setGenerating(false)
    }
  }

  function submitAnswers() {
    doGenerate(questions.map((q, i) => ({ question: q, answer: answers[i] || '' })))
  }

  function copy() {
    const text = result?.type === 'cv' ? result.text : result?.type === 'text' ? result.text : JSON.stringify(result?.data, null, 2)
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function markApplied() {
    if (!selectedJob || markedApplied || !updateJob) return
    updateJob(selectedJob.id, { status: 'applied' })
    setMarkedApplied(true)
  }

  if (!cvRaw) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO CV ON FILE</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>Add your CV first</div>
        <div style={{ fontSize: 14, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>Paste your CV during onboarding so we can tailor it for each role.</div>
        <a href="/api/dev/reset-onboard" style={{ marginTop: 8, fontSize: 13, color: 'var(--marker-black)', fontWeight: 500 }}>Re-do onboarding</a>
      </div>
    )
  }

  // ─── SETUP ────────────────────────────────────────────────────────
  if (step === 'setup') return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>CV &amp; Cover Letter</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>Select a role from your pipeline · Claude tailors your application</div>
      </div>

      {/* Mode */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[{ id: 'cv', label: 'Tailor CV' }, { id: 'cover', label: 'Cover letter' }].map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setResult(null) }}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${mode === m.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: mode === m.id ? 'var(--marker-black)' : 'var(--marker-cream-2)', color: mode === m.id ? 'var(--marker-cream)' : 'var(--marker-text)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Job picker */}
      {!useManual && pipelineJobs.length > 0 ? (
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Role from pipeline</label>
          <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}>
            <option value="">Choose a role…</option>
            {pipelineJobs.map(j => <option key={j.id} value={j.id}>{j.company}{j.roleTitle ? ` — ${j.roleTitle}` : ''}</option>)}
          </select>
          <button onClick={() => { setUseManual(true); setSelectedJobId('') }}
            style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)', cursor: 'pointer', letterSpacing: '0.04em' }}>
            ▸ ENTER MANUALLY INSTEAD
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 5 }}>Job title *</label>
              <input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Head of Partnerships"
                style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 5 }}>Company</label>
              <input value={manualCompany} onChange={e => setManualCompany(e.target.value)} placeholder="Monzo"
                style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            </div>
          </div>
          {pipelineJobs.length > 0 && (
            <button onClick={() => setUseManual(false)}
              style={{ background: 'none', border: 'none', padding: '0 0 4px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)', cursor: 'pointer', letterSpacing: '0.04em', display: 'block' }}>
              ▸ PICK FROM PIPELINE INSTEAD
            </button>
          )}
        </div>
      )}

      {/* JD */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 5 }}>
          Job description {selectedJob?.jd ? '(pre-filled from pipeline)' : '(paste for best results)'}
        </label>
        <textarea value={jdText} onChange={e => setJdText(e.target.value)}
          placeholder="Paste the full job description here…" rows={5}
          style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', resize: 'vertical', lineHeight: 1.5 }} />
      </div>

      {/* Effort */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 8 }}>How much effort?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {EFFORT_LEVELS.map(o => (
            <button key={o.id} onClick={() => setEffort(o.id)}
              style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, border: `1px solid ${effort === o.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: effort === o.id ? 'var(--marker-black)' : 'var(--marker-cream-2)', color: effort === o.id ? 'var(--marker-cream)' : 'var(--marker-text)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500 }}>{o.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.6 }}>{o.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#B91C1C', padding: '10px 12px', background: '#FEE2E2', borderRadius: 8 }}>{error}</div>}

      <button onClick={proceed} disabled={loadingQ || generating || !roleTitle.trim()}
        style={{ background: (!roleTitle.trim() || loadingQ || generating) ? 'var(--marker-border)' : 'var(--marker-black)', color: (!roleTitle.trim() || loadingQ || generating) ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: (!roleTitle.trim() || loadingQ || generating) ? 'default' : 'pointer' }}>
        {loadingQ ? 'Generating questions…' : generating ? 'Writing…' : effort === 'none' ? (mode === 'cover' ? 'Write cover letter →' : 'Generate CV →') : 'Next: answer questions →'}
      </button>

      <div className="legal-line" style={{ paddingTop: 4 }}>AI-generated. Review all output before submitting. Do not add experience you don't have.</div>
    </div>
  )

  // ─── QUESTIONS ────────────────────────────────────────────────────
  if (step === 'questions') return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button onClick={reset}
          style={{ background: 'none', border: '1px solid var(--marker-border)', padding: '6px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', flexShrink: 0 }}>
          ← Back
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', lineHeight: 1.3 }}>
            {roleTitle}{company ? ` at ${company}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 2 }}>
            {questions.length} question{questions.length !== 1 ? 's' : ''} · 2-4 sentences each · answers stay private
          </div>
        </div>
      </div>

      {questions.map((q, i) => (
        <div key={i} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--marker-black)', lineHeight: 1.5, marginBottom: 8 }}>{i + 1}. {q}</div>
          <textarea
            value={answers[i] || ''}
            onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
            placeholder="Your answer (2-4 sentences)…"
            rows={3}
            style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: `1px solid ${(answers[i] || '').trim() ? 'var(--marker-black)' : 'var(--marker-border)'}`, borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', resize: 'vertical', lineHeight: 1.5, transition: 'border-color 0.15s' }}
          />
        </div>
      ))}

      {error && <div style={{ fontSize: 12, color: '#B91C1C', padding: '10px 12px', background: '#FEE2E2', borderRadius: 8 }}>{error}</div>}

      <button onClick={submitAnswers} disabled={generating}
        style={{ background: generating ? 'var(--marker-border)' : 'var(--marker-black)', color: generating ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: generating ? 'default' : 'pointer' }}>
        {generating ? 'Generating…' : mode === 'cover' ? 'Write cover letter →' : 'Tailor CV →'}
      </button>

      <div className="legal-line">Answers are used only to improve this generation — not stored.</div>
    </div>
  )

  // ─── RESULT ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={reset}
          style={{ background: 'none', border: '1px solid var(--marker-border)', padding: '6px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', flexShrink: 0 }}>
          ← New
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)' }}>
            {roleTitle}{company ? ` at ${company}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>
            {mode === 'cover' ? 'Cover letter' : 'Tailored CV'} ready
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {result?.type === 'keywords' ? 'Keyword Analysis' : mode === 'cover' ? 'Cover Letter' : 'Tailored CV'}
          </div>
          <button onClick={copy}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: copied ? 'var(--marker-lime)' : 'var(--marker-border)', color: 'var(--marker-black)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em' }}>
            {copied ? 'COPIED ✓' : 'COPY'}
          </button>
        </div>

        {result?.type === 'keywords' && result.data && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className={result.data.matchScore >= 70 ? 'holo-foil' : ''} style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--marker-black)', background: result.data.matchScore >= 70 ? undefined : result.data.matchScore >= 50 ? 'var(--marker-lime)' : 'var(--marker-border)', padding: '4px 12px', borderRadius: 6 }}>{result.data.matchScore}%</div>
              <div style={{ fontSize: 12, color: 'var(--marker-mid)' }}>ATS match estimate</div>
            </div>
            {[{ label: 'Matched', items: result.data.matched, color: '#065F46', bg: '#D1FAE5' }, { label: 'Missing', items: result.data.missing, color: '#92400E', bg: '#FEF3C7' }].map(({ label, items, color, bg }) => items?.length > 0 && (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 6 }}>{label}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {items.map(k => <span key={k} style={{ fontSize: 11, padding: '3px 8px', background: bg, color, borderRadius: 4, fontFamily: 'var(--font-mono)' }}>{k}</span>)}
                </div>
              </div>
            ))}
            {result.data.tweaks?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--marker-black)', marginBottom: 6 }}>Suggested tweaks</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.data.tweaks.map((t, i) => <div key={i} style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.5, paddingLeft: 12, borderLeft: '2px solid var(--marker-border)' }}>{t}</div>)}
                </div>
              </div>
            )}
          </div>
        )}

        {(result?.type === 'cv' || result?.type === 'text') && (
          <pre style={{ padding: 14, fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--marker-text)', fontFamily: 'var(--font-mono)', margin: 0, maxHeight: 500, overflowY: 'auto' }}>
            {result.text}
          </pre>
        )}
      </div>

      {selectedJob && (
        <button onClick={markApplied} disabled={markedApplied}
          style={{ background: markedApplied ? 'var(--marker-lime)' : 'var(--marker-black)', color: 'var(--marker-black)', border: 'none', padding: '12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: markedApplied ? 'default' : 'pointer' }}>
          {markedApplied ? '✓ Marked as applied in pipeline' : 'Submit & mark as Applied →'}
        </button>
      )}

      <div className="legal-line" style={{ paddingTop: 4 }}>AI-generated. Review all output before submitting. Do not add experience you don't have.</div>
    </div>
  )
}

// ── Feed tab (3 sub-tabs: Task List / Web Search / Gov) ──────────

const RETURNSHIP_PROGRAMMES = [
  { company: 'Amazon',          programme: 'Amazon Returnity',          url: 'https://www.amazon.jobs/en/landing_pages/returnship', note: '16-week paid programme across tech, ops, and corporate roles' },
  { company: 'IBM',             programme: 'IBM SkillsBuild Return to Work', url: 'https://skillsbuild.org/adult-learners', note: 'Tech and consulting roles; structured re-entry with mentoring' },
  { company: 'Goldman Sachs',   programme: 'Goldman Sachs Returnship', url: 'https://www.goldmansachs.com/careers/students/programs/returnship.html', note: '8-week programme across divisions; London and beyond' },
  { company: 'McKinsey',        programme: 'ReIgnite',                 url: 'https://www.mckinsey.com/careers/students-and-early-career/reignite', note: 'Experienced hire re-entry for those out 2+ years' },
  { company: 'Deloitte',        programme: 'Return to Work',           url: 'https://www2.deloitte.com/uk/en/pages/careers/articles/return-to-work.html', note: '6-month returner programme across service lines' },
  { company: 'JP Morgan',       programme: 'ReEntry Programme',        url: 'https://careers.jpmorgan.com/global/en/students/programs/reentry-program', note: 'Paid 15-week programme for those out 2+ years' },
  { company: 'EY',              programme: 'EY Reconnect',             url: 'https://www.ey.com/en_uk/careers/experienced/reconnect', note: 'Flexible re-entry for senior returners across EY practices' },
  { company: 'Barclays',        programme: 'Encore',                   url: 'https://home.barclays/careers/graduate-talent/encore/', note: '12-week returnship; technology, ops, and banking roles' },
  { company: 'NatWest',         programme: 'Returning Professionals',  url: 'https://www.natwestgroup.com/careers/life-at-natwest-group/returners.html', note: 'Open to all career breakers; mentoring and flexible arrangements' },
  { company: 'Accenture',       programme: 'Returning Professionals',  url: 'https://www.accenture.com/gb-en/careers/local/returning-professionals', note: 'Tech-focused returnship with reskilling support' },
  { company: 'PwC',             programme: 'Back to Business',         url: 'https://www.pwc.co.uk/careers/experienced-careers/back-to-business.html', note: 'Structured returnship across audit, tax, and consulting' },
  { company: 'Aviva',           programme: 'Aviva Returners',          url: 'https://careers.aviva.co.uk/working-here/flexibility/returners/', note: 'Insurance and financial services; mentoring included' },
]

const PARENTAL_FRIENDLY_EMPLOYERS = [
  { company: 'Monzo',          leave: '6 months full pay',     policy: 'Equal primary/secondary carer leave; return-to-work coaching',       sector: 'Fintech' },
  { company: 'Spotify',        leave: '6 months full pay',     policy: 'Equal parental leave regardless of gender; global WFA policy',       sector: 'Tech' },
  { company: 'Bumble',         leave: '6 months full pay',     policy: 'Full pay for all parents; paid miscarriage leave',                   sector: 'Tech' },
  { company: 'Sky',            leave: '26 weeks full pay',     policy: 'Equal parental leave; enhanced paternity from week 1',               sector: 'Media' },
  { company: 'BBC',            leave: '52 weeks (26 full pay)', policy: '8 weeks full paternity; enhanced shared parental',                  sector: 'Media' },
  { company: 'Octopus Energy', leave: '6 months full pay',     policy: 'Equal parental leave policy; B Corp certified employer',             sector: 'Energy' },
  { company: 'Google UK',      leave: '24 weeks full pay',     policy: 'Equal primary/secondary; generous return-to-work flexibility',       sector: 'Tech' },
  { company: 'Microsoft UK',   leave: '20 weeks full pay',     policy: 'Equal parental leave; hybrid and flexible working embedded',         sector: 'Tech' },
  { company: 'Aviva',          leave: '26 weeks full pay',     policy: 'Phased return options; fertility treatment leave',                   sector: 'Finance' },
  { company: 'Unilever',       leave: '16 weeks full pay',     policy: 'Flexible working by default; global parental leave standard',        sector: 'Consumer Goods' },
  { company: 'GSK',            leave: '26 weeks full pay',     policy: 'Shared parental leave enhancement; fertility and adoption support',  sector: 'HealthTech' },
  { company: 'Linklaters',     leave: '26 weeks full pay',     policy: '8 weeks full paternity; top-up for shared parental',                 sector: 'Professional Services' },
  { company: 'John Lewis',     leave: '26 weeks full pay',     policy: 'Enhanced for primary + secondary; phased return',                   sector: 'Retail' },
  { company: 'BT Group',       leave: '26 weeks full pay',     policy: '8 weeks paternity at full pay; fertility leave',                    sector: 'Tech' },
]

const SOURCE_LABELS = {
  greenhouse:   'Greenhouse',
  careers_page: 'Greenhouse',
  adzuna:       'Adzuna',
  gov:          'Civil Service',
  gov_search:   'Civil Service',
}

function FeedTab({ jobs: pipelineJobs, addJob, feedJobs, feedLoading, profile }) {
  const [subTab,         setSubTab]         = useState('web')
  const [search,         setSearch]         = useState('')
  const [localDismissed, setLocalDismissed] = useState(
    () => new Set(profile?.hard_filters_json?.dismissed || [])
  )
  const [cardScores, setCardScores] = useState({})

  const tracks             = profile?.hard_filters_json?.tracks || (profile?.track ? [profile.track] : [])
  const showReturnships    = tracks.includes('returner')  || profile?.hard_filters_json?.surfaces?.returnships
  const showParentalFriendly = tracks.includes('parent') || profile?.hard_filters_json?.surfaces?.parental_friendly

  const addedLinks = new Set(pipelineJobs.flatMap(j => [j.link, j.jobLink]).filter(Boolean))

  const webJobs = feedJobs.filter(j => !['gov', 'gov_search'].includes(j.source) && !localDismissed.has(j.id))
  const govJobs = feedJobs.filter(j =>  ['gov', 'gov_search'].includes(j.source) && !localDismissed.has(j.id))

  function dismissJob(jobId) {
    setLocalDismissed(prev => new Set([...prev, jobId]))
    fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }) }).catch(() => {})
  }

  function addToPipeline(job, source) {
    addJob({
      id: crypto.randomUUID(),
      company: job.company,
      roleTitle: job.roleTitle,
      jobLink: job.link,
      link: job.link,
      officeDays: 2,
      status: 'considering',
      ranking: 1,
      signal: job.signal || '',
      signalReason: '',
      score: job.score || 0,
      scoreBreakdown: '',
      jd: '',
      source: source || job.source || 'feed',
      addedAt: new Date().toISOString(),
    })
    dismissJob(job.id)
  }

  function renderFeedCard(job, source) {
    const isAdded   = addedLinks.has(job.link)
    const isAdzuna  = job.source === 'adzuna' || job.adzunaAttributionRequired
    const sourceLabel = SOURCE_LABELS[job.source] || job.source || 'Feed'
    const cs        = cardScores[job.id] || {}
    const csScore   = parseFloat(cs.score) || 0
    const csTop     = csScore >= 9
    const csBg      = csTop ? undefined : csScore >= 7 ? 'var(--marker-lime)' : csScore >= 5 ? '#F5E4A0' : csScore > 0 ? '#FCA5A5' : 'var(--marker-border)'
    return (
      <div key={job.id} style={{ background: 'var(--marker-cream-2)', border: `1px solid ${cs.signal === 'apply' ? '#86EFAC' : 'var(--marker-border)'}`, borderRadius: 10, padding: 12, transition: 'border-color 0.3s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            {csScore > 0 && (
              <div className={csTop ? 'holo-foil' : ''} style={{ background: csTop ? undefined : csBg, fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, padding: '2px 8px', borderRadius: 5, color: 'var(--marker-black)' }}>{cs.score}</div>
            )}
            {job.link && (
              <button onClick={async () => {
                if (cs.loading) return
                setCardScores(prev => ({ ...prev, [job.id]: { ...prev[job.id], loading: true } }))
                try {
                  const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobLink: job.link, roleTitle: job.roleTitle, company: job.company }) })
                  if (res.ok) {
                    const d = await res.json()
                    setCardScores(prev => ({ ...prev, [job.id]: { score: d.score, signal: d.signal, loading: false } }))
                  } else {
                    setCardScores(prev => ({ ...prev, [job.id]: { ...prev[job.id], loading: false } }))
                  }
                } catch {
                  setCardScores(prev => ({ ...prev, [job.id]: { ...prev[job.id], loading: false } }))
                }
              }} disabled={cs.loading}
              style={{ background: cs.loading ? 'var(--marker-border)' : csScore > 0 ? 'transparent' : 'var(--marker-lime)', color: csScore > 0 ? 'var(--marker-mid)' : 'var(--marker-black)', border: csScore > 0 ? '1px solid var(--marker-border)' : 'none', padding: '5px 8px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: cs.loading ? 'default' : 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {cs.loading ? '…' : csScore > 0 ? 'RE-SCORE' : 'SCORE'}
              </button>
            )}
            <button onClick={() => !isAdded && addToPipeline(job, source)} disabled={isAdded}
              style={{ background: isAdded ? 'var(--marker-border)' : 'var(--marker-black)', color: isAdded ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '5px 9px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {isAdded ? '✓' : '+ Pipe'}
            </button>
            <button onClick={() => dismissJob(job.id)} title="Dismiss"
              style={{ background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '5px 7px', borderRadius: 6, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        </div>
        {cs.signal && cs.signal !== 'maybe' && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ background: cs.signal === 'apply' ? 'var(--marker-lime)' : '#FCA5A5', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-black)' }}>{cs.signal}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {job.location && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-mid)' }}>{job.location}</span>}
          {job.salary  && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>{job.salary}</span>}
          {isAdzuna
            ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', opacity: 0.6 }}>Jobs by Adzuna</span>
            : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', opacity: 0.5 }}>{sourceLabel}</span>}
        </div>
      </div>
    )
  }

  const filteredWeb = webJobs.filter(j => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (j.roleTitle || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q) || (j.location || '').toLowerCase().includes(q)
  })
  const filteredGov = govJobs.filter(j => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (j.roleTitle || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q)
  })
  const showWebAdzuna = filteredWeb.some(j => j.source === 'adzuna' || j.adzunaAttributionRequired)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Sub-tab bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', display: 'flex', gap: 6, alignItems: 'center' }}>
        {[
          { id: 'tasklist', label: 'Task List' },
          { id: 'web',      label: `Web${webJobs.length > 0 ? ` (${webJobs.length})` : ''}` },
          { id: 'gov',      label: `Gov${govJobs.length > 0 ? ` (${govJobs.length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => { setSubTab(t.id); setSearch('') }}
            style={{ padding: '5px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: subTab === t.id ? 500 : 400, background: subTab === t.id ? 'var(--marker-black)' : 'transparent', color: subTab === t.id ? 'var(--marker-cream)' : 'var(--marker-mid)', border: `1px solid ${subTab === t.id ? 'var(--marker-black)' : 'var(--marker-border)'}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Task List ── */}
      {subTab === 'tasklist' && <WishlistTab profile={profile} jobs={pipelineJobs} addJob={addJob} />}

      {/* ── Web Search ── */}
      {subTab === 'web' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {showReturnships && (
            <div style={{ padding: '16px 16px 0' }}>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 2 }}>RETURNSHIP PROGRAMMES</div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.4 }}>Structured re-entry programmes at major UK employers. Not all are open year-round.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {RETURNSHIP_PROGRAMMES.map((p, i) => (
                    <a key={p.company} href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 14px', borderBottom: i < RETURNSHIP_PROGRAMMES.length - 1 ? '1px solid var(--marker-border)' : 'none', textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1 }}>{p.company}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 2 }}>{p.programme}</div>
                      <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.4 }}>{p.note}</div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
          {showParentalFriendly && (
            <div style={{ padding: `${showReturnships ? '0' : '16px'} 16px 0` }}>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', marginBottom: 2 }}>PARENTAL-FRIENDLY EMPLOYERS</div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.4 }}>UK employers with verified enhanced parental leave.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {PARENTAL_FRIENDLY_EMPLOYERS.map((e, i) => (
                    <div key={e.company} style={{ padding: '10px 14px', borderBottom: i < PARENTAL_FRIENDLY_EMPLOYERS.length - 1 ? '1px solid var(--marker-border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{e.company}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '1px 5px', borderRadius: 4, color: 'var(--marker-mid)' }}>{e.sector}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 2 }}>{e.leave}</div>
                      <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.4 }}>{e.policy}</div>
                    </div>
                  ))}
                </div>
                <div className="legal-line" style={{ padding: '8px 14px' }}>Parental leave data from public disclosures. Verify before applying.</div>
              </div>
            </div>
          )}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', position: 'sticky', top: 0, zIndex: 5 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by role, company, or location…"
              style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 6, letterSpacing: '0.04em' }}>{filteredWeb.length} OF {webJobs.length} · NIGHTLY ADZUNA SCAN</div>
          </div>
          {feedLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING FEED…</div>
            </div>
          ) : filteredWeb.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>{webJobs.length === 0 ? 'FEED EMPTY' : 'NO MATCHES'}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>{webJobs.length === 0 ? 'New roles overnight' : 'Try different keywords'}</div>
              <div style={{ fontSize: 14, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>{webJobs.length === 0 ? 'Adzuna scans run nightly. Check back tomorrow.' : 'Adjust your search filter above.'}</div>
            </div>
          ) : (
            <div style={{ padding: '8px 16px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredWeb.map(job => renderFeedCard(job, 'web_search'))}
              {showWebAdzuna && <div className="legal-line" style={{ paddingTop: 8 }}>Job listings provided by Adzuna. Roles pulled nightly. Not affiliated with employers listed.</div>}
              {!showWebAdzuna && filteredWeb.length > 0 && <div className="legal-line" style={{ paddingTop: 8 }}>Roles pulled nightly from public career pages. Not affiliated with employers listed.</div>}
            </div>
          )}
        </div>
      )}

      {/* ── Gov ── */}
      {subTab === 'gov' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter civil service roles…"
              style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 6, letterSpacing: '0.04em' }}>{filteredGov.length} CIVIL SERVICE ROLES</div>
          </div>
          {feedLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING…</div>
            </div>
          ) : filteredGov.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO CIVIL SERVICE ROLES</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>Gov feed runs nightly</div>
              <div style={{ fontSize: 14, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>Civil service jobs pull at 3am. Check back in the morning.</div>
            </div>
          ) : (
            <div style={{ padding: '8px 16px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredGov.map(job => renderFeedCard(job, 'gov_search'))}
              <div className="legal-line" style={{ paddingTop: 8 }}>Civil service jobs from Civil Service Jobs board. Pulled nightly.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Wishlist seed data ────────────────────────────────────────────

const WISHLIST_SEEDS = {
  balanced: [
    { company: 'Monzo',          sector: 'Fintech',    note: 'Async culture, strong WLB scores, hybrid-first' },
    { company: 'Wise',           sector: 'Fintech',    note: 'Distributed-first, no-meeting Fridays, flat structure' },
    { company: 'Octopus Energy', sector: 'Energy',     note: 'B Corp, genuine flexible working, high Glassdoor scores' },
    { company: 'BBC',            sector: 'Media',      note: '35-hour week, hybrid, strong work-life culture' },
    { company: 'Spotify',        sector: 'Tech',       note: 'Work From Anywhere policy, async-friendly teams' },
    { company: 'Sky',            sector: 'Media/Tech', note: 'Hybrid-first, family-friendly, 26wk parental leave' },
    { company: 'Bumble',         sector: 'Tech',       note: 'Company-wide week off twice a year, progressive culture' },
    { company: 'Deliveroo',      sector: 'Tech',       note: 'Hybrid working, competitive benefits, London HQ' },
    { company: 'Farfetch',       sector: 'E-commerce', note: 'Flexible working embedded in culture, London HQ' },
    { company: 'Gousto',         sector: 'Food Tech',  note: 'B Corp certified, strong WLB, hybrid model' },
  ],
  parent: [
    { company: 'Aviva',            sector: 'Insurance', note: '26 weeks full pay for all parents, flexible return options' },
    { company: 'Channel 4',        sector: 'Media',     note: '9 months full pay for all parents — one of the best in UK' },
    { company: 'NatWest Group',    sector: 'Finance',   note: '52 weeks available, first 26 at full pay' },
    { company: 'Sky',              sector: 'Media/Tech',note: '26 weeks full pay, enhanced partner leave, phased return' },
    { company: 'Vodafone',         sector: 'Telecoms',  note: '16 weeks full pay globally, flexible return programme' },
    { company: 'Diageo',           sector: 'FMCG',      note: 'Shared parental leave champion, 26 weeks all parents' },
    { company: 'PwC',              sector: 'Consulting',note: '20 weeks full pay maternity, 4 weeks partner leave' },
    { company: "L'Oréal",          sector: 'FMCG',      note: '20 weeks full pay for all parents, global policy' },
    { company: 'KPMG',             sector: 'Consulting',note: '18 weeks full pay, 2 weeks partner, flexible return' },
    { company: 'Lloyds Banking',   sector: 'Finance',   note: 'Up to 39 weeks full pay maternity, strong culture' },
  ],
  returner: [
    { company: 'Goldman Sachs',    sector: 'Finance',   note: 'Returnship programme — 6 months paid, structured support' },
    { company: 'Amazon',           sector: 'Tech',      note: 'Return to Work — open to career breaks of 2+ years' },
    { company: 'Morgan Stanley',   sector: 'Finance',   note: 'Return to Work programme, open to all disciplines' },
    { company: 'Mastercard',       sector: 'Fintech',   note: 'Returnship programme, London offices' },
    { company: 'PwC',              sector: 'Consulting',note: 'Back to Business programme, targets career returners' },
    { company: 'Barclays',         sector: 'Finance',   note: 'Bespoke Return to Work programme with coaching' },
    { company: 'JP Morgan',        sector: 'Finance',   note: 'ReEntry programme — 15 weeks paid, mentored' },
    { company: 'HSBC',             sector: 'Finance',   note: 'Career Returners partnership, structured onboarding' },
    { company: 'IBM',              sector: 'Tech',      note: 'SkillsBuild returnship, tech and consulting roles' },
    { company: 'Lloyds Banking',   sector: 'Finance',   note: 'Returning to Work programme, hybrid-friendly' },
  ],
  career_changer: [
    { company: 'Accenture',        sector: 'Consulting', note: 'Actively hires from non-traditional backgrounds' },
    { company: 'Civil Service',    sector: 'Public Sector', note: 'Fast Stream open to all degree disciplines and backgrounds' },
    { company: 'Amazon',           sector: 'Tech',       note: 'Career Choice programme + internal role change support' },
    { company: 'Deloitte',         sector: 'Consulting', note: 'BrightStart and career-changer pathways across practices' },
    { company: 'ThoughtWorks',     sector: 'Tech',       note: 'Apprentice programme for bootcamp grads, open-minded hiring' },
    { company: 'Capgemini',        sector: 'Tech',       note: 'Tech degree apprenticeships designed for career switchers' },
    { company: 'BT Group',         sector: 'Telecoms',   note: 'Digital bootcamp-to-hire pathways, skills-first hiring' },
    { company: 'Lloyds Banking',   sector: 'Finance',    note: 'Tech Academy for career changers moving into engineering' },
    { company: 'General Assembly', sector: 'EdTech',     note: 'Hires its own graduates — good first tech role post-bootcamp' },
    { company: 'Makers',           sector: 'EdTech',     note: 'Partner companies hire directly from their cohorts' },
  ],
  standard: [
    { company: 'Google',       sector: 'Tech',     note: 'UK HQ in London, multiple offices, strong comp and growth' },
    { company: 'Amazon',       sector: 'Tech',     note: 'Multiple London offices, breadth of roles across divisions' },
    { company: 'Revolut',      sector: 'Fintech',  note: 'Fast-growing, equity upside, global scope from London' },
    { company: 'Palantir',     sector: 'Tech',     note: 'High-impact roles, mission-driven culture, London office' },
    { company: 'Anthropic',    sector: 'AI',       note: 'UK office, at the frontier of AI safety and development' },
    { company: 'Stripe',       sector: 'Fintech',  note: 'Dublin/London, strong engineering culture, high bar' },
    { company: 'Figma',        sector: 'Design',   note: 'London office, design-led product culture' },
    { company: 'Monzo',        sector: 'Fintech',  note: 'UK-born, scaling fast, mission-aligned, strong culture' },
    { company: 'Deliveroo',    sector: 'Tech',     note: 'London HQ, tech-forward, growing international operations' },
    { company: 'Wise',         sector: 'Fintech',  note: 'Profitable, distributed team, meaningful mission' },
  ],
}

// ── Wishlist tab — live Greenhouse checking ───────────────────────

function WishlistTab({ profile, jobs: pipelineJobs, addJob }) {
  const [wishlist,        setWishlist]        = useState(null)   // null = not loaded yet
  const [results,         setResults]         = useState({})
  const [showAdd,         setShowAdd]         = useState(false)
  const [addInput,        setAddInput]        = useState('')
  const [expanded,        setExpanded]        = useState({})
  const [generating,      setGenerating]      = useState(false)
  const [suggestions,     setSuggestions]     = useState(null)
  const [generateError,   setGenerateError]   = useState('')
  const hasChecked = useRef(false)

  const hasCV = !!(profile?.hard_filters_json?.cvRaw?.length > 100)

  // Load wishlist once on mount (from profile or seed from track)
  useEffect(() => {
    const saved = profile?.hard_filters_json?.wishlist
    if (saved && saved.length > 0) {
      setWishlist(saved)
      return
    }
    const tracks = profile?.hard_filters_json?.tracks?.length
      ? profile.hard_filters_json.tracks
      : profile?.track ? [profile.track] : ['standard']
    const seen = new Set()
    const seeds = []
    tracks.forEach(t => {
      ;(WISHLIST_SEEDS[t] || []).forEach(s => {
        if (!seen.has(s.company)) { seen.add(s.company); seeds.push({ name: s.company, sector: s.sector, note: s.note }) }
      })
    })
    if (!tracks.includes('standard')) {
      WISHLIST_SEEDS.standard.forEach(s => {
        if (!seen.has(s.company)) { seen.add(s.company); seeds.push({ name: s.company, sector: s.sector, note: s.note }) }
      })
    }
    setWishlist(seeds)
  }, [])

  // Run Greenhouse check once when wishlist is first populated
  useEffect(() => {
    if (!wishlist || hasChecked.current) return
    hasChecked.current = true
    if (wishlist.length === 0) return
    const initial = {}
    wishlist.forEach(c => { initial[c.name] = { status: 'loading', jobs: [] } })
    setResults(initial)
    fetch('/api/wishlist/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies: wishlist.map(c => ({ name: c.name, slug: c.slug })) }),
    })
      .then(r => r.json())
      .then(data => {
        const map = {}
        ;(data.results || []).forEach(r => { map[r.name] = r })
        setResults(map)
      })
      .catch(() => {
        const err = {}
        wishlist.forEach(c => { err[c.name] = { status: 'no_board', jobs: [], careersUrl: `https://www.google.com/search?q=${encodeURIComponent(c.name + ' jobs')}` } })
        setResults(err)
      })
  }, [wishlist])

  function persistWishlist(newList) {
    fetch('/api/wishlist/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wishlist: newList }),
    }).catch(() => {})
  }

  function removeCompany(name) {
    const next = (wishlist || []).filter(c => c.name !== name)
    setWishlist(next)
    setResults(prev => { const n = { ...prev }; delete n[name]; return n })
    persistWishlist(next)
  }

  function addCompany() {
    const name = addInput.trim()
    if (!name || (wishlist || []).find(c => c.name.toLowerCase() === name.toLowerCase())) {
      setAddInput(''); setShowAdd(false); return
    }
    const entry   = { name, sector: '', note: '', addedAt: new Date().toISOString() }
    const newList = [...(wishlist || []), entry]
    setWishlist(newList)
    setResults(prev => ({ ...prev, [name]: { status: 'loading', jobs: [] } }))
    setAddInput(''); setShowAdd(false)
    persistWishlist(newList)
    // Check only the new company
    fetch('/api/wishlist/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companies: [{ name }] }),
    })
      .then(r => r.json())
      .then(data => {
        const r = data.results?.[0]
        if (r) setResults(prev => ({ ...prev, [name]: r }))
      })
      .catch(() => {
        setResults(prev => ({ ...prev, [name]: { status: 'no_board', jobs: [], careersUrl: `https://www.google.com/search?q=${encodeURIComponent(name + ' jobs')}` } }))
      })
  }

  function addJobToPipeline(job, companyName) {
    addJob({
      id: crypto.randomUUID(),
      company: companyName,
      roleTitle: job.title,
      jobLink: job.url,
      link: job.url,
      officeDays: 2,
      status: 'considering',
      ranking: 1, signal: '', signalReason: '', score: 0, scoreBreakdown: '', jd: '',
      addedAt: new Date().toISOString(),
    })
  }

  async function generateWishlist() {
    if (generating) return
    setGenerating(true); setGenerateError(''); setSuggestions(null)
    try {
      const res = await fetch('/api/wishlist/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) { setGenerateError(data.error || 'Generation failed'); return }
      setSuggestions(data.suggestions || [])
    } catch {
      setGenerateError('Request failed — try again')
    } finally {
      setGenerating(false)
    }
  }

  function addSuggestion(s) {
    const name = s.company
    if ((wishlist || []).find(c => c.name.toLowerCase() === name.toLowerCase())) {
      setSuggestions(prev => prev.filter(x => x.company !== s.company))
      return
    }
    const entry   = { name, sector: s.sector || '', note: s.why || '', addedAt: new Date().toISOString() }
    const newList = [...(wishlist || []), entry]
    setWishlist(newList)
    setResults(prev => ({ ...prev, [name]: { status: 'loading', jobs: [] } }))
    setSuggestions(prev => prev.filter(x => x.company !== s.company))
    persistWishlist(newList)
    fetch('/api/wishlist/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companies: [{ name }] }) })
      .then(r => r.json())
      .then(data => { const r = data.results?.[0]; if (r) setResults(prev => ({ ...prev, [name]: r })) })
      .catch(() => setResults(prev => ({ ...prev, [name]: { status: 'no_board', jobs: [], careersUrl: `https://www.google.com/search?q=${encodeURIComponent(name + ' jobs')}` } })))
  }

  const addedLinks   = new Set(pipelineJobs.flatMap(j => [j.link, j.jobLink]).filter(Boolean))
  const list         = wishlist || []
  const withRoles    = list.filter(c => results[c.name]?.status === 'has_roles').length
  const totalChecked = list.filter(c => results[c.name]?.status && results[c.name].status !== 'loading').length
  const allLoading   = list.length > 0 && totalChecked === 0

  // Bug 1 fix: sort by rank ASC, then staleness (oldest/never-checked first)
  const sorted = [...list].sort((a, b) => {
    const rankA = parseFloat(a.rank) || 2
    const rankB = parseFloat(b.rank) || 2
    if (rankA !== rankB) return rankA - rankB
    const ageA = a.addedAt ? new Date(a.addedAt).getTime() : 0
    const ageB = b.addedAt ? new Date(b.addedAt).getTime() : 0
    return ageA - ageB
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: showAdd ? 12 : 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>Dream Wishlist</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>
              {allLoading
                ? 'Checking Greenhouse boards…'
                : list.length === 0
                ? 'Add companies to start watching'
                : `${withRoles} of ${list.length} companies have matching roles · Live data`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {hasCV && (
              <button onClick={generateWishlist} disabled={generating}
                style={{ background: generating ? 'var(--marker-border)' : '#FEF3C7', color: generating ? 'var(--marker-mid)' : '#92400E', border: '1px solid #FCD34D', padding: '8px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: generating ? 'default' : 'pointer', letterSpacing: '0.04em', flexShrink: 0 }}>
                {generating ? 'GENERATING…' : 'AI SUGGEST'}
              </button>
            )}
            <button
              onClick={() => setShowAdd(v => !v)}
              style={{ background: showAdd ? 'var(--marker-border)' : 'var(--marker-black)', color: showAdd ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
              {showAdd ? 'Cancel' : '+ Add'}
            </button>
          </div>
        </div>

        {showAdd && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCompany(); if (e.key === 'Escape') { setShowAdd(false); setAddInput('') } }}
              placeholder="Company name (e.g. Revolut, Adyen, Monzo…)"
              autoFocus
              style={{ flex: 1, padding: '9px 13px', fontSize: 13, border: '1px solid var(--marker-black)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}
            />
            <button
              onClick={addCompany}
              style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}
            >Add</button>
          </div>
        )}
      </div>

      {/* Company cards */}
      <div style={{ padding: '10px 16px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {list.length === 0 && !suggestions && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em', marginBottom: 12 }}>NO COMPANIES YET</div>
            {hasCV
              ? <button onClick={generateWishlist} disabled={generating}
                  style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', padding: '10px 18px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', marginBottom: 10, display: 'block', margin: '0 auto 10px' }}>
                  {generating ? 'Generating…' : 'Generate from my CV →'}
                </button>
              : <div style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 10 }}>Add your CV in the CV tab to get AI-personalised suggestions</div>
            }
            <button onClick={() => setShowAdd(true)} className="btn btn-ghost" style={{ fontSize: 13 }}>Or add manually</button>
          </div>
        )}

        {sorted.map(co => {
          const result   = results[co.name] || { status: 'loading', jobs: [] }
          const { status, jobs: roleJobs = [], careersUrl } = result
          const isExp    = !!expanded[co.name]
          const hasRoles = status === 'has_roles'
          const loading  = status === 'loading'

          return (
            <div
              key={co.name}
              style={{
                background: 'var(--marker-cream-2)',
                border: `1px solid ${hasRoles ? '#86EFAC' : 'var(--marker-border)'}`,
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'border-color 0.4s',
              }}
            >
              {/* Card header row */}
              <div style={{ padding: '12px 12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--marker-black)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{co.name}</div>
                    {co.sector && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '1px 6px', borderRadius: 4, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{co.sector}</span>
                    )}
                    {(() => {
                      const msAgo = co.addedAt ? Date.now() - new Date(co.addedAt).getTime() : Infinity
                      const isNever = msAgo === Infinity
                      const isStale = msAgo > 7 * 864e5
                      if (!isNever && !isStale) return null
                      return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, background: isNever ? '#EF4444' : '#F59E0B', color: '#fff', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>{isNever ? 'Never' : '7d+'}</span>
                    })()}
                    {(() => {
                      const wlb = WLB_DATA[co.name.toLowerCase()]
                      if (!wlb) return null
                      const n = parseFloat(wlb.wlb)
                      return (
                        <>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: n >= 4.3 ? 'var(--marker-lime)' : '#F5E4A0', padding: '1px 6px', borderRadius: 4, color: 'var(--marker-black)', flexShrink: 0 }}>WLB {wlb.wlb}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '1px 6px', borderRadius: 4, color: 'var(--marker-mid)', flexShrink: 0 }}>Leave {wlb.leave}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '1px 6px', borderRadius: 4, color: 'var(--marker-mid)', flexShrink: 0 }}>{wlb.office} office</span>
                        </>
                      )
                    })()}
                  </div>

                  {/* Status row */}
                  {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div className="anim-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>Checking Greenhouse…</span>
                    </div>
                  )}

                  {status === 'has_roles' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#15803D', fontWeight: 600 }}>
                        {roleJobs.length} matching role{roleJobs.length !== 1 ? 's' : ''} live now
                      </span>
                    </div>
                  )}

                  {status === 'no_roles' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>
                        No matching roles today
                        {result.totalOnBoard ? ` · ${result.totalOnBoard} total on board` : ''}
                      </span>
                    </div>
                  )}

                  {status === 'no_board' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>Not on Greenhouse</span>
                      <a
                        href={careersUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-black)', fontWeight: 500 }}
                      >
                        Search careers ↗
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  {hasRoles && (
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [co.name]: !prev[co.name] }))}
                      style={{
                        background: isExp ? 'var(--marker-black)' : 'var(--marker-lime)',
                        color: 'var(--marker-black)',
                        border: 'none',
                        padding: '6px 11px',
                        borderRadius: 7,
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                        color: isExp ? 'var(--marker-cream)' : 'var(--marker-black)',
                      }}
                    >
                      {isExp ? 'HIDE' : `VIEW ${roleJobs.length}`}
                    </button>
                  )}
                  <button
                    onClick={() => removeCompany(co.name)}
                    title="Remove from wishlist"
                    style={{ background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >×</button>
                </div>
              </div>

              {/* Expanded job list */}
              {isExp && hasRoles && (
                <div style={{ borderTop: '1px solid var(--marker-border)' }}>
                  {roleJobs.map((job, i) => {
                    const isAdded = addedLinks.has(job.url)
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px',
                          borderBottom: i < roleJobs.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 12,
                          background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                          {job.location && (
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2 }}>{job.location}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', padding: '4px 8px', border: '1px solid var(--marker-border)', borderRadius: 5, textDecoration: 'none' }}
                          >View ↗</a>
                          <button
                            onClick={() => !isAdded && addJobToPipeline(job, co.name)}
                            disabled={isAdded}
                            style={{ background: isAdded ? 'var(--marker-border)' : 'var(--marker-black)', color: isAdded ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {isAdded ? 'Added ✓' : '+ Pipeline'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* AI suggestions */}
        {generateError && (
          <div style={{ fontSize: 12, color: '#B91C1C', padding: '12px 14px', background: '#FEE2E2', borderRadius: 10 }}>{generateError}</div>
        )}
        {suggestions && suggestions.length > 0 && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #FCD34D', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI suggestions — based on your CV</div>
              <button onClick={() => setSuggestions(null)} style={{ background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
            {suggestions.map((s, i) => (
              <div key={s.company} style={{ padding: '10px 14px', borderBottom: i < suggestions.length - 1 ? '1px solid #FEF3C7' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: '#78350F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.company}</span>
                    {s.sector && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: '#FEF3C7', border: '1px solid #FCD34D', padding: '1px 6px', borderRadius: 4, color: '#92400E' }}>{s.sector}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>{s.why}</div>
                </div>
                <button onClick={() => addSuggestion(s)}
                  style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '6px 11px', borderRadius: 7, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', flexShrink: 0 }}>
                  + ADD
                </button>
              </div>
            ))}
          </div>
        )}
        {suggestions && suggestions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>All suggestions added.</div>
        )}

        {list.length > 0 && (
          <div className="legal-line" style={{ paddingTop: 4 }}>
            Live data from public Greenhouse boards. Not all companies use Greenhouse — use "Search careers" for those. Checked on every visit.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Search result card ────────────────────────────────────────────

function SearchResultCard({ job, isAdded, onAdd }) {
  const n   = parseFloat(job.score) || 0
  const top = n >= 9
  const scoreBg  = top ? undefined : n >= 7 ? 'var(--marker-lime)' : n >= 5 ? '#F5E4A0' : 'var(--marker-border)'
  const signalBg = job.signal === 'apply' ? 'var(--marker-lime)' : job.signal === 'maybe' ? '#F5E4A0' : '#F8D0D0'
  const officeBg = job.office === 'Remote' ? 'var(--marker-lime)' : job.office === '1 day' ? 'var(--marker-lime)' : 'var(--marker-cream)'

  return (
    <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', lineHeight: 1.3 }}>{job.title}</div>
          </div>
          <div
            className={top ? 'holo-foil' : ''}
            style={{ background: top ? undefined : scoreBg, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, padding: '3px 10px', borderRadius: 8, color: 'var(--marker-black)', flexShrink: 0, alignSelf: 'flex-start', border: '1px solid transparent' }}
          >
            {n > 0 ? job.score : '–'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: job.reason ? 8 : 10 }}>
          {job.signal && <span style={{ background: signalBg, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-black)' }}>{job.signal}</span>}
          {job.office && job.office !== 'Unknown' && <span style={{ background: officeBg, border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, color: 'var(--marker-black)' }}>{job.office}</span>}
          {job.salary && <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4 }}>{job.salary}</span>}
          {job.location && <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4 }}>{job.location}</span>}
        </div>

        {job.reason && (
          <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5, marginBottom: 10, fontStyle: 'italic', paddingLeft: 2 }}>{job.reason}</div>
        )}

        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--marker-border)' }}>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, border: '1px solid var(--marker-border)', fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', fontWeight: 500, textDecoration: 'none' }}
            >View role ↗</a>
          )}
          <button
            onClick={() => !isAdded && onAdd(job)}
            disabled={isAdded}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: isAdded ? 'var(--marker-border)' : 'var(--marker-black)', color: isAdded ? 'var(--marker-mid)' : 'var(--marker-cream)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer' }}
          >
            {isAdded ? 'Added ✓' : '+ Pipeline'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Search tab — live Adzuna + AI scoring ─────────────────────────

const TRACK_SUGGESTIONS = {
  standard:       ['Head of partnerships', 'Director of marketing', 'Head of growth', 'VP marketing', 'Partnerships director'],
  balanced:       ['Head of marketing', 'Senior marketing manager', 'Head of digital', 'Programme director', 'Director of brand'],
  parent:         ['Head of marketing', 'Director marketing', 'Senior marketing manager', 'Partnerships director'],
  returner:       ['Senior marketing manager', 'Partnerships manager', 'Head of marketing', 'Programme manager'],
  career_changer: ['Marketing manager', 'Partnerships manager', 'Growth manager', 'Business development manager', 'Programme manager'],
}

function SearchTab({ profile, jobs: pipelineJobs, addJob }) {
  const track       = profile?.track || 'standard'
  const suggestions = TRACK_SUGGESTIONS[track] || TRACK_SUGGESTIONS.standard

  const [query,      setQuery]      = useState('')
  const [searching,  setSearching]  = useState(false)
  const [results,    setResults]    = useState([])
  const [hasSearched,setHasSearched]= useState(false)
  const [error,      setError]      = useState('')
  const [meta,       setMeta]       = useState({ total: 0, scored: 0 })

  const addedUrls = new Set(pipelineJobs.flatMap(j => [j.link, j.jobLink]).filter(Boolean))

  async function doSearch(overrideQuery) {
    const q = (overrideQuery ?? query).trim()
    setSearching(true)
    setError('')
    setResults([])
    setHasSearched(true)
    try {
      const res  = await fetch('/api/search/live', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q || null }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResults(data.jobs || [])
      setMeta({ total: data.total || 0, scored: data.scored || 0 })
    } catch {
      setError('Search failed — check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  function handleAdd(job) {
    addJob({
      id:           crypto.randomUUID(),
      company:      job.company,
      roleTitle:    job.title,
      jobLink:      job.url,
      link:         job.url,
      officeDays:   job.office === 'Remote' ? 0 : job.office === '1 day' ? 1 : 2,
      status:       'considering',
      ranking:      1,
      signal:       job.signal || '',
      signalReason: job.reason || '',
      score:        job.score || 0,
      scoreBreakdown: JSON.stringify({ salary: job.salary, office: job.office }),
      jd:           '',
      addedAt:      new Date().toISOString(),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Sticky search bar */}
      <div style={{ padding: 16, background: 'var(--marker-cream)', position: 'sticky', top: 0, zIndex: 5, borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !searching && doSearch()}
            placeholder="e.g. Head of partnerships, Director of growth…"
            style={{ flex: 1, padding: '10px 14px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}
          />
          <button
            onClick={() => !searching && doSearch()}
            disabled={searching}
            style={{ background: searching ? 'var(--marker-border)' : 'var(--marker-black)', color: searching ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: searching ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
          >
            {searching ? 'Searching…' : 'Search →'}
          </button>
        </div>

        {/* Suggestion chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setQuery(s); doSearch(s) }}
              disabled={searching}
              style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: 'transparent', color: 'var(--marker-mid)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Loading */}
        {searching && (
          <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)' }}>Scanning live listings</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textAlign: 'center', lineHeight: 1.6 }}>Fetching from Adzuna · Scoring with Claude<br/>May take 30–60 seconds</div>
            <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
              <div className="anim-b1" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
              <div className="anim-b2" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
              <div className="anim-b3" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && !searching && (
          <div style={{ fontSize: 12, color: '#B91C1C', padding: '12px 14px', background: '#FEE2E2', borderRadius: 10, lineHeight: 1.5 }}>{error}</div>
        )}

        {/* No results after search */}
        {hasSearched && !searching && results.length === 0 && !error && (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em', marginBottom: 8 }}>NO STRONG MATCHES</div>
            <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
              Found {meta.total} raw listings but none scored 5+. Try broader keywords or a different role title.
            </div>
          </div>
        )}

        {/* Pre-search prompt */}
        {!hasSearched && !searching && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Live Adzuna search</div>
            <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
              Type any role title or pick a suggestion above. Results are scored against your profile by Claude — only the strongest matches appear.
            </div>
          </div>
        )}

        {/* Results header */}
        {results.length > 0 && !searching && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
              {results.length} SCORED · {meta.total} TOTAL FOUND
            </div>
            <div className="adzuna-badge" />
          </div>
        )}

        {/* Job cards */}
        {!searching && results.map((job, i) => (
          <SearchResultCard
            key={job.id || i}
            job={job}
            isAdded={addedUrls.has(job.url)}
            onAdd={handleAdd}
          />
        ))}

        {results.length > 0 && !searching && (
          <div className="legal-line" style={{ paddingTop: 4 }}>
            Job listings provided by Adzuna. AI-scored against your profile. Scores refresh each search — same role may score differently as listings change.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Balanced Roles tab ────────────────────────────────────────────

const BALANCED_COMPANIES = [
  { co: 'Nationwide',     sector: 'Finance',      wlb: '4.4', leave: '12 mo', office: '1d', score: '9.1', note: 'Best enhanced parental leave in UK finance; hybrid-first culture' },
  { co: 'Wellcome Trust', sector: 'Charity',      wlb: '4.6', leave: '6 mo',  office: '1d', score: '9.0', note: 'Sector-leading WLB scores; mission-driven; Central London HQ' },
  { co: 'Channel 4',      sector: 'Media',        wlb: '4.2', leave: '9 mo',  office: '2d', score: '8.9', note: '9 months full pay for all parents — best in UK broadcasting' },
  { co: 'Ofcom',          sector: 'Regulator',    wlb: '4.5', leave: '6 mo',  office: '2d', score: '8.8', note: 'Regulator stability; hybrid-first; consistently high WLB scores' },
  { co: 'Lloyds Banking', sector: 'Finance',      wlb: '4.1', leave: '39 wk', office: '2d', score: '8.8', note: 'Up to 39 weeks full pay maternity; strong flexible return options' },
  { co: 'BBC',            sector: 'Media',        wlb: '4.3', leave: '6 mo',  office: '2d', score: '8.7', note: '35-hour week, hybrid, public service culture, London and regional offices' },
  { co: 'NatWest Group',  sector: 'Finance',      wlb: '4.2', leave: '26 wk', office: '2d', score: '8.7', note: '52 weeks available, first 26 full pay; strong diversity programmes' },
  { co: 'Octopus Energy', sector: 'Energy',       wlb: '4.4', leave: '6 mo',  office: '2d', score: '8.7', note: 'B Corp certified; genuine flexible working; high Glassdoor scores' },
  { co: 'Sky',            sector: 'Media/Tech',   wlb: '4.0', leave: '26 wk', office: '2d', score: '8.6', note: '26 weeks full pay for all parents; large UK employer; hybrid-first' },
  { co: 'GitLab',         sector: 'Tech',         wlb: '4.2', leave: '4 mo',  office: '0d', score: '8.6', note: 'Fully remote-first; async culture; transparent pay and operations' },
  { co: 'Aviva',          sector: 'Insurance',    wlb: '4.1', leave: '26 wk', office: '2d', score: '8.5', note: '26 weeks full pay for all parents; flexible return to work programme' },
  { co: 'Monzo',          sector: 'Fintech',      wlb: '4.0', leave: '6 mo',  office: '2d', score: '8.5', note: 'Async-friendly; strong WLB reputation; growing UK bank' },
  { co: 'Wise',           sector: 'Fintech',      wlb: '4.1', leave: '6 mo',  office: '2d', score: '8.5', note: 'Distributed teams; no-meeting Fridays culture; profitable mission-driven' },
  { co: 'HMRC',           sector: 'Public Sector',wlb: '4.0', leave: '6 mo',  office: '2d', score: '8.4', note: 'Civil service terms; flexible working by default; large stable employer' },
  { co: 'DWP Digital',    sector: 'Public Sector',wlb: '4.0', leave: '6 mo',  office: '2d', score: '8.4', note: 'Gov.uk digital team; flexible civil service; mission-driven tech roles' },
]

// WLB lookup by company name (lowercase) — sourced from BALANCED_COMPANIES above
const WLB_DATA = {}
BALANCED_COMPANIES.forEach(c => { WLB_DATA[c.co.toLowerCase()] = c })

const BALANCED_SECTORS = ['All', 'Finance', 'Media', 'Tech', 'Public Sector', 'Fintech', 'Energy', 'Other']

function BalancedTab({ jobs: pipelineJobs, addJob }) {
  const [sector, setSector] = useState('All')

  const filtered = sector === 'All'
    ? BALANCED_COMPANIES
    : sector === 'Other'
    ? BALANCED_COMPANIES.filter(c => !['Finance', 'Media', 'Tech', 'Public Sector', 'Fintech', 'Energy'].includes(c.sector))
    : BALANCED_COMPANIES.filter(c => c.sector === sector || (sector === 'Finance' && ['Finance', 'Insurance'].includes(c.sector)))

  const watchedCompanies = new Set(pipelineJobs.map(j => j.company?.toLowerCase().trim()))

  function watch(c) {
    addJob({
      id: crypto.randomUUID(),
      company: c.co,
      roleTitle: '',
      jobLink: '',
      link: '',
      officeDays: parseFloat(c.office) || 2,
      status: 'watchlist',
      ranking: 1,
      signal: '',
      signalReason: '',
      score: 0,
      scoreBreakdown: '',
      jd: `WLB ${c.wlb}/5 · Leave ${c.leave} · Office ${c.office} · ${c.note}`,
      addedAt: new Date().toISOString(),
    })
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="kicker" style={{ color: 'var(--marker-mid)', marginBottom: 6 }}>Balanced Roles</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 6 }}>Companies where WLB is a fact, not a slide</div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.5, maxWidth: 560 }}>Anchored to public Glassdoor ratings (≥500 reviews), Working Families benchmark, and verified parental leave policies. Watch a company to add it to your Pipeline watchlist.</div>
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
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--marker-black)', fontSize: 15, marginBottom: 6 }}>{c.co}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.sector}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: parseFloat(c.wlb) >= 4.4 ? 'var(--marker-lime)' : '#F0E0A8', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-black)' }}>WLB {c.wlb}</span>
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

      <div style={{ padding: '4px 4px 8px' }}>
        <div className="legal-line">Balanced Roles data sourced from public employee reviews (Glassdoor, Trustpilot ≥ 500 reviews), Working Families benchmark, and employer policy pages. Aggregated, not individually verified.</div>
      </div>
    </div>
  )
}

// ── Main app ──────────────────────────────────────────────────────

// ── Analyse tab — paste URL or JD → instant AI score breakdown ───

const FACTOR_META = [
  { key: 'roleSkillsMatch', label: 'Skills match' },
  { key: 'seniorityFit',    label: 'Seniority fit' },
  { key: 'industryFit',     label: 'Industry fit' },
  { key: 'officeFlexibility',label: 'Office flexibility' },
  { key: 'companyCulture',  label: 'Company culture' },
  { key: 'paternityLeave',  label: 'Parental leave' },
  { key: 'salaryMarket',    label: 'Salary vs market' },
  { key: 'careerGrowth',    label: 'Career growth' },
]

function FactorBar({ label, factor }) {
  if (!factor) return null
  const score = factor.score || 0
  const barColor = score >= 8 ? 'var(--marker-lime)' : score >= 6 ? '#FCD34D' : score >= 4 ? '#FDBA74' : '#FCA5A5'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--marker-text)' }}>{label}</span>
          {factor.found === false && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-border)', padding: '1px 5px', borderRadius: 3 }}>not found</span>
          )}
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>{score > 0 ? score : '–'}</span>
      </div>
      <div style={{ height: 6, background: 'var(--marker-border)', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ height: '100%', width: `${Math.min((score / 10) * 100, 100)}%`, background: barColor, borderRadius: 3, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      {factor.note && <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{factor.note}</div>}
      {factor.detail && <div style={{ fontSize: 11, color: 'var(--marker-black)', fontWeight: 500, marginTop: 2 }}>{factor.detail}</div>}
    </div>
  )
}

function AnalyseTab({ profile, jobs: pipelineJobs, addJob }) {
  const [url,       setUrl]       = useState('')
  const [jd,        setJd]        = useState('')
  const [roleInput, setRoleInput] = useState('')
  const [coInput,   setCoInput]   = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [result,    setResult]    = useState(null)
  const [error,     setError]     = useState('')
  const [added,     setAdded]     = useState(false)
  const [showJd,    setShowJd]    = useState(false)

  async function analyse() {
    if (!url.trim() && !jd.trim()) return
    setAnalysing(true)
    setResult(null)
    setError('')
    setAdded(false)
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobLink:   url.trim() || null,
          jdText:    jd.trim() || null,
          roleTitle: roleInput.trim() || null,
          company:   coInput.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Analysis failed'); return }
      setResult(data)
      if (data.roleTitle && !roleInput) setRoleInput(data.roleTitle)
      if (data.company && !coInput) setCoInput(data.company)
    } catch {
      setError('Request failed — check your connection and try again.')
    } finally {
      setAnalysing(false)
    }
  }

  function addToPipeline() {
    if (!result || added) return
    const n = parseFloat(result.score) || 0
    addJob({
      id:           crypto.randomUUID(),
      company:      result.company || coInput.trim() || 'Unknown',
      roleTitle:    result.roleTitle || roleInput.trim() || 'Unknown',
      jobLink:      url.trim(),
      link:         url.trim(),
      officeDays:   result.officeDays ?? 2,
      status:       'considering',
      ranking:      1,
      signal:       result.signal || '',
      signalReason: result.signalReason || '',
      score:        n,
      scoreBreakdown: JSON.stringify({ factors: result.factors, officeDays: result.officeDays }),
      factors:      result.factors,
      jd:           jd.trim(),
      addedAt:      new Date().toISOString(),
    })
    setAdded(true)
  }

  const n         = parseFloat(result?.score) || 0
  const top       = n >= 9
  const scoreBg   = top ? undefined : n >= 7 ? 'var(--marker-lime)' : n >= 5 ? '#F5E4A0' : '#FCA5A5'
  const signalBg  = result?.signal === 'apply' ? 'var(--marker-lime)' : result?.signal === 'maybe' ? '#F5E4A0' : result?.signal === 'dont_apply' ? '#FCA5A5' : 'var(--marker-border)'
  const alreadyAdded = pipelineJobs.some(j => j.jobLink === url.trim() || j.link === url.trim())
  const canAdd = !!result && !added && !alreadyAdded

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Input area — sticky */}
      <div style={{ padding: 16, background: 'var(--marker-cream)', borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>Analyse a role</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 14 }}>Paste a job URL · Claude reads it and scores it against your profile</div>

        <div style={{ marginBottom: 10 }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !analysing && analyse()}
            placeholder="Job URL — e.g. https://boards.greenhouse.io/monzo/jobs/…"
            style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', boxSizing: 'border-box' }}
          />
        </div>

        {/* Optional fields row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <input value={roleInput} onChange={e => setRoleInput(e.target.value)} placeholder="Role title (optional)" style={{ padding: '8px 12px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }} />
          <input value={coInput}   onChange={e => setCoInput(e.target.value)}   placeholder="Company (optional)"   style={{ padding: '8px 12px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }} />
        </div>

        {/* JD toggle */}
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setShowJd(v => !v)}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)', cursor: 'pointer', letterSpacing: '0.04em' }}
          >
            {showJd ? '▾ HIDE JD PASTE' : '▸ PASTE JD TEXT (better results for paywalled pages)'}
          </button>
          {showJd && (
            <textarea
              value={jd}
              onChange={e => setJd(e.target.value)}
              placeholder="Paste the full job description here — improves accuracy, especially for parental leave and culture data"
              rows={5}
              style={{ display: 'block', width: '100%', marginTop: 8, padding: '9px 12px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
            />
          )}
        </div>

        <button
          onClick={analyse}
          disabled={analysing || (!url.trim() && !jd.trim())}
          style={{
            display: 'block', width: '100%', padding: '11px',
            background: analysing || (!url.trim() && !jd.trim()) ? 'var(--marker-border)' : 'var(--marker-black)',
            color: analysing || (!url.trim() && !jd.trim()) ? 'var(--marker-mid)' : 'var(--marker-cream)',
            border: 'none', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500,
            cursor: analysing || (!url.trim() && !jd.trim()) ? 'default' : 'pointer',
          }}
        >
          {analysing ? 'Analysing (20–60s)…' : 'Analyse role →'}
        </button>
      </div>

      <div style={{ padding: '14px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Loading animation */}
        {analysing && (
          <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)' }}>Reading job description</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textAlign: 'center', lineHeight: 1.7 }}>
              Fetching page content · Searching for company culture data<br/>Scoring against your profile with Claude
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <div className="anim-b1" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
              <div className="anim-b2" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
              <div className="anim-b3" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && !analysing && (
          <div style={{ fontSize: 12, color: '#B91C1C', padding: '12px 14px', background: '#FEE2E2', borderRadius: 10 }}>{error}</div>
        )}

        {/* Empty state */}
        {!analysing && !result && !error && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Full role breakdown</div>
            <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
              Paste any job URL above. Claude fetches the JD, searches for company culture data, and scores the role across 8 factors against your profile.
            </div>
          </div>
        )}

        {/* Results */}
        {result && !analysing && (
          <>
            {/* Score header card */}
            <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {result.company && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>{result.company}</div>}
                  {result.roleTitle && <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', lineHeight: 1.3 }}>{result.roleTitle}</div>}
                </div>
                <div className={top ? 'holo-foil' : ''} style={{ background: top ? undefined : scoreBg, fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, padding: '4px 12px', borderRadius: 10, color: 'var(--marker-black)', flexShrink: 0 }}>
                  {n > 0 ? result.score : '–'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: result.signalReason ? 10 : 0 }}>
                {result.signal && <span style={{ background: signalBg, fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-black)', fontWeight: 600 }}>{result.signal === 'dont_apply' ? 'DON\'T APPLY' : result.signal}</span>}
                {result.officeDays != null && <span style={{ background: result.officeDays <= 1 ? 'var(--marker-lime)' : 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 8px', borderRadius: 5 }}>{result.officeDays === 0 ? 'Remote' : `${result.officeDays}d office`}</span>}
                {result._usedWebSearch && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-border)', padding: '3px 7px', borderRadius: 4 }}>web search used</span>}
              </div>

              {result.signalReason && (
                <div style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.6, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--marker-border)', fontStyle: 'italic' }}>{result.signalReason}</div>
              )}

              {result.officeNote && (
                <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 6, lineHeight: 1.4 }}>Office: {result.officeNote}</div>
              )}
            </div>

            {/* Factor breakdown */}
            {result.factors && (
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Factor breakdown</div>
                {FACTOR_META.map(({ key, label }) => (
                  <FactorBar key={key} label={label} factor={result.factors[key]} />
                ))}
              </div>
            )}

            {/* Add to pipeline */}
            <div style={{ display: 'flex', gap: 8 }}>
              {url.trim() && (
                <a
                  href={url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: 10, border: '1px solid var(--marker-border)', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', fontWeight: 500, textDecoration: 'none' }}
                >
                  View job ↗
                </a>
              )}
              <button
                onClick={addToPipeline}
                disabled={!canAdd}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: added || alreadyAdded ? 'var(--marker-border)' : 'var(--marker-black)', color: added || alreadyAdded ? 'var(--marker-mid)' : 'var(--marker-cream)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: !canAdd ? 'default' : 'pointer' }}
              >
                {added || alreadyAdded ? 'Added to pipeline ✓' : `+ Add to pipeline${result.signal === 'apply' ? ' — apply!' : ''}`}
              </button>
            </div>

            <div className="legal-line">AI-generated analysis. Review all scoring before making decisions. Web search used for company data — may not reflect current policies.</div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Engine tab — Analyse + LinkedIn tips + Pipeline summary ───────

const LINKEDIN_TIPS = [
  { label: 'LinkedIn Jobs Boolean', text: '("Head of Partnerships" OR "Director of Partnerships" OR "VP Partnerships" OR "Head of Marketing" OR "Director of Marketing") AND (London OR Remote OR "United Kingdom")' },
  { label: 'Sales Navigator filters', text: 'Function: Business Development / Marketing | Seniority: Director / VP / C-Level | Posted: Past 7 days | Location: United Kingdom' },
  { label: 'Content feed hack', text: 'Switch LinkedIn search to "Content" tab → Sort by "Latest" → search: "we\'re hiring" OR "now hiring" + your role title. Surfaces posts 24-72h before jobs go live.' },
]

function EngineTab({ profile, jobs: pipelineJobs, addJob, updateJob }) {
  const [url,          setUrl]          = useState('')
  const [jd,           setJd]           = useState('')
  const [roleInput,    setRoleInput]    = useState('')
  const [coInput,      setCoInput]      = useState('')
  const [analysing,    setAnalysing]    = useState(false)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState('')
  const [added,        setAdded]        = useState(false)
  const [showJd,       setShowJd]       = useState(false)
  const [tipsOpen,     setTipsOpen]     = useState(false)
  const [copied,       setCopied]       = useState(null)
  const [salary,       setSalary]       = useState(null)
  const [salaryLoading,setSalaryLoading]= useState(false)

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
    setAnalysing(true); setResult(null); setError(''); setAdded(false); setSalary(null); setSalaryLoading(false)
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobLink: url.trim() || null, jdText: jd.trim() || null, roleTitle: roleInput.trim() || null, company: coInput.trim() || null }),
      })
      const data = await res.json()
      // Bug 4: auto-switch to JD paste on failure
      if (!res.ok || data.error) { setError(data.error || 'Analysis failed'); setShowJd(true); return }
      setResult(data)
      if (data.roleTitle && !roleInput) setRoleInput(data.roleTitle)
      if (data.company && !coInput) setCoInput(data.company)
      // Bug 3: auto-fetch salary for score ≥ 5
      if (parseFloat(data.score) >= 5) {
        setSalaryLoading(true)
        fetch('/api/salary-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleTitle: data.roleTitle || roleInput.trim(), company: data.company || coInput.trim() }) })
          .then(r => r.json()).then(d => { if (d.salary) setSalary(d.salary) }).catch(() => {}).finally(() => setSalaryLoading(false))
      }
    } catch {
      setError('Request failed — check your connection and try again.')
      setShowJd(true) // Bug 4: auto-switch on network failure too
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
      fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: url.trim() }) }).catch(() => {})
    }
    setAdded(true)
  }

  function copyTip(text, idx) {
    navigator.clipboard.writeText(text).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 2000) })
  }

  const n         = parseFloat(result?.score) || 0
  const top       = n >= 9
  const scoreBg   = top ? undefined : n >= 7 ? 'var(--marker-lime)' : n >= 5 ? '#F5E4A0' : '#FCA5A5'
  const signalBg  = result?.signal === 'apply' ? 'var(--marker-lime)' : result?.signal === 'maybe' ? '#F5E4A0' : result?.signal === 'dont_apply' ? '#FCA5A5' : 'var(--marker-border)'
  const alreadyAdded = pipelineJobs.some(j => j.jobLink === url.trim() || j.link === url.trim())
  const canAdd = !!result && !added && !alreadyAdded

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Pipeline summary strip ── */}
      {activeJobs.length > 0 && (
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

      {/* ── Bug 7: Recently added with no score ── */}
      {recentUnscoredJobs.length > 0 && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Recently added — check match?</div>
            {recentUnscoredJobs.map(j => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12, color: '#78350F' }}>
                <span>{j.company}{j.roleTitle ? ` · ${j.roleTitle}` : ''}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#92400E', opacity: 0.7 }}>no score yet</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LinkedIn tips ── */}
      <div style={{ padding: '0 16px 12px' }}>
        <button onClick={() => setTipsOpen(o => !o)}
          style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: tipsOpen ? '10px 10px 0 0' : 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase' }}>LinkedIn search tips</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400E' }}>{tipsOpen ? '▲' : '▼'}</span>
        </button>
        {tipsOpen && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LINKEDIN_TIPS.map((tip, idx) => (
              <div key={idx} style={{ background: '#FEF3C7', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{tip.label}</div>
                  <button onClick={() => copyTip(tip.text, idx)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: copied === idx ? 'var(--marker-lime)' : 'var(--marker-cream)', border: '1px solid var(--marker-border)', color: 'var(--marker-black)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em', flexShrink: 0 }}>
                    {copied === idx ? 'COPIED ✓' : 'COPY'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#78350F', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>{tip.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Analyse input ── */}
      <div style={{ padding: '0 16px 14px', borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>Analyse a role</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 14 }}>Paste a job URL · Claude reads it and scores it against your profile</div>
        <div style={{ marginBottom: 10 }}>
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && !analysing && analyse()}
            placeholder="Job URL — e.g. https://boards.greenhouse.io/monzo/jobs/…"
            style={{ display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid var(--marker-border)', borderRadius: 10, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <input value={roleInput} onChange={e => setRoleInput(e.target.value)} placeholder="Role title (optional)" style={{ padding: '8px 12px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }} />
          <input value={coInput} onChange={e => setCoInput(e.target.value)} placeholder="Company (optional)" style={{ padding: '8px 12px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShowJd(v => !v)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)', cursor: 'pointer', letterSpacing: '0.04em' }}>
            {showJd ? '▾ HIDE JD PASTE' : '▸ PASTE JD TEXT (better results for paywalled pages)'}
          </button>
          {showJd && (
            <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description…" rows={5}
              style={{ display: 'block', width: '100%', marginTop: 8, padding: '9px 12px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
          )}
        </div>
        <button onClick={analyse} disabled={analysing || (!url.trim() && !jd.trim())}
          style={{ display: 'block', width: '100%', padding: '11px', background: analysing || (!url.trim() && !jd.trim()) ? 'var(--marker-border)' : 'var(--marker-black)', color: analysing || (!url.trim() && !jd.trim()) ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: analysing || (!url.trim() && !jd.trim()) ? 'default' : 'pointer' }}>
          {analysing ? 'Analysing (20–60s)…' : 'Analyse role →'}
        </button>
      </div>

      {/* ── Results ── */}
      <div style={{ padding: '14px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {analysing && (
          <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)' }}>Reading job description</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textAlign: 'center', lineHeight: 1.7 }}>Fetching page · Searching company data · Scoring with Claude</div>
            <div style={{ display: 'flex', gap: 7 }}>
              <div className="anim-b1" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
              <div className="anim-b2" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
              <div className="anim-b3" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--marker-black)' }} />
            </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {result.company && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>{result.company}</div>}
                  {result.roleTitle && <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', lineHeight: 1.3 }}>{result.roleTitle}</div>}
                </div>
                <div className={top ? 'holo-foil' : ''} style={{ background: top ? undefined : scoreBg, fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, padding: '4px 12px', borderRadius: 10, color: 'var(--marker-black)', flexShrink: 0 }}>
                  {n > 0 ? result.score : '–'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: result.signalReason ? 10 : 0 }}>
                {result.signal && <span style={{ background: signalBg, fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-black)', fontWeight: 600 }}>{result.signal === 'dont_apply' ? "DON'T APPLY" : result.signal}</span>}
                {result.officeDays != null && <span style={{ background: result.officeDays <= 1 ? 'var(--marker-lime)' : 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 8px', borderRadius: 5 }}>{result.officeDays === 0 ? 'Remote' : `${result.officeDays}d office`}</span>}
                {result._usedWebSearch && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-border)', padding: '3px 7px', borderRadius: 4 }}>web search used</span>}
                {salaryLoading && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-border)', padding: '3px 7px', borderRadius: 4 }}>fetching salary…</span>}
                {salary && <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 8px', borderRadius: 5 }}>{salary.source === 'adzuna' ? `£${salary.min}k–£${salary.max}k` : `~£${salary.min}k–£${salary.max}k (est)`}</span>}
              </div>
              {result.signalReason && <div style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.6, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--marker-border)', fontStyle: 'italic' }}>{result.signalReason}</div>}
            </div>
            {result.factors && (
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Factor breakdown</div>
                {FACTOR_META.map(({ key, label }) => <FactorBar key={key} label={label} factor={result.factors[key]} />)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {url.trim() && (
                <a href={url.trim()} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, textAlign: 'center', padding: '11px', borderRadius: 10, border: '1px solid var(--marker-border)', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', fontWeight: 500, textDecoration: 'none' }}>
                  View job ↗
                </a>
              )}
              <button onClick={addToPipeline} disabled={!canAdd}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: added || alreadyAdded ? 'var(--marker-border)' : 'var(--marker-black)', color: added || alreadyAdded ? 'var(--marker-mid)' : 'var(--marker-cream)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: !canAdd ? 'default' : 'pointer' }}>
                {added || alreadyAdded ? 'Added to pipeline ✓' : `+ Add to pipeline${result.signal === 'apply' ? ' — apply!' : ''}`}
              </button>
            </div>
            <div className="legal-line">AI-generated analysis. Review before making decisions. Web search used for company data — may not reflect current policies.</div>
          </>
        )}
      </div>
    </div>
  )
}

const TABS = ['Engine', 'Pipeline', 'Feed', 'CV', 'Prep', 'Stats', 'Easy Life']

const TRACK_LABELS = { balanced: 'Balanced', standard: 'Standard', parent: 'Parent', returner: 'Returner', career_changer: 'Career changer' }

export default function AppPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState('Pipeline')
  const [colIdx, setColIdx] = useState(2) // default: "Worth applying?"
  const [showAdd, setShowAdd] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [feedJobs, setFeedJobs] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [cvPrefill, setCvPrefill] = useState(null)
  const [trialEndsAt, setTrialEndsAt] = useState(null)
  const [trialDismissed, setTrialDismissed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase.from('users').select('trial_ends_at').eq('id', data.user.id).single()
          .then(({ data: u }) => { if (u?.trial_ends_at) setTrialEndsAt(new Date(u.trial_ends_at)) })
          .catch(() => {})
      }
    })
    getProfile().then(p => {
      if (!p?.track) { router.replace('/onboard'); return }
      setProfile(p)
      loadJobs().then(d => { setJobs(Array.isArray(d) ? d : []); setLoaded(true) }).catch(() => setLoaded(true))
    }).catch(() => {
      loadJobs().then(d => { setJobs(Array.isArray(d) ? d : []); setLoaded(true) }).catch(() => setLoaded(true))
    })
    loadFeedFromDb().then(d => { setFeedJobs(Array.isArray(d) ? d : []); setFeedLoading(false) }).catch(() => setFeedLoading(false))
  }, [])

  const updateJob = useCallback((id, updates) => {
    setJobs(prev => {
      const current = prev.find(j => j.id === id)
      const appliedAt = updates.status === 'applied' && current?.status !== 'applied'
        ? { appliedAt: new Date().toISOString() }
        : {}
      const next = prev.map(j => j.id === id ? { ...j, ...updates, ...appliedAt } : j)
      const updated = next.find(j => j.id === id)
      if (updated) updateJobInDb(updated).catch(() => {})
      return next
    })
  }, [])

  const addJob = useCallback((job) => {
    const next = [...jobs, job]
    setJobs(next)
    saveJobs(next).catch(() => {})
  }, [jobs])

  const deleteJob = useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id !== id))
    deleteJobFromDb(id).catch(() => {})
  }, [])

  const tailorCv = useCallback((job) => {
    setCvPrefill({ jobId: job.id, jobTitle: job.roleTitle || '', company: job.company || '' })
    setTab('CV')
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const activeCol = COLUMNS[colIdx]
  const colJobs = jobs.filter(j => j.status === activeCol.id).sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))
  const totalWithJobs = jobs.filter(j => !['watchlist', 'no_jobs'].includes(j.status)).length

  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--marker-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING</div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', display: 'flex', flexDirection: 'column' }}>

      {/* ── App header — full-width sticky ── */}
      <div style={{ background: 'var(--marker-cream)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', width: '100%', boxSizing: 'border-box', padding: '12px 16px 0' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Logo size={18} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {profile?.track && (
                <span className="chip chip-lime" style={{ fontSize: 9, padding: '3px 7px' }}>
                  {TRACK_LABELS[profile.track] || profile.track}
                </span>
              )}
              <div className="chip" style={{ fontSize: 9, padding: '3px 7px' }}>
                {jobs.filter(j => j.score > 0).length}/{jobs.length} SCORED
              </div>
              <button onClick={() => router.push('/settings')} style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--marker-border)', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--marker-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Settings">⚙</button>
              <button onClick={signOut} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--marker-border)', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)' }} title="Sign out">
                {user?.email?.charAt(0).toUpperCase() || '?'}
              </button>
            </div>
          </div>

          <div className={s.tabScroll} style={{ display: 'flex', gap: 0, fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', padding: '0 14px 10px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', color: t === tab ? 'var(--marker-black)' : 'var(--marker-mid)', fontWeight: t === tab ? 500 : 400, borderBottom: t === tab ? '2px solid var(--marker-black)' : '2px solid transparent', whiteSpace: 'nowrap' }}>
                {t}
              </button>
            ))}
          </div>

          <div className="holo-hairline" style={{ marginLeft: -16, marginRight: -16, marginTop: -1 }} />
        </div>
      </div>

      {/* ── Trial banner ── */}
      {!trialDismissed && trialEndsAt && (() => {
        const now = new Date()
        const msLeft = trialEndsAt - now
        const daysLeft = Math.ceil(msLeft / 86400000)
        const expired = msLeft <= 0
        const expiringSoon = !expired && daysLeft <= 3
        if (!expired && !expiringSoon) return null
        const bg = expired ? '#FEE2E2' : '#FEF3C7'
        const border = expired ? '#FCA5A5' : '#FCD34D'
        const text = expired
          ? 'Your 7-day trial has ended. Upgrade to keep using all features.'
          : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial.`
        return (
          <div style={{ background: bg, borderBottom: `1px solid ${border}`, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: expired ? '#B91C1C' : '#92400E' }}>{text}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              {expired && <a href="/pricing" style={{ fontSize: 12, fontWeight: 500, color: '#B91C1C', textDecoration: 'none' }}>View plans →</a>}
              <button onClick={() => setTrialDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          </div>
        )
      })()}

      {/* ── Main content — centered ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 960, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* ── Pipeline tab ── */}
        {tab === 'Pipeline' && (
          <>
            {/* Column selector */}
            <div style={{ padding: '0 16px', overflowX: 'auto', display: 'flex', gap: 6, borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)' }}>
              {COLUMNS.map((col, i) => {
                const count = jobs.filter(j => j.status === col.id).length
                return (
                  <button key={col.id} onClick={() => setColIdx(i)} style={{ background: 'none', border: 'none', borderBottom: i === colIdx ? '2px solid var(--marker-black)' : '2px solid transparent', padding: '10px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', color: i === colIdx ? 'var(--marker-black)' : 'var(--marker-mid)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {col.label}
                    {count > 0 && <span style={{ background: i === colIdx ? 'var(--marker-black)' : 'var(--marker-border)', color: i === colIdx ? 'var(--marker-cream)' : 'var(--marker-mid)', borderRadius: 10, fontSize: 9, padding: '1px 5px', fontFamily: 'var(--font-mono)' }}>{count}</span>}
                  </button>
                )
              })}
            </div>

            {/* Column header */}
            <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>{activeCol.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{colJobs.length} card{colJobs.length !== 1 ? 's' : ''} · sorted by score</div>
              </div>
              <button onClick={() => setShowAdd(true)} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>+ Add</button>
            </div>

            {/* Cards */}
            <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
              {colJobs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginBottom: 12 }}>NOTHING HERE YET</div>
                  <button onClick={() => setShowAdd(true)} className="btn btn-ghost" style={{ fontSize: 13 }}>Add your first role</button>
                </div>
              ) : colJobs.map(job => (
                <PipelineCard key={job.id} job={job}
                  onEditDetails={j => setEditingJob(j)}
                  onDelete={deleteJob}
                  onTailorCv={tailorCv}
                  onScore={async (j) => {
                    if (!j.jobLink) return
                    try {
                      const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobLink: j.jobLink, roleTitle: j.roleTitle, company: j.company }) })
                      if (res.ok) {
                        const data = await res.json()
                        track('job_scored', { signal: data.signal || 'none' })
                        updateJob(j.id, { score: data.score, factors: data.factors, signal: data.signal, signalReason: data.signalReason, officeDays: data.officeDays ?? j.officeDays })
                      }
                    } catch {}
                  }}
                />
              ))}

              {colJobs.length > 0 && (
                <div style={{ padding: '12px 4px 4px' }}>
                  <div className="holo-hairline" />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 4px 8px' }}>
                <div className="legal-line">AI-generated scores and summaries. Not professional career advice. Parental leave data sourced via web search — verify directly with the employer before relying on it.</div>
              </div>
            </div>
          </>
        )}

        {/* ── Engine tab ── */}
        {tab === 'Engine' && <EngineTab profile={profile} jobs={jobs} addJob={addJob} updateJob={updateJob} />}

        {/* ── Feed tab ── */}
        {tab === 'Feed' && <FeedTab jobs={jobs} addJob={addJob} feedJobs={feedJobs} feedLoading={feedLoading} profile={profile} />}

        {/* ── CV tab ── */}
        {tab === 'CV' && <CvTab profile={profile} jobs={jobs} updateJob={updateJob} prefill={cvPrefill} onClearPrefill={() => setCvPrefill(null)} />}

        {/* ── Stats tab ── */}
        {tab === 'Stats' && <StatsTab jobs={jobs} />}

        {/* ── Prep tab ── */}
        {tab === 'Prep' && <PrepTab jobs={jobs} />}

        {/* ── Easy Life tab ── */}
        {tab === 'Easy Life' && <BalancedTab jobs={jobs} addJob={addJob} />}

      </div>

      {/* ── Bottom tab bar — mobile only (hidden ≥768px) ── */}
      <div className={s.bottomNav}>
        {[{ l: 'Engine', t: 'Engine' }, { l: 'Pipe', t: 'Pipeline' }, { l: 'Feed', t: 'Feed' }, { l: 'CV', t: 'CV' }, { l: 'Prep', t: 'Prep' }].map(({ l, t }) => (
          <button key={t} onClick={() => setTab(t)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px' }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: tab === t ? 'var(--marker-black)' : 'var(--marker-border)' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tab === t ? 'var(--marker-black)' : 'var(--marker-mid)' }}>{l}</div>
          </button>
        ))}
      </div>

      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onAdd={addJob} />}
      {editingJob && <EditJobModal job={editingJob} onClose={() => setEditingJob(null)} onSave={j => updateJob(j.id, j)} onDelete={deleteJob} />}
    </div>
  )
}
