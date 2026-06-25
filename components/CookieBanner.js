'use client'

import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const consent = localStorage.getItem('mkr_cookie_consent')
      if (!consent) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  function accept() {
    try { localStorage.setItem('mkr_cookie_consent', 'accepted') } catch {}
    setVisible(false)
  }

  function necessary() {
    try { localStorage.setItem('mkr_cookie_consent', 'necessary') } catch {}
    setVisible(false)
  }

  if (!visible) return null

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
        We use performance analytics (Vercel Analytics) to understand how Marker is used: no advertising, no third-party tracking, no cookies stored. See our{' '}
        <a href="/privacy" style={{ color: 'var(--marker-lime)', textDecoration: 'none' }}>Privacy Policy</a>.
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={necessary} style={{
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
        <button onClick={accept} style={{
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
