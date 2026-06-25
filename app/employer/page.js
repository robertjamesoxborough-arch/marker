'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { BRAND_NAME } from '../../lib/brand'
import LiveNetworkMeter from '../../components/LiveNetworkMeter'

export default function EmployerDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [shortlists, setShortlists] = useState({}) // roleId → { shortlist, totalCandidates, loading }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      const [pRes, rRes] = await Promise.all([
        fetch('/api/employer/profile'),
        fetch('/api/employer/role'),
      ])
      const pData = await pRes.json()
      const rData = await rRes.json()

      if (!pData.profile) { router.replace('/hire'); return }
      setProfile(pData.profile)
      setRoles(rData.roles || [])
      setLoading(false)
    }
    load()
  }, [])

  const loadShortlist = useCallback(async (roleId) => {
    setShortlists(prev => ({ ...prev, [roleId]: { ...(prev[roleId] || {}), loading: true } }))
    const res = await fetch('/api/employer/shortlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId }),
    })
    const data = await res.json()
    setShortlists(prev => ({ ...prev, [roleId]: { shortlist: data.shortlist || [], totalCandidates: data.totalCandidates || 0, loading: false } }))
  }, [])

  if (loading) {
    return (
      <div style={PAGE}>
        <DashNav companyName="" />
        <div style={{ padding: '80px 64px', color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={PAGE}>
      <DashNav companyName={profile?.company_name || ''} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 64px 80px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="kicker" style={{ marginBottom: 8 }}>{profile.company_name}</div>
            <h1 className="display-lg" style={{ fontSize: 'clamp(28px, 4vw, 42px)', color: 'var(--marker-black)' }}>Your hiring pipeline</h1>
          </div>
          <Link href="/hire" className="btn btn-lime btn-iris-sheen" style={{ fontWeight: 600, fontSize: 14 }}>+ Post a new role</Link>
        </div>

        {/* Live Network Meter */}
        <div style={{ marginBottom: 40 }}>
          <LiveNetworkMeter sector={profile.sector} />
        </div>

        {/* Roles */}
        {roles.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {roles.map(role => (
              <RolePanel
                key={role.id}
                role={role}
                shortlistData={shortlists[role.id]}
                onLoadShortlist={() => loadShortlist(role.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RolePanel({ role, shortlistData, onLoadShortlist }) {
  const [expanded, setExpanded] = useState(false)

  function toggle() {
    setExpanded(e => !e)
    if (!expanded && !shortlistData) onLoadShortlist()
  }

  const statusColor = { active: 'var(--marker-lime)', paused: '#f5d840', closed: 'var(--marker-border)' }[role.status] || 'var(--marker-border)'

  // Count intros by status for the ATS strip
  const introStats = shortlistData?.shortlist
    ? shortlistData.shortlist.reduce((acc, c) => {
        acc[c.introStatus] = (acc[c.introStatus] || 0) + 1
        return acc
      }, {})
    : null

  return (
    <div style={{ border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--marker-cream-2)' }}>
      {/* Role header */}
      <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {role.source_type === 'requite_managed' ? 'Requite managed' : role.source_type} · {role.status}
            </span>
          </div>
          <div className="display-md" style={{ fontSize: 20, color: 'var(--marker-black)', marginBottom: 4 }}>{role.title}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {role.location && <Chip>{role.location}</Chip>}
            {role.salary_min && <Chip>£{role.salary_min}k{role.salary_max ? `–£${role.salary_max}k` : '+'}</Chip>}
            {/* ATS-light intro status strip */}
            {introStats && (
              <>
                {introStats['pending'] > 0 && <Chip style={{ background: 'rgba(245,216,64,0.2)', borderColor: '#f5d840', color: 'var(--marker-text)' }}>{introStats['pending']} pending</Chip>}
                {introStats['accepted'] > 0 && <Chip style={{ background: 'rgba(198,244,50,0.2)', borderColor: 'rgba(198,244,50,0.6)', color: 'var(--marker-text)' }}>{introStats['accepted']} connected</Chip>}
                {introStats['declined'] > 0 && <Chip>{introStats['declined']} declined</Chip>}
              </>
            )}
          </div>
        </div>
        <button
          onClick={toggle}
          className="btn btn-ghost"
          style={{ fontSize: 13, padding: '9px 16px', flexShrink: 0 }}>
          {expanded ? 'Hide shortlist ↑' : 'View shortlist ↓'}
        </button>
      </div>

      {/* Shortlist */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--marker-border)', padding: '24px' }}>
          {!shortlistData || shortlistData.loading ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Scoring candidates…</div>
          ) : shortlistData.shortlist.length === 0 ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
              No candidates in the pool yet. Share Requite with your network to grow the pool.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div className="kicker">Anonymised shortlist: {shortlistData.shortlist.length} of {shortlistData.totalCandidates} candidates</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Deterministic match · no AI</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Identities hidden until mutual opt-in</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shortlistData.shortlist.map((c, i) => (
                  <CandidateCard key={c.candidateRef} candidate={c} rank={i + 1} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CandidateCard({ candidate, rank }) {
  const [expanded, setExpanded] = useState(false)
  const [introStatus, setIntroStatus] = useState(candidate.introStatus || 'none')
  const [requesting, setRequesting] = useState(false)
  const score = candidate.score
  const isTop = score >= 8

  async function requestIntro() {
    if (!candidate.matchId || requesting) return
    setRequesting(true)
    try {
      const res = await fetch('/api/employer/intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: candidate.matchId }),
      })
      const data = await res.json()
      if (data.success || data.alreadyRequested) {
        setIntroStatus(data.status || 'pending')
      }
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div style={{
      background: 'var(--marker-cream)',
      border: `1px solid ${isTop ? 'rgba(198,244,50,0.5)' : 'var(--marker-border)'}`,
      borderRadius: 8,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Rank */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', width: 28, flexShrink: 0 }}>#{rank}</div>

        {/* Ref badge */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'var(--marker-black)', color: 'var(--marker-cream)', padding: '3px 7px', borderRadius: 4, letterSpacing: '0.06em', flexShrink: 0 }}>{candidate.candidateRef}</div>

        {/* Summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>
            {candidate.seniority}{candidate.targetRoles?.[0] ? ` · ${candidate.targetRoles[0]}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 2 }}>
            {candidate.locationArea}{candidate.maxOfficeDays != null ? ` · max ${candidate.maxOfficeDays}d/wk office` : ''}{candidate.salaryFloor ? ` · ${candidate.salaryFloor}` : ''}
          </div>
        </div>

        {/* ATS intro status pill */}
        {introStatus !== 'none' && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.05em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 4, flexShrink: 0,
            background: introStatus === 'accepted' ? 'rgba(198,244,50,0.2)' : introStatus === 'pending' ? 'rgba(245,216,64,0.2)' : 'var(--marker-cream-2)',
            border: `1px solid ${introStatus === 'accepted' ? 'rgba(198,244,50,0.6)' : introStatus === 'pending' ? '#f5d840' : 'var(--marker-border)'}`,
            color: 'var(--marker-text)',
          }}>
            {introStatus === 'pending' && '⏳ Pending'}
            {introStatus === 'accepted' && '✓ Connected'}
            {introStatus === 'declined' && 'Declined'}
          </div>
        )}

        {/* Score */}
        <div className={isTop ? 'holo-foil' : ''} style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
          background: isTop ? undefined : score >= 6 ? 'rgba(198,244,50,0.15)' : 'var(--marker-border)',
          border: `1px solid ${isTop ? 'transparent' : score >= 6 ? 'rgba(198,244,50,0.5)' : 'var(--marker-border)'}`,
          color: 'var(--marker-black)', flexShrink: 0,
        }}>
          {score >= 7 && score < 9 ? <span className="chrome-text">{score.toFixed(1)}</span> : score.toFixed(1)}
        </div>

        {/* Expand */}
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--marker-mid)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.04em', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--marker-border)' }}>
          {/* Dimension breakdown — deterministic score, no AI */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Score breakdown · deterministic algorithm · 6 dimensions · no AI
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
            {Object.entries(candidate.dimensions || {}).map(([key, dim]) => (
              <DimBar key={key} label={DIM_LABELS[key] || key} score={dim?.score ?? 0} reason={dim?.reason} />
            ))}
          </div>
          {candidate.industries?.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginBottom: 12 }}>
              Background: {candidate.industries.join(', ')}
            </div>
          )}

          {/* Intro CTA — live in Stage 9 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {introStatus === 'none' && (
              <button
                onClick={requestIntro}
                disabled={requesting || !candidate.matchId}
                className="btn btn-lime btn-iris-sheen"
                style={{ fontSize: 12, padding: '7px 16px', opacity: requesting ? 0.7 : 1 }}>
                {requesting ? 'Sending…' : 'Request intro'}
              </button>
            )}
            {introStatus === 'pending' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f5d840', flexShrink: 0, animation: 'marker-pulse 2s ease-in-out infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Intro requested. Awaiting candidate response.</span>
              </div>
            )}
            {introStatus === 'accepted' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="holo-dot" style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-text)', letterSpacing: '0.04em', fontWeight: 600 }}>Introduction confirmed</span>
                  {candidate.introRespondedAt && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
                      · {new Date(candidate.introRespondedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                {candidate.candidateEmail ? (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-text)', background: 'rgba(198,244,50,0.15)', border: '1px solid rgba(198,244,50,0.5)', padding: '5px 12px', borderRadius: 5 }}>
                    {candidate.candidateEmail}
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Contact details will appear here once confirmed.</div>
                )}
              </div>
            )}
            {introStatus === 'declined' && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Candidate declined. Consider the next match on the shortlist.</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DimBar({ label, score, reason }) {
  return (
    <div title={reason || ''} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: score >= 7 ? 'var(--marker-text)' : 'var(--marker-mid)' }}>{score.toFixed(1)}</span>
      </div>
      <div style={{ height: 3, background: 'var(--marker-border)', borderRadius: 2, overflow: 'hidden' }}>
        <div className={score >= 8 ? 'iris-progress' : ''} style={{ height: '100%', width: `${score * 10}%`, background: score >= 8 ? undefined : score >= 6 ? 'var(--marker-lime)' : 'var(--marker-mid)', borderRadius: 2 }} />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, marginBottom: 12, color: 'var(--marker-black)' }}>No roles yet</div>
      <p style={{ color: 'var(--marker-mid)', marginBottom: 24, fontSize: 15 }}>Post your first role to get a matched, anonymised candidate shortlist.</p>
      <Link href="/hire" className="btn btn-lime btn-iris-sheen" style={{ fontWeight: 600 }}>Post a role →</Link>
    </div>
  )
}

function DashNav({ companyName }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 64px', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream)', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--marker-black)', textDecoration: 'none' }}>
          {BRAND_NAME.toLowerCase()}<span className="holo-dot" style={{ display: 'inline-block', width: '0.28em', height: '0.28em', borderRadius: '50%', marginLeft: '0.05em', verticalAlign: 'super' }} />
        </Link>
        {companyName && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>{companyName}</span>}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Link href="/hire" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>+ Post role</Link>
        <Link href="/trust" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Why trust us</Link>
      </div>
    </div>
  )
}

function Chip({ children, style }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.04em', ...style }}>{children}</span>
  )
}

const DIM_LABELS = {
  roleFit: 'Role fit',
  seniorityFit: 'Seniority',
  locationFit: 'Location',
  compFit: 'Comp fit',
  freshness: 'Role freshness',
  cultureWlb: 'Culture / WLB',
}

const PAGE = { width: '100%', minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }
