'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './marketing.module.css'

const tiers = [
  {
    name: 'Free',
    sub: '7-day trial',
    monthly: 0,
    annual: 0,
    detail: '3 scores · 30 quick checks',
    cta: 'Start free',
    flag: false,
  },
  {
    name: 'Standby',
    sub: 'Quietly looking',
    monthly: 4,
    annual: 3,
    detail: 'Weekly digest · 5 scores · 100 checks',
    cta: 'Choose Standby',
    flag: false,
  },
  {
    name: 'Lite',
    sub: 'Active hunt',
    monthly: 12,
    annual: 10,
    detail: '30 scores · 15 CVs · 15 letters',
    cta: 'Choose Lite',
    flag: false,
  },
  {
    name: 'Pro',
    sub: 'Going hard',
    monthly: 24,
    annual: 19,
    detail: '100 scores · 40 CVs · Interview prep',
    cta: 'Choose Pro',
    flag: true,
  },
]

export default function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className={styles.pricingSection}>
      <div className={styles.pricingHeader}>
        <div>
          <div className="kicker holo-text" style={{ marginBottom: 16 }}>Pricing</div>
          <h2 className="display-lg" style={{ fontSize: 'clamp(36px, 4vw, 56px)', color: 'var(--marker-black)' }}>
            Pay for what you use.<br />
            <span style={{ color: 'var(--marker-mid)' }}>Not for what you don't.</span>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: 4 }}>
          <button
            onClick={() => setAnnual(false)}
            style={{
              background: !annual ? 'var(--marker-black)' : 'transparent',
              color: !annual ? 'var(--marker-cream)' : 'var(--marker-text)',
              border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            style={{
              background: annual ? 'var(--marker-black)' : 'transparent',
              color: annual ? 'var(--marker-cream)' : 'var(--marker-text)',
              border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >
            Annual · −20%
          </button>
        </div>
      </div>
      <div className={styles.pricingGrid}>
        {tiers.map(p => {
          const price = annual ? p.annual : p.monthly
          return (
            <div key={p.name} style={{
              background: p.flag ? 'var(--marker-black)' : 'var(--marker-cream-2)',
              color: p.flag ? 'var(--marker-cream)' : 'var(--marker-text)',
              border: '1px solid ' + (p.flag ? 'var(--marker-black)' : 'var(--marker-border)'),
              borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column',
              gap: 18, minHeight: 360, position: 'relative',
            }}>
              {p.flag && (
                <div className="holo-foil" style={{
                  position: 'absolute', top: -1, right: -1,
                  color: 'var(--marker-black)', fontFamily: 'var(--font-mono)',
                  fontSize: 10, padding: '4px 10px', borderRadius: '0 12px 0 8px', letterSpacing: '0.06em',
                }}>
                  MOST CHOSEN
                </div>
              )}
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 13, opacity: p.flag ? 0.6 : 0.7, color: p.flag ? 'var(--marker-cream)' : 'var(--marker-mid)' }}>{p.sub}</div>
              </div>
              <div>
                <span className="display-xl" style={{ fontSize: 56, color: p.flag ? 'var(--marker-cream)' : 'var(--marker-black)' }}>
                  {price === 0 ? '£0' : `£${price}`}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: p.flag ? '#999' : 'var(--marker-mid)', marginLeft: 4 }}>
                  {annual && price > 0 ? '/ mo · billed annually' : '/ mo'}
                </span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: p.flag ? 'var(--marker-cream)' : 'var(--marker-text-soft)' }}>{p.detail}</div>
              <Link
                href="/auth"
                className={p.flag ? 'btn btn-lime' : 'btn btn-primary'}
                style={{ marginTop: 'auto', justifyContent: 'center' }}
              >
                {p.cta}
              </Link>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>
        Pro + BYO key · £7/mo · same as Pro, your own Anthropic key.&nbsp;&nbsp;Student? 50% off Lite with .ac.uk.
      </div>
    </section>
  )
}
