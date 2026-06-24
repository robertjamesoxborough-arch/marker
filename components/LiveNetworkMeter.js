'use client'
import { useEffect, useState } from 'react'

export default function LiveNetworkMeter({ compact = false, sector = null }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/network-meter')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) {
    return compact
      ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>checking live count…</span>
      : null
  }

  const { roleCount, employerCount, candidateCount } = data
  const sectorLabel = sector ? ` in ${sector}` : ''

  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>
        <span className="holo-dot" style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0 }} />
        {roleCount === 0
          ? 'Launching — be a founding partner'
          : `${roleCount} managed role${roleCount !== 1 ? 's' : ''} live${sectorLabel}`}
      </span>
    )
  }

  return (
    <div style={{
      background: 'var(--marker-black)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      gap: 32,
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="holo-dot" style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live network</span>
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        <Stat n={roleCount} label="managed roles" />
        <Stat n={employerCount} label="hiring partners" />
        <Stat n={candidateCount} label="candidates in pool" />
      </div>
      {roleCount === 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 24 }}>
          No managed roles live yet — be a founding partner and get priority placement.
        </div>
      )}
    </div>
  )
}

function Stat({ n, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: n === 0 ? 'rgba(255,255,255,0.25)' : 'var(--marker-lime)', lineHeight: 1 }}>{n}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}
