'use client'

// Presentation only. The decision this banner collects is owned and acted on
// by components/ConsentGate.js, which is what actually withholds analytics,
// performance monitoring and referral attribution until "Accept" is clicked.
// This component deliberately holds no storage logic of its own any more:
// previously it wrote a flag and hid itself while both buttons did exactly
// the same thing, and nothing downstream ever read the result.
export default function CookieBanner({ onChoose }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'var(--marker-black)',
      borderTop: '1px solid #222',
      padding: '16px 20px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      animation: 'fadeSlideIn 0.3s ease',
    }}>
      <div style={{ flex: '1 1 300px', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        We&apos;d like to use Vercel Analytics and Speed Insights to understand how Requite is used, and to remember if you arrived from someone&apos;s referral link. No advertising and no third-party tracking. Choose &ldquo;Necessary only&rdquo; and none of it loads: only the cookies that keep you signed in. See our{' '}
        <a href="/cookies" style={{ color: 'var(--marker-lime)', textDecoration: 'none' }}>Cookie Policy</a>.
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={() => onChoose('necessary')} style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.55)',
          padding: '8px 14px',
          borderRadius: 6,
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          NECESSARY ONLY
        </button>
        <button onClick={() => onChoose('accepted')} style={{
          background: 'var(--marker-lime)',
          border: 'none',
          color: 'var(--marker-black)',
          padding: '8px 14px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          ACCEPT
        </button>
      </div>
    </div>
  )
}
