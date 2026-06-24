'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { loadJobs, saveJobs, updateJobInDb, deleteJobFromDb, getProfile } from '../../lib/db'
import { createClient } from '../../lib/supabase/client'
import FreshnessPulse from '../../components/FreshnessPulse'
import MemoryCard from '../../components/MemoryCard'
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
  const high = n >= 7 && n < 9
  const bg = top ? undefined : high ? 'rgba(198,244,50,0.22)' : n >= 5 ? 'var(--marker-cream)' : 'var(--marker-border)'
  const border = top ? 'transparent' : high ? 'rgba(198,244,50,0.7)' : 'var(--marker-border)'
  return (
    <div className={top ? 'holo-foil' : ''} style={{ background: bg, border: `1px solid ${border}`, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, padding: '2px 8px', borderRadius: 5, color: 'var(--marker-black)', flexShrink: 0 }}>
      {n > 0 ? <span className={high ? 'chrome-text' : ''}>{score}</span> : '–'}
    </div>
  )
}

function OfficeBadge({ days }) {
  if (days === undefined || days === null) return null
  const d = parseFloat(days)
  const bg = d <= 1 ? 'var(--marker-lime)' : d <= 2.5 ? '#F0E0A8' : '#E8B8B8'
  const label = d === 0 ? 'Remote' : `${d}d`
  return <span style={{ background: bg, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, color: 'var(--marker-black)' }}>{label}</span>
}

