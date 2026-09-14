'use client'

import { useState, useEffect } from 'react'
import { buildWhyBullets, VerdictCard, DAILY_INSIGHTS, getJourneyStage, JOURNEY, GettingStartedPanel } from '../shared'
import { CHANNELS, CHANNEL_LABELS, isChannelOverdue, buildChannelUrls } from '../../../lib/channel-urls'
import EngineTab from './EngineTab'

export default function TodayDashboard({ profile, jobs, addJob, updateJob, onTabSwitch, onOpenPrep, onOpenReferral, plan, onProfileSaved }) {
  const [scorerOpen, setScorerOpen] = useState(false)
  const [glanceOpen, setGlanceOpen] = useState(false)
  const [intros, setIntros] = useState([])
  const [channelChecks, setChannelChecks] = useState(null)

  useEffect(() => {
    fetch('/api/candidate/intros')
      .then(r => r.json())
      .then(d => setIntros(d.intros || []))
      .catch(() => {})
  }, [])

  // Same cadence read Aggregator uses — one shared channel_checks record
  // per channel, not a second tracking system. See lib/channel-urls.js.
  useEffect(() => {
    fetch('/api/aggregator/channel-click')
      .then(r => r.json())
      .then(setChannelChecks)
      .catch(() => setChannelChecks({}))
  }, [])

  function recordChannelClick(channel) {
    setChannelChecks(prev => ({ ...(prev || {}), [channel]: new Date().toISOString() }))
    fetch('/api/aggregator/channel-click', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel }),
    }).catch(() => {})
  }

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

  // A too-thin profile (no CV, no target roles) can't be scored against
  // anything — /api/analyse 500s on a genuinely empty profile. Show an
  // honest "still setting you up" card instead of ever reaching the
  // scorer, rather than let a not-quite-onboarded user hit that error.
  const hasProfile = !!(profile?.hard_filters_json?.cvRaw || (profile?.target_roles && profile.target_roles.length > 0))
  if (!hasProfile) {
    return (
      <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>STILL SETTING YOU UP</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-black)' }}>Add your CV or target roles to get started</div>
        <div style={{ fontSize: 13, color: 'var(--marker-mid)', maxWidth: 320, lineHeight: 1.6 }}>Requite needs at least your CV or a few target roles to score anything against. Add them in Settings, then come back here.</div>
        <a href="/settings" style={{ marginTop: 4, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', textDecoration: 'none', display: 'inline-block', fontWeight: 500 }}>Go to Settings →</a>
      </div>
    )
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

  // 'In interviews' used to be a nudge branch here, competing for the one
  // generic slot below with five other conditions. Promoted to its own
  // dedicated, unmissable section (Stage 67) instead — an active interview
  // should never be one condition away from being buried.
  let nudge = null
  if (followUps.length > 0) {
    nudge = { tag: 'Follow up today', msg: `${followUps.length} application${followUps.length !== 1 ? 's are' : ' is'} 7+ days old with no reply. Two minutes of outreach now.`, cta: 'View pipeline', tab: 'Pipeline' }
  } else if (unscoredReady.length >= 2) {
    nudge = { tag: 'Score your pipeline', msg: `${unscoredReady.length} saved roles have no score yet. Score before applying.`, cta: 'Score a role', action: () => setScorerOpen(true) }
  } else if (topUnacted) {
    nudge = { tag: 'Ready to apply', msg: `${topUnacted.company || topUnacted.roleTitle} scored ${topUnacted.score}. A strong match. Apply before it closes.`, cta: 'View pipeline', tab: 'Pipeline' }
  } else if (appliedThisWeek === 0 && activeJobs.length >= 3) {
    nudge = { tag: 'Apply this week', msg: `${activeJobs.length} roles saved, none applied this week. Pick your best and send.`, cta: 'View pipeline', tab: 'Pipeline' }
  } else if (activeJobs.length < 5) {
    nudge = { tag: 'Build your pipeline', msg: 'Aim for 5 to 8 roles before applying. More options means better decisions.', cta: 'Find roles', tab: 'Discover' }
  } else {
    nudge = { tag: 'Keep going', msg: 'Consistency wins more offers than sprints. Keep scoring and adding roles.', cta: 'Find roles', tab: 'Discover' }
  }

  const whyBullets = bestJob ? buildWhyBullets(bestJob, profile) : []

  const nudgeWhy = {
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

      {/* ── Getting started — folded in from its old separate all-or-
          nothing swap. Same component, unchanged internals; it already
          self-hides once its own step list is empty, so it naturally
          disappears as the user progresses rather than needing a trigger. ── */}
      <GettingStartedPanel
        profile={profile}
        jobs={jobs}
        onProfileSaved={onProfileSaved}
        onTabSwitch={onTabSwitch}
      />

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

      {/* ── Interview coming up (Stage 67) — a dedicated, unmissable reveal
          the moment any role hits Interviewing, not a tab left to hunt
          for. Deliberately its own section rather than sharing the single
          generic "Next action" slot below (an active interview should
          never lose to five other lower-stakes conditions). ── */}
      {interviewingJobs.length > 0 && (
        <div style={SEC}>
          <div style={KICKER}>Interview coming up</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {interviewingJobs.slice(0, 3).map(job => (
              <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--marker-black)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Interview coming up for {job.roleTitle || 'this role'}</div>
                </div>
                <button onClick={() => onOpenPrep?.(job)}
                  style={{ flexShrink: 0, background: 'var(--marker-lime)', color: 'var(--marker-black)', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Prep now →
                </button>
              </div>
            ))}
            {interviewingJobs.length > 3 && (
              <button onClick={() => onTabSwitch('Pipeline')}
                style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', padding: 0, textAlign: 'left', letterSpacing: '0.04em' }}>
                +{interviewingJobs.length - 3} more in pipeline →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Section 1: Best Opportunity Today ── */}
      <div style={SEC}>
        <div style={KICKER}>Best opportunity today</div>
        {bestJob ? (
          <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: 16 }}>
            <VerdictCard job={{ ...bestJob, factors: bestFactors }} />

            {whyBullets.length > 0 && (
              <div style={{ margin: '14px 0' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 7 }}>Why this role stands out</div>
                <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                  {whyBullets.map((b, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--marker-text)', lineHeight: 1.65, marginBottom: 3 }}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: whyBullets.length > 0 ? 0 : 14 }}>
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
              {onOpenReferral && (
                <button onClick={() => onOpenReferral(bestJob)}
                  style={{ background: 'transparent', color: 'var(--marker-black)', border: '1px solid var(--marker-border)', padding: '9px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                  Ask for a referral
                </button>
              )}
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
            {(() => {
              // Folded in from the retired persistent JourneyBar — the same
              // "you're at stage X" value, now a slim line here instead of
              // its own strip shown above every tab.
              const stage = getJourneyStage(jobs)
              const current = JOURNEY[stage - 1]
              return (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 10 }}>
                  Stage {stage} of {JOURNEY.length} · {current?.full}
                </div>
              )
            })()}
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

      {/* ── Channels to check today — surfaces the Aggregator's own cadence
          (same channel_checks table, same lib/channel-urls.js builders) as
          capped one-tap items, so a user doesn't have to know Aggregator
          exists to keep the daily sweep going. Capped to 2 visible items
          with a quiet overflow link — never a wall, and never a second
          cadence system. The Aggregator tab itself is untouched. ── */}
      {(() => {
        if (!channelChecks) return null
        const targetRoles = profile?.target_roles || []
        // Rotate which target role gets featured so target_roles[0] isn't
        // permanently treated as "the" priority role — a different one of
        // the user's own roles is featured each day, in stated rotation.
        const featuredRole = targetRoles.length > 0 ? targetRoles[Math.floor(now / DAY) % targetRoles.length] : null
        const dueChannels = CHANNELS.filter(c => {
          if (!isChannelOverdue(c, channelChecks[c])) return false
          return c === 'target_companies' || !!featuredRole
        })
        if (dueChannels.length === 0) return null
        const shown = dueChannels.slice(0, 2)
        const overflow = dueChannels.length - shown.length
        return (
          <div style={SEC}>
            <div style={KICKER}>Channels to check today</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shown.map(channel => {
                const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '10px 12px', textDecoration: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }
                const labelStyle = { fontSize: 13, color: 'var(--marker-black)', fontFamily: 'var(--font-body)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                const arrowStyle = { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', flexShrink: 0 }
                if (channel === 'target_companies') {
                  return (
                    <button key={channel} onClick={() => { recordChannelClick(channel); onTabSwitch('Discover') }} style={{ ...rowStyle, border: '1px solid var(--marker-border)' }}>
                      <span style={labelStyle}>Check your target companies</span>
                      <span style={arrowStyle}>→</span>
                    </button>
                  )
                }
                const url = buildChannelUrls(featuredRole, profile)[channel]
                return (
                  <a key={channel} href={url} target="_blank" rel="noopener noreferrer" onClick={() => recordChannelClick(channel)} style={rowStyle}>
                    <span style={labelStyle}>Check {CHANNEL_LABELS[channel]} for &quot;{featuredRole}&quot;</span>
                    <span style={arrowStyle}>→</span>
                  </a>
                )
              })}
            </div>
            {overflow > 0 && (
              <button onClick={() => onTabSwitch('Aggregator')}
                style={{ background: 'none', border: 'none', color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', padding: '10px 0 0', display: 'block', letterSpacing: '0.04em' }}>
                +{overflow} more in Aggregator →
              </button>
            )}
          </div>
        )
      })()}

      {/* ── Pipeline glance — a summary signal, never the board itself.
          Collapsed by default: one line of counts. Expands to counts by
          stage + the one thing needing attention + a deep link to the
          real Pipeline tab, which stays completely unchanged. ── */}
      {jobs.length > 0 && (() => {
        const parts = []
        if (activeJobs.length > 0) parts.push(`${activeJobs.length} in progress`)
        if (interviewingJobs.length > 0) parts.push(`${interviewingJobs.length} interviewing`)
        if (followUps.length > 0) parts.push(`${followUps.length} need${followUps.length === 1 ? 's' : ''} follow-up`)
        const summaryLine = parts.length > 0 ? parts.join(' · ') : `${jobs.length} tracked`
        return (
          <div style={SEC}>
            <button onClick={() => setGlanceOpen(o => !o)}
              style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <div>
                <div style={KICKER}>Pipeline glance</div>
                <div style={{ fontSize: 13, color: 'var(--marker-text)' }}>{summaryLine}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--marker-mid)', flexShrink: 0, marginLeft: 12 }}>{glanceOpen ? '▾' : '▸'}</span>
            </button>
            {glanceOpen && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                  {health.map(stat => (
                    <div key={stat.label} style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, lineHeight: 1, color: stat.count > 0 ? 'var(--marker-black)' : 'var(--marker-border)' }}>{stat.count}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.05em', marginTop: 4, textTransform: 'uppercase', color: 'var(--marker-mid)' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                {nudge && (
                  <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginBottom: 10, lineHeight: 1.5 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-black)', fontWeight: 600 }}>Needs attention · </span>
                    {nudge.msg}
                  </div>
                )}
                <button onClick={() => onTabSwitch('Pipeline')}
                  style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 14px', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}>
                  Open pipeline →
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Opportunities — one capped feed. Was two separate stacked
          sections (Recent Opportunities + Watchlist); merged per the
          calm-front-door redesign so Today shows one short list, not
          several. ── */}
      {(() => {
        const watchlisted = jobs.filter(j => j.status === 'watchlist')
        const feedItems = [...recentJobs, ...watchlisted]
          .sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0))
          .slice(0, 5)
        if (feedItems.length === 0) return null
        return (
          <div style={SEC}>
            <div style={KICKER}>Opportunities</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {feedItems.map(job => {
                const score = parseFloat(job.score) || 0
                const isWatch = job.status === 'watchlist'
                return (
                  <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: 'var(--marker-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.roleTitle || '–'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{isWatch ? 'watching' : (job.status || '').replace('_', ' ')}</span>
                      {score > 0 ? (
                        <div className={score >= 9 ? 'holo-foil' : ''} style={{
                          background: score >= 9 ? undefined : score >= 7 ? 'var(--marker-lime)' : score >= 5 ? 'var(--marker-cream)' : 'var(--marker-border)',
                          border: `1px solid ${score >= 9 ? 'transparent' : 'var(--marker-border)'}`,
                          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, padding: '2px 7px', borderRadius: 5, color: 'var(--marker-black)',
                        }}>{job.score}</div>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-border)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '2px 6px', borderRadius: 4 }}>–</span>
                      )}
                      {isWatch && (
                        <button onClick={() => { updateJob && updateJob(job.id, { status: 'considering' }) }} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '3px 8px', borderRadius: 4, cursor: 'pointer', letterSpacing: '0.04em' }}>Consider →</button>
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
              {plan === 'free' ? 'Free plan · 30 AI analyses/month' : `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`}
            </span>
          )}
          {plan === 'free' && (
            <a href="/pricing" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textDecoration: 'none' }}>Upgrade for unlimited AI →</a>
          )}
          <a href="/trust" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textDecoration: 'none' }}>Why trust Requite</a>
          <a href="mailto:support@upstreaminsights.co.uk" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textDecoration: 'none' }}>support@upstreaminsights.co.uk</a>
        </div>
      </div>

    </div>
  )
}
