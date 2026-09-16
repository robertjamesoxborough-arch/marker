'use client'

import { useState, useEffect, Suspense } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import CookieBanner from './CookieBanner'
import RefCapture from './RefCapture'

export const CONSENT_KEY = 'mkr_cookie_consent'

// Owns the one piece of state that decides whether anything non-essential is
// allowed to run (Stage 74).
//
// WHAT WAS WRONG BEFORE.
// The banner wrote a flag and hid itself, and that was all it did. Analytics
// and Speed Insights were mounted unconditionally in the root layout, so they
// loaded and reported on every page view before the banner had been touched,
// and carried on identically whether the user clicked "Accept" or "Necessary
// only". The referral-attribution identifier was written to localStorage on
// landing, also before any choice. The choice presented to the user had no
// effect on anything, which is worse than presenting no choice at all.
//
// WHAT HAPPENS NOW.
// Nothing non-essential mounts until consent is an explicit "accepted".
// Declining genuinely declines: analytics never loads and the referral
// identifier is never written. The decision is also reversible, which consent
// has to be, via the control on /cookies.
//
// The root layout is a Server Component and cannot hold this state, which is
// why the gate lives here and the layout just renders it.
export default function ConsentGate() {
  // undefined = not yet read from storage (first paint, before useEffect).
  // Deliberately NOT defaulted to 'accepted': the pre-decision state must
  // behave exactly like a refusal, or the gate is decorative again.
  const [consent, setConsent] = useState(undefined)

  useEffect(() => {
    try {
      setConsent(localStorage.getItem(CONSENT_KEY) || null)
    } catch {
      // Storage blocked: treat as undecided-and-therefore-refused. The banner
      // will show on each visit, which is the honest outcome when we cannot
      // remember a choice, rather than silently assuming one.
      setConsent(null)
    }
  }, [])

  function choose(value) {
    try { localStorage.setItem(CONSENT_KEY, value) } catch {}
    setConsent(value)
  }

  const accepted = consent === 'accepted'

  return (
    <>
      {/* Referral attribution is growth tracking, not something the user
          asked for, so it waits for consent like everything else here. */}
      {accepted && <Suspense fallback={null}><RefCapture /></Suspense>}

      {consent === null && <CookieBanner onChoose={choose} />}

      {accepted && <Analytics />}
      {accepted && <SpeedInsights />}
    </>
  )
}
