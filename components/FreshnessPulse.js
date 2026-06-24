'use client'

const COLORS = {
  Fresh:   '#00C4A0',
  Aging:   '#F59E0B',
  Stale:   '#9CA3AF',
  Expired: '#EF4444',
}

// Freshness Pulse badge: colored dot + "verified Xh ago" text.
// Props:
//   freshness    — 'Fresh' | 'Aging' | 'Stale' | 'Expired'
//   relativeTime — '6h ago' | '3d ago' etc
//   compact      — if true, omit the text label (dot only)
export default function FreshnessPulse({ freshness, relativeTime, compact }) {
  if (!freshness) return null
  const color = COLORS[freshness] || COLORS.Stale
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: color, flexShrink: 0, display: 'inline-block',
      }} />
      {!compact && relativeTime && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--marker-mid)',
        }}>
          verified {relativeTime}
        </span>
      )}
    </span>
  )
}
