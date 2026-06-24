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

  return (
    <div style={{ border: '1px solid var(--marker-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--marker-cream-2)' }}>
      {/* Role header */}
      <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{role.source_type === 'requite_managed' ? 'Requite managed' : role.source_type} · {role.status}</span>
          </div>
          <div className="display-md" style={{ fontSize: 20, color: 'var(--marker-black)', marginBottom: 4 }}>{role.title}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {role.location && <Chip>{role.location}</Chip>}
            {role.salary_min && <Chip>£{role.salary_min}k{role.salary_max ? `–£${role.salary_max}k` : '+'}</Chip>}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="kicker">Anonymised shortlist — {shortlistData.shortlist.length} of {shortlistData.totalCandidates} candidates</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Identities hidden until mutual opt-in</div>
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
  const score = candidate.score
  const isTop = score >= 8

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
          {/* Dimension breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
            {Object.entries(candidate.dimensions || {}).map(([key, dim]) => (
              <DimBar key={key} label={DIM_LABELS[key] || key} score={dim?.score ?? 0} reason={dim?.reason} />
            ))}
          </div>
          {candidate.industries?.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginBottom: 10 }}>
              Background: {candidate.industries.join(', ')}
            </div>
          )}
          {/* Opt-in CTA — Stage 9 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button disabled className="btn btn-ghost" style={{ fontSize: 12, padding: '7px 14px', opacity: 0.5, cursor: 'not-allowed' }}>
              Request intro (Stage 9)
            </button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Warm-intro flow coming in the next update</span>
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
        <Link href="/app" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>Candidate view</Link>
      </div>
    </div>
  )
}

function Chip({ children }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.04em' }}>{children}</span>
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
