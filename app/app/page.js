'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { loadJobs, saveJobs, updateJobInDb, deleteJobFromDb, getProfile } from '../../lib/db'
import { createClient } from '../../lib/supabase/client'
import { Packer } from 'docx'
import { buildCvDocx } from '../../lib/cv-docx'
import FreshnessPulse from '../../components/FreshnessPulse'
import { hashText } from '../../lib/text-hash'

// HARD, NON-REMOVABLE RULE (Session O legal hardening): Requite indexes and
// scores third-party job listings. It never republishes or intermediates
// the application itself. Every job link anywhere in this file MUST open
// in a new tab, straight to the original posting: target="_blank"
// rel="noopener noreferrer", href pointing at the source's own URL (job.url/
// job.link/job.jobLink/job.careersUrl), never an internal route. There is
// no in-app "submit application" flow anywhere in this codebase and there
// must never be one added -- that would cross the line from indexing into
// operating as the recruiter of record. Audited 2026-07-14: all job-link
// anchors in this file already satisfy this; any new one must too.
import MemoryCard from '../../components/MemoryCard'
import s from './dashboard.module.css'
import { buildChannelUrls, CHANNELS, CHANNEL_LABELS, CHANNEL_CADENCE_DAYS, isChannelOverdue } from '../../lib/channel-urls'
import { matchJob } from '../../lib/job-match'
import {
  Logo, AdzunaBadge, PasteJdCallout, ATS_PROVIDER_LABELS, sourceLabel, SourceLabel, scoreTierOf, ScoreBadge,
  OfficeBadge, SignalBadge, POSTED_WITHIN_OPTIONS, POSTED_WITHIN_KEY, usePostedWithin, withinPostedWindow,
  PostedWithinSelect, WeeklyPreferenceBox, FreshScanButton, FACTOR_LABELS, factorScoreColor, timeAgo, PipelineCard,
  useTutorial, FIRST_RUN_STEPS, useFirstRun, FirstRunGuide, TourBanner, ProgressBar, STEPS_ANALYSE, STEPS_SEARCH,
  STEPS_PREP, STEPS_CT_COMPANIES, STEPS_CT_ROLES, STEPS_CT_RECRUITERS, COLUMNS, describeDuplicateMatch,
  renderPrepMarkdown, INTERVIEW_STAGES, FUNNEL, EFFORT_LEVELS, buildCvFallbackPrompt, buildCoverLetterFallbackPrompt,
  RETURNSHIP_PROGRAMMES, PARENTAL_FRIENDLY_EMPLOYERS, SOURCE_LABELS, WISHLIST_SEEDS, BALANCED_COMPANIES, WLB_DATA,
  BALANCED_SECTORS, FACTOR_META, FactorBar, buildLinkedInTips, JOURNEY,
  CHANNEL_CADENCE_LABEL, MAX_BRING_IN_BATCH, channelTimeAgo,
  DAILY_INSIGHTS, TAB_TOOLTIPS, resolveSearchMode, buildTabs, PlanGate, TRACK_LABELS,
} from './shared'
import EngineTab from './tabs/EngineTab'
import AddJobModal from './modals/AddJobModal'
import EditJobModal from './modals/EditJobModal'
import TidyUpModal from './modals/TidyUpModal'
import PrepTab from './tabs/PrepTab'
import ReferralsTab from './tabs/ReferralsTab'
import StatsTab from './tabs/StatsTab'
import BalancedTab from './tabs/BalancedTab'
import AggregatorTab from './tabs/AggregatorTab'
import ContractorTab from './tabs/ContractorTab'
import CvTab from './tabs/CvTab'
import FeedTab from './tabs/FeedTab'
import TodayDashboard from './tabs/TodayDashboard'









