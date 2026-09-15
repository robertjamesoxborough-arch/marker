// Shared constants, helpers, hooks, and small presentational components
// used across app/app/page.js's AppPage and its extracted tab/modal files.
// Pure relocation from app/app/page.js during the Sept 2026 file split —
// no logic changed. See PROGRESS.md for the split's rationale and order.

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase/client'
import { QUICK_PROFILE_EXAMPLES, dailyPick } from '../../lib/onboarding-options'

export function Logo({ size = 18 }) {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--marker-black)', display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      marker
      <span className="holo-dot" style={{ display: 'inline-block', width: '0.32em', height: '0.32em', borderRadius: '50%', marginLeft: '0.05em', position: 'relative', top: '-0.55em', flexShrink: 0 }} />
    </span>
  )
}

export function AdzunaBadge() {
  return <div className="adzuna-badge">Jobs by Adzuna</div>
}

// Shared paste-JD chrome (Stage 59) — the Stage 55 rainbow-gradient style
// (originally just the "Open the job page ↗" fallback button) extracted
// into one component and applied everywhere a job description gets pasted:
// the manual-add/edit flow, interview prep, the single-role scorer, CV
// generation's no-JD-stored fallback, and Aggregator bring-in. Previously
// each of these five looked different — a plain placeholder inside a field
// literally labelled "Notes" in one case — so pasting a JD never read as
// one deliberate, recognisable step. One banner, one design language.
export function PasteJdCallout({ label = 'PASTE THE JOB DESCRIPTION HERE', subtext }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'inline-block', padding: '7px 14px', borderRadius: 8, background: 'linear-gradient(90deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #C77DFF)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, textShadow: '0 1px 2px rgba(0,0,0,0.25)', letterSpacing: '0.02em' }}>
        📋 {label}
      </div>
      {subtext && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 6, lineHeight: 1.6 }}>{subtext}</div>}
    </div>
  )
}

// Session O legal hardening: transparent provenance on every card. Every
// job on Requite comes from indexing a real external source -- an ATS
// provider's public API, Adzuna, or a company's own career page -- never
// from Requite itself. Showing where it actually came from is both better
// UX and legally safer than presenting third-party listings as if they
// were ours.
export const ATS_PROVIDER_LABELS = { greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', smartrecruiters: 'SmartRecruiters' }
export function sourceLabel(job) {
  if (job.source === 'wishlist_scrape' || job.source === 'manual') return `from ${job.company || 'the employer'} careers page`
  if (job.source === 'adzuna' || job.adzunaAttributionRequired) return 'via Adzuna'
  if (job.source === 'gov' || job.source === 'gov_search') return 'via Adzuna'
  if (job.source === 'contract_search') return 'via Adzuna'
  const atsProvider = Array.isArray(job.trackTags) ? job.trackTags.find(t => ATS_PROVIDER_LABELS[t]) : null
  if (atsProvider) return `via ${ATS_PROVIDER_LABELS[atsProvider]}`
  if (job.source === 'greenhouse') return 'via Greenhouse' // fallback if trackTags didn't reach the client
  return null
}
export function SourceLabel({ job }) {
  const label = sourceLabel(job)
  if (!label) return null
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.02em' }}>{label}</span>
}

// Which scoring tier produced a job's score: 'full' if a real analysis
// stored factor breakdowns, else 'quick' for a fast feed scan.
export function scoreTierOf(job) {
  if (job?.score_tier) return job.score_tier
  try {
    const bd = typeof job?.scoreBreakdown === 'string' ? JSON.parse(job.scoreBreakdown) : (job?.scoreBreakdown || {})
    if (bd && bd.factors) return 'full'
  } catch {}
  return job?.score ? 'quick' : null
}

export function ScoreBadge({ score, tier }) {
  const n = parseFloat(score) || 0
  const top = n >= 9
  const high = n >= 7 && n < 9
  const bg = top ? undefined : high ? 'rgba(198,244,50,0.22)' : n >= 5 ? 'var(--marker-cream)' : 'var(--marker-border)'
  const border = top ? 'transparent' : high ? 'rgba(198,244,50,0.7)' : 'var(--marker-border)'
  const quick = tier === 'quick'
  const full = tier === 'full'
  return (
    <div
      className={top ? 'holo-foil' : ''}
      title={quick ? 'Quick score, from a fast title scan. Run a full analysis for a verified score.' : full ? 'Verified score, from a full job description analysis.' : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: bg, border: `1px solid ${border}`, boxShadow: quick && n > 0 ? '0 0 0 2px rgba(147,197,253,0.65)' : 'none', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, padding: '2px 8px', borderRadius: 5, color: 'var(--marker-black)', flexShrink: 0 }}>
      {full && n > 0 && <span style={{ color: '#15803D', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      {n > 0 ? <span className={high ? 'chrome-text' : ''}>{score}</span> : '–'}
    </div>
  )
}

export function OfficeBadge({ days }) {
  if (days === undefined || days === null) return null
  const d = parseFloat(days)
  const bg = d <= 1 ? 'var(--marker-lime)' : d <= 2.5 ? '#F0E0A8' : '#E8B8B8'
  const label = d === 0 ? 'Remote' : `${d}d`
  return <span style={{ background: bg, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, color: 'var(--marker-black)' }}>{label}</span>
}

export function SignalBadge({ signal }) {
  if (!signal) return null
  const bg = signal === 'apply' ? 'var(--marker-lime)' : signal === 'maybe' ? '#F0E0A8' : '#E8B8B8'
  const color = signal === 'dont_apply' ? 'white' : 'var(--marker-black)'
  const label = signal === 'dont_apply' ? 'skip' : signal
  return <span style={{ background: bg, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', color }}>{label}</span>
}

// ── Posted-within filter — shared across all feed tabs. For cached reads
// this is a deterministic client-side filter (zero cost, jobs are already
// loaded); for a live Fresh Scan, the same value is passed through as
// maxDaysOld so the route uses Adzuna's native max_days_old param instead
// of filtering after fetch.
export const POSTED_WITHIN_OPTIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: 'Anytime', days: null },
]
export const POSTED_WITHIN_KEY = 'mkr_posted_within'

export function usePostedWithin(defaultDays = 14) {
  const [days, setDays] = useState(() => {
    try {
      const saved = localStorage.getItem(POSTED_WITHIN_KEY)
      return saved === 'null' ? null : (saved ? parseInt(saved, 10) : defaultDays)
    } catch { return defaultDays }
  })
  const setAndPersist = (d) => {
    setDays(d)
    try { localStorage.setItem(POSTED_WITHIN_KEY, d === null ? 'null' : String(d)) } catch {}
  }
  return [days, setAndPersist]
}

// dateStr is foundAt/cached_at, refreshed on every cron upsert -- this filters
// by "last touched by our ingest", not true original posting date, for a
// listing that keeps reappearing in scans. Same limitation the freshness
// system (lib/freshness.js) already has; documented, not a bug to fix here.
export function withinPostedWindow(dateStr, days) {
  if (days == null) return true
  if (!dateStr) return true // no date info — don't hide, matches missing-info-neutral pattern used elsewhere
  const ageMs = Date.now() - new Date(dateStr).getTime()
  return ageMs <= days * 86400000
}

export function PostedWithinSelect({ days, onChange }) {
  return (
    <select
      value={days === null ? 'anytime' : String(days)}
      onChange={e => onChange(e.target.value === 'anytime' ? null : parseInt(e.target.value, 10))}
      style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', letterSpacing: '0.02em' }}
    >
      {POSTED_WITHIN_OPTIONS.map(o => (
        <option key={o.label} value={o.days === null ? 'anytime' : String(o.days)}>Posted within: {o.label}</option>
      ))}
    </select>
  )
}

// ── Weekly preferences box — free text weighted into lib/match-engine.js's
// weeklyFocus dimension at read time (deterministic keyword parsing server-
// side, zero model calls). Saved via a dedicated endpoint that only ever
// touches hard_filters_json.weeklyPreference, not the whole profile.
export function WeeklyPreferenceBox() {
  const [value,   setValue]   = useState('')
  const [saved,   setSaved]   = useState(true)
  const [loaded,  setLoaded]  = useState(false)

  useEffect(() => {
    fetch('/api/profile/weekly-preference')
      .then(r => r.json())
      .then(d => setValue(d.weeklyPreference || ''))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaved(false)
    try {
      await fetch('/api/profile/weekly-preference', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyPreference: value }),
      })
    } catch {}
    setSaved(true)
  }

  if (!loaded) return null

  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        placeholder="What do you want this week? e.g. remote only, no fintech"
        maxLength={300}
        style={{ flex: 1, padding: '7px 10px', fontSize: 12, border: '1px solid var(--marker-border)', borderRadius: 8, background: 'var(--marker-cream)', color: 'var(--marker-text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)' }}
      />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', flexShrink: 0, minWidth: 42, textAlign: 'right' }}>
        {saved ? 'SAVED' : 'SAVING…'}
      </span>
    </div>
  )
}

