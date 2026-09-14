'use client'

import { useState } from 'react'
import { matchJob } from '../../../lib/job-match'
import FreshnessPulse from '../../../components/FreshnessPulse'
import {
  useTutorial, buildLinkedInTips, WLB_DATA, SourceLabel, AdzunaBadge, TourBanner, WeeklyPreferenceBox,
  PostedWithinSelect, usePostedWithin, withinPostedWindow, FreshScanButton, RETURNSHIP_PROGRAMMES, PARENTAL_FRIENDLY_EMPLOYERS,
  VerdictCard,
} from '../shared'
import WishlistTab from './WishlistTab'
import WishlistJobsTab from './WishlistJobsTab'

export default function FeedTab({ jobs: pipelineJobs, addJob, feedJobs, feedLoading, profile, defaultSubTab, onRefreshFeed, recheckJob, recheckingJobs, dismissedJobs }) {
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
  const [refreshCooldownMsg, setRefreshCooldownMsg] = useState(false)
  const [postedWithinDays, setPostedWithinDays] = usePostedWithin(14)
  const [sortBy,           setSortBy]           = useState('relevance') // 'relevance' | 'date' | 'salary'
  const [minRelevance,     setMinRelevance]     = useState(0)           // 0 = any, else minimum relevanceScore
  const [includeOutOfArea, setIncludeOutOfArea] = useState(false)
  const [showWebTour,      dismissWebTour]      = useTutorial('feed_web')
  const [showWishlistTour, dismissWishlistTour] = useTutorial('feed_wishlist')

  async function handleRefresh() {
    try {
      const last = parseInt(localStorage.getItem('mkr_feed_refresh') || '0', 10)
      if (Date.now() - last < 60 * 60 * 1000) {
        setRefreshCooldownMsg(true)
        setTimeout(() => setRefreshCooldownMsg(false), 4000)
        return
      }
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

  // Dashboard-wide duplicate detection (Stage 58): addedLinks above only
  // catches an exact URL match, which is exactly what this feature exists
  // to fix — the same real job shows up under a different URL from a
  // different source. A STRONG content match against the user's own
  // pipeline/dismissed history is filtered out of the feed the same way;
  // SOFT matches are left visible (never asserted, and hiding a card the
  // user hasn't seen yet on a mere guess would be a real false negative).
  const dupeRecords = pipelineJobs.map(j => ({
    id: j.id, source: 'pipeline', status: j.status, company: j.company, roleTitle: j.roleTitle, location: j.location, externalId: j.externalId, appliedAt: j.appliedAt,
  })).concat((dismissedJobs || []).map(d => ({
    id: d.id, source: 'dismissed', company: d.company, roleTitle: d.roleTitle, location: d.location, externalId: d.externalId,
  })))
  const isStrongDupe = j => matchJob({ company: j.company, roleTitle: j.roleTitle, location: j.location, externalId: j.externalId }, dupeRecords)?.tier === 'strong'

  const webJobs = feedJobs.filter(j => !['gov', 'gov_search'].includes(j.source) && !localDismissed.has(j.id) && !addedLinks.has(j.link) && !isStrongDupe(j))
  const govJobs = feedJobs.filter(j =>  ['gov', 'gov_search'].includes(j.source) && !localDismissed.has(j.id) && !addedLinks.has(j.link) && !isStrongDupe(j))

  function dismissJob(job) {
    const jobId = job?.id ?? job
    setLocalDismissed(prev => new Set([...prev, jobId]))
    fetch('/api/dismiss', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeof job === 'object' ? { jobId, company: job.company, roleTitle: job.roleTitle, location: job.location, externalId: job.externalId } : { jobId }),
    }).catch(() => {})
  }

  // Adzuna links are a redirect, not the real employer careers page; they
  // can also expire or change. Resolve to the real destination before
  // saving into the pipeline, so a link opened weeks later still works.
  // No AI cost -- pure HTTP redirect following (app/api/resolve-url). Never
  // blocks the add action: falls back to the original link on any failure.
  async function addToPipeline(job, source) {
    let link = job.link
    if (job.source === 'adzuna' || job.adzunaAttributionRequired) {
      try {
        const res = await fetch('/api/resolve-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: job.link }) })
        const data = await res.json()
        if (data.resolved) link = data.resolved
      } catch {}
    }
    addJob({
      id: crypto.randomUUID(),
      jobCacheId: job.id || null,
      company: job.company,
      roleTitle: job.roleTitle,
      jobLink: link,
      link,
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
    dismissJob(job)
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
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '–'}</div>
            <div style={{ marginTop: 2 }}><SourceLabel job={job} /></div>
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
                    setCardScores(prev => ({ ...prev, [job.id]: { score: d.score, signal: d.signal, signalReason: d.signalReason, factors: d.factors, officeDays: d.officeDays, loading: false } }))
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
          {isAdzuna && <AdzunaBadge />}
        </div>
        {/* Verdict — replaces the raw score-only badge once a card is
            scored (Stage 66): plain-English read + desirability/
            competitiveness split before any more numbers. */}
        {csScore > 0 && (
          <div style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <VerdictCard job={{ score: cs.score, signal: cs.signal, signalReason: cs.signalReason, factors: cs.factors, officeDays: cs.officeDays }} compact />
          </div>
        )}
        {/* CTA row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderTop: '1px solid var(--marker-border)', paddingTop: 8 }}>
          {job.link && (
            <a href={job.link} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'var(--marker-black)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              View JD ↗
            </a>
          )}
          <button onClick={() => !isAdded && addToPipeline(job, source)} disabled={isAdded}
            style={{ background: isAdded ? 'var(--marker-lime)' : 'var(--marker-black)', color: isAdded ? 'var(--marker-black)' : 'var(--marker-cream)', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: isAdded ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
            {isAdded ? '✓ Added to pipeline' : 'Add to pipeline'}
          </button>
          {!isAdded && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>→ Considering</span>}
          <button onClick={() => dismissJob(job)}
            style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '6px 10px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 500, cursor: 'pointer', letterSpacing: '0.04em' }}>Dismiss</button>
        </div>
      </div>
    )
  }

  // Client-side sort: default mirrors the server's relevance ranking
  // (feed-cache already sorts by it); "Newest" / "Salary" re-sort the same
  // already-fetched page, no re-fetch needed.
  function parseSalaryClient(s) {
    if (!s) return null
    const nums = String(s).match(/[\d.]+/g)
    if (!nums || nums.length === 0) return null
    const vals = nums.map(Number).filter(n => !isNaN(n)).map(n => n < 1000 ? n * 1000 : n)
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }
  function applySort(list) {
    const sorted = [...list]
    if (sortBy === 'date') sorted.sort((a, b) => new Date(b.foundAt || b.created || 0) - new Date(a.foundAt || a.created || 0))
    else if (sortBy === 'salary') sorted.sort((a, b) => (parseSalaryClient(b.salary) ?? -1) - (parseSalaryClient(a.salary) ?? -1))
    else sorted.sort((a, b) => (b.relevanceScore ?? -1) - (a.relevanceScore ?? -1))
    return sorted
  }

  const filteredWeb = applySort(webJobs
    .filter(j => withinPostedWindow(j.foundAt || j.created, postedWithinDays))
    .filter(j => minRelevance === 0 || (j.relevanceScore ?? 0) >= minRelevance)
    .filter(j => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (j.roleTitle || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q) || (j.location || '').toLowerCase().includes(q)
    }))
  const filteredGov = applySort(govJobs
    .filter(j => withinPostedWindow(j.foundAt || j.created, postedWithinDays))
    .filter(j => minRelevance === 0 || (j.relevanceScore ?? 0) >= minRelevance)
    .filter(j => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (j.roleTitle || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q)
    }))
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
              { id: 'companies',     label: 'Target Companies' },
              { id: 'live',          label: 'Live Roles' },
              { id: 'wishlist_jobs', label: 'Wishlist Roles' },
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
                  Companies are generated from your profile. <strong>Hiring now</strong> means open roles are live right now. Add any you want, even if they don't post publicly.
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
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginTop: 2, letterSpacing: '0.04em' }}>COPY THESE STRINGS: SURFACES ROLES BEFORE THEY HIT JOB BOARDS</div>
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
              These roles refresh every night. Anything dismissed stays hidden. Hit <strong>SCORE</strong> on a role to get your 8-factor match score before deciding whether to add it to your pipeline.
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
            <WeeklyPreferenceBox />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
              <PostedWithinSelect days={postedWithinDays} onChange={setPostedWithinDays} />
              <button onClick={handleRefresh} disabled={refreshing}
                style={{ background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', cursor: refreshing ? 'default' : 'pointer', letterSpacing: '0.04em', padding: 0 }}>
                {refreshing ? 'REFRESHING…' : '↻ REFRESH'}
              </button>
              {refreshCooldownMsg && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Refreshed &lt;1h ago. Check back later.</span>}
            </div>
            {/* Sort + filter row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--marker-border)', background: 'var(--marker-cream)', fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}>
                <option value="relevance">Sort: Best match</option>
                <option value="date">Sort: Newest</option>
                <option value="salary">Sort: Salary</option>
              </select>
              <select value={minRelevance} onChange={e => setMinRelevance(Number(e.target.value))}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--marker-border)', background: 'var(--marker-cream)', fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}>
                <option value={0}>Any relevance</option>
                <option value={6}>6+ match</option>
                <option value={8}>8+ match</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeOutOfArea}
                  onChange={e => { const v = e.target.checked; setIncludeOutOfArea(v); onRefreshFeed?.({ broaden: v }) }} />
                Include out-of-area roles
              </label>
            </div>
            <div style={{ marginTop: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
                {feedSource === 'gov'
                  ? `${filteredGov.length} CIVIL SERVICE ROLES`
                  : `${filteredWeb.length} OF ${webJobs.length} · NIGHTLY SCAN`}
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <FreshScanButton endpoints={['/api/feed-web', '/api/feed-gov']} onScanComplete={onRefreshFeed} maxDaysOld={postedWithinDays} />
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
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-black)', opacity: 0.5, marginTop: 8, letterSpacing: '0.04em' }}>NEXT UPDATE: TONIGHT AFTER 3AM UTC</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', fontWeight: 500 }}>In the meantime:</div>
                  <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>Add target companies ↑</div>
                    <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginTop: 2, lineHeight: 1.4 }}>Build your shortlist above: companies you'd actually want to work for. Open roles surface automatically.</div>
                  </button>
                  <button onClick={() => { /* parent will handle tab switch */ document.querySelector('[data-tab="WLB"]')?.click() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)' }}>WLB guide →</div>
                    <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginTop: 2, lineHeight: 1.4 }}>Browse 30+ UK employers with strong WLB scores: Glassdoor ratings, parental leave, and office expectations.</div>
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
              {showWebAdzuna && <div className="legal-line" style={{ paddingTop: 8 }}>Job listings provided by Adzuna. Roles pulled nightly. Match scores are AI estimates based on your profile, not guarantees. Not affiliated with employers listed.</div>}
              {!showWebAdzuna && filteredWeb.length > 0 && <div className="legal-line" style={{ paddingTop: 8 }}>Roles pulled nightly from public career pages. Match scores are AI estimates, not guarantees. Not affiliated with employers listed.</div>}
            </div>
          )}
          {showReturnships && (
            <div style={{ padding: '16px 16px 0' }}>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--marker-border)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--marker-black)', marginBottom: 3 }}>Returnship programmes</div>
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.4 }}>Structured paid re-entry programmes at major UK employers. Click any to go directly to the programme page. Not all are open year-round.</div>
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
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.4 }}>UK employers with enhanced parental leave policies, worth researching if this matters to you. Always verify directly with the employer.</div>
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

          {/* Wishlist Roles view */}
          {discoverView === 'wishlist_jobs' && (
            <WishlistJobsTab jobs={pipelineJobs} addJob={addJob} />
          )}
        </div>
      )}

      {/* WLB guide moved to its own top-level tab */}
    </div>
  )
}