function SignalBadge({ signal }) {
  if (!signal) return null
  const bg = signal === 'apply' ? 'var(--marker-lime)' : signal === 'maybe' ? '#F0E0A8' : '#E8B8B8'
  const color = signal === 'dont_apply' ? 'white' : 'var(--marker-black)'
  const label = signal === 'dont_apply' ? 'skip' : signal
  return <span style={{ background: bg, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', color }}>{label}</span>
}

// ── Pipeline card — matches ProductMobileUI.jsx exactly ───────────

const FACTOR_LABELS = {
  roleSkillsMatch: 'Skills match',
  seniorityFit: 'Seniority fit',
  industryFit: 'Industry fit',
  officeFlexibility: 'Office flex',
  companyCulture: 'Culture',
  paternityLeave: 'Parental leave',
  salaryMarket: 'Salary',
  careerGrowth: 'Growth',
}

function factorScoreColor(score) {
  if (score >= 8) return 'var(--marker-lime)'
  if (score >= 6) return '#93C5FD'
  if (score >= 4) return '#F0E0A8'
  return '#E8B8B8'
}

function timeAgo(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 8) return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function PipelineCard({ job, onEditDetails, onDelete, onScore, onTailorCv, onStatusChange }) {
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [scoreError, setScoreError] = useState('')
  const bd = (() => { try { return typeof job.scoreBreakdown === 'string' ? JSON.parse(job.scoreBreakdown) : (job.scoreBreakdown || {}) } catch { return {} } })()
  const factors = job.factors || bd.factors || null
  const isAdzuna = job.source === 'adzuna' || bd.source === 'adzuna'

  const postedLabel = job.postedAt
    ? `Posted ${timeAgo(job.postedAt)}`
    : job.addedAt
      ? `Added ${timeAgo(job.addedAt)}`
      : null

  const salary = job.salary || bd.salary || null

  return (
    <div style={{ background: 'var(--marker-cream-2)', border: `1px solid ${job.deadLink ? '#F59E0B' : 'var(--marker-border)'}`, borderRadius: 10, padding: 12 }}>
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
        {salary && <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4 }}>{salary}</span>}
        {bd.wlb && <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4 }}>Balance {bd.wlb}/5</span>}
        {job.deadLink && <span style={{ background: '#FEF3C7', border: '1px solid #F59E0B', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, color: '#92400E' }}>Dead link</span>}
        {job.status === 'applied' && job.appliedAt && (Date.now() - new Date(job.appliedAt).getTime()) > 7 * 86400000 && (
          <span style={{ background: 'var(--marker-lime)', border: '1px solid rgba(0,0,0,0.08)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, color: 'var(--marker-black)', fontWeight: 600 }}>Follow up?</span>
        )}
        {postedLabel && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', padding: '3px 0' }}>{postedLabel}</span>}
      </div>

      {job.signalReason && (
        <div style={{ fontSize: 11, color: 'var(--marker-mid)', fontStyle: 'italic', lineHeight: 1.4, marginBottom: 8 }}>{job.signalReason}</div>
      )}

      {breakdownOpen && factors && (
        <div style={{ marginBottom: 8, padding: 10, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
            {Object.entries(factors).map(([k, v]) => {
              const label = FACTOR_LABELS[k] || k.replace(/([A-Z])/g, ' $1').trim()
              const score = typeof v === 'object' ? v?.score : (typeof v === 'number' ? v : null)
              const note = typeof v === 'object' ? v?.note || v?.reason : null
              const notFound = typeof v === 'object' && v?.found === false
              const scoreColor = notFound ? 'var(--marker-mid)' : score !== null ? factorScoreColor(score) : 'var(--marker-border)'
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--marker-border)' }}>
                  <span style={{ background: scoreColor, minWidth: 28, textAlign: 'center', padding: '2px 4px', borderRadius: 3, color: 'var(--marker-black)', fontWeight: 600 }}>
                    {notFound ? '✕' : score !== null ? score : '–'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: 'var(--marker-text)', textTransform: 'capitalize' }}>{label}</span>
                    {note && <span style={{ color: 'var(--marker-mid)', marginLeft: 6 }}>{note}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {onStatusChange && (
        <div style={{ marginBottom: 8 }}>
          <select
            value={job.status}
            onChange={e => onStatusChange(job.id, e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', border: '1px solid var(--marker-border)', borderRadius: 6, background: '#fff', color: 'var(--marker-text)', cursor: 'pointer' }}
          >
            {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid var(--marker-border)', marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => onTailorCv(job)} style={{ flex: 1, minWidth: 80, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Tailor CV</button>
        <button onClick={() => setBreakdownOpen(o => !o)} disabled={!factors} style={{ flex: 1, minWidth: 80, background: 'transparent', color: factors ? 'var(--marker-text)' : 'var(--marker-mid)', border: '1px solid var(--marker-border)', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', cursor: factors ? 'pointer' : 'default' }}>
          {breakdownOpen ? 'Hide' : 'Breakdown'}
        </button>
        {job.jobLink && (
          <button
            onClick={async () => {
              setScoring(true)
              setScoreError('')
              try { await onScore(job) } catch (e) { setScoreError(e?.message || 'Scoring failed') }
              setScoring(false)
            }}
            disabled={scoring}
            style={{ flex: 1, minWidth: 60, background: scoring ? 'var(--marker-border)' : job.score ? 'transparent' : 'var(--marker-lime)', color: scoring ? 'var(--marker-mid)' : 'var(--marker-black)', border: job.score && !scoring ? '1px solid var(--marker-border)' : 'none', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: scoring ? 'default' : 'pointer' }}>
            {scoring ? 'Scoring…' : job.score ? 'Re-score' : 'Score'}
          </button>
        )}
        {scoreError && <div style={{ width: '100%', fontSize: 10, color: '#B91C1C', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{scoreError}</div>}
        <button onClick={() => onEditDetails(job)} style={{ background: 'transparent', color: 'var(--marker-mid)', border: '1px solid var(--marker-border)', padding: '7px 9px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }} title="Edit details">✏️</button>
        {isAdzuna && <AdzunaBadge />}
      </div>
    </div>
  )
}

// ── First-time tutorial system ────────────────────────────────────

function useTutorial(key) {
  const [seen, setSeen] = useState(true) // true = no flash before hydration
  useEffect(() => {
    try { if (!localStorage.getItem(`mkr_tour_${key}`)) setSeen(false) } catch {}
  }, [key])
  function dismiss() {
    try { localStorage.setItem(`mkr_tour_${key}`, '1') } catch {}
    setSeen(true)
  }
  return [!seen, dismiss]
}

// ── First-run guide ───────────────────────────────────────────────

const FIRST_RUN_STEPS = [
  {
    n: '01',
    tab: 'Discover',
    subTab: 'tasklist',
    heading: 'This is your Company Scan.',
    body: 'We pre-loaded companies based on your profile. The green dot means they have open roles right now. Click any company to expand the roles.',
    cta: 'Got it →',
    pulse: 'company-scan-list',
  },
  {
    n: '02',
    tab: 'Discover',
    subTab: 'tasklist',
    heading: 'See a role? Add it to your pipeline.',
    body: 'Hit the + Pipeline button on any role. Aim for 5–8 active roles — enough to keep momentum without overwhelm.',
    cta: 'Got it →',
    pulse: 'pipeline-button',
  },
  {
    n: '03',
    tab: 'Today',
    subTab: null,
    heading: 'Score any role in 30 seconds.',
    body: 'Paste a job URL into the box on this page. Claude reads the full JD and gives you an 8-factor match score — including office days, WLB, and parental leave.',
    cta: "Let's go",
    pulse: 'score-input',
  },
]

function useFirstRun() {
  const [step, setStep] = useState(null) // null = loaded but done; 1/2/3 = active
  useEffect(() => {
    try {
      if (!localStorage.getItem('mkr_first_run_done')) setStep(1)
    } catch {}
  }, [])
  function advance() {
    setStep(s => {
      if (s >= FIRST_RUN_STEPS.length) {
        try { localStorage.setItem('mkr_first_run_done', '1') } catch {}
        return null
      }
      return s + 1
    })
  }
  function dismiss() {
    try { localStorage.setItem('mkr_first_run_done', '1') } catch {}
    setStep(null)
  }
  return [step, advance, dismiss]
}

function FirstRunGuide({ step, onAdvance, onDismiss }) {
  if (!step) return null
  const s = FIRST_RUN_STEPS[step - 1]
  return (
    <div style={{ margin: '0 0 0', background: 'var(--marker-black)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '14px 16px', display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
          <div className="kicker holo-text" style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{s.n}</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.01em', marginBottom: 4 }}>{s.heading}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{s.body}</div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={onAdvance} className="holo-foil" style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--marker-black)', letterSpacing: '-0.01em' }}>{s.cta}</button>
              <div style={{ display: 'flex', gap: 4 }}>
                {FIRST_RUN_STEPS.map((_, i) => (
                  <div key={i} style={{ width: i + 1 === step ? 16 : 6, height: 6, borderRadius: 3, background: i + 1 === step ? 'var(--marker-lime)' : 'rgba(255,255,255,0.2)', transition: 'all 0.2s' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <button onClick={onDismiss} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 18, lineHeight: 1, padding: '2px 4px', marginTop: 2 }} title="Skip tour">×</button>
      </div>
    </div>
  )
}

function TourBanner({ children, onDismiss }) {
  return (
    <div style={{ background: 'var(--marker-cream-2)', borderBottom: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', padding: '12px 16px 12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, animation: 'fadeSlideIn 0.35s ease' }}>
      <div style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: 'var(--marker-mid)', marginRight: 6 }}>Tip ·</span>
        {children}
      </div>
      <button onClick={onDismiss} style={{ flexShrink: 0, background: 'none', border: '1px solid var(--marker-border)', cursor: 'pointer', color: 'var(--marker-mid)', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, padding: '4px 10px', borderRadius: 4, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>Got it</button>
    </div>
  )
}

// ── Progress bar — shared animated loader for slow AI calls ──────

function ProgressBar({ duration, steps, slowAt, slowMsg }) {
  const [pct,        setPct]        = useState(0)
  const [stepIdx,    setStepIdx]    = useState(0)
  const [showSlow,   setShowSlow]   = useState(false)

  useEffect(() => {
    const tickMs     = 300
    const totalTicks = (duration * 1000) / tickMs
    let tick = 0
    const id = setInterval(() => {
      tick++
      const raw   = Math.min(tick / totalTicks, 1)
      const eased = 1 - Math.pow(1 - raw, 2.2)
      const newPct = Math.min(91, eased * 91)
      setPct(newPct)
      setStepIdx(Math.min(Math.floor((newPct / 91) * steps.length), steps.length - 1))
      if (slowAt && newPct >= slowAt) setShowSlow(true)
    }, tickMs)
    return () => clearInterval(id)
  }, [duration, steps.length, slowAt])

  return (
    <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 10, letterSpacing: '0.04em', minHeight: 16 }}>
        {steps[stepIdx]}
      </div>
      <div style={{ background: 'var(--marker-border)', borderRadius: 3, height: 3, overflow: 'hidden' }}>
        <div style={{ background: 'var(--marker-black)', height: '100%', width: `${pct}%`, transition: 'width 0.3s ease', borderRadius: 3 }} />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', letterSpacing: '0.04em', textAlign: 'right', marginTop: 5 }}>
        {Math.round(pct)}%
      </div>
      {slowMsg && showSlow && (
        <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', lineHeight: 1.7, textAlign: 'center', letterSpacing: '0.04em', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 6, padding: '8px 12px' }}>
          {slowMsg}
        </div>
      )}
    </div>
  )
}

const STEPS_ANALYSE = [
  'Fetching the job page…',
  'Extracting the job description…',
  'Checking company culture signals…',
  'Measuring skills match against your profile…',
  'Weighing seniority and industry fit…',
  'Calculating your WLB score…',
  'Putting it all together…',
  'Building your score breakdown…',
]

const STEPS_SEARCH = [
  'Querying Adzuna for live roles…',
  'Pulling the freshest listings…',
  'Filtering out anything irrelevant…',
  'Reading each job description…',
  'Matching against your profile…',
  'Scoring the best fits…',
  'Ranking the results…',
  'Nearly there…',
]

const STEPS_PREP = [
  'Researching the company…',
  'Digging into their interview style…',
  'Pulling likely first-round questions…',
  'Building your STAR story frameworks…',
  'Checking culture and Glassdoor notes…',
  'Writing your company intelligence brief…',
  'Adding the finishing touches…',
  'Almost done…',
]

const STEPS_CT_COMPANIES = [
  'Identifying active UK employers in your field…',
  'Cross-referencing contractor hiring volumes…',
  'Checking conversion confidence signals…',
  'Pulling WLB and culture data…',
  'Scoring and ranking your targets…',
  'Almost there…',
]

const STEPS_CT_ROLES = [
  'Querying Adzuna for contract roles…',
  'Filtering out permanent listings…',
  'Reading each contract description…',
  'Matching against your contractor profile…',
  'Scoring the best fits…',
  'Ranking the results…',
]

const STEPS_CT_RECRUITERS = [
  'Finding specialist UK agencies in your field…',
  'Checking their contractor focus areas…',
  'Pulling approach notes for each agency…',
  'Ranking by relevance to your role…',
  'Nearly there…',
]

// ── Column definitions ────────────────────────────────────────────

const COLUMNS = [
  { id: 'considering',    label: 'Considering',  primary: true  },
  { id: 'to_apply',       label: 'To apply',     primary: true  },
  { id: 'applied',        label: 'Applied',      primary: true  },
  { id: 'interviewing',   label: 'Interviewing', primary: true  },
  { id: 'offer',          label: 'Offer',        primary: true  },
  { id: 'watchlist',      label: 'Watchlist',    primary: true  },
  { id: 'rejected',       label: 'Rejected',     primary: false },
  { id: 'no_jobs',        label: 'No openings',  primary: false },
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

// ── Interview Prep markdown renderer ─────────────────────────────

function renderPrepMarkdown(text) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: i > 0 ? 18 : 0, marginBottom: 8, paddingBottom: 5, borderBottom: '1px solid var(--marker-border)' }}>
          {line.slice(3)}
        </div>
      )
    }
    if (line.startsWith('### ')) {
      return (
        <div key={i} style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginTop: 10, marginBottom: 4 }}>
          {line.slice(4)}
        </div>
      )
    }
    if (line.trim() === '') return <div key={i} style={{ height: 5 }} />
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <div key={i} style={{ paddingLeft: 10, lineHeight: 1.7, color: 'var(--marker-text)' }}>{'• ' + line.slice(2)}</div>
    }
    return <div key={i} style={{ lineHeight: 1.7, color: 'var(--marker-text)' }}>{line}</div>
  })
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

function PrepTab({ jobs, profile }) {
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
  const [result, setResult]               = useState('')
  const [error, setError]                 = useState('')
  const [copied, setCopied]               = useState(false)
  const [salary, setSalary]               = useState(null)
  const [offerAmount, setOfferAmount]     = useState('')
  const [targetAmount, setTargetAmount]   = useState('')
  const [negoNotes, setNegoNotes]         = useState('')

  const selectedJob = jobs.find(j => j.id === selectedJobId) || null

  useEffect(() => {
    if (!selectedJob?.roleTitle) { setSalary(null); return }
    setSalary(null)
    const body = { roleTitle: selectedJob.roleTitle, company: selectedJob.company || '' }
    if (profile?.seniority) body.profileSeniority = profile.seniority
    fetch('/api/salary-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.salary) setSalary(d.salary) }).catch(() => {})
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
    setResult('')
    setError('')
    try {
      if (mode === 'negotiate') {
        const res = await fetch('/api/negotiation-prep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleTitle: selectedJob.roleTitle, company: selectedJob.company, offerAmount: offerAmount.trim(), targetAmount: targetAmount.trim(), notes: negoNotes.trim(), jdText: (selectedJob.jd || '').slice(0, 2000) }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Generation failed'); return }
        setResult(data.prep || '')
      } else {
        const res = await fetch('/api/interview-prep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job: selectedJob, stage, interviewer: interviewer.trim(), jdText: jdText.trim(), cvBase64: cvBase64 || undefined }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Generation failed'); return }
        track('interview_prep_generated', { stage })
        setResult(data.prep || '')
      }
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
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO APPLIED ROLES</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>Mark a role as Applied first</div>
        <div style={{ fontSize: 14, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>Interview prep is available for roles at the Applied, Interviewing, or Offer stage in your pipeline.</div>
      </div>
    )
  }

  const offerJobs = activeJobs.filter(j => j.status === 'offer')

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Tab purpose header + mode toggle */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--marker-border)', marginBottom: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>
          {mode === 'negotiate' ? 'Negotiate your offer' : 'Prep for your interview'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
          {mode === 'negotiate'
            ? 'Scripts, counter-offer strategy, and BATNA for your offer-stage role — grounded in your profile and market data.'
            : 'Pick a role you\'ve applied for and get a full prep pack — company background, likely questions, and STAR story starters tailored to the JD.'}
        </div>
        {offerJobs.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {[{ id: 'prep', label: 'Interview prep' }, { id: 'negotiate', label: 'Negotiate offer' }].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setResult(''); setError('') }}
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
        <select value={selectedJobId} onChange={e => { setSelectedJobId(e.target.value); setResult(''); setError('') }}
          style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}>
          {(mode === 'negotiate' ? offerJobs : activeJobs).map(j => <option key={j.id} value={j.id}>{j.company} — {j.roleTitle || 'Untitled'}</option>)}
        </select>
        {salary && (
          <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
            Market rate for this role: <span style={{ color: 'var(--marker-black)', fontWeight: 700 }}>{salary.source === 'adzuna' ? `£${salary.min}k–£${salary.max}k` : `~£${salary.min}k–£${salary.max}k (est)`}</span>
            <span style={{ marginLeft: 6, color: 'var(--marker-border)' }}>· {salary.source === 'adzuna' ? 'Adzuna data' : 'Static estimate'}</span>
          </div>
        )}
      </div>

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
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Interviewer name / title <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional)</span></label>
        <input value={interviewer} onChange={e => setInterviewer(e.target.value)} placeholder="e.g. Sarah Chen, VP Product" style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>Job description <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(paste for best results)</span></label>
        <textarea value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the JD here — Claude will research the company live via web search regardless…" rows={4} style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)', resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--marker-text)', marginBottom: 6 }}>CV you submitted <span style={{ fontWeight: 400, color: 'var(--marker-mid)' }}>(optional — PDF only, for targeted STAR answers)</span></label>
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
        {generating ? 'Generating…' : mode === 'negotiate' ? 'Generate negotiation pack' : 'Generate prep pack'}
      </button>

      {generating && (
        <div style={{ padding: '16px 0 4px' }}>
          <ProgressBar duration={mode === 'negotiate' ? 15 : 50} steps={STEPS_PREP} slowAt={mode === 'negotiate' ? 10 : 32} slowMsg={mode === 'negotiate' ? 'Preparing your negotiation scripts and market analysis…' : "Web search adds time here — Claude's looking up the actual company, not guessing from training data."} />
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#B91C1C', padding: '10px 12px', background: '#FEE2E2', borderRadius: 8 }}>{error}</div>}

      {result && (
        <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{mode === 'negotiate' ? 'Negotiation pack' : 'Prep pack'}</div>
            <button onClick={copy} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: copied ? 'var(--marker-lime)' : 'var(--marker-border)', color: 'var(--marker-black)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em' }}>
              {copied ? 'COPIED ✓' : 'COPY'}
            </button>
          </div>
          <div style={{ padding: 14, fontSize: 12, maxHeight: 600, overflowY: 'auto', fontFamily: 'var(--font-body)' }}>
            {renderPrepMarkdown(result)}
          </div>
        </div>
      )}

      <div className="legal-line">{mode === 'negotiate' ? 'AI negotiation coaching. Market data from Adzuna. Verify figures independently.' : 'Live web research included. Takes 30-60 seconds. Uses your Anthropic API key.'}</div>
    </div>
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
  const EFFORT_LABELS = { 1: 'L1 — Keywords', 2: 'L2 — Guided', 3: 'L3 — Deep' }

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
          { label: 'Int. rate', value: applied > 0 ? `${intRate}%` : '—' },
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
            {parseFloat(avgInterv) > parseFloat(avgApplied) + 0.5 ? ' Higher-scored roles are converting — keep prioritising them.' : ''}
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
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '—'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2 }}>{job.company}</div>
                </div>
                <ScoreBadge score={job.score} />
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
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: rate >= 30 ? '#16a34a' : rate > 0 ? 'var(--marker-text)' : 'var(--marker-mid)' }}>{bandApplied > 0 ? `${rate}%` : '—'}</div>
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
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: rate >= 30 ? '#16a34a' : rate > 0 ? 'var(--marker-text)' : 'var(--marker-mid)' }}>{lvApplied > 0 ? `${rate}%` : '—'}</div>
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
          insights.push(`Roles scored 9-10 converted at ${Math.round((topBandInterv/topBandApplied)*100)}% — prioritise these above all else.`)
        }
        const l3Jobs = jobs.filter(j => j.cvEffortLevel === 3)
        const l1Jobs = jobs.filter(j => j.cvEffortLevel === 1)
        const l3App  = l3Jobs.filter(j => ['applied','interviewing','offer','rejected'].includes(j.status)).length
        const l1App  = l1Jobs.filter(j => ['applied','interviewing','offer','rejected'].includes(j.status)).length
        const l3Rate = l3App > 0 ? l3Jobs.filter(j => ['interviewing','offer'].includes(j.status)).length / l3App : 0
        const l1Rate = l1App > 0 ? l1Jobs.filter(j => ['interviewing','offer'].includes(j.status)).length / l1App : 0
        if (l3App >= 2 && l1App >= 2 && l3Rate > l1Rate) {
          insights.push(`Level 3 tailored CVs got ${Math.round((l3Rate - l1Rate)*100)}% more interviews than Level 1 — consider trusting the AI more.`)
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

// ── CV Generator tab ──────────────────────────────────────────────

const EFFORT_LEVELS = [
  { id: 'none',   label: 'Zero effort', sub: 'AI writes now — no questions',     cvEffort: 'standard' },
  { id: 'light',  label: 'Light',       sub: '2 questions · adds real context',   cvEffort: 'standard' },
  { id: 'medium', label: 'Medium',      sub: '4 questions · stronger tailoring',  cvEffort: 'deep'     },
  { id: 'deep',   label: 'Deep',        sub: '7 questions · maximum precision',   cvEffort: 'deep'     },
]

function buildCvPrompt(level, roleTitle, company, jobLink, cvRaw) {
  const jobLine = `Role: ${roleTitle}${company ? ` at ${company}` : ''}${jobLink ? `\nJob link: ${jobLink}` : ''}`
  const cvBlock = cvRaw ? `\nMy CV:\n${cvRaw}` : ''
  const footer = `\nATS + AI screening defence: Use exact-match keywords from the JD. Keep bullet points action-verb led with metrics. Avoid tables, text boxes, and headers/footers which ATS parsers cannot read. Do not add skills or experience that are not in my CV.\n\nImportant: share download links to the final CV only — do not paste the CV text directly in this chat.`

  if (level === 1) return `You are helping me tailor my CV for a specific role. Analyse it against the job description and give me actionable guidance — I will make the edits myself.\n\n${jobLine}${cvBlock}\n\nPlease:\n1. List the 10–15 most important keywords from the JD I should include in my CV\n2. Identify the 3 biggest gaps between my CV and what they are asking for\n3. Suggest 5 specific bullet point rewrites I could make (keep my authentic experience, just tighten the language and add metrics where possible)\n4. Flag any ATS risks — formatting issues, missing keywords, vague phrases${footer}`

  if (level === 2) return `Please rewrite my CV to better match this specific role. Keep my authentic experience — improve how it is framed, not what I have done.\n\n${jobLine}${cvBlock}\n\nInstructions:\n- Rewrite bullet points to mirror language from the JD where genuinely applicable\n- Optimise for ATS: ensure exact-match keywords appear naturally, remove filler phrases, keep formatting clean\n- Optimise for AI screening: ensure the skills section, first page, and each role's opening line are keyword-dense but readable\n- Keep every job title, company, and date — do not invent experience\n- Aim for a relevance score of 8+/10 for this specific role${footer}`

  return `Please create a fully tailored, ATS-optimised version of my CV for this specific role. This is a deep rewrite — pull every relevant piece of experience forward and present it in the strongest possible way.\n\n${jobLine}${cvBlock}\n\nInstructions:\n- Reorder and reframe bullet points to lead with what this employer cares most about\n- Rewrite the profile/summary to be a direct pitch for this exact role\n- Use exact keywords from the JD throughout, especially in the summary, skills section, and each role's opening bullets\n- ATS: no tables, no text boxes, no columns, no headers/footers with key info, bullet points only, clean section headers\n- AI screening defence: ensure the first page, summary, and every role heading directly echo the language of the JD\n- Remove or de-prioritise anything clearly irrelevant to this role\n- Keep every job title, company, and date — do not invent experience or qualifications${footer}`
}

function buildClPrompt(level, roleTitle, company, jobLink, cvRaw) {
  const jobLine = `Role: ${roleTitle}${company ? ` at ${company}` : ''}${jobLink ? `\nJob link: ${jobLink}` : ''}`
  const cvBlock = cvRaw ? `\nMy CV:\n${cvRaw}` : ''
  const footer = `\nKeep it to 3–4 paragraphs, 300–400 words. British English. Confident and direct — no phrases like "I am writing to apply" or "I would be thrilled".\n\nImportant: share download links to the final cover letter only — do not paste the text directly in this chat.`

  if (level === 1) return `Help me write a cover letter for this role. Give me a structure and key points to include — I will write it myself.\n\n${jobLine}${cvBlock}\n\nPlease:\n1. Suggest the 3 strongest points from my background to lead with for this specific role\n2. Identify any gaps I should address proactively\n3. Give me an opening line that is direct and specific (not generic)\n4. Suggest a closing sentence${footer}`

  if (level === 2) return `Please write a first draft cover letter for this role based on my CV. I will edit it.\n\n${jobLine}${cvBlock}\n\nStructure: opening that names the role and why I am the right fit, 2 paragraphs of relevant evidence from my CV, closing with availability and enthusiasm.${footer}`

  return `Please write a polished, compelling cover letter for this role. This should be a final-draft quality letter I can send with minimal edits.\n\n${jobLine}${cvBlock}\n\nMake it: specific to this role and company (not generic), evidenced from my actual experience, confident without being arrogant, and concise. Open with a hook, not "I am writing to express my interest".${footer}`
}

const CV_EFFORT_OPTIONS = [
  { level: 1, label: 'Level 1 — Keywords and gaps', sub: 'You write it, ChatGPT guides you', tool: 'ChatGPT' },
  { level: 2, label: 'Level 2 — Guided rewrite',    sub: 'AI rewrites, you review and edit', tool: 'Claude or ChatGPT' },
  { level: 3, label: 'Level 3 — Deep rewrite',      sub: 'Claude does the full tailoring',   tool: 'Claude' },
]

function CvGeneratorFlow({ mode, allJobs, cvRaw, updateJob, prefill, onClearPrefill, onSwitchToEngine }) {
  const eligibleJobs = (allJobs || [])
    .filter(j => ['considering', 'to_apply', 'applied'].includes(j.status))
    .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))

  const [step,          setStep]          = useState(1)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [effortLevel,   setEffortLevel]   = useState(null)
  const [prompt,        setPrompt]        = useState('')
  const [copied,        setCopied]        = useState(false)
  const [markedApplied, setMarkedApplied] = useState(false)

  const selectedJob = eligibleJobs.find(j => j.id === selectedJobId) || null
  const recentHistory = (allJobs || [])
    .filter(j => j.cvGeneratedAt)
    .sort((a, b) => new Date(b.cvGeneratedAt) - new Date(a.cvGeneratedAt))
    .slice(0, 10)

  useEffect(() => {
    if (!prefill || mode !== 'cv') return
    const job = (allJobs || []).find(j => j.id === prefill.jobId)
    if (job && ['considering', 'to_apply', 'applied'].includes(job.status)) {
      setSelectedJobId(prefill.jobId)
    }
    onClearPrefill?.()
  }, [prefill])

  function goStep1() { setStep(1); setEffortLevel(null); setPrompt(''); setCopied(false); setMarkedApplied(false) }

  function pickEffort(level) {
    if (selectedJob) updateJob(selectedJob.id, { cvEffortLevel: level })
    setEffortLevel(level)
    const roleTitle = selectedJob?.roleTitle || ''
    const company   = selectedJob?.company || ''
    const jobLink   = selectedJob?.jobLink || ''
    const p = mode === 'cv'
      ? buildCvPrompt(level, roleTitle, company, jobLink, cvRaw)
      : buildClPrompt(level, roleTitle, company, jobLink, cvRaw)
    setPrompt(p)
    setStep(3)
  }

  function copyPrompt() {
    navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  function confirmApplied() {
    if (selectedJob) updateJob(selectedJob.id, { status: 'applied', appliedAt: new Date().toISOString(), cvGeneratedAt: new Date().toISOString() })
    setMarkedApplied(true)
    track(mode === 'cv' ? 'cv_generated' : 'cover_letter_generated', { level: effortLevel })
  }

  // ── Step 1: Pick job ──
  if (step === 1) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Step 1 of 4</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>Pick a role</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 3 }}>From your Worth applying, Going to apply, and Applied columns</div>
      </div>

      {eligibleJobs.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 10 }}>No roles in your active pipeline yet.</div>
          <button onClick={onSwitchToEngine} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--marker-black)', cursor: 'pointer', letterSpacing: '0.04em', textDecoration: 'underline' }}>Analyse a role first →</button>
        </div>
      ) : (
        <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
          style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: '#fff', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}>
          <option value="">Choose a role…</option>
          {eligibleJobs.map(j => (
            <option key={j.id} value={j.id}>
              {j.company}{j.roleTitle ? ` — ${j.roleTitle}` : ''}{j.score ? ` (${j.score})` : ''}
            </option>
          ))}
        </select>
      )}

      <button onClick={() => setStep(2)} disabled={!selectedJobId}
        style={{ background: selectedJobId ? 'var(--marker-black)' : 'var(--marker-border)', color: selectedJobId ? 'var(--marker-cream)' : 'var(--marker-mid)', border: 'none', padding: '12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: selectedJobId ? 'pointer' : 'default' }}>
        Next: choose effort level →
      </button>

      {recentHistory.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Recent {mode === 'cv' ? 'CVs' : 'cover letters'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentHistory.map(j => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-black)', textTransform: 'uppercase' }}>{j.company}</div>
                  <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginTop: 2 }}>{j.roleTitle || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {j.cvEffortLevel && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>L{j.cvEffortLevel}</div>}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>{timeAgo(j.cvGeneratedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ── Step 2: Pick effort level ──
  if (step === 2) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button onClick={goStep1} style={{ background: 'none', border: '1px solid var(--marker-border)', padding: '6px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', flexShrink: 0 }}>← Back</button>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Step 2 of 4</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)' }}>Choose effort level</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 2 }}>{selectedJob?.company}{selectedJob?.roleTitle ? ` — ${selectedJob.roleTitle}` : ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CV_EFFORT_OPTIONS.map(o => (
          <button key={o.level} onClick={() => pickEffort(o.level)}
            style={{ textAlign: 'left', padding: '14px', borderRadius: 10, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>{o.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{o.sub}</div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-border)', color: 'var(--marker-mid)', padding: '3px 7px', borderRadius: 4, whiteSpace: 'nowrap' }}>{o.tool}</span>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Step 3: Copy prompt ──
  if (step === 3) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <button onClick={() => setStep(2)} style={{ background: 'none', border: '1px solid var(--marker-border)', padding: '6px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', flexShrink: 0 }}>← Back</button>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Step 3 of 4</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)' }}>Your prompt for Claude / ChatGPT</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 2 }}>Copy this → paste into {CV_EFFORT_OPTIONS.find(o => o.level === effortLevel)?.tool} → it writes your CV</div>
        </div>
      </div>

      {/* JD tip */}
      <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: '0 8px 8px 0', padding: '10px 13px' }}>
        <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--marker-black)', marginRight: 6 }}>If AI can't find the JD:</span>
          Paste the full job description text manually into Claude or ChatGPT after the prompt. This happens when job boards block automated access.
        </div>
      </div>

      <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Your prompt — copy and paste into AI</div>
          <button onClick={copyPrompt}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: copied ? 'var(--marker-lime)' : 'var(--marker-border)', color: 'var(--marker-black)', border: 'none', padding: '5px 12px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em', fontWeight: 600 }}>
            {copied ? 'COPIED ✓' : 'COPY'}
          </button>
        </div>
        <pre style={{ padding: 14, fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--marker-text)', fontFamily: 'var(--font-mono)', margin: 0, maxHeight: 400, overflowY: 'auto' }}>
          {prompt}
        </pre>
      </div>

      <button onClick={() => setStep(4)}
        style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
        Next: confirm application →
      </button>
    </div>
  )

  // ── Step 4: Mark applied ──
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Step 4 of 4</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>Did you apply?</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 3 }}>{selectedJob?.company}{selectedJob?.roleTitle ? ` — ${selectedJob.roleTitle}` : ''}</div>
      </div>

      {markedApplied ? (
        <div style={{ padding: '20px', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#065F46', marginBottom: 6 }}>Applied — good luck!</div>
          <div style={{ fontSize: 12, color: '#047857' }}>Status updated to Applied in your pipeline.</div>
        </div>
      ) : (
        <>
          <button onClick={confirmApplied}
            style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '13px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
            Yes, I applied — mark as Applied
          </button>
          <button onClick={goStep1}
            style={{ background: 'transparent', color: 'var(--marker-mid)', border: '1px solid var(--marker-border)', padding: '12px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
            Not yet — back to start
          </button>
        </>
      )}

      {markedApplied && (
        <button onClick={goStep1}
          style={{ background: 'transparent', color: 'var(--marker-mid)', border: '1px solid var(--marker-border)', padding: '11px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
          Generate another →
        </button>
      )}

      <div className="legal-line">AI-generated prompts. Review all CV output before submitting. Do not add experience you do not have.</div>
    </div>
  )
}

// ── Recruiter Panel (perm + contractor) ──────────────────────────

function RecruiterPanel({ profile, mode }) {
  const hfj = profile?.hard_filters_json || {}
  const isContractor = mode === 'contractor'
  const cacheKey = isContractor ? 'contractorRecruiters' : 'permRecruiters'
  const cacheAtKey = isContractor ? 'contractorRecruitersCachedAt' : 'permRecruitersCachedAt'
  const apiPath = isContractor ? '/api/contractor/recruiters' : '/api/perm/recruiters'
  const CACHE_MS = 7 * 24 * 60 * 60 * 1000

  const [recruiters, setRecruiters] = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [copied, setCopied]         = useState(null) // index of copied item

  const wishlist = (hfj.wishlist || []).map(c => c.name.toLowerCase())

  useEffect(() => {
    const cached   = hfj[cacheKey]
    const cachedAt = hfj[cacheAtKey]
    if (cached && cachedAt && Date.now() - new Date(cachedAt).getTime() < CACHE_MS) {
      setRecruiters(cached)
    } else {
      generate()
    }
  }, [])

  async function generate() {
    setLoading(true); setError('')
    try {
      const res = await fetch(apiPath, { method: 'POST' })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setRecruiters(data.recruiters || [])
    } catch { setError('Request failed — try again') }
    finally { setLoading(false) }
  }

  function buildCvPrompt(r) {
    const cvRaw = hfj.cvRaw || hfj.careerSummary || ''
    const targetRoles = (profile?.target_roles || []).join(', ') || 'senior professional'
    const atsName = r.ats?.name || 'their ATS'
    const atsFormat = r.ats?.format || '.docx'
    const atsInstructions = r.ats?.instructions || 'single-column format, no tables or text boxes'
    return `Please create a CV optimised for submission to ${r.agency}. They use ${atsName} — here are the specific formatting requirements: ${atsInstructions}. Preferred format: ${atsFormat}.

My target roles: ${targetRoles}

My CV:
${cvRaw || '[No CV added yet — go to Settings > Profile to add your CV]'}

Please:
1. Reformat for ${atsName} compatibility — ${atsInstructions}
2. Ensure all skills, tools, and sector keywords appear as plain body text (not in tables or text boxes)
3. Job titles and seniority level should be prominent at the start of each role
4. Keep every job title, company, and date accurate — do not invent anything
5. Output as clean text I can paste into ${atsFormat} format

Make sure the CV is tailored to ${r.agency}'s typical clients: ${(r.companies || []).slice(0, 5).join(', ')}.`
  }

  function copyPrompt(r, idx) {
    navigator.clipboard.writeText(buildCvPrompt(r)).then(() => {
      setCopied(idx); setTimeout(() => setCopied(null), 2500)
    })
  }

  function getOverlap(r) {
    if (!r.companies || wishlist.length === 0) return []
    return r.companies.filter(c => wishlist.includes(c.toLowerCase()))
  }

  const priorityLabels = { 1: 'Priority 1', 2: 'Priority 2', 3: 'Priority 3' }
  const priorityColors = { 1: 'var(--marker-lime)', 2: '#F5E4A0', 3: 'var(--marker-cream)' }

  const byPriority = [1, 2, 3].map(p => ({
    priority: p,
    list: (recruiters || []).filter(r => (r.priority || 3) === p),
  })).filter(g => g.list.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 4 }}>
          {isContractor ? 'Contract specialist agencies' : 'Recruiters worth working with'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
          {isContractor
            ? 'Agencies that regularly place senior contractors. Sorted by how relevant they are to your field. Set up alerts and add yourself to each database.'
            : 'Agencies and search firms for senior permanent roles. Register with Priority 1 first. Each card includes ATS tips and a ready-to-use CV prompt optimised for their system.'}
        </div>
        {recruiters && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={generate} style={{ background: 'none', border: '1px solid var(--marker-border)', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>↻ Refresh</button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)' }}>
            {isContractor ? 'Finding specialist agencies…' : 'Researching recruiters for your field…'}
          </div>
          <ProgressBar duration={25}
            steps={['Searching for specialist agencies…', 'Checking ATS systems and company relationships…', 'Ranking by relevance to your profile…', 'Almost done…']}
            slowAt={40} slowMsg="Researching agency specialisms takes a moment — results will be specific to your field." />
        </div>
      )}

      {error && !loading && (
        <div style={{ margin: 16, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#B91C1C' }}>
          {error} — <button onClick={generate} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, padding: 0 }}>try again</button>
        </div>
      )}

      {recruiters && !loading && (
        <div style={{ padding: '12px 16px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {byPriority.map(group => (
            <div key={group.priority}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: priorityColors[group.priority], border: '1px solid var(--marker-border)', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{priorityLabels[group.priority]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {group.list.map((r, i) => {
                  const overlap = getOverlap(r)
                  const allCompanies = r.companies || []
                  const idx = (group.priority - 1) * 10 + i
                  return (
                    <div key={i} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden' }}>
                      {/* Agency header */}
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--marker-black)', marginBottom: 3 }}>{r.agency}</div>
                            <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{r.specialisation}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            {r.register && (
                              <a href={r.register} target="_blank" rel="noopener noreferrer"
                                style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'var(--marker-black)', background: 'var(--marker-lime)', border: 'none', padding: '6px 11px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                Register ↗
                              </a>
                            )}
                          </div>
                        </div>
                        {r.coverage && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-mid)' }}>{r.coverage}</span>
                        )}
                      </div>

                      {/* Insight */}
                      {r.insight && (
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream)' }}>
                          <div style={{ fontSize: 12, color: 'var(--marker-black)', lineHeight: 1.6 }}>{r.insight}</div>
                        </div>
                      )}

                      {/* ATS section */}
                      {r.ats && (
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', background: 'rgba(0,0,0,0.015)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-black)', color: 'var(--marker-cream)', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>ATS</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-black)', fontWeight: 600 }}>{r.ats.name}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>{r.ats.format}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.65 }}>{r.ats.instructions}</div>
                        </div>
                      )}

                      {/* Companies covered */}
                      {allCompanies.length > 0 && (
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
                            Companies they place at{overlap.length > 0 ? ` · ${overlap.length} match your shortlist` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {allCompanies.slice(0, 12).map(co => {
                              const isMatch = wishlist.includes(co.toLowerCase())
                              return (
                                <span key={co} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: isMatch ? 'var(--marker-lime)' : 'var(--marker-cream)', border: `1px solid ${isMatch ? '#86EFAC' : 'var(--marker-border)'}`, padding: '2px 7px', borderRadius: 4, color: 'var(--marker-black)', fontWeight: isMatch ? 600 : 400 }}>
                                  {co}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* How to approach + CTA */}
                      <div style={{ padding: '10px 14px' }}>
                        {r.note && (
                          <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 10, borderLeft: '2px solid var(--marker-lime)', paddingLeft: 8 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 3, color: 'var(--marker-mid)' }}>How to approach</span>
                            {r.note}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => copyPrompt(r, idx)}
                            style={{ background: copied === idx ? 'var(--marker-lime)' : 'var(--marker-black)', color: copied === idx ? 'var(--marker-black)' : 'var(--marker-cream)', border: 'none', padding: '7px 13px', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            {copied === idx ? 'COPIED ✓' : '📋 Copy CV prompt'}
                          </button>
                          <a href="https://claude.ai" target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'var(--marker-black)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '7px 13px', borderRadius: 7, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            Open Claude ↗
                          </a>
                          {r.linkedin && (
                            <a href={r.linkedin} target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--marker-mid)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '7px 13px', borderRadius: 7, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                              LinkedIn ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="legal-line">Agency and ATS information generated by AI. Verify details directly with each agency before submitting. Not affiliated with any agency listed.</div>
        </div>
      )}
    </div>
  )
}

function ContractorCvPanel({ profile }) {
  const hfj = profile?.hard_filters_json || {}
  const [copied, setCopied] = useState(false)

  const roles       = (hfj.targetRoles || []).join(', ') || 'senior contractor'
  const field       = hfj.field || 'your field'
  const yearsExp    = hfj.yearsExperience || ''
  const summary     = hfj.careerSummary || ''
  const cvRaw       = (hfj.cvRaw || '').slice(0, 3000)
  const ir35        = hfj.ir35Willing === true ? 'outside IR35' : hfj.ir35Willing === false ? 'inside IR35 only' : 'inside or outside IR35'
  const contractTypes = (hfj.contractTypes || []).join(', ') || 'contract and interim'

  const prompt = `You are an expert CV writer for UK contractors and interim professionals.

Write a clean, skills-led contractor CV for the following person. This CV will be sent directly to recruitment agencies — it must be concise, outcomes-focused, and easy to skim in 10 seconds.

Professional background:
${summary || cvRaw || `Experienced ${field} professional with ${yearsExp ? yearsExp + ' years experience' : 'significant experience'} in ${roles}.`}

Target roles: ${roles}
Field: ${field}
IR35 preference: ${ir35}
Contract type preference: ${contractTypes}

CV structure to produce:
1. Name + contact line placeholder (e.g. "[Name] | [Email] | [LinkedIn] | Day rate: £[X]/day")
2. Professional summary (3-4 lines, contractor positioning, sector breadth, key skills)
3. Core skills (bullet list, 12-16 items — use keywords recruiters search for)
4. Career history (most recent first — company, role, dates, 3-4 achievement bullets per role using £/% outcomes where possible)
5. Education + certifications (brief)

Rules:
- UK English throughout
- No "responsible for" — use strong verbs (led, delivered, grew, built, reduced)
- Include day rate placeholder
- Keep to 2 pages equivalent
- Format clearly with section headers

Return the CV text only — no preamble, no explanation.`

  function copy() {
    navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: '0 10px 10px 0', padding: '12px 14px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>How to use</div>
        <div style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.6 }}>Copy the prompt below and paste it into Claude or ChatGPT. It generates a skills-led 2-page CV formatted for recruiter mailshots — not tied to any single JD. Update your day rate and LinkedIn URL in the output before sending.</div>
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--marker-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Contractor CV prompt — copy into AI</div>
          <button onClick={copy} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: copied ? 'var(--marker-lime)' : 'var(--marker-black)', border: 'none', color: copied ? 'var(--marker-black)' : 'var(--marker-cream)', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em', fontWeight: 600 }}>
            {copied ? 'COPIED ✓' : 'COPY PROMPT'}
          </button>
        </div>
        <div style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>{prompt}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5 }}>
        The prompt pulls from your profile. To improve the output, add your full CV text in <a href="/settings" style={{ color: 'var(--marker-black)' }}>Settings</a>.
      </div>
    </div>
  )
}

function DirectCvPanel({ allJobs, profile }) {
  const eligibleJobs = (allJobs || []).filter(j => j.status && !['saved', 'rejected', 'withdrawn'].includes(j.status))
  const [selectedJobId, setSelectedJobId] = useState(eligibleJobs[0]?.id || '')
  const [effort, setEffort] = useState('standard')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedJob = eligibleJobs.find(j => j.id === selectedJobId) || eligibleJobs[0]

  async function generate() {
    if (!selectedJob?.roleTitle || !selectedJob?.jdRaw) {
      setError('Selected role has no job description stored. Add it from the pipeline.')
      return
    }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/cv/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleTitle: selectedJob.roleTitle, company: selectedJob.company || '', jd: selectedJob.jdRaw, effort }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (eligibleJobs.length === 0) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-mid)', textAlign: 'center' }}>
        No tracked roles yet. Add roles to your pipeline to generate tailored CVs.
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflowY: 'auto' }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
        Generate a tailored CV sent directly to the API — output displayed here with verified-stats check.
      </div>

      {/* Role picker */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--marker-mid)', marginBottom: 5 }}>ROLE</div>
        <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
          style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-text)' }}>
          {eligibleJobs.map(j => (
            <option key={j.id} value={j.id}>{j.roleTitle}{j.company ? ` — ${j.company}` : ''} ({j.status})</option>
          ))}
        </select>
        {selectedJob && !selectedJob.jdRaw && (
          <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#d97706' }}>No JD stored for this role — paste it from the pipeline card first.</div>
        )}
      </div>

      {/* Effort */}
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

      <button onClick={generate} disabled={loading || !selectedJob?.jdRaw}
        style={{ padding: '11px', borderRadius: 8, background: loading ? 'var(--marker-mid)' : 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? 'Generating…' : 'Generate'}
      </button>

      {error && <div style={{ padding: 10, borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', fontFamily: 'var(--font-body)', fontSize: 13, color: '#dc2626' }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {result.flaggedMetrics && result.flaggedMetrics.length > 0 && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontFamily: 'var(--font-body)', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
              <strong>Verified-stats warning:</strong> The following numbers were not found in your stored CV — review before using: <strong>{result.flaggedMetrics.join(', ')}</strong>
            </div>
          )}
          {result.flaggedMetrics && result.flaggedMetrics.length === 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#166534', letterSpacing: '0.06em' }}>
              VERIFIED — all metrics trace to your stored CV
            </div>
          )}
          <textarea readOnly value={result.type === 'keywords' ? JSON.stringify(result.data, null, 2) : result.text}
            style={{ width: '100%', minHeight: 320, padding: 12, borderRadius: 8, border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-text)', background: 'var(--marker-cream-2)', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
          <button onClick={() => navigator.clipboard.writeText(result.type === 'keywords' ? JSON.stringify(result.data, null, 2) : result.text)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--marker-border)', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13, cursor: 'pointer', color: 'var(--marker-text)', alignSelf: 'flex-start' }}>
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  )
}

function CvTab({ profile, jobs: allJobs, updateJob, prefill, onClearPrefill, onSwitchToEngine }) {
  const cvRaw = profile?.hard_filters_json?.cvRaw || ''
  const hfj   = profile?.hard_filters_json || {}
  const searchMode = hfj.searchMode || (hfj.openToContract === true ? 'both' : 'perm')
  const isContractorOnly = searchMode === 'contractor'
  const [section, setSection] = useState(isContractorOnly ? 'contractor_cv' : 'cv')

  if (!cvRaw) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO PROFILE YET</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', textAlign: 'center' }}>Build your profile first</div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
          Go to the <strong>Today</strong> tab and answer 3 quick questions — or paste your full CV in Settings.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={onSwitchToEngine} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Go to Engine →</button>
          <a href="/settings" style={{ background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-text)', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', textDecoration: 'none', display: 'inline-block' }}>Paste CV in Settings</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Tab purpose header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>
          {isContractorOnly ? 'Contractor CV' : searchMode === 'both' ? 'CV tools' : 'Tailor your application'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
          {isContractorOnly
            ? 'Generate a skills-based CV to send directly to recruiters — no specific JD needed. Designed for contractor market.'
            : 'Pick a role from your pipeline and generate a tailored CV prompt or cover letter, matched to the JD in seconds.'}
        </div>
      </div>

      {/* Section toggle */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)' }}>
        {[
          ...(searchMode !== 'perm' ? [{ id: 'contractor_cv', label: 'Contractor CV' }] : []),
          ...(searchMode !== 'contractor' ? [{ id: 'cv', label: 'Tailor CV' }, { id: 'cover', label: 'Cover Letter' }, { id: 'generate', label: 'AI Generate' }] : []),
          { id: 'recruiters', label: 'Recruiters' },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${section === s.id ? 'var(--marker-black)' : 'var(--marker-border)'}`, background: section === s.id ? 'var(--marker-black)' : 'transparent', color: section === s.id ? 'var(--marker-cream)' : 'var(--marker-text)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === 'contractor_cv' && (
        <ContractorCvPanel profile={profile} />
      )}

      {section === 'recruiters' && (
        <RecruiterPanel profile={profile} mode={isContractorOnly ? 'contractor' : 'perm'} />
      )}

      {section === 'cv' && (
        <CvGeneratorFlow
          key="cv"
          mode="cv"
          allJobs={allJobs}
          cvRaw={cvRaw}
          updateJob={updateJob}
          prefill={prefill}
          onClearPrefill={onClearPrefill}
          onSwitchToEngine={onSwitchToEngine}
        />
      )}
      {section === 'cover' && (
        <CvGeneratorFlow
          key="cover"
          mode="cover"
          allJobs={allJobs}
          cvRaw={cvRaw}
          updateJob={updateJob}
          prefill={null}
          onClearPrefill={null}
          onSwitchToEngine={onSwitchToEngine}
        />
      )}
      {section === 'generate' && (
        <DirectCvPanel allJobs={allJobs} profile={profile} />
      )}
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
  greenhouse:   'Company board',
  careers_page: 'Company board',
  adzuna:       'Adzuna',
  gov:          'Civil Service',
  gov_search:   'Civil Service',
}

function FeedTab({ jobs: pipelineJobs, addJob, feedJobs, feedLoading, profile, defaultSubTab, onRefreshFeed, recheckJob, recheckingJobs }) {
  const [subTab,         setSubTab]         = useState(defaultSubTab || 'find')
  const [discoverView,   setDiscoverView]   = useState('companies')
  const [search,         setSearch]         = useState('')
  const [localDismissed, setLocalDismissed] = useState(
    () => new Set(profile?.hard_filters_json?.dismissed || [])
  )
  const [cardScores,      setCardScores]      = useState({})
  const [feedSource,      setFeedSource]      = useState('all')
  const [linkedinOpen,    setLinkedinOpen]    = useState(false)
  const [linkedinCopied,  setLinkedinCopied]  = useState(null)
  const [refreshing,      setRefreshing]      = useState(false)
  const [showWebTour,      dismissWebTour]      = useTutorial('feed_web')
  const [showWishlistTour, dismissWishlistTour] = useTutorial('feed_wishlist')

  async function handleRefresh() {
    try {
      const last = parseInt(localStorage.getItem('mkr_feed_refresh') || '0', 10)
      if (Date.now() - last < 60 * 60 * 1000) return
    } catch {}
    setRefreshing(true)
    try {
      await onRefreshFeed?.()
      try { localStorage.setItem('mkr_feed_refresh', String(Date.now())) } catch {}
    } finally {
      setRefreshing(false)
    }
  }

  const LINKEDIN_TIPS = buildLinkedInTips(profile)
  function copyLinkedinTip(text, idx) {
    navigator.clipboard.writeText(text).then(() => { setLinkedinCopied(idx); setTimeout(() => setLinkedinCopied(null), 2000) })
  }

  const tracks             = profile?.hard_filters_json?.tracks || (profile?.track ? [profile.track] : [])
  const showReturnships    = tracks.includes('returner')  || profile?.hard_filters_json?.surfaces?.returnships
  const showParentalFriendly = tracks.includes('parent') || profile?.hard_filters_json?.surfaces?.parental_friendly

  const addedLinks = new Set(pipelineJobs.flatMap(j => [j.link, j.jobLink]).filter(Boolean))

  const webJobs = feedJobs.filter(j => !['gov', 'gov_search'].includes(j.source) && !localDismissed.has(j.id) && !addedLinks.has(j.link))
  const govJobs = feedJobs.filter(j =>  ['gov', 'gov_search'].includes(j.source) && !localDismissed.has(j.id) && !addedLinks.has(j.link))

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
    const cs        = cardScores[job.id] || {}
    const csScore   = parseFloat(cs.score) || 0
    const csTop     = csScore >= 9
    const csBg      = csTop ? undefined : csScore >= 7 ? 'var(--marker-lime)' : csScore >= 5 ? '#F5E4A0' : csScore > 0 ? '#FCA5A5' : 'var(--marker-border)'
    const wlbData   = WLB_DATA[(job.company || '').toLowerCase()]
    const wlbScore  = wlbData ? parseFloat(wlbData.wlb) : null
    return (
      <div key={job.id} style={{ background: 'var(--marker-cream-2)', border: `1px solid ${cs.signal === 'apply' ? '#86EFAC' : 'var(--marker-border)'}`, borderRadius: 10, padding: 12, transition: 'border-color 0.3s' }}>
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '—'}</div>
          </div>
          {/* Score + score button */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            {csScore > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div className={csTop ? 'holo-foil' : ''} style={{ background: csTop ? undefined : csBg, fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, padding: '3px 9px', borderRadius: 6, color: 'var(--marker-black)', letterSpacing: '-0.02em' }}>{cs.score}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginTop: 2 }}>JOB FIT</div>
              </div>
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
          </div>
        </div>
        {/* Tags row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {job.location && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-mid)' }}>{job.location}</span>}
          {job.salary  && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>{job.salary}</span>}
          {job.freshness && <FreshnessPulse freshness={job.freshness} relativeTime={job.relativeTime} />}
          {(job.freshness === 'Aging' || job.freshness === 'Stale') && (
            <button onClick={() => recheckJob(job.id, job.link)} disabled={recheckingJobs[job.id]}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '2px 7px', borderRadius: 4, cursor: recheckingJobs[job.id] ? 'default' : 'pointer' }}>
              {recheckingJobs[job.id] ? '…' : 'Still open?'}
            </button>
          )}
          {wlbScore !== null && (
            <span title="Glassdoor work-life balance score for this employer" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: wlbScore >= 4.3 ? 'var(--marker-lime)' : 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4, color: 'var(--marker-black)', cursor: 'help' }}>
              WLB {wlbData.wlb}/5
            </span>
          )}
          {cs.signal && cs.signal !== 'maybe' && (
            <span style={{ background: cs.signal === 'apply' ? 'var(--marker-lime)' : '#FCA5A5', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-black)' }}>{cs.signal}</span>
          )}
          {isAdzuna && <AdzunaBadge />}
        </div>
        {/* CTA row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderTop: '1px solid var(--marker-border)', paddingTop: 8 }}>
          {job.link && (
            <a href={job.link} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'var(--marker-black)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              View JD ↗
            </a>
          )}
          <button onClick={() => !isAdded && addToPipeline(job, source)} disabled={isAdded}
            style={{ background: isAdded ? 'var(--marker-lime)' : 'var(--marker-black)', color: 'var(--marker-black)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
            {isAdded ? '✓ Added to pipeline' : 'Add to pipeline'}
          </button>
          {!isAdded && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>→ Considering</span>}
          <button onClick={() => dismissJob(job.id)}
            style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' }}>Dismiss</button>
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

      {/* ── Tab purpose header ── */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--marker-border)' }}>
        <div className="kicker holo-text" style={{ marginBottom: 6 }}>Discover</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 6 }}>Find your next role.</div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>Browse pre-filtered listings, score the ones that look right, add them to your pipeline. New listings every night.</div>
      </div>

      {/* no sub-tab bar — WLB is its own top-level tab */}

      {/* ── Find Roles ── */}
      {subTab === 'find' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--marker-border)', padding: '0 16px', gap: 0 }}>
            {[
              { id: 'companies', label: 'Target Companies' },
              { id: 'live',      label: 'Live Roles' },
            ].map(v => (
              <button key={v.id} onClick={() => setDiscoverView(v.id)}
                style={{ background: 'none', border: 'none', borderBottom: discoverView === v.id ? '2px solid var(--marker-black)' : '2px solid transparent', marginBottom: -2, padding: '12px 16px 10px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: discoverView === v.id ? 600 : 400, color: discoverView === v.id ? 'var(--marker-black)' : 'var(--marker-mid)', cursor: 'pointer', letterSpacing: '-0.01em' }}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Target Companies view */}
          {discoverView === 'companies' && (
            <>
              {showWishlistTour && (
                <TourBanner onDismiss={dismissWishlistTour}>
                  Companies are generated from your profile. <strong>Hiring now</strong> means open roles are live right now. Add any you want — even if they don't post publicly.
                </TourBanner>
              )}
              <WishlistTab profile={profile} jobs={pipelineJobs} addJob={addJob} />
            </>
          )}

          {/* Live Roles view */}
          {discoverView === 'live' && (
            <>
          {/* LinkedIn strings — collapsible */}
          <div style={{ margin: '0 16px', borderBottom: '1px solid var(--marker-border)' }}>
            <button onClick={() => setLinkedinOpen(o => !o)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>Find roles on LinkedIn</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2, letterSpacing: '0.04em' }}>COPY THESE STRINGS — SURFACES ROLES BEFORE THEY HIT JOB BOARDS</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--marker-mid)', flexShrink: 0, lineHeight: 1 }}>{linkedinOpen ? '▾' : '▸'}</span>
            </button>
            {linkedinOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12, animation: 'fadeSlideIn 0.25s ease' }}>
                {LINKEDIN_TIPS.map((tip, idx) => (
                  <div key={idx} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{tip.label}</div>
                      <button onClick={() => copyLinkedinTip(tip.text, idx)} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: linkedinCopied === idx ? 'var(--marker-lime)' : 'var(--marker-black)', border: 'none', color: linkedinCopied === idx ? 'var(--marker-black)' : 'var(--marker-cream)', padding: '3px 10px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em', flexShrink: 0 }}>
                        {linkedinCopied === idx ? 'COPIED ✓' : 'COPY'}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>{tip.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showWebTour && (
            <TourBanner onDismiss={dismissWebTour}>
              These roles refresh every night — anything dismissed stays hidden. Hit <strong>SCORE</strong> on a role to get your 8-factor match score before deciding whether to add it to your pipeline.
            </TourBanner>
          )}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', position: 'sticky', top: 0, zIndex: 5 }}>
            {/* Source toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[{ id: 'all', label: 'All roles' }, { id: 'gov', label: 'Civil service' }].map(s => (
                <button key={s.id} onClick={() => { setFeedSource(s.id); setSearch('') }}
                  style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: feedSource === s.id ? 500 : 400, background: feedSource === s.id ? 'var(--marker-black)' : 'transparent', color: feedSource === s.id ? 'var(--marker-cream)' : 'var(--marker-mid)', border: `1px solid ${feedSource === s.id ? 'var(--marker-black)' : 'var(--marker-border)'}` }}>
                  {s.label}
                </button>
              ))}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={feedSource === 'gov' ? 'Filter civil service roles…' : 'Filter by role, company, or location…'}
              style={{ display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--marker-border)', borderRadius: 8, background: 'var(--marker-cream)', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
                {feedSource === 'gov'
                  ? `${filteredGov.length} CIVIL SERVICE ROLES`
                  : `${filteredWeb.length} OF ${webJobs.length} · NIGHTLY SCAN`}
              </div>
              <button onClick={handleRefresh} disabled={refreshing}
                style={{ background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', cursor: refreshing ? 'default' : 'pointer', letterSpacing: '0.04em', padding: 0 }}>
                {refreshing ? 'REFRESHING…' : '↻ REFRESH'}
              </button>
            </div>
          </div>
          {feedLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>LOADING FEED…</div>
            </div>
          ) : feedSource === 'gov' ? (
            filteredGov.length === 0 ? (
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
            )
          ) : filteredWeb.length === 0 ? (
            <div style={{ padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {webJobs.length === 0 ? (
                <>
                  <div style={{ background: 'var(--marker-lime)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 5 }}>Your feed updates overnight</div>
                    <div style={{ fontSize: 13, color: 'var(--marker-black)', lineHeight: 1.6 }}>Adzuna scans thousands of job boards every night and surfaces roles that match your profile. New listings will appear here tomorrow.</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', fontWeight: 500 }}>In the meantime:</div>
                  <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>Add target companies ↑</div>
                    <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginTop: 2, lineHeight: 1.4 }}>Build your shortlist above — companies you'd actually want to work for. Open roles surface automatically.</div>
                  </button>
                  <button onClick={() => { /* parent will handle tab switch */ document.querySelector('[data-tab="WLB"]')?.click() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>WLB guide →</div>
                    <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginTop: 2, lineHeight: 1.4 }}>Browse 30+ UK employers with strong WLB scores — Glassdoor ratings, parental leave, and office expectations.</div>
                  </button>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>NO MATCHES</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>Try different keywords</div>
                  <div style={{ fontSize: 14, color: 'var(--marker-mid)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>Adjust your search filter above.</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredWeb.map(job => renderFeedCard(job, 'web_search'))}
              {showWebAdzuna && <div className="legal-line" style={{ paddingTop: 8 }}>Job listings provided by Adzuna. Roles pulled nightly. Match scores are AI estimates based on your profile — not guarantees. Not affiliated with employers listed.</div>}
              {!showWebAdzuna && filteredWeb.length > 0 && <div className="legal-line" style={{ paddingTop: 8 }}>Roles pulled nightly from public career pages. Match scores are AI estimates — not guarantees. Not affiliated with employers listed.</div>}
            </div>
          )}
          {showReturnships && (
            <div style={{ padding: '16px 16px 0' }}>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--marker-black)', marginBottom: 3 }}>Returnship programmes</div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.4 }}>Structured paid re-entry programmes at major UK employers. Click any to go directly to the programme page — not all are open year-round.</div>
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
            <div style={{ padding: `${showReturnships ? '0' : '16px'} 16px 80px` }}>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--marker-black)', marginBottom: 3 }}>Parental-friendly employers</div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.4 }}>UK employers with enhanced parental leave policies — worth researching if this matters to you. Always verify directly with the employer.</div>
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
          {!showReturnships && !showParentalFriendly && <div style={{ height: 80 }} />}
            </>
          )}
        </div>
      )}

      {/* WLB guide moved to its own top-level tab */}
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
  const [autoGenPending,  setAutoGenPending]  = useState(false)
  const hasChecked = useRef(false)

  const hasCV = !!(profile?.hard_filters_json?.cvRaw?.length > 100)

  // Load wishlist once on mount — auto-generate from CV on first ever visit
  useEffect(() => {
    const saved = profile?.hard_filters_json?.wishlist
    if (saved && saved.length > 0) {
      setWishlist(saved)
      return
    }
    // If user has a CV and hasn't auto-generated before, trigger it
    let firstVisit = false
    if (hasCV) {
      try {
        if (!localStorage.getItem('mkr_companies_autogen')) {
          localStorage.setItem('mkr_companies_autogen', '1')
          firstVisit = true
        }
      } catch {}
    }
    if (firstVisit) {
      setWishlist([])
      setAutoGenPending(true)
      return
    }
    // Fallback: seed from track data
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

  // Trigger auto-generate once wishlist is set to empty and pending flag is set
  useEffect(() => {
    if (!autoGenPending) return
    setAutoGenPending(false)
    generateWishlist(true)
  }, [autoGenPending])

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
    if (job.url) {
      fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.url }) }).catch(() => {})
    }
  }

  async function generateWishlist(autoAdd = false) {
    if (generating) return
    setGenerating(true); setGenerateError(''); setSuggestions(null)
    try {
      const res = await fetch('/api/wishlist/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setGenerateError(data.error || 'Generation failed')
        // Fall back to seeds on auto-gen failure
        if (autoAdd) {
          const tracks = profile?.hard_filters_json?.tracks?.length
            ? profile.hard_filters_json.tracks
            : profile?.track ? [profile.track] : ['standard']
          const seen = new Set(); const seeds = []
          tracks.forEach(t => (WISHLIST_SEEDS[t] || []).forEach(s => { if (!seen.has(s.company)) { seen.add(s.company); seeds.push({ name: s.company, sector: s.sector, note: s.note }) } }))
          if (!tracks.includes('standard')) WISHLIST_SEEDS.standard.forEach(s => { if (!seen.has(s.company)) { seen.add(s.company); seeds.push({ name: s.company, sector: s.sector, note: s.note }) } })
          setWishlist(seeds)
        }
        return
      }
      const suggs = data.suggestions || []
      if (autoAdd && suggs.length > 0) {
        const newList = suggs.map(s => ({ name: s.company, sector: s.sector || '', note: s.why || '', addedAt: new Date().toISOString() }))
        hasChecked.current = false
        setWishlist(newList)
        persistWishlist(newList)
      } else {
        setSuggestions(suggs)
      }
    } catch {
      setGenerateError('Request failed — try again')
      if (autoAdd) setWishlist([])
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

  const hiringNow = sorted.filter(c => results[c.name]?.status === 'has_roles')
  const onRadar   = sorted.filter(c => results[c.name]?.status !== 'has_roles')

  function renderWishlistCard(co) {
    const result   = results[co.name] || { status: 'loading', jobs: [] }
    const { status, jobs: roleJobs = [], careersUrl } = result
    const isExp    = !!expanded[co.name]
    const hasRoles = status === 'has_roles'
    const loading  = status === 'loading'
    return (
      <div key={co.name} style={{ background: 'var(--marker-cream-2)', border: `1px solid ${hasRoles ? '#86EFAC' : 'var(--marker-border)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.4s' }}>
        <div style={{ padding: '12px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--marker-black)' }}>{co.name}</div>
              {co.sector && <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--marker-mid)', flexShrink: 0 }}>{co.sector}</span>}
            </div>
            {(() => {
              const wlb = WLB_DATA[co.name.toLowerCase()]
              if (!wlb) return null
              const n = parseFloat(wlb.wlb)
              const offDays = parseInt(wlb.office)
              const offText = offDays === 0 ? 'Fully remote' : `${offDays}d/wk office`
              return (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, background: n >= 4.3 ? 'var(--marker-lime)' : '#F5E4A0', padding: '2px 7px', borderRadius: 4, color: 'var(--marker-black)', flexShrink: 0 }}>WLB {wlb.wlb}/5</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 7px', borderRadius: 4, color: 'var(--marker-mid)', flexShrink: 0 }}>{wlb.leave} leave</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 7px', borderRadius: 4, color: 'var(--marker-mid)', flexShrink: 0 }}>{offText}</span>
                </div>
              )
            })()}
            {co.note && !WLB_DATA[co.name.toLowerCase()] && <div style={{ fontSize: 11, color: 'var(--marker-mid)', marginBottom: 4, lineHeight: 1.4 }}>{co.note}</div>}
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div className="anim-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)' }}>Checking…</span></div>}
            {status === 'has_roles' && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#15803D', fontWeight: 500 }}>{roleJobs.length} matching role{roleJobs.length !== 1 ? 's' : ''} open now</span></div>}
            {status === 'no_roles' && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} /><span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)' }}>No matching roles right now{result.totalOnBoard ? ` — ${result.totalOnBoard} others on their board` : ''}</span></div>}
            {status === 'no_board' && <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} /><a href={careersUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-black)', fontWeight: 500 }}>Search careers ↗</a></div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            {hasRoles && <button onClick={() => setExpanded(prev => ({ ...prev, [co.name]: !prev[co.name] }))} style={{ background: isExp ? 'var(--marker-black)' : 'var(--marker-lime)', border: 'none', padding: '6px 11px', borderRadius: 7, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', color: isExp ? 'var(--marker-cream)' : 'var(--marker-black)' }}>{isExp ? 'HIDE' : `VIEW ${roleJobs.length}`}</button>}
            {!hasRoles && !loading && careersUrl && (
              <a href={careersUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', padding: '5px 9px', border: '1px solid var(--marker-border)', borderRadius: 6, textDecoration: 'none', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                JOBS ↗
              </a>
            )}
            <button onClick={() => removeCompany(co.name)} title="Remove" style={{ background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
          </div>
        </div>
        {isExp && hasRoles && (
          <div style={{ borderTop: '1px solid var(--marker-border)' }}>
            {roleJobs.map((job, i) => {
              const isAdded = addedLinks.has(job.url)
              return (
                <div key={i} style={{ padding: '10px 12px', borderBottom: i < roleJobs.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                    {job.location && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2 }}>{job.location}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', padding: '4px 8px', border: '1px solid var(--marker-border)', borderRadius: 5, textDecoration: 'none' }}>View ↗</a>
                    <button onClick={() => !isAdded && addJobToPipeline(job, co.name)} disabled={isAdded} style={{ background: isAdded ? 'var(--marker-border)' : 'var(--marker-black)', color: isAdded ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>{isAdded ? 'Added ✓' : '+ Pipeline'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const trackCtx = {
    balanced:       'WLB-first employers — hybrid working, strong leave policies, and low-stress cultures',
    parent:         'Family-friendly employers — enhanced parental leave, phased returns, fertility support',
    returner:       'Active returnship programmes — structured paid re-entry for career returners',
    career_changer: 'Open to non-traditional backgrounds — skills-first hiring and internal pathway programmes',
    standard:       'Top UK employers across tech, fintech, media, and professional services',
  }
  const activeTrack = profile?.track || 'standard'
  const trackLine = trackCtx[activeTrack]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--marker-border)' }}>
        {/* Track context */}
        {trackLine && list.length > 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            {activeTrack} track · {trackLine}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: showAdd ? 12 : 0 }}>
          <div style={{ fontSize: 12, color: 'var(--marker-mid)' }}>
            {allLoading
              ? 'Checking career pages…'
              : list.length === 0
              ? 'Add a company below to start tracking'
              : withRoles > 0
              ? `${withRoles} open now · ${list.length - withRoles} on radar · live data`
              : `${list.length} companies tracked · checking for openings…`}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {hasCV && (
              <button onClick={generateWishlist} disabled={generating}
                style={{ background: generating ? 'var(--marker-border)' : 'var(--marker-black)', color: generating ? 'var(--marker-mid)' : 'var(--marker-cream)', border: 'none', padding: '8px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: generating ? 'default' : 'pointer', letterSpacing: '0.04em', flexShrink: 0 }}>
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

        {generating && list.length > 0 && (
          <div style={{ padding: '12px 0 4px' }}>
            <ProgressBar duration={20} steps={['Scanning your CV for relevant sectors…', 'Matching to companies that hire your profile…', 'Ranking by fit and hiring activity…', 'Adding the finishing touches…', 'Nearly there…']} slowAt={45} slowMsg="Reading your CV takes a moment — suggestions will be specific to you, not generic." />
          </div>
        )}

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
            {generating ? (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em', marginBottom: 16 }}>BUILDING YOUR TARGET LIST…</div>
                <ProgressBar duration={20} steps={['Reading your CV…', 'Matching to UK employers…', 'Ranking by fit and hiring activity…', 'Nearly ready…']} slowAt={45} slowMsg="Taking your profile into account — companies will be specific to you." />
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em', marginBottom: 12 }}>NO COMPANIES YET</div>
                {hasCV
                  ? <button onClick={() => generateWishlist(false)} disabled={generating}
                      style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '10px 18px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em', display: 'block', margin: '0 auto 10px' }}>
                      Generate from my CV →
                    </button>
                  : <div style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 10 }}>Add your CV in the CV tab to get AI-personalised suggestions</div>
                }
                <button onClick={() => setShowAdd(true)} className="btn btn-ghost" style={{ fontSize: 13 }}>Or add manually</button>
              </>
            )}
          </div>
        )}

        {/* ── Hiring now section ── */}
        {list.length > 0 && !allLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: hiringNow.length > 0 ? '#22C55E' : 'var(--marker-border)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.01em' }}>
              {hiringNow.length > 0 ? `${hiringNow.length} hiring now` : 'None hiring right now'}
            </span>
          </div>
        )}
        {list.length > 0 && !allLoading && hiringNow.length === 0 && (
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--marker-text-soft)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
              None of your tracked companies have open roles right now. Check back tomorrow, or add more companies to broaden your radar.
            </div>
            {!hasCV && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--marker-mid)' }}>Add your CV in Settings to unlock AI-suggested companies tailored to your background.</div>
            )}
          </div>
        )}
        {hiringNow.map(co => renderWishlistCard(co))}

        {/* ── On your radar section ── */}
        {list.length > 0 && onRadar.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: hiringNow.length > 0 ? 8 : 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--marker-border)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-mid)', letterSpacing: '-0.01em' }}>On your radar ({onRadar.length})</span>
          </div>
        )}

        {onRadar.map(co => renderWishlistCard(co))}

        {/* AI suggestions */}

        {/* AI suggestions */}
        {generateError && (
          <div style={{ fontSize: 12, color: '#B91C1C', padding: '12px 14px', background: '#FEE2E2', borderRadius: 10 }}>{generateError}</div>
        )}
        {suggestions && suggestions.length > 0 && (
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', animation: 'fadeSlideIn 0.3s ease' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--marker-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI suggestions — based on your CV</div>
              <button onClick={() => setSuggestions(null)} style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
            {suggestions.map((s, i) => (
              <div key={s.company} style={{ padding: '10px 14px', borderBottom: i < suggestions.length - 1 ? '1px solid var(--marker-border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--marker-black)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.company}</span>
                    {s.sector && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '1px 6px', borderRadius: 4, color: 'var(--marker-mid)' }}>{s.sector}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{s.why}</div>
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
            Live data from public jobs boards. Not all companies post publicly — use "Search careers" to check the ones that don't. Refreshed on every visit.
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

        {searching && (
          <div style={{ padding: '48px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)' }}>Scanning live listings</div>
            <ProgressBar duration={50} steps={STEPS_SEARCH} slowAt={45} slowMsg="Scoring is the slow bit — Claude's reading each job description properly, not just matching keywords." />
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
  { co: 'Nationwide',     sector: 'Finance',      wlb: '4.4', reviews: '4,820', leave: '26 weeks full pay',  office: '1d', wf: true,  careers: 'https://jobs.nationwide.co.uk',           score: '9.1', note: 'Best enhanced parental leave in UK finance; hybrid-first culture. Working Families Top Employer 2024.' },
  { co: 'Wellcome Trust', sector: 'Charity',      wlb: '4.6', reviews: '640',   leave: '26 weeks full pay',  office: '1d', wf: false, careers: 'https://wellcome.org/jobs',               score: '9.0', note: 'Sector-leading WLB; mission-driven science philanthropy; flexible by default.' },
  { co: 'Channel 4',      sector: 'Media',        wlb: '4.2', reviews: '1,080', leave: '9 months full pay',  office: '2d', wf: true,  careers: 'https://careers.channel4.com',            score: '8.9', note: '9 months full pay for all parents — best in UK broadcasting. Working Families Top Employer 2024.' },
  { co: 'Ofcom',          sector: 'Regulator',    wlb: '4.5', reviews: '780',   leave: '26 weeks full pay',  office: '2d', wf: false, careers: 'https://www.ofcom.org.uk/about-ofcom/careers', score: '8.8', note: 'Regulator stability; hybrid-first; consistently high WLB ratings on Glassdoor.' },
  { co: 'Lloyds Banking', sector: 'Finance',      wlb: '4.1', reviews: '9,200', leave: '39 weeks full pay',  office: '2d', wf: true,  careers: 'https://www.lloydsbankinggroup.com/careers', score: '8.8', note: 'Up to 39 weeks full pay; strong flexible return options. Working Families Top Employer.' },
  { co: 'BBC',            sector: 'Media',        wlb: '4.3', reviews: '6,400', leave: '26 weeks full pay',  office: '2d', wf: true,  careers: 'https://careers.bbc.co.uk',               score: '8.7', note: '35-hour week, hybrid, public service culture. Working Families Top Employer 2024.' },
  { co: 'NatWest Group',  sector: 'Finance',      wlb: '4.2', reviews: '7,100', leave: '26 weeks full pay',  office: '2d', wf: true,  careers: 'https://jobs.natwestgroup.com',           score: '8.7', note: '52 weeks available, first 26 at full pay. Working Families Top Employer 2024.' },
  { co: 'Octopus Energy', sector: 'Energy',       wlb: '4.4', reviews: '1,240', leave: '26 weeks full pay',  office: '2d', wf: false, careers: 'https://octopus.energy/careers',          score: '8.7', note: 'B Corp certified; genuine flexible working; high Glassdoor WLB scores.' },
  { co: 'Sky',            sector: 'Media',        wlb: '4.0', reviews: '5,600', leave: '26 weeks full pay',  office: '2d', wf: false, careers: 'https://careers.sky.com',                 score: '8.6', note: '26 weeks full pay for all parents; large UK employer; hybrid-first.' },
  { co: 'GitLab',         sector: 'Tech',         wlb: '4.2', reviews: '2,300', leave: '16 weeks full pay',  office: '0d', wf: false, careers: 'https://about.gitlab.com/jobs',           score: '8.6', note: 'Fully remote-first; async culture; transparent pay and operations.' },
  { co: 'Aviva',          sector: 'Insurance',    wlb: '4.1', reviews: '3,800', leave: '26 weeks full pay',  office: '2d', wf: true,  careers: 'https://careers.aviva.co.uk',             score: '8.5', note: '26 weeks full pay for all parents; flexible return programme. Working Families Top Employer.' },
  { co: 'Monzo',          sector: 'Fintech',      wlb: '4.0', reviews: '1,100', leave: '26 weeks full pay',  office: '2d', wf: false, careers: 'https://monzo.com/careers',               score: '8.5', note: 'Async-friendly; strong WLB reputation; fast-growing UK bank.' },
  { co: 'Wise',           sector: 'Fintech',      wlb: '4.1', reviews: '1,560', leave: '26 weeks full pay',  office: '2d', wf: false, careers: 'https://wise.com/jobs',                   score: '8.5', note: 'Distributed teams; no-meeting Fridays; profitable and mission-driven.' },
  { co: 'HMRC',           sector: 'Public Sector',wlb: '4.0', reviews: '3,200', leave: '26 weeks full pay',  office: '2d', wf: false, careers: 'https://www.civilservicejobs.service.gov.uk', score: '8.4', note: 'Civil service terms; flexible working by default; large stable employer.' },
  { co: 'DWP Digital',    sector: 'Public Sector',wlb: '4.0', reviews: '2,100', leave: '26 weeks full pay',  office: '2d', wf: false, careers: 'https://www.civilservicejobs.service.gov.uk', score: '8.4', note: 'GDS-aligned digital team; flexible civil service terms; mission-driven tech roles.' },
]

// WLB lookup by company name (lowercase) — sourced from BALANCED_COMPANIES above
const WLB_DATA = {}
BALANCED_COMPANIES.forEach(c => { WLB_DATA[c.co.toLowerCase()] = c })

const BALANCED_SECTORS = ['All', 'Finance', 'Media', 'Tech', 'Public Sector', 'Fintech', 'Energy', 'Regulator', 'Charity', 'Other']

function BalancedTab({ jobs: pipelineJobs, addJob }) {
  const [sector, setSector] = useState('All')

  const filtered = sector === 'All'
    ? BALANCED_COMPANIES
    : sector === 'Other'
    ? BALANCED_COMPANIES.filter(c => !['Finance', 'Media', 'Tech', 'Public Sector', 'Fintech', 'Energy', 'Regulator', 'Charity', 'Insurance'].includes(c.sector))
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
        <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>WLB is how well a job fits around the rest of your life — hours, flexibility, parental leave, culture, and whether you're actually expected to switch off. Job ads claim it. Glassdoor reviews measure it. This list uses ≥500 Glassdoor reviews plus Working Families benchmark data, so you can research before you apply.</div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--marker-black)' }}>Watch</strong> adds a company to your pipeline Watchlist — no role yet, just a signal to keep an eye on them. You'll see them in your Pipeline under <em>Watching</em>, and if they appear in your live job feed they'll be highlighted.
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
        </div>
        {[
          { title: 'Programme Manager',        why: 'Structured delivery, clear scope, rarely on-call' },
          { title: 'Partnerships Lead',         why: 'Relationship-led, outcome-focused, low-crisis profile' },
          { title: 'Digital Strategy Manager',  why: 'Advisory remit, cross-functional, rarely firefighting' },
          { title: 'Product Manager (platform)',why: 'Internal tooling orgs tend to have calmer roadmaps' },
          { title: 'Operations Lead',           why: 'Process-oriented, stable timelines, measurable scope' },
          { title: 'Marketing Manager (brand)', why: 'Avoid "Growth" in the title — often means startup hours' },
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
          { tip: 'LinkedIn',          detail: '"Senior product manager remote £80k" — apply "Easy Apply off" + "Under 10 applicants" filters' },
          { tip: 'Glassdoor filter',  detail: 'Company filter → Work/Life Balance ≥ 4.0 → sort by most recent reviews' },
          { tip: 'Escape the City',   detail: '"Purpose-driven" filter surfaces B Corps, charities, and public sector orgs' },
          { tip: 'Working Families',  detail: 'workingfamilies.org.uk/top-employers — annual verified list of family-friendly UK employers' },
          { tip: 'Civil Service Jobs',detail: 'civilservicejobs.service.gov.uk — Director/Deputy Director level, flexible working by default' },
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
      track('role_scored', { signal: data.signal || 'none' })
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
            placeholder="Job URL — e.g. https://monzo.com/careers/jobs/…"
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

        {analysing && (
          <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)' }}>Analysing role</div>
            <ProgressBar duration={45} steps={STEPS_ANALYSE} slowAt={38} slowMsg="Taking a bit longer — Claude's searching the web for this one rather than reading the page directly. Worth the wait." />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Factor breakdown</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', opacity: 0.7 }}>AI · Claude Haiku</div>
                </div>
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

function buildLinkedInTips(profile) {
  const roles = profile?.target_roles || []
  const booleanRoles = roles.length
    ? roles.slice(0, 5).map(r => `"${r}"`).join(' OR ')
    : '"Head of Partnerships" OR "Director of Partnerships" OR "Head of Marketing" OR "Director of Marketing"'
  const topRole = roles[0] || 'your role title'
  return [
    { label: 'LinkedIn Jobs Boolean', text: `(${booleanRoles}) AND (London OR Remote OR "United Kingdom")` },
    { label: 'Sales Navigator filters', text: 'Function: Business Development / Marketing | Seniority: Director / VP / C-Level | Posted: Past 7 days | Location: United Kingdom' },
    { label: 'Content feed hack', text: `Switch LinkedIn search to "Content" tab → Sort by "Latest" → search: "we're hiring" OR "now hiring" + ${topRole}. Surfaces posts 24-72h before jobs go live.` },
  ]
}

// ── Focus mode — clean flat pipeline view ────────────────────────

const FOCUS_STAGES = [
  { id: 'active',       label: 'In play',      statuses: ['considering', 'to_apply', 'applied'] },
  { id: 'interviewing', label: 'Interviewing', statuses: ['interviewing'] },
  { id: 'outcome',      label: 'Outcome',      statuses: ['offer', 'rejected'] },
]

function FocusPipelineView({ jobs, updateJob, deleteJob }) {
  const active = jobs.filter(j => !['watchlist', 'no_jobs'].includes(j.status))
    .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))

  if (active.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>No roles tracked yet</div>
        <div style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.7, maxWidth: 300, margin: '0 auto' }}>Score a role on the Score tab and add it to your pipeline — it will appear here.</div>
      </div>
    )
  }

  const now = Date.now()

  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {FOCUS_STAGES.map(stage => {
        const group = active.filter(j => stage.statuses.includes(j.status))
        if (!group.length) return null
        return (
          <div key={stage.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{stage.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', background: 'var(--marker-border)', borderRadius: 10, padding: '1px 6px', color: 'var(--marker-mid)' }}>{group.length}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.map(job => {
                const score = parseFloat(job.score) || 0
                const scoreTop = score >= 9
                const scoreBg = scoreTop ? undefined : score >= 7 ? 'var(--marker-lime)' : score >= 5 ? '#F5E4A0' : score > 0 ? '#FCA5A5' : 'var(--marker-border)'
                const daysApplied = job.appliedAt ? Math.floor((now - new Date(job.appliedAt).getTime()) / 86400000) : null
                const needsFollowUp = job.status === 'applied' && daysApplied !== null && daysApplied >= 7
                return (
                  <div key={job.id} style={{ background: needsFollowUp ? '#FFFBEB' : 'var(--marker-cream-2)', border: `1px solid ${needsFollowUp ? '#FCD34D' : 'var(--marker-border)'}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={scoreTop ? 'holo-foil' : ''} style={{ background: scoreTop ? undefined : scoreBg, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: 'var(--marker-black)', flexShrink: 0, minWidth: 36, textAlign: 'center' }}>
                      {score > 0 ? job.score : '–'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '—'}</div>
                    </div>
                    {needsFollowUp && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, background: '#FCD34D', color: '#78350F', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>Follow up?</span>
                    )}
                    <select value={job.status} onChange={e => updateJob(job.id, { status: e.target.value })} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', flexShrink: 0, background: 'transparent', border: '1px solid var(--marker-border)', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', minWidth: 80 }}>
                      {COLUMNS.filter(c => !['watchlist', 'no_jobs'].includes(c.id)).map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EngineTab({ profile, jobs: pipelineJobs, addJob, updateJob, stripped = false }) {
  const [url,          setUrl]          = useState('')
  const [jd,           setJd]           = useState('')
  const [roleInput,    setRoleInput]    = useState('')
  const [coInput,      setCoInput]      = useState('')
  const [analysing,    setAnalysing]    = useState(false)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState('')
  const [added,        setAdded]        = useState(false)
  const [autoAdded,    setAutoAdded]    = useState(false)
  const [showJd,       setShowJd]       = useState(false)
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
    setAnalysing(true); setResult(null); setError(''); setAdded(false); setAutoAdded(false); setSalary(null); setSalaryLoading(false)
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
          jd: jd.trim(),
          source: 'analyse',
          addedAt: new Date().toISOString(),
        })
        if (url.trim()) fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: url.trim() }) }).catch(() => {})
        setAutoAdded(true)
      }
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

  const n         = parseFloat(result?.score) || 0
  const top       = n >= 9
  const scoreBg   = top ? undefined : n >= 7 ? 'var(--marker-lime)' : n >= 5 ? '#F5E4A0' : '#FCA5A5'
  const signalBg  = result?.signal === 'apply' ? 'var(--marker-lime)' : result?.signal === 'maybe' ? '#F5E4A0' : result?.signal === 'dont_apply' ? '#FCA5A5' : 'var(--marker-border)'
  const alreadyAdded = pipelineJobs.some(j => j.jobLink === url.trim() || j.link === url.trim())
  const canAdd = !!result && !added && !alreadyAdded

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Tab purpose header ── */}
      {!stripped && (
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>Score a job</div>
          <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>Paste any job URL and Claude reads the JD, researches the company, and scores the role against your profile in about 30 seconds.</div>
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
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Recently added — score these?</div>
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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: stripped ? 14 : 17, fontWeight: 500, color: stripped ? 'var(--marker-mid)' : 'var(--marker-black)', marginBottom: 3, display: stripped ? 'none' : 'block' }}>Analyse a role</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 14 }}>Paste a job URL · Claude reads it and scores it against your profile</div>
        <div style={{ marginBottom: 10 }}>
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && !analysing && analyse()}
            placeholder="Job URL — e.g. https://monzo.com/careers/jobs/…"
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
          <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)' }}>Analysing role</div>
            <ProgressBar duration={45} steps={STEPS_ANALYSE} slowAt={38} slowMsg="Taking a bit longer — Claude's searching the web for this one rather than reading the page directly. Worth the wait." />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Factor breakdown</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', opacity: 0.7 }}>AI · Claude Haiku</div>
                </div>
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
              <button onClick={!autoAdded ? addToPipeline : undefined} disabled={added || alreadyAdded}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: autoAdded ? 'rgba(198,244,50,0.3)' : (added || alreadyAdded) ? 'var(--marker-border)' : 'var(--marker-black)', color: (added || alreadyAdded || autoAdded) ? 'var(--marker-black)' : 'var(--marker-cream)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: (added || alreadyAdded) ? 'default' : 'pointer' }}>
                {autoAdded ? 'Watchlisted ✓ — see Pipeline tab' : (added || alreadyAdded) ? 'In pipeline ✓' : `+ Add to pipeline${result.signal === 'apply' ? ' — apply!' : ''}`}
              </button>
            </div>
            <div className="legal-line">AI-generated analysis. Review before making decisions. Web search used for company data — may not reflect current policies.</div>
          </>
        )}
      </div>

    </div>
  )
}

// ── Contractor Routes tab ─────────────────────────────────────────

function ContractorTab({ profile, jobs: pipelineJobs, addJob }) {
  const [subTab, setSubTab] = useState('roles')

  const [roles,       setRoles]       = useState(null)
  const [rolesLoading,setRolesLoading]= useState(false)
  const [rolesError,  setRolesError]  = useState('')
  const [addedRoles,  setAddedRoles]  = useState(new Set())

  const [recruiters,        setRecruiters]        = useState(null)
  const [recruitersLoading, setRecruitersLoading] = useState(false)
  const [recruitersError,   setRecruitersError]   = useState('')

  const CACHE_MS = 7 * 24 * 60 * 60 * 1000
  function isFresh(cachedAt) { return !!cachedAt && Date.now() - new Date(cachedAt).getTime() < CACHE_MS }

  // Auto-load both panels on first mount if no fresh cache
  useEffect(() => {
    const rolesCachedAt = profile?.hard_filters_json?.contractorRolesCachedAt
    if (isFresh(rolesCachedAt) && profile?.hard_filters_json?.contractorRoles) {
      setRoles(profile.hard_filters_json.contractorRoles)
    } else {
      scanRoles()
    }
    const recCachedAt = profile?.hard_filters_json?.contractorRecruitersCachedAt
    if (isFresh(recCachedAt) && profile?.hard_filters_json?.contractorRecruiters) {
      setRecruiters(profile.hard_filters_json.contractorRecruiters)
    } else {
      generateRecruiters()
    }
  }, [])

  async function scanRoles() {
    setRolesLoading(true); setRolesError('')
    try {
      const res  = await fetch('/api/contractor/roles', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setRolesError(data.error); return }
      setRoles(data.jobs || [])
    } catch { setRolesError('Request failed — try again') }
    finally { setRolesLoading(false) }
  }

  async function generateRecruiters() {
    setRecruitersLoading(true); setRecruitersError('')
    try {
      const res  = await fetch('/api/contractor/recruiters', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setRecruitersError(data.error); return }
      setRecruiters(data.recruiters || [])
    } catch { setRecruitersError('Request failed — try again') }
    finally { setRecruitersLoading(false) }
  }

  function addRoleToPipeline(job) {
    addJob({
      id: crypto.randomUUID(),
      company: job.company,
      roleTitle: job.title,
      jobLink: job.url,
      link: job.url,
      officeDays: 2,
      status: 'considering',
      ranking: 1,
      signal: job.signal || '',
      signalReason: job.reason || '',
      score: job.score || 0,
      scoreBreakdown: '',
      jd: '',
      source: 'contract_search',
      addedAt: new Date().toISOString(),
    })
    setAddedRoles(prev => new Set([...prev, job.id]))
  }

  const hfj           = profile?.hard_filters_json || {}
  const contractTypes = (hfj.contractTypes || ['interim']).join(' / ')
  const ir35          = hfj.ir35Willing || 'either'
  const ir35Label     = ir35 === 'outside' ? 'Outside IR35 preferred' : ir35 === 'inside' ? 'Inside IR35 OK' : 'Either IR35'

  const SUBTABS = [
    { id: 'roles',      label: 'Live Roles'  },
    { id: 'recruiters', label: 'Recruiters'  },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '18px 16px 0', borderBottom: '2px solid var(--marker-border)' }}>
        <div className="kicker holo-text" style={{ marginBottom: 6 }}>Contractor Routes</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 8 }}>Live contract roles. The right agencies.</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-lime)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{contractTypes}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{ir35Label}</span>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {SUBTABS.map(s => (
            <button key={s.id} onClick={() => setSubTab(s.id)}
              style={{ background: 'none', border: 'none', borderBottom: subTab === s.id ? '2px solid var(--marker-black)' : '2px solid transparent', marginBottom: -2, padding: '10px 16px 8px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: subTab === s.id ? 600 : 400, color: subTab === s.id ? 'var(--marker-black)' : 'var(--marker-mid)', cursor: 'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'roles' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rolesLoading && (
            <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)' }}>Scanning live contract roles…</div>
              <ProgressBar duration={35} steps={STEPS_CT_ROLES} slowAt={48} slowMsg="Scoring 40–60 roles takes a moment. Claude reads each one properly — not just the title." />
            </div>
          )}
          {rolesError && !rolesLoading && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#B91C1C' }}>
              {rolesError} — <button onClick={scanRoles} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, padding: 0 }}>try again</button>
            </div>
          )}
          {roles && !rolesLoading && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{roles.length} contract roles · scored</div>
                <button onClick={scanRoles} style={{ background: 'none', border: '1px solid var(--marker-border)', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>↻ Rescan</button>
              </div>
              {roles.length === 0 ? (
                <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 10 }}>No matching contract roles found right now.</div>
                  <button onClick={scanRoles} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 16px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Try again</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {roles.map(job => {
                    const isAdded   = addedRoles.has(job.id) || pipelineJobs.some(j => j.jobLink === job.url || j.link === job.url)
                    const scoreN    = parseFloat(job.score) || 0
                    const scoreBg   = scoreN >= 8 ? 'var(--marker-lime)' : scoreN >= 6 ? '#F5E4A0' : 'var(--marker-border)'
                    const wlbEntry  = WLB_DATA[(job.company || '').toLowerCase()]
                    const wlbScore  = wlbEntry ? parseFloat(wlbEntry.wlb) : null
                    return (
                      <div key={job.id} style={{ background: 'var(--marker-cream-2)', border: `1px solid ${job.signal === 'apply' ? '#86EFAC' : 'var(--marker-border)'}`, borderRadius: 10, padding: 12 }}>
                        {/* Title + dual scores */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ background: scoreBg, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, padding: '3px 9px', borderRadius: 6, color: 'var(--marker-black)' }}>{job.score || '—'}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginTop: 2 }}>JOB FIT</div>
                            </div>
                            {wlbScore !== null && (
                              <div style={{ textAlign: 'center' }}>
                                <div title="Glassdoor WLB score" style={{ background: wlbScore >= 4.3 ? 'var(--marker-lime)' : 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, padding: '3px 9px', borderRadius: 6, color: 'var(--marker-black)' }}>{wlbEntry.wlb}</div>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginTop: 2 }}>WLB /5</div>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Tags */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                          {job.contractType && job.contractType !== 'Unknown' && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-lime)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em' }}>{job.contractType}</span>
                          )}
                          {job.office && job.office !== 'Unknown' && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>{job.office}</span>
                          )}
                          {job.salary && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>{job.salary}</span>
                          )}
                          {job.location && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', padding: '2px 0' }}>{job.location}</span>
                          )}
                          {job.signal && job.signal !== 'maybe' && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: job.signal === 'apply' ? 'var(--marker-lime)' : '#FCA5A5', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{job.signal}</span>
                          )}
                        </div>
                        {job.reason && (
                          <div style={{ fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.5, marginBottom: 8 }}>{job.reason}</div>
                        )}
                        {/* CTAs */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderTop: '1px solid var(--marker-border)', paddingTop: 8 }}>
                          {job.url && (
                            <a href={job.url} target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'var(--marker-black)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                              View JD ↗
                            </a>
                          )}
                          <button onClick={() => !isAdded && addRoleToPipeline(job)} disabled={isAdded}
                            style={{ background: isAdded ? 'var(--marker-lime)' : 'var(--marker-black)', color: 'var(--marker-black)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                            {isAdded ? '✓ Added to pipeline' : 'Add to pipeline'}
                          </button>
                          {!isAdded && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>→ Considering</span>}
                        </div>
                      </div>
                    )
                  })}
                  <div className="legal-line" style={{ paddingTop: 4 }}>Contract roles from Adzuna. Scored by Claude for relevance to your profile. Not affiliated with employers listed.</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subTab === 'recruiters' && (
        <RecruiterPanel profile={profile} mode="contractor" />
      )}

    </div>
  )
}

// ── Week progress strip ───────────────────────────────────────────

function WeekProgress({ jobs }) {
  const now = Date.now()
  const sorted = [...jobs].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
  const firstJobMs = sorted[0]?.addedAt ? new Date(sorted[0].addedAt).getTime() : now
  const weekNum = Math.max(1, Math.ceil((now - firstJobMs) / (7 * 86400000)))
  const oneWeekAgo = now - 7 * 86400000
  const savedThisWeek = jobs.filter(j => j.addedAt && new Date(j.addedAt).getTime() > oneWeekAgo).length
  const appliedThisWeek = jobs.filter(j => j.appliedAt && new Date(j.appliedAt).getTime() > oneWeekAgo).length
  const followUpsDue = jobs.filter(j => j.status === 'applied' && j.appliedAt && (now - new Date(j.appliedAt).getTime()) > 7 * 86400000).length

  let nudge
  if (savedThisWeek === 0) nudge = 'Go to Discover and score anything that looks right. Even one a day keeps your search alive.'
  else if (appliedThisWeek === 0 && savedThisWeek >= 3) nudge = "You've been busy looking. Ready to start applying? Pick your top 3 and go."
  else if (followUpsDue > 0) nudge = `${followUpsDue} application${followUpsDue > 1 ? 's' : ''} ready for a follow-up. A short polite email can double your response rate.`
  else if (appliedThisWeek >= 2) nudge = 'Applications are out. Stay active on Discover so your pipeline keeps moving.'
  else nudge = 'Consistency wins more offers than sprints. Keep scoring and adding roles this week.'

  return (
    <div style={{ margin: '10px 16px 0', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Week {weekNum} of your search</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'Saved', value: savedThisWeek, hit: savedThisWeek >= 3 },
          { label: 'Applied', value: appliedThisWeek, hit: appliedThisWeek >= 2 },
          { label: 'Follow up', value: followUpsDue, warn: followUpsDue > 0 },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: 1, borderRadius: 8, padding: '8px 10px', textAlign: 'center',
            background: stat.hit ? 'var(--marker-lime)' : 'var(--marker-cream)',
            border: '1px solid var(--marker-border)',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, lineHeight: 1, color: stat.value > 0 ? 'var(--marker-black)' : 'var(--marker-border)' }}>{stat.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.06em', marginTop: 4, textTransform: 'uppercase', color: 'var(--marker-mid)' }}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>{nudge}</div>
    </div>
  )
}

// ── Journey stage system ─────────────────────────────────────────

const JOURNEY = [
  { n: 1, label: 'Find roles',    full: 'Find your roles',      sub: 'Browse Discover and save anything that looks right.',               tab: 'Discover', cta: 'Go to Discover'    },
  { n: 2, label: 'Score them',    full: 'Score your saves',     sub: 'Paste each URL into the scorer — see which are actually worth your time.', tab: 'Today',    cta: 'Score a role'      },
  { n: 3, label: 'Apply',         full: 'Apply to your best',   sub: 'Take your top-scored role seriously. Use the CV generator, write a real cover letter.', tab: 'CV', cta: 'Open CV generator' },
  { n: 4, label: 'Follow up',     full: 'Track and follow up',  sub: 'Applications are out. A short follow-up email can make the difference.',  tab: 'Pipeline', cta: 'View pipeline'     },
  { n: 5, label: 'Interview',     full: 'Prepare to win',       sub: "You're in a live interview process. Prep before anything else.",         tab: 'Interview', cta: 'Interview prep'    },
]

function getJourneyStage(jobs) {
  if (jobs.filter(j => j.status === 'interviewing').length > 0) return 5
  if (jobs.filter(j => ['applied', 'offer'].includes(j.status)).length > 0) return 4
  const active = jobs.filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))
  if (active.filter(j => parseFloat(j.score) > 0).length > 0) return 3
  if (active.length > 0) return 2
  return 1
}

function JourneyBar({ jobs, activeTab, onTabSwitch }) {
  const stage = getJourneyStage(jobs)
  const current = JOURNEY[stage - 1]
  const onCurrentTab = activeTab === current.tab

  return (
    <div style={{ background: 'var(--marker-black)', padding: '10px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

        {/* Stage label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span className="holo-text" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', fontWeight: 700 }}>
            {String(stage).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.01em', lineHeight: 1 }}>
            {current.full}
          </span>
        </div>

        {/* Progress track */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
          {JOURNEY.map((s, i) => {
            const done    = s.n < stage
            const active  = s.n === stage
            const future  = s.n > stage
            return (
              <span key={s.n} style={{ display: 'contents' }}>
                {i > 0 && (
                  <div style={{ flex: 1, height: 2, background: done ? 'var(--marker-lime)' : 'rgba(255,255,255,0.12)', transition: 'background 0.4s' }} />
                )}
                <div
                  title={s.full}
                  style={{
                    width:  active ? 12 : 8,
                    height: active ? 12 : 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    transition: 'all 0.3s',
                    background: done
                      ? 'var(--marker-lime)'
                      : future
                        ? 'rgba(255,255,255,0.18)'
                        : active
                          ? 'conic-gradient(from 210deg, #e080c8, #80b8ff, #70d890, #f5d840, #ff8cc0, #a080ff, #e080c8)'
                          : undefined,
                    boxShadow: active ? '0 0 8px 2px rgba(160,100,240,0.5)' : undefined,
                  }}
                />
              </span>
            )
          })}
        </div>

        {/* CTA */}
        {onCurrentTab ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-lime)', letterSpacing: '0.08em', flexShrink: 0 }}>YOU'RE HERE</span>
        ) : (
          <button
            onClick={() => onTabSwitch(current.tab)}
            style={{ flexShrink: 0, background: 'var(--marker-lime)', color: 'var(--marker-black)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}
          >
            {current.cta} →
          </button>
        )}
      </div>

      {/* Sub-instruction — only show on non-current tabs as context */}
      {!onCurrentTab && (
        <div style={{ marginTop: 6, paddingLeft: 34, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          {current.sub}
        </div>
      )}
    </div>
  )
}

// Research-backed daily routine:
// Day 1 Discover: find and save roles to pipeline
// Day 2 Score: assess saved roles, cut weak ones
// Day 3 Apply: write quality applications to top 1-2 roles
// Day 4 Research: target companies + LinkedIn search
// Day 5 Follow-up: chase applications, update pipeline
// Then repeat. Never the same focus two days running.

function SmartNudge({ jobs, onTabSwitch }) {
  const now = Date.now()
  const DAY = 86400000
  const WEEK = 7 * DAY

  const activeJobs = jobs.filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))
  const interviewingJobs = jobs.filter(j => j.status === 'interviewing')
  const appliedJobs = jobs.filter(j => j.status === 'applied')
  const followUps = appliedJobs.filter(j => j.appliedAt && (now - new Date(j.appliedAt).getTime()) > 7 * DAY)

  const oneWeekAgo = now - WEEK
  const oneDayAgo = now - (25 * 3600000) // 25h window
  const twoDaysAgo = now - (49 * 3600000)

  const appliedThisWeek = jobs.filter(j => j.appliedAt && new Date(j.appliedAt).getTime() > oneWeekAgo).length
  const savedThisWeek   = jobs.filter(j => j.addedAt  && new Date(j.addedAt).getTime()  > oneWeekAgo).length

  const sorted = [...jobs].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
  const firstJobMs = sorted[0]?.addedAt ? new Date(sorted[0].addedAt).getTime() : now
  const weeksIn = Math.max(1, Math.ceil((now - firstJobMs) / WEEK))

  // Activity pattern detection
  const feedSources = ['web_search', 'adzuna', 'contract_search', 'feed', 'gov_search', 'gov']
  const bulkFeedAdded = jobs.filter(j => j.addedAt && new Date(j.addedAt).getTime() > oneDayAgo && feedSources.includes(j.source))
  const appliedRecently = jobs.filter(j => j.appliedAt && new Date(j.appliedAt).getTime() > oneDayAgo && j.status === 'applied')
  const appliedTwoDaysAgo = jobs.filter(j => j.appliedAt && new Date(j.appliedAt).getTime() > twoDaysAgo && j.status === 'applied')

  // Unscored jobs that are in considering/to_apply (ready to be assessed)
  const unscoredReady = activeJobs.filter(j => !parseFloat(j.score) && ['considering', 'to_apply'].includes(j.status))

  const topUnacted = activeJobs
    .filter(j => ['considering', 'to_apply'].includes(j.status) && parseFloat(j.score) >= 7)
    .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))[0]

  let nudge = null

  // 1. Live interview process — highest priority
  if (interviewingJobs.length > 0) {
    const co = interviewingJobs[0].company || interviewingJobs[0].roleTitle || 'a live process'
    nudge = { tag: 'In interviews', accent: 'var(--marker-lime)', msg: `You're at interview stage with ${co}. That takes priority over everything else right now. Prepare properly — most candidates don't.`, cta: 'Interview prep', tab: 'Interview' }

  // 2. Follow-ups overdue
  } else if (followUps.length > 0) {
    nudge = { tag: 'Follow up today', accent: '#e8c830', msg: `${followUps.length} application${followUps.length !== 1 ? 's are' : ' is'} 7+ days old with no reply. A short, polite email gets 2–3× the response rate of waiting. Two minutes of work.`, cta: 'View pipeline', tab: 'Pipeline' }

  // 3. Just applied to several things yesterday — rotate to research mode
  } else if (appliedRecently.length >= 2) {
    nudge = { tag: 'Research day', accent: 'var(--marker-lime)', msg: `You applied to ${appliedRecently.length} roles yesterday. Good. Today: build your target company shortlist or do LinkedIn outreach — applying every day without researching leaves half the market untouched.`, cta: 'Target companies', tab: 'Discover' }

  // 4. Added many auto-generated jobs from the feed — need to score and filter
  } else if (bulkFeedAdded.length >= 3) {
    nudge = { tag: 'Score before you apply', accent: '#e8c830', msg: `You added ${bulkFeedAdded.length} roles from the feed. Before applying to any of them, score them — you'll find half aren't worth your time. Focus your effort on the ones that score 7+.`, cta: 'Score roles', tab: 'Today' }

  // 5. Several unscored roles sitting in pipeline
  } else if (unscoredReady.length >= 3) {
    nudge = { tag: 'Score your pipeline', accent: '#e8c830', msg: `You have ${unscoredReady.length} unscored roles saved. Scoring takes 30 seconds each — paste the URL into the scorer above. You should only apply to roles that score 7 or higher.`, cta: 'Score a role', tab: 'Today' }

  // 6. High-score role ready to apply
  } else if (topUnacted) {
    const name = topUnacted.company || topUnacted.roleTitle || 'Your top role'
    nudge = { tag: 'Apply today', accent: 'var(--marker-lime)', msg: `${name} scored ${topUnacted.score} — that's a strong match. A tailored application to a well-scored role gets 3× more callbacks than the same application sent to a weak match. Apply before it closes.`, cta: 'View pipeline', tab: 'Pipeline' }

  // 7. Applied a bunch in last 2 days, nothing new discovered
  } else if (appliedTwoDaysAgo.length >= 2 && savedThisWeek <= appliedTwoDaysAgo.length) {
    nudge = { tag: 'Find more roles', accent: 'var(--marker-lime)', msg: `You've applied to ${appliedTwoDaysAgo.length} roles this week — good. Keep the pipeline topped up. Check for new roles in the feed or add a few more target companies.`, cta: 'Discover roles', tab: 'Discover' }

  // 8. Stalled — nothing active this week
  } else if (weeksIn >= 3 && appliedThisWeek === 0 && savedThisWeek === 0) {
    nudge = { tag: 'Pipeline stalled', accent: 'var(--marker-border)', msg: `Week ${weeksIn} with nothing saved or applied. Job searches stall when activity stalls. Pick your two strongest roles and apply this week — momentum compounds.`, cta: 'View pipeline', tab: 'Pipeline' }

  // 9. New user / empty pipeline
  } else if (activeJobs.length === 0) {
    nudge = { tag: 'Start here', accent: 'var(--marker-lime)', msg: 'Head to Discover first — your target company list auto-populates from your profile. Browse it, then use the scorer above on any role that looks right.', cta: 'Go to Discover', tab: 'Discover' }

  // 10. Small pipeline, not applied yet
  } else if (activeJobs.length < 5 && appliedThisWeek === 0) {
    nudge = { tag: 'Build your pipeline', accent: 'var(--marker-lime)', msg: `${activeJobs.length} role${activeJobs.length !== 1 ? 's' : ''} saved. Aim for 5–8 before applying — more options means better decisions. Find 3–4 more before sending anything.`, cta: 'Find more roles', tab: 'Discover' }
  }

  if (!nudge) return null

  return (
    <div style={{ margin: '10px 16px 0', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: `3px solid ${nudge.accent}`, borderRadius: '0 10px 10px 0', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{nudge.tag}</div>
        <div style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.65 }}>{nudge.msg}</div>
      </div>
      <button
        onClick={() => onTabSwitch(nudge.tab)}
        style={{ flexShrink: 0, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 12px', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center' }}
      >
        {nudge.cta}
      </button>
    </div>
  )
}

// ── Why bullets — plain-English explanations from factor data ────────
function buildWhyBullets(job, profile) {
  const bullets = []
  const bd = (() => { try { return typeof job.scoreBreakdown === 'string' ? JSON.parse(job.scoreBreakdown) : (job.scoreBreakdown || {}) } catch { return {} } })()
  const factors = job.factors || bd.factors || {}
  const maxDays = profile?.max_office_days ?? 2

  const officeDays = job.officeDays ?? bd.officeDays
  if (typeof officeDays === 'number') {
    if (officeDays === 0) bullets.push('Fully remote — matches your working preferences')
    else if (officeDays <= maxDays) bullets.push(`${officeDays} day${officeDays !== 1 ? 's' : ''} in the office, within your stated limit`)
  }

  const skills = factors.roleSkillsMatch?.score || 0
  if (skills >= 8) bullets.push('Responsibilities closely match your recent experience')
  else if (skills >= 6) bullets.push('Role requirements largely align with your background')

  const sen = factors.seniorityFit?.score || 0
  if (sen >= 8) bullets.push('Seniority level is a strong match for your career stage')

  const salScore = factors.salaryMarket?.score || 0
  const salFound = factors.salaryMarket?.found
  const salaryStr = job.salary || bd.salary
  if (salScore >= 7 && salFound) {
    bullets.push(salaryStr ? `Salary ${salaryStr} — above your stated minimum` : 'Advertised salary is above your stated minimum')
  } else if (salaryStr && bullets.length < 4) {
    bullets.push(`Salary listed as ${salaryStr}`)
  }

  const leaveScore = factors.paternityLeave?.score || 0
  const leaveFound = factors.paternityLeave?.found
  const leaveDetail = factors.paternityLeave?.detail
  if (leaveScore >= 8 && leaveFound) {
    bullets.push(leaveDetail ? `Parental leave: ${leaveDetail}` : 'Company offers strong parental leave')
  }

  const wlbEntry = WLB_DATA[(job.company || '').toLowerCase()]
  if (wlbEntry && parseFloat(wlbEntry.wlb) >= 4.3 && bullets.length < 5) {
    bullets.push(`${job.company} scores ${wlbEntry.wlb}/5 for work-life balance on Glassdoor`)
  }

  const cultureScore = factors.companyCulture?.score || 0
  const cultureFound = factors.companyCulture?.found
  if (cultureScore >= 8 && cultureFound && bullets.length < 5) {
    bullets.push('Company has a strong reputation as a place to work')
  }

  const indScore = factors.industryFit?.score || 0
  if (indScore >= 8 && bullets.length < 4) bullets.push('Sector closely matches your experience')

  const growthScore = factors.careerGrowth?.score || 0
  if (growthScore >= 8 && bullets.length < 5) bullets.push('Role offers a clear progression path based on the description')

  return bullets.slice(0, 5)
}

// ── Today Dashboard ──────────────────────────────────────────────────
const DAILY_INSIGHTS = [
  'Roles with 3+ dimensions scoring 7+ have a much higher interview rate than average. Prioritise those first.',
  'Following up on applications older than 7 days doubles response rates. Most candidates never do it.',
  'Senior roles close faster than they post. Apply to your 7+ scored roles within 48 hours of finding them.',
  'Tailoring your CV opening paragraph to the JD keywords typically raises ATS match scores significantly.',
  'The best hiring managers do read cover letters. Three focused paragraphs beat a generic one every time.',
  'Roles posted Monday or Tuesday fill fastest — the hiring team is fresh off the weekly planning meeting.',
  'Practising your answer to "walk me through your background" out loud cuts interview nerves by more than you expect.',
]

function TodayDashboard({ profile, jobs, addJob, updateJob, onTabSwitch, plan }) {
  const [scorerOpen, setScorerOpen] = useState(false)
  const [intros, setIntros] = useState([])

  useEffect(() => {
    fetch('/api/candidate/intros')
      .then(r => r.json())
      .then(d => setIntros(d.intros || []))
      .catch(() => {})
  }, [])

  async function handleIntroResponse(requestId, action) {
    const res = await fetch('/api/candidate/intros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action }),
    })
    const data = await res.json()
    if (data.success) {
      setIntros(prev => prev.map(i =>
        i.requestId === requestId
          ? { ...i, status: data.status, isMutual: data.mutual }
          : i
      ))
    }
  }

  const now = Date.now()
  const DAY = 86400000
  const WEEK = 7 * DAY

  const activeJobs = jobs.filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))

  // Best Opportunity: highest-scored active job not yet applied
  const bestJob = activeJobs
    .filter(j => parseFloat(j.score) > 0)
    .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))[0]

  const bestBd = bestJob ? (() => { try { return typeof bestJob.scoreBreakdown === 'string' ? JSON.parse(bestJob.scoreBreakdown) : (bestJob.scoreBreakdown || {}) } catch { return {} } })() : {}
  const bestFactors = bestJob ? (bestJob.factors || bestBd.factors || null) : null

  // Next Action: derive priority nudge
  const interviewingJobs = jobs.filter(j => j.status === 'interviewing')
  const appliedJobs = jobs.filter(j => j.status === 'applied')
  const followUps = appliedJobs.filter(j => j.appliedAt && (now - new Date(j.appliedAt).getTime()) > 7 * DAY)
  const unscoredReady = activeJobs.filter(j => !parseFloat(j.score) && ['considering', 'to_apply'].includes(j.status))
  const topUnacted = activeJobs
    .filter(j => ['considering', 'to_apply'].includes(j.status) && parseFloat(j.score) >= 7)
    .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))[0]
  const appliedThisWeek = jobs.filter(j => j.appliedAt && new Date(j.appliedAt).getTime() > now - WEEK).length

  let nudge = null
  if (interviewingJobs.length > 0) {
    const co = interviewingJobs[0].company || 'a live process'
    nudge = { tag: 'In interviews', msg: `You are at interview stage with ${co}. Prepare properly — most candidates do not.`, cta: 'Interview prep', tab: 'Interview' }
  } else if (followUps.length > 0) {
    nudge = { tag: 'Follow up today', msg: `${followUps.length} application${followUps.length !== 1 ? 's are' : ' is'} 7+ days old with no reply. Two minutes of outreach now.`, cta: 'View pipeline', tab: 'Pipeline' }
  } else if (unscoredReady.length >= 2) {
    nudge = { tag: 'Score your pipeline', msg: `${unscoredReady.length} saved roles have no score yet. Score before applying.`, cta: 'Score a role', action: () => setScorerOpen(true) }
  } else if (topUnacted) {
    nudge = { tag: 'Ready to apply', msg: `${topUnacted.company || topUnacted.roleTitle} scored ${topUnacted.score} — a strong match. Apply before it closes.`, cta: 'View pipeline', tab: 'Pipeline' }
  } else if (appliedThisWeek === 0 && activeJobs.length >= 3) {
    nudge = { tag: 'Apply this week', msg: `${activeJobs.length} roles saved, none applied this week. Pick your best and send.`, cta: 'View pipeline', tab: 'Pipeline' }
  } else if (activeJobs.length < 5) {
    nudge = { tag: 'Build your pipeline', msg: 'Aim for 5 to 8 roles before applying. More options means better decisions.', cta: 'Find roles', tab: 'Discover' }
  } else {
    nudge = { tag: 'Keep going', msg: 'Consistency wins more offers than sprints. Keep scoring and adding roles.', cta: 'Find roles', tab: 'Discover' }
  }

  const whyBullets = bestJob ? buildWhyBullets(bestJob, profile) : []

  const nudgeWhy = {
    'In interviews': [
      `You are at interview stage with ${interviewingJobs[0]?.company || 'a company'}. That takes priority over everything else right now`,
      'Active processes can go quiet within days if you stop engaging',
      'Most candidates at this stage rely on instinct. Structured preparation sets you apart',
      'Interviewers notice when candidates know the company and the role inside out',
    ],
    'Follow up today': [
      `${followUps.length} application${followUps.length !== 1 ? 's are' : ' is'} 7 or more days old with no response`,
      'Applications without a follow-up get a reply far less often',
      'A short, polite email keeps your name visible to the hiring team',
      'Hiring managers are busy. A gentle nudge is expected, not pushy',
    ],
    'Score your pipeline': [
      `You have ${unscoredReady.length} saved roles with no score`,
      'Applying without scoring first means spending effort on roles that may not be worth it',
      'A score tells you where to invest time on cover letters and tailored applications',
      'Some of those roles may be stronger than they look at first glance',
    ],
    'Ready to apply': topUnacted ? [
      `${topUnacted.company || topUnacted.roleTitle} has already been scored at ${topUnacted.score}. No more analysis needed`,
      'High-scoring roles tend to attract more competition and fill faster',
      'You already have everything you need to write a strong application',
    ] : [],
    'Apply this week': [
      'Roles in your pipeline can fill quickly once a company starts interviewing',
      'A strong, tailored application takes 30 to 60 minutes. Three this week is realistic',
      'Without applications out, you cannot start getting responses and interviews',
    ],
    'Build your pipeline': [
      'With fewer than five roles, you have limited options if some do not work out',
      'A wider shortlist lets you compare what is available before committing to applications',
      'Building your list now reduces pressure once you are ready to apply',
    ],
    'Keep going': [
      'Job searches with consistent weekly activity tend to complete faster',
      'A short session each day keeps your search moving and your options open',
      'The strongest opportunities often appear when you are not expecting them',
    ],
  }[nudge?.tag] || []

  // Pipeline Health
  const health = [
    { label: 'Applied', count: jobs.filter(j => j.status === 'applied').length },
    { label: 'Interviewing', count: jobs.filter(j => j.status === 'interviewing').length },
    { label: 'Offers', count: jobs.filter(j => j.status === 'offer').length },
    { label: 'Rejected', count: jobs.filter(j => j.status === 'rejected').length },
  ]

  // Recent Opportunities: 5 most recently added active jobs
  const recentJobs = [...activeJobs]
    .sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0))
    .slice(0, 5)

  const SEC = { padding: '16px 16px 14px', borderBottom: '1px solid var(--marker-border)' }
  const KICKER = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Section 0: Intro requests from employers ── */}
      {intros.filter(i => i.status !== 'declined').length > 0 && (
        <div style={SEC}>
          <div style={KICKER}>Introductions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intros.map(intro => {
              if (intro.status === 'declined') return null
              const isPending = intro.status === 'pending'
              const isAccepted = intro.status === 'accepted'
              return (
                <div key={intro.requestId} style={{
                  background: isAccepted ? 'var(--marker-black)' : 'var(--marker-cream-2)',
                  border: `1px solid ${isAccepted ? 'transparent' : isPending ? 'rgba(198,244,50,0.5)' : 'var(--marker-border)'}`,
                  borderLeft: isPending ? '3px solid var(--marker-lime)' : undefined,
                  borderRadius: isAccepted ? 10 : '0 10px 10px 0',
                  padding: '12px 14px',
                }}>
                  {isPending && (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>An employer wants to connect</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 2 }}>{intro.roleTitle}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 10 }}>
                        {[intro.roleLocation, intro.roleSalary, intro.matchScore != null ? `${parseFloat(intro.matchScore).toFixed(1)}/10 match` : null].filter(Boolean).join(' · ')}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleIntroResponse(intro.requestId, 'accept')}
                          style={{ background: 'var(--marker-lime)', color: 'var(--marker-black)', border: 'none', padding: '8px 16px', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Accept introduction
                        </button>
                        <button
                          onClick={() => handleIntroResponse(intro.requestId, 'decline')}
                          style={{ background: 'transparent', color: 'var(--marker-mid)', border: '1px solid var(--marker-border)', padding: '8px 12px', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer' }}>
                          Decline
                        </button>
                      </div>
                    </>
                  )}
                  {isAccepted && (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Introduction confirmed</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-cream)', marginBottom: 4 }}>
                        {intro.companyName ? `Connected with ${intro.companyName}` : 'Introduction accepted'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                        {intro.roleTitle}{intro.roleLocation ? ` · ${intro.roleLocation}` : ''}
                        {intro.respondedAt ? ` · ${new Date(intro.respondedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(198,244,50,0.8)', letterSpacing: '0.04em' }}>
                        {intro.companyName ? 'They have your contact details and will be in touch.' : 'Awaiting employer confirmation.'}
                      </div>
                    </>
                  )}
                </div>
              )
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* ── Section 1: Best Opportunity Today ── */}
      <div style={SEC}>
        <div style={KICKER}>Best opportunity today</div>
        {bestJob ? (
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bestJob.company}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bestJob.roleTitle || '—'}</div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div
                  className={parseFloat(bestJob.score) >= 9 ? 'holo-foil' : ''}
                  style={{
                    background: parseFloat(bestJob.score) >= 9 ? undefined : parseFloat(bestJob.score) >= 7 ? 'var(--marker-lime)' : parseFloat(bestJob.score) >= 5 ? '#F5E4A0' : '#FCA5A5',
                    border: `1px solid ${parseFloat(bestJob.score) >= 9 ? 'transparent' : 'var(--marker-border)'}`,
                    fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, lineHeight: 1,
                    padding: '8px 16px', borderRadius: 10, color: 'var(--marker-black)',
                  }}
                >{bestJob.score}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-mid)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI-scored · /10</div>
              </div>
            </div>

            {bestJob.signalReason && (
              <div style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.55, marginBottom: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.03)', borderRadius: 6 }}>{bestJob.signalReason}</div>
            )}

            {bestFactors && (() => {
              const top3 = Object.entries(bestFactors)
                .filter(([, v]) => v?.score >= 7)
                .sort(([, a], [, b]) => b.score - a.score)
                .slice(0, 3)
              if (!top3.length) return null
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {top3.map(([key, v]) => (
                    <span key={key} style={{ background: 'var(--marker-lime)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px', borderRadius: 4 }}>
                      {FACTOR_LABELS[key] || key} {v.score}/10
                    </span>
                  ))}
                </div>
              )
            })()}

            {whyBullets.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 7 }}>Why this role stands out</div>
                <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                  {whyBullets.map((b, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.65, marginBottom: 3 }}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {(bestJob.jobLink || bestJob.link) && (
                <a href={bestJob.jobLink || bestJob.link} target="_blank" rel="noopener noreferrer"
                  style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', padding: '9px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}>
                  Apply now →
                </a>
              )}
              <button onClick={() => onTabSwitch('Pipeline')}
                style={{ background: 'transparent', color: 'var(--marker-black)', border: '1px solid var(--marker-border)', padding: '9px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                View in pipeline
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>No scored roles yet</div>
            <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.5, marginBottom: 12 }}>Score a job URL to see your best opportunity here.</div>
            <button onClick={() => setScorerOpen(true)}
              style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
              Score a role →
            </button>
          </div>
        )}
      </div>

      {/* ── Section 2: Next Action ── */}
      {nudge && (
        <div style={SEC}>
          <div style={KICKER}>Next action</div>
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: '0 10px 10px 0', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>{nudge.tag}</div>
                <div style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.55 }}>{nudge.msg}</div>
              </div>
              <button
                onClick={nudge.action ? nudge.action : () => onTabSwitch(nudge.tab)}
                style={{ flexShrink: 0, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '9px 14px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >{nudge.cta}</button>
            </div>
            {nudgeWhy.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--marker-border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 7 }}>Why this now</div>
                <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                  {nudgeWhy.map((b, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.65, marginBottom: 3 }}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Pipeline Health ── */}
      <div style={SEC}>
        <div style={KICKER}>Pipeline health</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {health.map(stat => (
            <button key={stat.label} onClick={() => onTabSwitch('Pipeline')}
              style={{
                background: stat.count > 0 && stat.label === 'Interviewing' ? 'var(--marker-lime)' : 'var(--marker-cream-2)',
                border: '1px solid var(--marker-border)', borderRadius: 10, padding: '12px 6px',
                textAlign: 'center', cursor: 'pointer',
              }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, lineHeight: 1, color: stat.count > 0 ? 'var(--marker-black)' : 'var(--marker-border)' }}>{stat.count}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.05em', marginTop: 4, textTransform: 'uppercase', color: 'var(--marker-mid)' }}>{stat.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 4: Recent Opportunities ── */}
      {recentJobs.length > 0 && (
        <div style={SEC}>
          <div style={KICKER}>Recent opportunities</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentJobs.map(job => {
              const score = parseFloat(job.score) || 0
              return (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{(job.status || '').replace('_', ' ')}</span>
                    {score > 0 ? (
                      <div className={score >= 9 ? 'holo-foil' : ''} style={{
                        background: score >= 9 ? undefined : score >= 7 ? 'var(--marker-lime)' : score >= 5 ? 'var(--marker-cream)' : 'var(--marker-border)',
                        border: `1px solid ${score >= 9 ? 'transparent' : 'var(--marker-border)'}`,
                        fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, padding: '2px 7px', borderRadius: 5, color: 'var(--marker-black)',
                      }}>{job.score}</div>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-border)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>–</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={() => onTabSwitch('Pipeline')}
            style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', padding: '10px 0 0', display: 'block', letterSpacing: '0.04em' }}>
            View all in pipeline →
          </button>
        </div>
      )}

      {/* ── Section 5: Watchlist — recently tracked (auto-captured) ── */}
      {(() => {
        const watchlisted = jobs.filter(j => j.status === 'watchlist').sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0)).slice(0, 4)
        if (watchlisted.length === 0) return null
        return (
          <div style={SEC}>
            <div style={KICKER}>In your watchlist</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {watchlisted.map(job => {
                const score = parseFloat(job.score) || 0
                return (
                  <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', align: 'center', gap: 6, flexShrink: 0 }}>
                      {score > 0 ? (
                        <div className={score >= 9 ? 'holo-foil' : ''} style={{ background: score >= 9 ? undefined : score >= 7 ? 'rgba(198,244,50,0.22)' : score >= 5 ? 'var(--marker-cream)' : 'var(--marker-border)', border: `1px solid ${score >= 9 ? 'transparent' : score >= 7 ? 'rgba(198,244,50,0.7)' : 'var(--marker-border)'}`, fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, padding: '2px 7px', borderRadius: 5, color: 'var(--marker-black)' }}>
                          {score >= 7 && score < 9 ? <span className="chrome-text">{job.score}</span> : job.score}
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>–</span>
                      )}
                      <button onClick={() => { updateJob && updateJob(job.id, { status: 'considering' }) }} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em' }}>Consider →</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => onTabSwitch('Pipeline')} style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', padding: '10px 0 0', display: 'block', letterSpacing: '0.04em' }}>
              View full pipeline →
            </button>
          </div>
        )
      })()}

      {/* ── Section 6: Daily insight ── */}
      {(() => {
        const insight = DAILY_INSIGHTS[new Date().getDay() % DAILY_INSIGHTS.length]
        return (
          <div style={{ ...SEC, background: 'var(--marker-black)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, color: 'rgba(255,255,255,0.4)' }}>Today's insight</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.6 }}>{insight}</div>
          </div>
        )
      })()}

      {/* ── Score a role (secondary, collapsible) ── */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--marker-border)' }}>
        <button onClick={() => setScorerOpen(o => !o)}
          style={{ width: '100%', background: 'none', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.04em' }}>
          <span>SCORE A NEW ROLE</span>
          <span style={{ fontSize: 12 }}>{scorerOpen ? '▾' : '▸'}</span>
        </button>
        {scorerOpen && (
          <div style={{ marginTop: 8 }}>
            <EngineTab profile={profile} jobs={jobs} addJob={addJob} updateJob={updateJob} stripped />
          </div>
        )}
      </div>

      <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="legal-line">AI-generated scores and summaries. Not professional career advice.</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {plan && plan !== 'trial' && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--marker-mid)', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', padding: '2px 7px', borderRadius: 3 }}>
              {plan === 'free' ? 'Free plan · 3 AI analyses/day' : `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`}
            </span>
          )}
          {plan === 'free' && (
            <a href="/pricing" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textDecoration: 'none' }}>Upgrade for unlimited AI →</a>
          )}
          <a href="/trust" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textDecoration: 'none' }}>Why trust Requite</a>
          <a href="mailto:support@requite.io" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textDecoration: 'none' }}>support@requite.io</a>
        </div>
      </div>

    </div>
  )
}

const TAB_TOOLTIPS = {
  Today:      'Your daily hub — score roles, see your week at a glance, and get back on track fast',
  Pipeline:   'Manage your active roles across stages — stats at the bottom',
  Discover:   'Your personalised job feed and target company shortlist',
  WLB:        'Curated employer reference — Glassdoor WLB scores, parental leave, and office days before you commit to applying',
  CV:         'Generate a tailored CV prompt or cover letter for any pipeline role',
  Interview:  'Full interview prep pack — company research, questions, STAR stories',
  Contractor: 'Curated employer list, recruiter directory, and live contract role scan',
}

// plan: 'free' | 'trial' | 'perm' | 'contractor' | 'both'
// During free/trial: use user's searchMode preference (full access for onboarding/testing)
// On a paid plan: the plan IS the searchMode — overrides user preference
function resolveSearchMode(profile, plan) {
  const hfj = profile?.hard_filters_json || {}
  const userPref = hfj.searchMode || (hfj.openToContract === true ? 'both' : 'perm')
  if (plan === 'perm') return 'perm'
  if (plan === 'contractor') return 'contractor'
  if (plan === 'both') return 'both'
  return userPref // free / trial: honour user preference, show all they've chosen
}

function buildTabs(profile, plan = 'trial') {
  const hfj = profile?.hard_filters_json || {}
  const searchMode = resolveSearchMode(profile, plan)
  const tabs = ['Today', 'Pipeline', 'Discover', 'WLB']
  if (searchMode !== 'contractor') {
    if (hfj.wantsCvGen !== false) tabs.push('CV')
    if (hfj.wantsInterviewPrep !== false) tabs.push('Interview')
  } else {
    tabs.push('CV')
  }
  if (searchMode !== 'perm') tabs.push('Contractor')
  tabs.push('Profile')
  return tabs
}

// ── Plan gate — shown when a feature isn't on the user's plan ──────
function PlanGate({ feature, requiredPlan, currentPlan }) {
  const planNames = { perm: 'Marker (£12/mo)', contractor: 'Marker Contractor (£16/mo)', both: 'Marker Pro (£26/mo)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '56px 24px 80px', gap: 16 }}>
      <div className="kicker holo-text" style={{ marginBottom: 4 }}>Upgrade required</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {feature} is on {planNames[requiredPlan] || requiredPlan}
      </div>
      <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.7, maxWidth: 280 }}>
        Your current plan is {planNames[currentPlan] || currentPlan}. Upgrade to unlock this tool.
      </div>
      <a href="/pricing" style={{ display: 'inline-block', marginTop: 8, background: 'var(--marker-black)', color: 'var(--marker-cream)', padding: '11px 24px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
        View plans →
      </a>
    </div>
  )
}

const TRACK_LABELS = { balanced: 'Balanced', standard: 'Standard', parent: 'Parent', returner: 'Returner', career_changer: 'Career changer' }

function GettingStartedPanel({ profile, jobs, onProfileSaved, onTabSwitch }) {
  const cvRaw = profile?.hard_filters_json?.cvRaw || ''
  const hasCv = cvRaw.length > 50
  const cvThin = hasCv && cvRaw.length < 400
  const hasScored = jobs.some(j => parseFloat(j.score) > 0)
  const activeJobs = jobs.filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))
  const hasPipeline = activeJobs.length > 0

  const [minimized, setMinimized] = useState(false)
  const [pbOpen, setPbOpen] = useState(false)
  const [pbTitle, setPbTitle] = useState('')
  const [pbSkills, setPbSkills] = useState('')
  const [pbHighlight, setPbHighlight] = useState('')
  const [pbSaving, setPbSaving] = useState(false)
  const [suppOpen, setSuppOpen] = useState(false)
  const [suppText, setSuppText] = useState('')
  const [suppSaving, setSuppSaving] = useState(false)

  const steps = [
    // Step 1: profile — only show if genuinely no profile data (post-onboarding this should never show)
    !hasCv && { id: 'profile', label: 'Tell us about yourself', detail: 'A bit more background helps Claude score roles accurately for you' },
    cvThin && { id: 'supplement', label: 'Strengthen your profile', detail: 'Your profile is thin — a few more details will meaningfully improve your scores' },
    // Step 2: discovery before scoring
    !hasPipeline && !hasScored && { id: 'discover', label: 'Find your first roles', detail: 'Go to the Discover tab — browse your company list and job feed, then come back here to score anything that looks right' },
    // Step 3: score
    !hasScored && hasPipeline === false && { id: 'score', label: 'Score a promising role', detail: 'Paste a job URL in the box below. Claude reads the JD and scores it against your profile in ~30 seconds' },
    hasScored && !hasPipeline && { id: 'pipeline', label: 'Add it to your pipeline', detail: 'Click + Add to pipeline after scoring to start tracking it. Aim for 5-8 live roles' },
    // Step 4: build shortlist
    hasPipeline && activeJobs.length < 4 && { id: 'shortlist', label: 'Build your shortlist', detail: `You have ${activeJobs.length} active role${activeJobs.length !== 1 ? 's' : ''}. Aim for 5–8 to keep your pipeline healthy` },
  ].filter(Boolean)

  if (steps.length === 0) return null

  async function saveProfile() {
    if (!pbTitle.trim()) return
    const newCvRaw = [
      `Current role: ${pbTitle.trim()}`,
      pbSkills.trim() ? `Key skills: ${pbSkills.trim()}` : null,
      pbHighlight.trim() ? `Career highlight: ${pbHighlight.trim()}` : null,
    ].filter(Boolean).join('\n')
    setPbSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPbSaving(false); return }
      const { data: p } = await supabase.from('profiles').select('hard_filters_json').eq('id', user.id).single()
      const existing = p?.hard_filters_json || {}
      await supabase.from('profiles').update({ hard_filters_json: { ...existing, cvRaw: newCvRaw } }).eq('id', user.id)
      onProfileSaved(newCvRaw)
      setPbOpen(false)
    } catch {}
    setPbSaving(false)
  }

  async function saveSupplement() {
    if (!suppText.trim()) return
    setSuppSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSuppSaving(false); return }
      const { data: p } = await supabase.from('profiles').select('hard_filters_json').eq('id', user.id).single()
      const existing = p?.hard_filters_json || {}
      const updated = (existing.cvRaw || '') + `\n\nAdditional context:\n${suppText.trim()}`
      await supabase.from('profiles').update({ hard_filters_json: { ...existing, cvRaw: updated } }).eq('id', user.id)
      onProfileSaved(updated)
      setSuppOpen(false)
      setSuppText('')
    } catch {}
    setSuppSaving(false)
  }

  return (
    <div style={{ margin: '8px 16px 0', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: '0 10px 10px 0', overflow: 'hidden' }}>
      <div
        onClick={() => setMinimized(m => !m)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', borderBottom: minimized ? 'none' : '1px solid var(--marker-border)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.01em' }}>Get started</span>
          <span style={{ background: 'var(--marker-lime)', borderRadius: 10, fontSize: 9, fontFamily: 'var(--font-mono)', padding: '1px 6px', color: 'var(--marker-black)', fontWeight: 700 }}>{steps.length}</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--marker-mid)' }}>{minimized ? '▸' : '▾'}</span>
      </div>

      {!minimized && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((step, i) => (
            <div key={step.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', flexShrink: 0, marginTop: 2, minWidth: 20 }}>0{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3, letterSpacing: '-0.01em' }}>{step.label}</div>
                <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.5 }}>{step.detail}</div>

                {step.id === 'profile' && (
                  <div style={{ marginTop: 8 }}>
                    {!pbOpen ? (
                      <button onClick={e => { e.stopPropagation(); setPbOpen(true) }} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Build profile →</button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }} onClick={e => e.stopPropagation()}>
                        <input value={pbTitle} onChange={e => setPbTitle(e.target.value)} placeholder="Current job title + company (e.g. Head of Marketing at Sky)" style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-body)', border: '1px solid var(--marker-border)', borderRadius: 7, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                        <input value={pbSkills} onChange={e => setPbSkills(e.target.value)} placeholder="Key skills, comma separated (e.g. partnerships, SEO, digital strategy)" style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-body)', border: '1px solid var(--marker-border)', borderRadius: 7, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                        <input value={pbHighlight} onChange={e => setPbHighlight(e.target.value)} placeholder="Biggest career win, one line (e.g. Grew partnerships revenue 3× at Sky)" style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-body)', border: '1px solid var(--marker-border)', borderRadius: 7, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: 7 }}>
                          <button onClick={saveProfile} disabled={pbSaving || !pbTitle.trim()} style={{ flex: 1, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: pbSaving || !pbTitle.trim() ? 'not-allowed' : 'pointer', opacity: pbSaving || !pbTitle.trim() ? 0.5 : 1 }}>{pbSaving ? 'Saving…' : 'Save profile'}</button>
                          <button onClick={() => setPbOpen(false)} style={{ background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '8px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step.id === 'discover' && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={e => { e.stopPropagation(); onTabSwitch && onTabSwitch('Discover') }} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Go to Discover →</button>
                  </div>
                )}

                {step.id === 'supplement' && (
                  <div style={{ marginTop: 8 }}>
                    {!suppOpen ? (
                      <button onClick={e => { e.stopPropagation(); setSuppOpen(true) }} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Add more detail →</button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }} onClick={e => e.stopPropagation()}>
                        <textarea
                          value={suppText}
                          onChange={e => setSuppText(e.target.value)}
                          placeholder="e.g. Past roles at HSBC and Google not in profile. Strong negotiator. Led rebrand project in 2024. Currently doing an MBA. Open to interim roles."
                          rows={4}
                          style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-body)', border: '1px solid var(--marker-border)', borderRadius: 7, background: '#fff', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box', lineHeight: 1.5 }}
                        />
                        <div style={{ display: 'flex', gap: 7 }}>
                          <button onClick={saveSupplement} disabled={suppSaving || !suppText.trim()} style={{ flex: 1, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: suppSaving || !suppText.trim() ? 'not-allowed' : 'pointer', opacity: suppSaving || !suppText.trim() ? 0.5 : 1 }}>{suppSaving ? 'Saving…' : 'Save'}</button>
                          <button onClick={() => setSuppOpen(false)} style={{ background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '8px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState('Pipeline')
  const [colIdx, setColIdx] = useState(0) // default: "Worth applying?"
  const [showAdd, setShowAdd] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [feedJobs, setFeedJobs] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [recheckingJobs, setRecheckingJobs] = useState({})
  const [returnBanner, setReturnBanner] = useState(null) // { daysSince, newJobsCount }
  const [cvPrefill, setCvPrefill] = useState(null)
  const [trialEndsAt, setTrialEndsAt] = useState(null)
  const [trialDismissed, setTrialDismissed] = useState(false)
  const [plan, setPlan] = useState('trial') // 'free' | 'trial' | 'perm' | 'contractor' | 'both'
  const [pipelineSearch, setPipelineSearch] = useState('')
  const [checkingLinks, setCheckingLinks] = useState(false)
  const [tabTooltip, setTabTooltip] = useState(null)
  const [pipelineStatsOpen, setPipelineStatsOpen] = useState(false)
  const [showEngineTour,   dismissEngineTour]   = useTutorial('engine')
  const [showPipelineTour, dismissPipelineTour] = useTutorial('pipeline')
  const [showCvTour,       dismissCvTour]       = useTutorial('cv')
  const [showInterviewTour,dismissInterviewTour] = useTutorial('interview')
  const [firstRunStep, advanceFirstRun, dismissFirstRun] = useFirstRun()

  const TABS = buildTabs(profile, plan)

  useEffect(() => {
    if (firstRunStep === 1) setTab('Discover')
  }, [firstRunStep])

  function handleFirstRunAdvance() {
    if (firstRunStep === 2) setTab('Today')
    advanceFirstRun()
  }

  const [focusMode, setFocusMode] = useState(() => {
    try { return localStorage.getItem('mkr_focus') === '1' } catch { return false }
  })
  const [focusTab, setFocusTab] = useState('Score')

  function toggleFocusMode() {
    const next = !focusMode
    setFocusMode(next)
    try { localStorage.setItem('mkr_focus', next ? '1' : '0') } catch {}
    if (next) {
      const map = { Today: 'Score', CV: 'Score', Interview: 'Score', Contractor: 'Score', Pipeline: 'Track', Discover: 'Find', WLB: 'Find' }
      setFocusTab(map[tab] || 'Score')
    }
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase.from('users').select('trial_ends_at').eq('id', data.user.id).single()
          .then(({ data: u }) => { if (u?.trial_ends_at) setTrialEndsAt(new Date(u.trial_ends_at)) })
        fetch('/api/profile/tier').then(r => r.ok ? r.json() : {}).then(d => { if (d.tier) setPlan(d.tier) }).catch(() => {})
          .catch(() => {})
      }
    })
    getProfile().then(p => {
      if (!p?.track) { router.replace('/onboard'); return }
      setProfile(p)
      loadJobs().then(d => {
        const loaded = Array.isArray(d) ? d : []
        setJobs(loaded)
        setLoaded(true)
        // New users (no pipeline) land on Discover — jobs are the hook
        const active = loaded.filter(j => !['watchlist','no_jobs','rejected'].includes(j.status))
        if (active.length === 0) setTab('Discover')
      }).catch(() => setLoaded(true))
    }).catch(() => {
      loadJobs().then(d => { setJobs(Array.isArray(d) ? d : []); setLoaded(true) }).catch(() => setLoaded(true))
    })
    fetch('/api/feed-cache').then(r => r.ok ? r.json() : []).then(d => {
      const jobs = Array.isArray(d) ? d : []
      setFeedJobs(jobs)
      setFeedLoading(false)
      // "Pick up where you left off" — show return banner if > 24h since last visit
      try {
        const lastVisit = localStorage.getItem('mkr_last_visit')
        const now = Date.now()
        if (lastVisit) {
          const daysSince = Math.floor((now - parseInt(lastVisit, 10)) / 86400000)
          if (daysSince >= 1) {
            const newJobsCount = jobs.filter(j => j.foundAt && new Date(j.foundAt).getTime() > parseInt(lastVisit, 10)).length
            setReturnBanner({ daysSince, newJobsCount })
          }
        }
        localStorage.setItem('mkr_last_visit', String(now))
      } catch {}
    }).catch(() => setFeedLoading(false))
  }, [])

  const refreshFeed = useCallback(async () => {
    setFeedLoading(true)
    try {
      const d = await fetch('/api/feed-cache').then(r => r.ok ? r.json() : [])
      setFeedJobs(Array.isArray(d) ? d : [])
    } finally {
      setFeedLoading(false)
    }
  }, [])

  const recheckJob = useCallback(async (jobId, jobLink) => {
    setRecheckingJobs(prev => ({ ...prev, [jobId]: true }))
    try {
      const res = await fetch('/api/freshness/recheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, jobLink }),
      })
      if (res.ok) {
        const d = await res.json()
        setFeedJobs(prev => prev.map(j => j.id === jobId ? { ...j, freshness: d.freshness, relativeTime: d.relativeTime } : j))
      }
    } catch {}
    setRecheckingJobs(prev => ({ ...prev, [jobId]: false }))
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
    setJobs(prev => {
      const job = prev.find(j => j.id === id)
      if (job?.jobLink) {
        fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.jobLink }) }).catch(() => {})
      }
      return prev.filter(j => j.id !== id)
    })
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
  const colJobs = jobs
    .filter(j => j.status === activeCol.id)
    .filter(j => {
      if (!pipelineSearch.trim()) return true
      const q = pipelineSearch.toLowerCase()
      return (j.company || '').toLowerCase().includes(q) || (j.roleTitle || '').toLowerCase().includes(q)
    })
    .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))

  async function checkDeadLinks() {
    const targets = jobs.filter(j => ['considering', 'to_apply', 'applied'].includes(j.status) && j.jobLink)
    if (!targets.length) return
    setCheckingLinks(true)
    try {
      const res = await fetch('/api/check-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: targets.map(j => ({ id: j.id, url: j.jobLink })) }),
      })
      if (res.ok) {
        const { results } = await res.json()
        results.forEach(r => {
          if (r.status === 'dead') updateJob(r.id, { deadLink: true })
          else if (r.status === 'alive') updateJob(r.id, { deadLink: false })
        })
      }
    } catch {}
    setCheckingLinks(false)
  }
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
      <div style={{ background: 'var(--marker-cream)', position: 'sticky', top: 0, zIndex: 10, paddingBottom: 20 }}>
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
              <button onClick={toggleFocusMode} title={focusMode ? 'Switch to Standard view' : 'Switch to Focus view — fewer tabs, less noise'} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: focusMode ? 'var(--marker-black)' : 'transparent', color: focusMode ? 'var(--marker-cream)' : 'var(--marker-mid)', border: `1px solid ${focusMode ? 'var(--marker-black)' : 'var(--marker-border)'}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: focusMode ? 600 : 400, lineHeight: 1 }}>
                {focusMode ? '⊙ Focus' : '⊙ Focus'}
              </button>
              <button onClick={() => router.push('/settings')} style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--marker-border)', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--marker-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Settings">⚙</button>
              <button onClick={signOut} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--marker-border)', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)' }} title="Sign out">
                {user?.email?.charAt(0).toUpperCase() || '?'}
              </button>
            </div>
          </div>

          <div className={s.tabScroll} style={{ display: 'flex', gap: 0, fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)' }}>
            {focusMode ? (
              ['Score', 'Track', 'Find'].map(t => (
                <button key={t} onClick={() => setFocusTab(t)} className={t === focusTab ? s.tabActive : ''} style={{ background: 'none', border: 'none', borderBottom: '3px solid transparent', padding: '0 14px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', color: t === focusTab ? 'var(--marker-black)' : 'var(--marker-mid)', fontWeight: t === focusTab ? 500 : 400, whiteSpace: 'nowrap', position: 'relative' }}>
                  {t}
                </button>
              ))
            ) : (
              TABS.map(t => (
                <button key={t} data-tab={t} onClick={() => { setTab(t); setTabTooltip(null) }} className={t === tab ? s.tabActive : ''} style={{ background: 'none', border: 'none', borderBottom: '3px solid transparent', padding: '0 10px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', color: t === tab ? 'var(--marker-black)' : 'var(--marker-mid)', fontWeight: t === tab ? 500 : 400, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3, position: 'relative' }}>
                  {t}
                  <span
                    title={TAB_TOOLTIPS[t]}
                    onClick={e => { e.stopPropagation(); setTabTooltip(tabTooltip === t ? null : t) }}
                    style={{ fontSize: 9, opacity: tabTooltip === t ? 0.9 : 0.6, cursor: 'help', lineHeight: 1, userSelect: 'none' }}
                  >ⓘ</span>
                </button>
              ))
            )}
          </div>

          {tabTooltip && (
            <div style={{ padding: '8px 16px', background: 'var(--marker-cream-2)', borderTop: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-black)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, animation: 'fadeSlideIn 0.25s ease' }}>
              <div style={{ fontSize: 11, color: 'var(--marker-text)', lineHeight: 1.5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'var(--marker-black)' }}>{tabTooltip} · </span>
                {TAB_TOOLTIPS[tabTooltip]}
              </div>
              <button onClick={() => setTabTooltip(null)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--marker-mid)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          )}

          <div className="holo-hairline" style={{ marginLeft: -16, marginRight: -16, marginTop: 8 }} />
        </div>
        <FirstRunGuide step={firstRunStep} onAdvance={handleFirstRunAdvance} onDismiss={dismissFirstRun} />
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

      {/* ── "Pick up where you left off" return banner (G3) ── */}
      {returnBanner && (
        <div style={{ background: 'var(--marker-cream-2)', borderBottom: '1px solid var(--marker-border)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-mid)', marginRight: 6 }}>Welcome back ·</span>
            {returnBanner.daysSince === 1 ? 'You were last here yesterday.' : `You were last here ${returnBanner.daysSince} days ago.`}
            {returnBanner.newJobsCount > 0 && ` ${returnBanner.newJobsCount} new job${returnBanner.newJobsCount === 1 ? '' : 's'} in your feed since then.`}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => { setTab('Discover'); setReturnBanner(null) }} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer' }}>View feed →</button>
            <button onClick={() => setReturnBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--marker-mid)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
          </div>
        </div>
      )}

      {/* ── Journey bar — persists across all tabs ── */}
      {!focusMode && loaded && (
        <JourneyBar jobs={jobs} activeTab={tab} onTabSwitch={setTab} />
      )}

      {/* ── Main content — centered ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 960, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* ── Focus mode ── */}
        {focusMode && (
          <>
            {focusTab === 'Score' && (
              <EngineTab profile={profile} jobs={jobs} addJob={addJob} updateJob={updateJob} stripped />
            )}
            {focusTab === 'Track' && (
              <FocusPipelineView jobs={jobs} updateJob={updateJob} deleteJob={deleteJob} />
            )}
            {focusTab === 'Find' && (
              <FeedTab jobs={jobs} addJob={addJob} feedJobs={feedJobs} feedLoading={feedLoading} profile={profile} defaultSubTab="find" onRefreshFeed={refreshFeed} recheckJob={recheckJob} recheckingJobs={recheckingJobs} />
            )}
          </>
        )}

        {/* ── Standard mode tabs ── */}
        {!focusMode && (<>

        {/* ── Pipeline tab ── */}
        {tab === 'Pipeline' && (
          <>
            {/* Tab purpose header */}
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--marker-border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 3 }}>Your pipeline</div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>Track every role you're considering. Move cards through stages as you progress, from first look to offer.</div>
            </div>
            {/* Momentum strip */}
            <div style={{ display: 'flex', background: 'var(--marker-black)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: 'Applied', count: jobs.filter(j => j.status === 'applied').length, color: 'var(--marker-lime)' },
                { label: 'Interviewing', count: jobs.filter(j => j.status === 'interviewing').length, color: '#a0c8ff' },
                { label: 'Offers', count: jobs.filter(j => j.status === 'offer').length, color: '#f0a8d0' },
              ].map((item, i) => (
                <div key={item.label} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, color: item.color, lineHeight: 1 }}>{item.count}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 5 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {showPipelineTour && (
              <TourBanner onDismiss={dismissPipelineTour}>
                Roles land in <strong>Watchlist</strong> automatically when you analyse them. Move them to <strong>Considering</strong> when interested, then right through stages as you progress.
              </TourBanner>
            )}

            {/* Column selector — primary always visible; secondary only when they have cards */}
            <div style={{ padding: '0 16px', overflowX: 'auto', display: 'flex', gap: 6, borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)' }}>
              {COLUMNS.map((col, i) => {
                const count = jobs.filter(j => j.status === col.id).length
                if (!col.primary && count === 0) return null
                return (
                  <button key={col.id} onClick={() => setColIdx(i)} style={{ background: 'none', border: 'none', borderBottom: i === colIdx ? '2px solid var(--marker-black)' : '2px solid transparent', padding: '10px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', color: i === colIdx ? 'var(--marker-black)' : 'var(--marker-mid)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {col.label}
                    {count > 0 && <span style={{ background: i === colIdx ? 'var(--marker-black)' : 'var(--marker-border)', color: i === colIdx ? 'var(--marker-cream)' : 'var(--marker-mid)', borderRadius: 10, fontSize: 9, padding: '1px 5px', fontFamily: 'var(--font-mono)' }}>{count}</span>}
                  </button>
                )
              })}
            </div>

            {/* Search + actions bar */}
            <div style={{ padding: '10px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', alignItems: 'center' }}>
              <input
                value={pipelineSearch}
                onChange={e => setPipelineSearch(e.target.value)}
                placeholder="Search company or role…"
                style={{ flex: 1, padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-body)', border: '1px solid var(--marker-border)', borderRadius: 7, background: '#fff', color: 'var(--marker-text)', outline: 'none' }}
              />
              <button
                onClick={checkDeadLinks}
                disabled={checkingLinks}
                style={{ background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '7px 11px', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: checkingLinks ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
              >
                {checkingLinks ? 'Checking…' : 'Check links'}
              </button>
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
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginBottom: 12 }}>
                    {pipelineSearch ? 'NO MATCHES' : 'NOTHING HERE YET'}
                  </div>
                  {!pipelineSearch && <button onClick={() => setShowAdd(true)} className="btn btn-ghost" style={{ fontSize: 13 }}>Add your first role</button>}
                </div>
              ) : colJobs.map(job => (
                <PipelineCard key={job.id} job={job}
                  onEditDetails={j => setEditingJob(j)}
                  onDelete={deleteJob}
                  onTailorCv={tailorCv}
                  onStatusChange={(id, newStatus) => updateJob(id, { status: newStatus })}
                  onScore={async (j) => {
                    if (!j.jobLink) return
                    const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobLink: j.jobLink, roleTitle: j.roleTitle, company: j.company }) })
                    const data = await res.json()
                    console.log('[score]', res.status, data)
                    if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`)
                    track('job_scored', { signal: data.signal || 'none' })
                    updateJob(j.id, { score: data.score, factors: data.factors, signal: data.signal, signalReason: data.signalReason, officeDays: data.officeDays ?? j.officeDays })
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

              {jobs.length > 0 && (
                <div style={{ borderTop: '1px solid var(--marker-border)', paddingTop: 4 }}>
                  <button
                    onClick={() => setPipelineStatsOpen(o => !o)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  >
                    <span>Your numbers</span>
                    <span style={{ fontSize: 11 }}>{pipelineStatsOpen ? '▾' : '▸'}</span>
                  </button>
                  {pipelineStatsOpen && <StatsTab jobs={jobs} />}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Today tab ── */}
        {tab === 'Today' && (() => {
          const activeJobs = jobs.filter(j => !['watchlist','no_jobs','rejected'].includes(j.status))
          return activeJobs.length === 0 ? (
            <GettingStartedPanel
              profile={profile}
              jobs={jobs}
              onProfileSaved={cvRaw => setProfile(prev => ({ ...prev, hard_filters_json: { ...(prev?.hard_filters_json || {}), cvRaw } }))}
              onTabSwitch={t => setTab(t)}
            />
          ) : (
            <TodayDashboard
              profile={profile}
              jobs={jobs}
              addJob={addJob}
              updateJob={updateJob}
              onTabSwitch={setTab}
              plan={plan}
            />
          )
        })()}

        {/* ── Discover tab ── */}
        {tab === 'Discover' && <FeedTab jobs={jobs} addJob={addJob} feedJobs={feedJobs} feedLoading={feedLoading} profile={profile} defaultSubTab="find" onRefreshFeed={refreshFeed} recheckJob={recheckJob} recheckingJobs={recheckingJobs} />}

        {/* ── WLB tab ── */}
        {tab === 'WLB' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--marker-border)' }}>
              <div className="kicker holo-text" style={{ marginBottom: 6 }}>Know before you apply</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>Employers actually worth working for.</div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>Real Glassdoor WLB scores, parental leave policies, and office expectations — so you can research culture before you commit to an application.</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', letterSpacing: '0.04em', marginTop: 8 }}>Culture data from public Glassdoor scores, company disclosures, and employer surveys. Always verify directly with the employer before applying.</div>
            </div>
            <BalancedTab jobs={jobs} addJob={addJob} />
          </div>
        )}

        {/* ── CV tab ── */}
        {tab === 'CV' && (
          <>
            {showCvTour && (
              <TourBanner onDismiss={dismissCvTour}>
                Pick a role from your pipeline, choose how deeply to rewrite your CV, and copy the prompt into ChatGPT or Claude. The deeper the rewrite, the better the interview rate.
              </TourBanner>
            )}
            <CvTab profile={profile} jobs={jobs} updateJob={updateJob} prefill={cvPrefill} onClearPrefill={() => setCvPrefill(null)} onSwitchToEngine={() => setTab('Today')} />
          </>
        )}

        {/* ── Prep tab — perm + both plans only ── */}
        {tab === 'Interview' && (
          plan === 'contractor'
            ? <PlanGate feature="Interview prep" requiredPlan="both" currentPlan={plan} />
            : <>
                {showInterviewTour && (
                  <TourBanner onDismiss={dismissInterviewTour}>
                    Full prep pack for any role at <strong>Applied</strong> stage or beyond — company briefing, likely questions, and STAR frameworks tailored to the JD. Add your interviewer's name for targeted prep.
                  </TourBanner>
                )}
                <PrepTab jobs={jobs} profile={profile} />
              </>
        )}

        {/* ── Contractor tab — contractor + both plans only ── */}
        {tab === 'Contractor' && (
          plan === 'perm'
            ? <PlanGate feature="Contractor routes" requiredPlan="contractor" currentPlan={plan} />
            : <ContractorTab profile={profile} jobs={jobs} addJob={addJob} />
        )}

        {/* ── Profile / Memory Card tab (G3) ── */}
        {tab === 'Profile' && <MemoryCard />}

        </>)} {/* end standard mode */}

      </div>

      {/* ── Bottom tab bar — mobile only (hidden ≥768px) ── */}
      <div className={s.bottomNav}>
        {TABS.map(t => ({ l: t === 'Interview' ? 'Prep' : t === 'Pipeline' ? 'Pipe' : t === 'Contractor' ? 'Contr.' : t === 'Discover' ? 'Find' : t === 'WLB' ? 'WLB' : t, t })).map(({ l, t }) => (
          <button key={t} onClick={() => setTab(t)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px' }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: tab === t ? 'var(--marker-black)' : 'var(--marker-border)' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tab === t ? 'var(--marker-black)' : 'var(--marker-mid)' }}>{l}</div>
          </button>
        ))}
      </div>

      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onAdd={addJob} />}
      {editingJob && <EditJobModal job={editingJob} onClose={() => setEditingJob(null)} onSave={j => updateJob(j.id, j)} onDelete={deleteJob} />}

      {/* ── App footer — legal links ── */}
      <div style={{ borderTop: '1px solid var(--marker-border)', padding: '16px 16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        {[
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
          { label: 'Pricing', href: '/pricing' },
          { label: 'hello@marker.work', href: 'mailto:hello@marker.work' },
        ].map(({ label, href }) => (
          <a key={label} href={href} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>{label}</a>
        ))}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', letterSpacing: '0.04em' }}>· Job scores are AI estimates — not professional advice ·</span>
      </div>
    </div>
  )
}