// ── Fresh Scan — Pro/Max live re-scan, gated by lib/allowance.js's
// feed_fresh_scan daily cap. Shows real allowance state before the click
// (fetched read-only, spends nothing); free tier (cap 0) is disabled with
// an upgrade hint instead of hidden. Posts {fresh:true} to one or more
// routes (feed-web/feed-gov/contractor-roles), which live-scan and write
// the shared cache, then calls onScanComplete to reload the passive view.
// maxDaysOld (from the posted-within selector) is passed through so a live
// scan uses Adzuna's native max_days_old param rather than filtering after
// the fact.
export function FreshScanButton({ endpoints, onScanComplete, maxDaysOld }) {
  const [allowance, setAllowance] = useState(null)
  const [scanning, setScanning]   = useState(false)
  const [err, setErr]             = useState('')

  useEffect(() => {
    fetch('/api/profile/fresh-scan-allowance').then(r => r.ok ? r.json() : null).then(setAllowance).catch(() => {})
  }, [])

  if (!allowance) return null

  const locked = allowance.cap === 0
  const exhausted = !locked && allowance.used >= allowance.cap

  async function runScan() {
    setErr(''); setScanning(true)
    try {
      const results = await Promise.all(endpoints.map(ep =>
        fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true, maxDaysOld: maxDaysOld ?? undefined }) })
          .then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }))
      ))
      const limited = results.find(r => r.status === 429)
      if (limited) {
        setErr(limited.data.error || 'Fresh scan limit reached today.')
        setAllowance(a => a ? { ...a, used: limited.data.used ?? a.used, cap: limited.data.cap ?? a.cap } : a)
      } else {
        setAllowance(a => a ? { ...a, used: a.used + 1 } : a)
        await onScanComplete?.()
      }
    } catch {
      setErr('Fresh scan failed. Try again.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={locked || exhausted || scanning ? undefined : runScan}
        disabled={scanning}
        title={locked ? 'Upgrade to Pro for live Fresh Scans: free plans read the shared daily-refreshed feed' : exhausted ? 'Fresh scan limit reached today' : undefined}
        style={{
          background: locked ? 'var(--marker-cream-2)' : exhausted ? 'var(--marker-border)' : 'var(--marker-lime)',
          border: locked ? '1px solid var(--marker-border)' : 'none',
          color: 'var(--marker-black)', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          letterSpacing: '0.04em', padding: '5px 11px', borderRadius: 6,
          cursor: locked || exhausted || scanning ? 'default' : 'pointer', opacity: scanning ? 0.6 : 1,
        }}>
        {scanning ? 'SCANNING…' : locked ? '⚡ FRESH SCAN · PRO' : '⚡ FRESH SCAN'}
      </button>
      {!locked && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
          {Math.max(0, allowance.cap - allowance.used)} of {allowance.cap} left today
        </span>
      )}
      {err && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#B91C1C' }}>{err}</span>}
    </div>
  )
}