export default function AppPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [dismissedJobs, setDismissedJobs] = useState([])
  const [dupeConfirm, setDupeConfirm] = useState(null) // { job, match } while a STRONG-match confirm is open
  const [tab, setTab] = useState('Today')
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
  const [prepPrefill, setPrepPrefill] = useState(null)
  const [referralPrefill, setReferralPrefill] = useState(null)
  const [trialEndsAt, setTrialEndsAt] = useState(null)
  const [trialDismissed, setTrialDismissed] = useState(false)
  const [plan, setPlan] = useState('trial') // 'free' | 'trial' | 'perm' | 'contractor' | 'both'
  const [pipelineSearch, setPipelineSearch] = useState('')
  const [checkingLinks, setCheckingLinks] = useState(false)
  const [tabTooltip, setTabTooltip] = useState(null)
  const [pipelineStatsOpen, setPipelineStatsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [expiredBannerDismissed, setExpiredBannerDismissed] = useState(false)
  const [tidyUpOpen, setTidyUpOpen] = useState(false)
  const [holdingOpen, setHoldingOpen] = useState(false)
  const [showEngineTour,   dismissEngineTour]   = useTutorial('engine')
  const [showPipelineTour, dismissPipelineTour] = useTutorial('pipeline')
  const [showCvTour,       dismissCvTour]       = useTutorial('cv')
  const [showInterviewTour,dismissInterviewTour] = useTutorial('interview')
  const [firstRunStep, advanceFirstRun, dismissFirstRun] = useFirstRun()

  const TABS = buildTabs(profile, plan)
  // Calm default nav (Stage 71 — UX plan step 5): the standard nav IS the
  // calm nav now, so it's a small primary set (the daily driver + the two
  // other legs of the core loop) plus everything else behind "More". Primary
  // mirrors Focus Mode's old Score/Track/Find shape exactly (proof it works
  // technically) but renders the REAL tabs, not Focus Mode's stripped ones —
  // nobody using standard mode today loses functionality. Toolkit is
  // computed as "everything else in TABS", not a second hardcoded list, so a
  // future tab added to buildTabs() automatically lands in the toolkit
  // rather than silently vanishing from the nav entirely.
  const PRIMARY_TAB_IDS = ['Today', 'Pipeline', 'Discover']
  const primaryTabs = TABS.filter(t => PRIMARY_TAB_IDS.includes(t))
  const toolkitTabs = TABS.filter(t => !PRIMARY_TAB_IDS.includes(t))
  const isToolkitActive = toolkitTabs.includes(tab)

  useEffect(() => {
    if (firstRunStep === 1) setTab('Discover')
  }, [firstRunStep])

  function handleFirstRunAdvance() {
    if (firstRunStep === 2) setTab('Today')
    advanceFirstRun()
  }

  // First run always ends on Today, the calm front door — whether the user
  // clicks all the way through the guide or dismisses it partway.
  function handleFirstRunDismiss() {
    setTab('Today')
    dismissFirstRun()
  }

  // Focus Mode retired (Stage 71) — the standard nav is now the calm nav
  // (primary tabs + the toolkit "More" reveal above), which supersedes
  // Focus Mode's opt-in Score/Track/Find collapse. FOCUS_STAGES /
  // FocusPipelineView are untouched in shared.js if this needs reversing —
  // same discipline as JourneyBar's retirement.
  const [moreOpen, setMoreOpen] = useState(false)

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
        // Today is the calm front door for everyone, including a genuinely
        // empty pipeline — its own Next Action nudge already directs an
        // empty-pipeline user to Discover with a clear CTA, so no forced
        // tab switch is needed here.
      }).catch(() => setLoaded(true))
    }).catch(() => {
      loadJobs().then(d => { setJobs(Array.isArray(d) ? d : []); setLoaded(true) }).catch(() => setLoaded(true))
    })
    fetch('/api/dismiss').then(r => r.ok ? r.json() : { records: [] }).then(d => setDismissedJobs(d.records || [])).catch(() => {})
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

  const refreshFeed = useCallback(async (opts) => {
    setFeedLoading(true)
    try {
      const d = await fetch(`/api/feed-cache${opts?.broaden ? '?broaden=1' : ''}`).then(r => r.ok ? r.json() : [])
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

  const commitJob = useCallback((job) => {
    const next = [...jobs, job]
    setJobs(next)
    saveJobs(next).catch(() => {})
  }, [jobs])

  // Dashboard-wide duplicate detection (Stage 58): every entry point that
  // adds a job to the pipeline (feed cards, wishlist, balanced/contractor
  // tabs, the single-role scorer, the Aggregator's own add button, manual
  // add) calls this one addJob, so the check lives here once instead of
  // being repeated at each call site. Deterministic string matching only
  // (lib/job-match.js) -- zero AI cost. A STRONG match pauses the add and
  // asks; a SOFT match never blocks, it just rides along on the job record
  // as a gentle, dismissable note.
  const addJob = useCallback((job) => {
    const records = [
      ...jobs.map(j => ({ id: j.id, source: 'pipeline', status: j.status, company: j.company, roleTitle: j.roleTitle, location: j.location, externalId: j.externalId, appliedAt: j.appliedAt })),
      ...dismissedJobs.map(d => ({ id: d.id, source: 'dismissed', company: d.company, roleTitle: d.roleTitle, location: d.location, externalId: d.externalId })),
    ]
    const match = matchJob({ company: job.company, roleTitle: job.roleTitle, location: job.location, externalId: job.externalId }, records)
    if (match?.tier === 'strong') {
      setDupeConfirm({ job, match })
      return
    }
    if (match?.tier === 'soft') {
      commitJob({ ...job, possibleDuplicateOf: { reason: match.reason, company: match.record.company, roleTitle: match.record.roleTitle, source: match.record.source, status: match.record.status } })
      return
    }
    commitJob(job)
  }, [jobs, dismissedJobs, commitJob])

  const deleteJob = useCallback((id) => {
    setJobs(prev => {
      const job = prev.find(j => j.id === id)
      if (job?.jobLink) {
        fetch('/api/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.jobLink, company: job.company, roleTitle: job.roleTitle, location: job.location, externalId: job.externalId }) }).catch(() => {})
      }
      return prev.filter(j => j.id !== id)
    })
    deleteJobFromDb(id).catch(() => {})
  }, [])

  const tailorCv = useCallback((job) => {
    setCvPrefill({ jobId: job.id, jobTitle: job.roleTitle || '', company: job.company || '' })
    setTab('CV')
  }, [])

  const openPrep = useCallback((job) => {
    setPrepPrefill({ jobId: job.id })
    setTab('Interview')
  }, [])

  const openReferral = useCallback((job) => {
    setReferralPrefill({ jobId: job.id })
    setTab('Referrals')
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const activeCol = COLUMNS[colIdx]
  const colJobs = jobs
    .filter(j => j.status === activeCol.id && !j.archived && !j.holdingArea)
    .filter(j => {
      if (!pipelineSearch.trim()) return true
      const q = pipelineSearch.toLowerCase()
      return (j.company || '').toLowerCase().includes(q) || (j.roleTitle || '').toLowerCase().includes(q)
    })
    .sort((a, b) => (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))

  // Feature: bulk select/move/delete — all plain DB writes via the existing
  // updateJob/deleteJob, no model calls.
  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAllInColumn() {
    setSelectedIds(prev => {
      const allSelected = colJobs.length > 0 && colJobs.every(j => prev.has(j.id))
      const next = new Set(prev)
      if (allSelected) colJobs.forEach(j => next.delete(j.id))
      else colJobs.forEach(j => next.add(j.id))
      return next
    })
  }
  function applyBulkStatus(newStatus) {
    if (!newStatus) return
    selectedIds.forEach(id => updateJob(id, { status: newStatus }))
    setSelectedIds(new Set())
    setBulkStatus('')
  }
  function applyBulkDelete() {
    selectedIds.forEach(id => deleteJob(id))
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
  }

  // Feature: expired-jobs banner — dead-linked or clearly stale active-stage
  // roles, offered as a one-click bulk archive (flag + hide, never delete).
  const expiredJobs = jobs.filter(j => !j.archived && j.deadLink && ['considering', 'to_apply', 'applied'].includes(j.status))
  function archiveAllExpired() {
    expiredJobs.forEach(j => updateJob(j.id, { archived: true }))
  }

  // Feature: "Help me tidy up" holding area — roles the tool moved aside for
  // this week. Not archived, not deleted, one click brings any of them back.
  const holdingJobs = jobs.filter(j => !j.archived && j.holdingArea)
  function returnFromHolding(id) {
    updateJob(id, { holdingArea: false })
  }

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
              <button onClick={() => router.push('/settings')} title="Settings — edit your profile, CV and criteria"
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', borderRadius: 7, padding: '6px 12px', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, cursor: 'pointer', lineHeight: 1, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 14 }}>⚙</span>
                Settings
              </button>
              <button onClick={signOut} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--marker-border)', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--marker-mid)' }} title="Sign out">
                {user?.email?.charAt(0).toUpperCase() || '?'}
              </button>
            </div>
          </div>

          <div className={s.tabScroll} style={{ display: 'flex', gap: 0, fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)' }}>
            {primaryTabs.map(t => (
              <button key={t} data-tab={t} onClick={() => { setTab(t); setTabTooltip(null) }} className={t === tab ? s.tabActive : ''} style={{ background: 'none', border: 'none', borderBottom: '3px solid transparent', padding: '0 10px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', color: t === tab ? 'var(--marker-black)' : 'var(--marker-mid)', fontWeight: t === tab ? 500 : 400, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3, position: 'relative' }}>
                {t}
                <span
                  title={TAB_TOOLTIPS[t]}
                  onClick={e => { e.stopPropagation(); setTabTooltip(tabTooltip === t ? null : t) }}
                  style={{ fontSize: 9, opacity: tabTooltip === t ? 0.9 : 0.6, cursor: 'help', lineHeight: 1, userSelect: 'none' }}
                >ⓘ</span>
              </button>
            ))}
            {/* "More" reveals the toolkit — everything in TABS that isn't a
                primary tab. Shows the active toolkit tab's own name instead
                of the bare "More" label when one is selected, so a user
                inside e.g. CV never loses track of where they are. */}
            <button onClick={() => { setMoreOpen(o => !o); setTabTooltip(null) }} className={isToolkitActive ? s.tabActive : ''} style={{ background: 'none', border: 'none', borderBottom: '3px solid transparent', padding: '0 10px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', color: isToolkitActive ? 'var(--marker-black)' : 'var(--marker-mid)', fontWeight: isToolkitActive ? 500 : 400, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
              {isToolkitActive ? tab : 'More'}
              <span style={{ fontSize: 9 }}>{moreOpen ? '▴' : '▾'}</span>
            </button>
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

          {/* Toolkit reveal — rendered at all times (display:none when
              collapsed, never unmounted) so every toolkit button keeps its
              data-tab attribute in the DOM. FeedTab.js's "WLB guide →" nudge
              switches tabs via document.querySelector('[data-tab="WLB"]')
              .click() rather than a prop callback; unmounting this panel
              conditionally would silently break that existing nudge the
              moment WLB left the primary row. Cheapest fix that needs zero
              changes to FeedTab.js. */}
          <div style={{ display: moreOpen ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, padding: '12px 16px', background: 'var(--marker-cream-2)', borderTop: '1px solid var(--marker-border)', borderBottom: '1px solid var(--marker-border)' }}>
            {toolkitTabs.map(t => (
              <button key={t} data-tab={t} onClick={() => { setTab(t); setMoreOpen(false); setTabTooltip(null) }} style={{ textAlign: 'left', background: t === tab ? 'var(--marker-black)' : '#fff', border: `1px solid ${t === tab ? 'var(--marker-black)' : 'var(--marker-border)'}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: t === tab ? 'var(--marker-cream)' : 'var(--marker-black)' }}>{t}</span>
                <span style={{ fontSize: 10.5, lineHeight: 1.4, color: t === tab ? 'rgba(255,255,255,0.65)' : 'var(--marker-mid)' }}>{TAB_TOOLTIPS[t]}</span>
              </button>
            ))}
          </div>

          <div className="holo-hairline" style={{ marginLeft: -16, marginRight: -16, marginTop: 8 }} />
        </div>
        <FirstRunGuide step={firstRunStep} onAdvance={handleFirstRunAdvance} onDismiss={handleFirstRunDismiss} />
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

      {/* ── Journey bar retired as a persistent element (calm-front-door
          redesign) — its "you're at stage X" value now lives as a slim
          line inside Today's Next Action card instead. JourneyBar itself
          is untouched in shared.js if this needs reversing. ── */}

      {/* ── Main content — centered ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 960, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

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

            {/* Expired jobs banner — dead-linked active-stage roles, one-click bulk archive */}
            {expiredJobs.length > 0 && !expiredBannerDismissed && (
              <div style={{ margin: '10px 16px 0', padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--marker-black)' }}>
                  <strong>{expiredJobs.length}</strong> role{expiredJobs.length !== 1 ? 's' : ''} in your pipeline {expiredJobs.length !== 1 ? 'have' : 'has'} a dead link. Archive them to keep your board current — the row stays, just hidden from active columns.
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={archiveAllExpired} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>Archive all</button>
                  <button onClick={() => setExpiredBannerDismissed(true)} style={{ background: 'none', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>Dismiss</button>
                </div>
              </div>
            )}

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
              <button
                onClick={() => setTidyUpOpen(true)}
                style={{ background: 'var(--marker-lime)', border: '1px solid var(--marker-black)', color: 'var(--marker-black)', padding: '7px 11px', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Help me tidy up
              </button>
            </div>

            {holdingJobs.length > 0 && (
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)' }}>
                <button onClick={() => setHoldingOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  <span>{holdingOpen ? '▾' : '▸'}</span>
                  <span>If you have time · {holdingJobs.length}</span>
                </button>
                {holdingOpen && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {holdingJobs.map(j => (
                      <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 10px', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 500 }}>{j.company}</span>
                          {j.roleTitle && <span style={{ color: 'var(--marker-mid)' }}> · {j.roleTitle}</span>}
                        </div>
                        <button onClick={() => returnFromHolding(j.id)} style={{ background: 'none', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '4px 9px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', flexShrink: 0 }}>Back to board</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bulk action bar — appears only when something is selected */}
            {selectedIds.size > 0 && (
              <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--marker-lime)', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--marker-black)' }}>{selectedIds.size} selected</span>
                <select
                  value={bulkStatus}
                  onChange={e => applyBulkStatus(e.target.value)}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--marker-black)', background: 'var(--marker-cream)', cursor: 'pointer' }}
                >
                  <option value="">Move to…</option>
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                {confirmBulkDelete ? (
                  <>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-black)' }}>Delete {selectedIds.size} role{selectedIds.size !== 1 ? 's' : ''}?</span>
                    <button onClick={applyBulkDelete} style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>Confirm delete</button>
                    <button onClick={() => setConfirmBulkDelete(false)} style={{ background: 'none', border: '1px solid var(--marker-black)', color: 'var(--marker-black)', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmBulkDelete(true)} style={{ background: 'none', border: '1px solid var(--marker-black)', color: 'var(--marker-black)', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>Delete</button>
                )}
                <button onClick={() => { setSelectedIds(new Set()); setConfirmBulkDelete(false) }} style={{ background: 'none', border: 'none', color: 'var(--marker-black)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', marginLeft: 'auto' }}>Clear</button>
              </div>
            )}

            {/* Column header */}
            <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {colJobs.length > 0 && (
                  <input type="checkbox"
                    checked={colJobs.every(j => selectedIds.has(j.id))}
                    onChange={toggleSelectAllInColumn}
                    title="Select all in this column"
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--marker-lime)' }}
                  />
                )}
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>{activeCol.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{colJobs.length} card{colJobs.length !== 1 ? 's' : ''} · sorted by score</div>
                </div>
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
                <div key={job.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <input type="checkbox"
                    checked={selectedIds.has(job.id)}
                    onChange={() => toggleSelect(job.id)}
                    style={{ width: 15, height: 15, marginTop: 14, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--marker-lime)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                <PipelineCard job={job}
                  onEditDetails={j => setEditingJob(j)}
                  onDelete={deleteJob}
                  onTailorCv={tailorCv}
                  onAskForReferral={openReferral}
                  onStatusChange={(id, newStatus) => updateJob(id, { status: newStatus })}
                  onDismissDuplicateFlag={id => updateJob(id, { possibleDuplicateOf: null })}
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
                  </div>
                </div>
              ))}

              {colJobs.length > 0 && (
                <div style={{ padding: '12px 4px 4px' }}>
                  <div className="holo-hairline" />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 4px 8px' }}>
                <div className="legal-line">AI-generated scores and summaries. Not professional career advice. Parental leave data sourced via web search. Verify directly with the employer before relying on it.</div>
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

        {/* ── Today tab — the calm front door. GettingStartedPanel is no
            longer a separate all-or-nothing swap; it's folded into
            TodayDashboard itself (still the same component, still
            self-hides once nothing's left to do), so there is one home
            for "what should I do now" instead of two. ── */}
        {tab === 'Today' && (
          <TodayDashboard
            profile={profile}
            jobs={jobs}
            addJob={addJob}
            updateJob={updateJob}
            onTabSwitch={setTab}
            onOpenPrep={openPrep}
            onOpenReferral={openReferral}
            plan={plan}
            onProfileSaved={cvRaw => setProfile(prev => ({ ...prev, hard_filters_json: { ...(prev?.hard_filters_json || {}), cvRaw } }))}
          />
        )}

        {/* ── Discover tab ── */}
        {tab === 'Discover' && <FeedTab jobs={jobs} addJob={addJob} feedJobs={feedJobs} feedLoading={feedLoading} profile={profile} defaultSubTab="find" onRefreshFeed={refreshFeed} recheckJob={recheckJob} recheckingJobs={recheckingJobs} dismissedJobs={dismissedJobs} />}

        {/* ── Aggregator tab ── */}
        {tab === 'Aggregator' && <AggregatorTab profile={profile} addJob={addJob} onTabSwitch={setTab} pipelineJobs={jobs} dismissedJobs={dismissedJobs} />}

        {/* ── WLB tab ── */}
        {tab === 'WLB' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--marker-border)' }}>
              <div className="kicker holo-text" style={{ marginBottom: 6 }}>Know before you apply</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>Employers actually worth working for.</div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>Real Glassdoor WLB scores, parental leave policies, and office expectations, so you can research culture before you commit to an application.</div>
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
                    Full prep pack for any role at <strong>Applied</strong> stage or beyond: company briefing, likely questions, and STAR frameworks tailored to the JD. Add your interviewer's name for targeted prep.
                  </TourBanner>
                )}
                <PrepTab jobs={jobs} profile={profile} updateJob={updateJob} onSwitchToPipeline={() => setTab('Pipeline')} prefill={prepPrefill} onClearPrefill={() => setPrepPrefill(null)} />
              </>
        )}

        {/* ── Referrals tab — candidate-side network outreach ── */}
        {tab === 'Referrals' && (
          <ReferralsTab jobs={jobs} profile={profile} prefill={referralPrefill} onClearPrefill={() => setReferralPrefill(null)} />
        )}

        {/* ── Contractor tab — contractor + both plans only ── */}
        {tab === 'Contractor' && (
          plan === 'perm'
            ? <PlanGate feature="Contractor routes" requiredPlan="contractor" currentPlan={plan} />
            : <ContractorTab profile={profile} jobs={jobs} addJob={addJob} />
        )}

        {/* ── Profile / Memory Card tab (G3) ── */}
        {tab === 'Profile' && <MemoryCard />}

      </div>

      {/* ── Bottom tab bar — mobile only (hidden ≥768px). Same primary +
          More split as the header, sharing the one moreOpen state — tapping
          More here opens the SAME toolkit panel rendered near the top of the
          sticky header (never a second, duplicate panel), scrolling there
          so it's visible from wherever the user was on the page. ── */}
      <div className={s.bottomNav}>
        {primaryTabs.map(t => ({ l: t === 'Discover' ? 'Find' : t === 'Pipeline' ? 'Pipe' : t, t })).map(({ l, t }) => (
          <button key={t} onClick={() => { setTab(t); setMoreOpen(false) }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px' }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: tab === t ? 'var(--marker-black)' : 'var(--marker-border)' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: tab === t ? 'var(--marker-black)' : 'var(--marker-mid)' }}>{l}</div>
          </button>
        ))}
        <button onClick={() => setMoreOpen(o => { const next = !o; if (next) window.scrollTo({ top: 0, behavior: 'smooth' }); return next })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px' }}>
          <div style={{ width: 18, height: 18, borderRadius: 4, background: (isToolkitActive || moreOpen) ? 'var(--marker-black)' : 'var(--marker-border)' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: (isToolkitActive || moreOpen) ? 'var(--marker-black)' : 'var(--marker-mid)' }}>More</div>
        </button>
      </div>

      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onAdd={addJob} />}
      {editingJob && <EditJobModal job={editingJob} onClose={() => setEditingJob(null)} onSave={j => updateJob(j.id, j)} onDelete={deleteJob} />}
      {tidyUpOpen && <TidyUpModal jobs={jobs} updateJob={updateJob} onClose={() => setTidyUpOpen(false)} />}

      {dupeConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 380, width: '100%' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Looks like you&apos;ve already handled this</div>
            <div style={{ fontSize: 13, color: 'var(--marker-black)', fontWeight: 500, marginBottom: 4 }}>{describeDuplicateMatch(dupeConfirm.match)}</div>
            <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 16 }}>
              {dupeConfirm.match.record.company} — {dupeConfirm.match.record.roleTitle}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { commitJob(dupeConfirm.job); setDupeConfirm(null) }} style={{ background: 'none', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--marker-text)' }}>Add anyway</button>
              <button onClick={() => setDupeConfirm(null)} className="btn btn-primary" style={{ fontSize: 13, padding: '9px 16px' }}>Skip it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── App footer — legal links ── */}
      <div style={{ borderTop: '1px solid var(--marker-border)', padding: '16px 16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        {[
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
          { label: 'Pricing', href: '/pricing' },
          { label: 'support@upstreaminsights.co.uk', href: 'mailto:support@upstreaminsights.co.uk' },
        ].map(({ label, href }) => (
          <a key={label} href={href} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>{label}</a>
        ))}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', letterSpacing: '0.04em' }}>· Job scores are AI estimates, not professional advice ·</span>
      </div>
    </div>
  )
}
