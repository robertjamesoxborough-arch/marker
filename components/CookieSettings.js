'use client'

import { useState, useEffect } from 'react'
import { CONSENT_KEY } from './ConsentGate'

const LABELS = {
  accepted:  'Analytics and referral attribution are on.',
  necessary: 'Necessary only. Analytics and referral attribution are off.',
}

// Consent has to be as easy to withdraw as it was to give, so this is the
// withdrawal route: it clears the stored choice and reloads, which brings the
// banner back and, critically, unmounts anything that was running under the
// old choice. Before Stage 74 there was no way to revisit the decision at all.
export default function CookieSettings() {
  const [consent, setConsent] = useState(undefined)

  useEffect(() => {
    try { setConsent(localStorage.getItem(CONSENT_KEY) || null) } catch { setConsent(null) }
  }, [])

  function reset() {
    try { localStorage.removeItem(CONSENT_KEY) } catch {}
    // Full reload rather than just clearing state: analytics, if it was
    // accepted, is already mounted and needs to actually stop.
    window.location.reload()
  }

  if (consent === undefined) return null

  return (
    <div style={{ padding: '14px 16px', border: '1px solid var(--marker-border)', borderRadius: 10, background: 'var(--marker-cream-2)' }}>
      <div style={{ fontSize: 14, marginBottom: 10 }}>
        <strong>Your current choice: </strong>
        {consent === null ? 'Not set yet. Nothing optional is running.' : (LABELS[consent] || 'Not set yet.')}
      </div>
      <button
        onClick={reset}
        style={{
          background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none',
          padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}
      >
        Change my choice
      </button>
      <div style={{ fontSize: 12, color: 'var(--marker-mid)', marginTop: 8, lineHeight: 1.6 }}>
        This clears your saved choice and reloads the page so you can choose again. Choosing &ldquo;Necessary only&rdquo; stops analytics loading at all, it does not merely hide it.
      </div>
    </div>
  )
}