// ── Pipeline card — matches ProductMobileUI.jsx exactly ───────────

export const FACTOR_LABELS = {
  roleSkillsMatch: 'Skills match',
  seniorityFit: 'Seniority fit',
  industryFit: 'Industry fit',
  officeFlexibility: 'Office flex',
  companyCulture: 'Culture',
  paternityLeave: 'Parental leave',
  salaryMarket: 'Salary',
  careerGrowth: 'Growth',
}

export function factorScoreColor(score) {
  if (score >= 8) return 'var(--marker-lime)'
  if (score >= 6) return '#93C5FD'
  if (score >= 4) return '#F0E0A8'
  return '#E8B8B8'
}

export function timeAgo(iso) {
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

export function PipelineCard({ job, onEditDetails, onDelete, onScore, onTailorCv, onAskForReferral, onStatusChange, onDismissDuplicateFlag }) {
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
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '–'}</div>
        </div>
        <ScoreBadge score={job.score} tier={scoreTierOf(job)} />
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

      {job.possibleDuplicateOf && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#92400E', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 6, padding: '6px 8px', marginBottom: 8, lineHeight: 1.4 }}>
          <span style={{ flex: 1 }}>This might be the same as {job.possibleDuplicateOf.company} · {job.possibleDuplicateOf.roleTitle}, worth a check.</span>
          {onDismissDuplicateFlag && (
            <button onClick={() => onDismissDuplicateFlag(job.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', fontSize: 11, padding: 0, flexShrink: 0 }}>✕</button>
          )}
        </div>
      )}

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
        {onAskForReferral && (
          <button onClick={() => onAskForReferral(job)} title="Draft outreach to a contact at this company" style={{ flex: 1, minWidth: 80, background: 'transparent', color: 'var(--marker-text)', border: '1px solid var(--marker-border)', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Ask for a referral</button>
        )}
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

export function useTutorial(key) {
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

export const FIRST_RUN_STEPS = [
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
    body: 'Hit the + Pipeline button on any role. Aim for 5–8 active roles: enough to keep momentum without overwhelm.',
    cta: 'Got it →',
    pulse: 'pipeline-button',
  },
  {
    n: '03',
    tab: 'Today',
    subTab: null,
    heading: 'Score any role in 30 seconds.',
    body: 'Paste a job URL into the box on this page. Claude reads the full JD and gives you an 8-factor match score (including office days, WLB, and parental leave).',
    cta: "Let's go",
    pulse: 'score-input',
  },
]

export function useFirstRun() {
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

export function FirstRunGuide({ step, onAdvance, onDismiss }) {
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

export function TourBanner({ children, onDismiss }) {
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

export function ProgressBar({ duration, steps, slowAt, slowMsg }) {
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

export const STEPS_ANALYSE = [
  'Fetching the job page…',
  'Extracting the job description…',
  'Checking company culture signals…',
  'Measuring skills match against your profile…',
  'Weighing seniority and industry fit…',
  'Calculating your WLB score…',
  'Putting it all together…',
  'Building your score breakdown…',
]

export const STEPS_SEARCH = [
  'Querying Adzuna for live roles…',
  'Pulling the freshest listings…',
  'Filtering out anything irrelevant…',
  'Reading each job description…',
  'Matching against your profile…',
  'Scoring the best fits…',
  'Ranking the results…',
  'Nearly there…',
]

export const STEPS_PREP = [
  'Researching the company…',
  'Digging into their interview style…',
  'Pulling likely first-round questions…',
  'Building your STAR story frameworks…',
  'Checking culture and Glassdoor notes…',
  'Writing your company intelligence brief…',
  'Adding the finishing touches…',
  'Almost done…',
]

export const STEPS_CT_COMPANIES = [
  'Identifying active UK employers in your field…',
  'Cross-referencing contractor hiring volumes…',
  'Checking conversion confidence signals…',
  'Pulling WLB and culture data…',
  'Scoring and ranking your targets…',
  'Almost there…',
]

export const STEPS_CT_ROLES = [
  'Querying Adzuna for contract roles…',
  'Filtering out permanent listings…',
  'Reading each contract description…',
  'Matching against your contractor profile…',
  'Scoring the best fits…',
  'Ranking the results…',
]

export const STEPS_CT_RECRUITERS = [
  'Finding specialist UK agencies in your field…',
  'Checking their contractor focus areas…',
  'Pulling approach notes for each agency…',
  'Ranking by relevance to your role…',
  'Nearly there…',
]

// ── Column definitions ────────────────────────────────────────────

export const COLUMNS = [
  { id: 'considering',    label: 'Considering',  primary: true  },
  { id: 'to_apply',       label: 'To apply',     primary: true  },
  { id: 'applied',        label: 'Applied',      primary: true  },
  { id: 'interviewing',   label: 'Interviewing', primary: true  },
  { id: 'offer',          label: 'Offer',        primary: true  },
  { id: 'watchlist',      label: 'Watchlist',    primary: true  },
  { id: 'rejected',       label: 'Rejected',     primary: false },
  { id: 'no_jobs',        label: 'No openings',  primary: false },
]

// Dashboard-wide duplicate detection (Stage 58) — plain-language framing
// for a STRONG match, per the three required phrasings: applied / dismissed
// / already tracking. Never asserts anything for a SOFT match (that's
// rendered separately, as "might be" -- see possibleDuplicateOf below).
export function describeDuplicateMatch(match) {
  const record = match.record
  if (record.source === 'dismissed') return 'You dismissed this before.'
  if (['applied', 'interviewing', 'offer'].includes(record.status)) {
    const when = record.appliedAt ? new Date(record.appliedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null
    return when ? `You applied to this in ${when}.` : 'You already applied to this.'
  }
  const label = COLUMNS.find(c => c.id === record.status)?.label || record.status
  return `Already tracking this as "${label}".`
}

// ── Interview Prep markdown renderer ─────────────────────────────

export function renderPrepMarkdown(text) {
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

export const INTERVIEW_STAGES = [
  { id: 'screening',      label: 'Screening call',    sub: 'HR / talent, 20-30 min' },
  { id: 'hiring_manager', label: 'Hiring manager',    sub: 'Deep role + competency' },
  { id: 'panel',          label: 'Panel',             sub: 'Multiple stakeholders' },
  { id: 'task',           label: 'Task / case study', sub: 'Presentation or exercise' },
  { id: 'final',          label: 'Final round',       sub: 'Last 2-3 candidates' },
  { id: 'ceo',            label: 'CEO / exec',        sub: 'Strategic, vision-level' },
]

// ── Stats tab ─────────────────────────────────────────────────────

export const FUNNEL = [
  { id: 'watchlist',   label: 'Watchlist',       color: 'var(--marker-border)' },
  { id: 'considering', label: 'Worth applying?',  color: '#C4B5FD' },
  { id: 'to_apply',    label: 'Going to apply',   color: '#93C5FD' },
  { id: 'applied',     label: 'Applied',          color: 'var(--marker-lime)' },
  { id: 'interviewing',label: 'Interviewing',     color: '#FCD34D' },
  { id: 'offer',       label: 'Offer',            color: '#6EE7B7' },
  { id: 'rejected',    label: 'Rejected',         color: '#FCA5A5' },
]

// ── CV Generator tab ──────────────────────────────────────────────

export const EFFORT_LEVELS = [
  { id: 'none',   label: 'Zero effort', sub: 'AI writes now, no questions',     cvEffort: 'standard' },
  { id: 'light',  label: 'Light',       sub: '2 questions · adds real context',   cvEffort: 'standard' },
  { id: 'medium', label: 'Medium',      sub: '4 questions · stronger tailoring',  cvEffort: 'deep'     },
  { id: 'deep',   label: 'Deep',        sub: '7 questions · maximum precision',   cvEffort: 'deep'     },
]

// Copy-paste fallback prompts — used only inside DirectCvPanel's "prefer
// your own AI?" toggle. AI Generate (DirectCvPanel's own in-app call) is the
// primary path; this is the one deliberately-kept fallback for people who'd
// rather paste into their own Claude/ChatGPT than spend an in-app allowance
// (previously there were two separate copy-paste tabs plus the API path —
// consolidated to one API path + one fallback, see PROGRESS.md Stage 44 #7).
export function buildCvFallbackPrompt(roleTitle, company, jobLink, cvRaw, jd) {
  const jobLine = `Role: ${roleTitle}${company ? ` at ${company}` : ''}${jobLink ? `\nJob link: ${jobLink}` : ''}`
  const jdBlock = jd ? `\nJob description:\n${jd}` : ''
  const cvBlock = cvRaw ? `\nMy CV:\n${cvRaw}` : ''
  return `Please rewrite my CV to better match this specific role. Keep my authentic experience; improve how it is framed, not what I have done.\n\n${jobLine}${jdBlock}${cvBlock}\n\nInstructions:\n- Rewrite bullet points to mirror language from the JD where genuinely applicable\n- Optimise for ATS: ensure exact-match keywords appear naturally, remove filler phrases, keep formatting clean\n- Optimise for AI screening: ensure the skills section, first page, and each role's opening line are keyword-dense but readable\n- Keep every job title, company, and date. Do not invent experience.\n- Aim for a relevance score of 8+/10 for this specific role\n\nATS + AI screening defence: use exact-match keywords from the JD, action-verb-led bullets with metrics, no tables or text boxes. Do not add skills or experience that are not in my CV.`
}

export function buildCoverLetterFallbackPrompt(roleTitle, company, jobLink, cvRaw, jd) {
  const jobLine = `Role: ${roleTitle}${company ? ` at ${company}` : ''}${jobLink ? `\nJob link: ${jobLink}` : ''}`
  const jdBlock = jd ? `\nJob description:\n${jd}` : ''
  const cvBlock = cvRaw ? `\nMy CV:\n${cvRaw}` : ''
  return `Please write a tailored cover letter for this specific role, based on my real CV. UK English, no cliches, no invented experience or numbers.\n\n${jobLine}${jdBlock}${cvBlock}\n\nInstructions:\n- Reference specific, real achievements from my CV that match what this role asks for\n- Keep it to 3-4 short paragraphs, direct and specific, not generic\n- Do not invent any number, metric, or piece of experience that is not in my CV\n- UK English throughout\n\nReturn the letter text only, no preamble.`
}

// ── Feed tab (3 sub-tabs: Task List / Web Search / Gov) ──────────

export const RETURNSHIP_PROGRAMMES = [
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

export const PARENTAL_FRIENDLY_EMPLOYERS = [
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

export const SOURCE_LABELS = {
  greenhouse:   'Company board',
  careers_page: 'Company board',
  adzuna:       'Adzuna',
  gov:          'Civil Service',
  gov_search:   'Civil Service',
}

// ── Wishlist seed data ────────────────────────────────────────────

export const WISHLIST_SEEDS = {
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
    { company: 'Channel 4',        sector: 'Media',     note: '9 months full pay for all parents, one of the best in UK' },
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
    { company: 'Goldman Sachs',    sector: 'Finance',   note: 'Returnship programme: 6 months paid, structured support' },
    { company: 'Amazon',           sector: 'Tech',      note: 'Return to Work: open to career breaks of 2+ years' },
    { company: 'Morgan Stanley',   sector: 'Finance',   note: 'Return to Work programme, open to all disciplines' },
    { company: 'Mastercard',       sector: 'Fintech',   note: 'Returnship programme, London offices' },
    { company: 'PwC',              sector: 'Consulting',note: 'Back to Business programme, targets career returners' },
    { company: 'Barclays',         sector: 'Finance',   note: 'Bespoke Return to Work programme with coaching' },
    { company: 'JP Morgan',        sector: 'Finance',   note: 'ReEntry programme: 15 weeks paid, mentored' },
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
    { company: 'General Assembly', sector: 'EdTech',     note: 'Hires its own graduates, good first tech role post-bootcamp' },
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

// ── Balanced Roles tab ────────────────────────────────────────────

export const BALANCED_COMPANIES = [
  { co: 'Nationwide',     sector: 'Finance',      wlb: '4.4', reviews: '4,820', leave: '26 weeks full pay',  office: '1d', wf: true,  careers: 'https://jobs.nationwide.co.uk',           score: '9.1', note: 'Best enhanced parental leave in UK finance; hybrid-first culture. Working Families Top Employer 2024.' },
  { co: 'Wellcome Trust', sector: 'Charity',      wlb: '4.6', reviews: '640',   leave: '26 weeks full pay',  office: '1d', wf: false, careers: 'https://wellcome.org/jobs',               score: '9.0', note: 'Sector-leading WLB; mission-driven science philanthropy; flexible by default.' },
  { co: 'Channel 4',      sector: 'Media',        wlb: '4.2', reviews: '1,080', leave: '9 months full pay',  office: '2d', wf: true,  careers: 'https://careers.channel4.com',            score: '8.9', note: '9 months full pay for all parents; best in UK broadcasting. Working Families Top Employer 2024.' },
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
  // NHS: real Agenda for Change national terms + Glassdoor's general "NHS"
  // listing (not one specific trust's PR claim, since Agenda for Change
  // genuinely applies nationally) — added because this list previously had
  // no healthcare employer despite the NHS being the UK's largest employer.
  { co: 'NHS',            sector: 'Healthcare',   wlb: '3.3', reviews: '14,689',leave: '8 weeks full pay + 18 weeks half pay', office: 'Shift-based', wf: false, careers: 'https://www.jobs.nhs.uk', score: '7.8', note: 'Agenda for Change national terms apply across every trust: 8 weeks full pay + 18 weeks half pay maternity leave, and a day-one statutory right to request flexible working.' },
]

// WLB lookup by company name (lowercase) — sourced from BALANCED_COMPANIES above
export const WLB_DATA = {}
BALANCED_COMPANIES.forEach(c => { WLB_DATA[c.co.toLowerCase()] = c })

export const BALANCED_SECTORS = ['All', 'Finance', 'Media', 'Tech', 'Public Sector', 'Fintech', 'Energy', 'Regulator', 'Charity', 'Healthcare', 'Other']

// ── Main app ──────────────────────────────────────────────────────

// ── Analyse tab — paste URL or JD → instant AI score breakdown ───

export const FACTOR_META = [
  { key: 'roleSkillsMatch', label: 'Skills match' },
  { key: 'seniorityFit',    label: 'Seniority fit' },
  { key: 'industryFit',     label: 'Industry fit' },
  { key: 'officeFlexibility',label: 'Office flexibility' },
  { key: 'companyCulture',  label: 'Company culture' },
  { key: 'paternityLeave',  label: 'Parental leave' },
  { key: 'salaryMarket',    label: 'Salary vs market' },
  { key: 'careerGrowth',    label: 'Career growth' },
]

export function FactorBar({ label, factor }) {
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

// ── Verdict card (Stage 66) ──────────────────────────────────────────
// A scored role used to lead with a raw number and an 8-factor grid. This
// flips it: a plain-English verdict first, an honest two-axis split
// second (would you WANT it vs would you WIN it), scannable facts last.
// Both are built entirely from what /api/analyse already returns -- the
// verdict reuses the model's own signalReason (it already synthesises fit,
// gaps and a recommendation into plain English -- see the analyse prompt),
// falling back to a deterministic synthesis from factor notes/scores only
// when signalReason is missing (an older pipeline row, say). The split is
// a pure regrouping of the same 8 factor scores. Zero new AI calls either way.

export const COMPETITIVENESS_FACTOR_KEYS = ['roleSkillsMatch', 'seniorityFit', 'industryFit']
export const DESIRABILITY_FACTOR_KEYS = ['officeFlexibility', 'companyCulture', 'paternityLeave', 'salaryMarket', 'careerGrowth']

function avgFactorScore(factors, keys) {
  const scores = keys.map(k => factors?.[k]?.score).filter(s => typeof s === 'number' && s > 0)
  if (scores.length === 0) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}

// Same 3-way partition as the rest of the app's score chips (FeedTab's
// csBg, ScoreBadge's colour bands): >=7 high/lime, >=5 mid/yellow, else low
// -- consistent with the existing design language rather than inventing a
// new banding just for this split.
function scoreBand(n) {
  if (n == null) return null
  return n >= 7 ? 'high' : n >= 5 ? 'mid' : 'low'
}

// One honest read per band combination -- deliberately never hides a low
// competitiveness reading behind a high overall score, the whole point of
// this feature (telling someone they're a stretch before they sink effort in).
const SPLIT_READS = {
  'high-high': "A role you'd want and are well placed to win. Strong all round.",
  'high-mid':  'Genuinely appealing, and a fair shot at it. Worth the effort.',
  'high-low':  "A role you'd love but you're a stretch on. Apply if you're up for the challenge.",
  'mid-high':  'Solid odds of landing it, and reasonably appealing. A safe bet.',
  'mid-mid':   'Middling on both counts. Neither a standout nor a write-off.',
  'mid-low':   "A fair shot at it, but not obviously a role you'd want. Low priority unless something else draws you in.",
  'low-high':  "You'd likely win this easily, but it may not excite you. Worth a gut check before applying.",
  'low-mid':   "A fair shot, but not obviously a role you'd want. Only worth it for the right reasons.",
  'low-low':   "Neither a strong fit nor a role you'd likely love. Probably not worth the time.",
}

// desirability = the lifestyle/comp factors, competitiveness = the
// skills/seniority/experience factors -- computed deterministically from
// the existing score breakdown, no new AI call.
export function computeVerdictSplit(factors) {
  const desirability = avgFactorScore(factors, DESIRABILITY_FACTOR_KEYS)
  const competitiveness = avgFactorScore(factors, COMPETITIVENESS_FACTOR_KEYS)
  const dBand = scoreBand(desirability)
  const cBand = scoreBand(competitiveness)
  const read = (dBand && cBand) ? SPLIT_READS[`${dBand}-${cBand}`] : ''
  return { desirability, competitiveness, read }
}

export function buildVerdict(job) {
  if (job?.signalReason && job.signalReason.trim()) return job.signalReason.trim()

  const factors = job?.factors || {}
  const entries = Object.entries(factors).filter(([, v]) => v && typeof v.score === 'number' && v.score > 0)
  if (entries.length === 0) return ''

  const sorted = [...entries].sort((a, b) => b[1].score - a[1].score)
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
  let verdict = `${cap((FACTOR_LABELS[strongest[0]] || strongest[0]).toLowerCase())} is the strongest part of this match.`
  if (weakest[0] !== strongest[0] && weakest[1].score <= 5) {
    verdict += ` ${cap((FACTOR_LABELS[weakest[0]] || weakest[0]).toLowerCase())} is the notable gap, worth weighing before you commit.`
  }
  return verdict
}

function FactChip({ children, highlight }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 9px', borderRadius: 5, background: highlight ? 'var(--marker-lime)' : 'var(--marker-cream)', border: '1px solid var(--marker-border)', color: 'var(--marker-black)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// The one consistent way a scored role is shown everywhere scoring
// happens (Today, feed, aggregator, engine scorer): verdict first, the
// desirability/competitiveness split second, scannable facts last --
// never a raw number or factor grid leading. `compact` trims sizing for
// list-row contexts (feed cards, aggregator results); `showFactors` (the
// engine scorer's full result view) adds the detailed 8-factor breakdown
// beneath, demoted from where it used to lead.
export function VerdictCard({ job, compact = false, showFactors = false }) {
  const factors = job?.factors || {}
  const verdict = buildVerdict(job)
  const { desirability, competitiveness, read } = computeVerdictSplit(factors)
  const score = parseFloat(job?.score) || 0
  const hasSplit = desirability != null && competitiveness != null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
      {(job?.company || job?.roleTitle) && (
        <div>
          {job.company && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>{job.company}</div>}
          {job.roleTitle && <div style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 15 : 17, fontWeight: 500, color: 'var(--marker-black)', lineHeight: 1.3 }}>{job.roleTitle}</div>}
        </div>
      )}

      {verdict && (
        <div style={{ fontSize: compact ? 12.5 : 14, color: 'var(--marker-black)', lineHeight: 1.6 }}>{verdict}</div>
      )}

      {hasSplit && (
        <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: compact ? '9px 10px' : '12px 14px' }}>
          <div style={{ display: 'flex', gap: 18, marginBottom: read ? 6 : 0 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Desirability</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 16 : 20, fontWeight: 500, color: 'var(--marker-black)' }}>{desirability}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Competitiveness</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 16 : 20, fontWeight: 500, color: 'var(--marker-black)' }}>{competitiveness}</div>
            </div>
          </div>
          {read && <div style={{ fontSize: compact ? 11 : 12, color: 'var(--marker-text)', lineHeight: 1.5 }}>{read}</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {job?.officeDays != null && <FactChip>{job.officeDays === 0 ? 'Remote' : `${job.officeDays}d office`}</FactChip>}
        {factors.salaryMarket?.note && <FactChip>{factors.salaryMarket.note}</FactChip>}
        {score > 0 && <FactChip>{score}/10 overall</FactChip>}
        {job?.signal && <FactChip highlight={job.signal === 'apply'}>{job.signal === 'dont_apply' ? "DON'T APPLY" : job.signal.toUpperCase()}</FactChip>}
      </div>

      {showFactors && job?.factors && (
        <div style={{ borderTop: '1px solid var(--marker-border)', paddingTop: 12, marginTop: 2 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Full factor breakdown</div>
          {FACTOR_META.map(({ key, label }) => <FactorBar key={key} label={label} factor={job.factors[key]} />)}
        </div>
      )}
    </div>
  )
}

// ── Engine tab — Analyse + LinkedIn tips + Pipeline summary ───────

export function buildLinkedInTips(profile) {
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

export const FOCUS_STAGES = [
  { id: 'active',       label: 'In play',      statuses: ['considering', 'to_apply', 'applied'] },
  { id: 'interviewing', label: 'Interviewing', statuses: ['interviewing'] },
  { id: 'outcome',      label: 'Outcome',      statuses: ['offer', 'rejected'] },
]

export function FocusPipelineView({ jobs, updateJob, deleteJob }) {
  const active = jobs.filter(j => !['watchlist', 'no_jobs'].includes(j.status))
    .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))

  if (active.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>No roles tracked yet</div>
        <div style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.7, maxWidth: 300, margin: '0 auto' }}>Score a role on the Score tab and add it to your pipeline. It will appear here.</div>
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
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '–'}</div>
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

// ── Journey stage system ─────────────────────────────────────────

export const JOURNEY = [
  { n: 1, label: 'Find roles',    full: 'Find your roles',      sub: 'Browse Discover and save anything that looks right.',               tab: 'Discover', cta: 'Go to Discover'    },
  { n: 2, label: 'Score them',    full: 'Score your saves',     sub: 'Paste each URL into the scorer; see which are actually worth your time.', tab: 'Today',    cta: 'Score a role'      },
  { n: 3, label: 'Apply',         full: 'Apply to your best',   sub: 'Take your top-scored role seriously. Use the CV generator, write a real cover letter.', tab: 'CV', cta: 'Open CV generator' },
  { n: 4, label: 'Follow up',     full: 'Track and follow up',  sub: 'Applications are out. A short follow-up email can make the difference.',  tab: 'Pipeline', cta: 'View pipeline'     },
  { n: 5, label: 'Interview',     full: 'Prepare to win',       sub: "You're in a live interview process. Prep before anything else.",         tab: 'Interview', cta: 'Interview prep'    },
]

export function getJourneyStage(jobs) {
  if (jobs.filter(j => j.status === 'interviewing').length > 0) return 5
  if (jobs.filter(j => ['applied', 'offer'].includes(j.status)).length > 0) return 4
  const active = jobs.filter(j => !['watchlist', 'no_jobs', 'rejected'].includes(j.status))
  if (active.filter(j => parseFloat(j.score) > 0).length > 0) return 3
  if (active.length > 0) return 2
  return 1
}

// ── Aggregator Tab — disciplined daily sweep of channels we can't ingest ──
// Legal boundary (see the file-header HARD RULE above): every link here is
// build-a-URL-and-send-them-out, never a scrape. Requite holds zero data
// from LinkedIn, Indeed, or Adzuna's public search beyond the URL itself.

export const CHANNEL_CADENCE_LABEL = { indeed: 'Daily', linkedin: 'Daily', adzuna: 'Every 2-3 days', target_companies: 'Every 2-3 days' }
export const MAX_BRING_IN_BATCH = 10

// Hour-level granularity (unlike the file's other timeAgo helper, which
// only goes down to "today"/"yesterday") -- a daily cadence needs to
// distinguish "checked 1h ago" from "checked 20h ago", both of which
// would otherwise read as the same "today".
export function channelTimeAgo(iso) {
  if (!iso) return 'Not checked yet'
  const ms = Date.now() - new Date(iso).getTime()
  const hrs = Math.floor(ms / (60 * 60 * 1000))
  if (hrs < 1) return 'Checked just now'
  if (hrs < 24) return `Checked ${hrs}h ago`
  return `Checked ${Math.floor(hrs / 24)}d ago`
}

export function JourneyBar({ jobs, activeTab, onTabSwitch }) {
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

// ── Why bullets — plain-English explanations from factor data ────────
export function buildWhyBullets(job, profile) {
  const bullets = []
  const bd = (() => { try { return typeof job.scoreBreakdown === 'string' ? JSON.parse(job.scoreBreakdown) : (job.scoreBreakdown || {}) } catch { return {} } })()
  const factors = job.factors || bd.factors || {}
  const maxDays = profile?.max_office_days ?? 2

  const officeDays = job.officeDays ?? bd.officeDays
  if (typeof officeDays === 'number') {
    if (officeDays === 0) bullets.push('Fully remote, matching your working preferences')
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
    bullets.push(salaryStr ? `Salary ${salaryStr} , above your stated minimum` : 'Advertised salary is above your stated minimum')
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
export const DAILY_INSIGHTS = [
  'Following up on an application after a week rarely hurts, and most candidates never bother.',
  'A role can close quickly once a strong candidate applies. If something scores 7 or higher, it is worth applying sooner rather than letting it sit.',
  'Echoing a few of the JD\'s own keywords in your CV opening paragraph is a simple way to signal genuine fit at a glance, to a human reader as much as any system.',
  'Good hiring managers do read cover letters. Three focused paragraphs usually beat a generic one.',
  'Practising your answer to "walk me through your background" out loud cuts interview nerves by more than you expect.',
]

export const TAB_TOOLTIPS = {
  Today:      'Your daily hub: score roles, see your week at a glance, and get back on track fast',
  Pipeline:   'Manage your active roles across stages. Stats at the bottom.',
  Discover:   'Your personalised job feed and target company shortlist',
  Aggregator: 'Pre-filled search links for LinkedIn, Indeed and Adzuna, built from your profile, plus a cadence tracker for your daily sweep',
  WLB:        'Curated employer reference: Glassdoor WLB scores, parental leave, and office days before you commit to applying',
  CV:         'Generate a tailored CV or cover letter for any pipeline role, with a copy-paste option if you would rather use your own AI tool',
  Interview:  'Full interview prep pack: company research, questions, STAR stories',
  Referrals:  'The people you know: draft warm referral asks, reconnects, and speculative outreach',
  Contractor: 'Curated employer list, recruiter directory, and live contract role scan',
  Profile:    'Everything Requite knows about you: your CV, target roles, and preferences. Most fields are editable here; career history is edited in Settings.',
}

// plan: 'free' | 'trial' | 'perm' | 'contractor' | 'both'
// During free/trial: use user's searchMode preference (full access for onboarding/testing)
// On a paid plan: the plan IS the searchMode — overrides user preference
export function resolveSearchMode(profile, plan) {
  const hfj = profile?.hard_filters_json || {}
  const userPref = hfj.searchMode || (hfj.openToContract === true ? 'both' : 'perm')
  if (plan === 'perm') return 'perm'
  if (plan === 'contractor') return 'contractor'
  if (plan === 'both') return 'both'
  return userPref // free / trial: honour user preference, show all they've chosen
}

export function buildTabs(profile, plan = 'trial') {
  const hfj = profile?.hard_filters_json || {}
  const searchMode = resolveSearchMode(profile, plan)
  const tabs = ['Today', 'Pipeline', 'Discover', 'Aggregator', 'WLB']
  if (searchMode !== 'contractor') {
    if (hfj.wantsCvGen !== false) tabs.push('CV')
    if (hfj.wantsInterviewPrep !== false) tabs.push('Interview')
  } else {
    tabs.push('CV')
  }
  // Referrals apply equally to perm and contractor search — the channel
  // that lands most real hires doesn't care which mode a user is in.
  tabs.push('Referrals')
  if (searchMode !== 'perm') tabs.push('Contractor')
  tabs.push('Profile')
  return tabs
}

// ── Plan gate — shown when a feature isn't on the user's plan ──────
export function PlanGate({ feature, requiredPlan, currentPlan }) {
  const planNames = { perm: 'Free', contractor: 'Requite Pro (£19/mo)', both: 'Requite Pro (£19/mo)', free: 'Free', pro: 'Requite Pro (£19/mo)', max: 'Requite Max (£39/mo)' }
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

export const TRACK_LABELS = { balanced: 'Balanced', standard: 'Standard', parent: 'Parent', returner: 'Returner', career_changer: 'Career changer' }

export function GettingStartedPanel({ profile, jobs, onProfileSaved, onTabSwitch }) {
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
  const pbExample = dailyPick(QUICK_PROFILE_EXAMPLES)
  const [suppText, setSuppText] = useState('')
  const [suppSaving, setSuppSaving] = useState(false)

  const steps = [
    // Step 1: profile — only show if genuinely no profile data (post-onboarding this should never show)
    !hasCv && { id: 'profile', label: 'Tell us about yourself', detail: 'A bit more background helps Claude score roles accurately for you' },
    cvThin && { id: 'supplement', label: 'Strengthen your profile', detail: 'Your profile is thin. A few more details will meaningfully improve your scores.' },
    // Step 2: discovery before scoring
    !hasPipeline && !hasScored && { id: 'discover', label: 'Find your first roles', detail: 'Go to the Discover tab. Browse your company list and job feed, then come back here to score anything that looks right' },
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
      const { data: p } = await supabase.from('profiles').select('hard_filters_json').eq('user_id', user.id).single()
      const existing = p?.hard_filters_json || {}
      await supabase.from('profiles').update({ hard_filters_json: { ...existing, cvRaw: newCvRaw } }).eq('user_id', user.id)
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
      const { data: p } = await supabase.from('profiles').select('hard_filters_json').eq('user_id', user.id).single()
      const existing = p?.hard_filters_json || {}
      const updated = (existing.cvRaw || '') + `\n\nAdditional context:\n${suppText.trim()}`
      await supabase.from('profiles').update({ hard_filters_json: { ...existing, cvRaw: updated } }).eq('user_id', user.id)
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
                        <input value={pbTitle} onChange={e => setPbTitle(e.target.value)} placeholder={`Current job title + employer (e.g. ${pbExample.title})`} style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-body)', border: '1px solid var(--marker-border)', borderRadius: 7, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                        <input value={pbSkills} onChange={e => setPbSkills(e.target.value)} placeholder={`Key skills, comma separated (e.g. ${pbExample.skills})`} style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-body)', border: '1px solid var(--marker-border)', borderRadius: 7, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                        <input value={pbHighlight} onChange={e => setPbHighlight(e.target.value)} placeholder={`Biggest career win, one line (e.g. ${pbExample.highlight})`} style={{ padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-body)', border: '1px solid var(--marker-border)', borderRadius: 7, background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
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

