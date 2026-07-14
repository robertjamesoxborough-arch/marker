'use client'

import Link from 'next/link'
import styles from './marketing.module.css'

const tiers = [
  {
    name: 'Free',
    sub: 'Start searching',
    monthly: 0,
    detail: 'Pipeline board · 30 AI scores/month · job feed · Memory Card',
    cta: 'Start free',
    flag: false,
  },
  {
    name: 'Pro',
    sub: 'Going all in',
    monthly: 19,
    detail: 'Unlimited AI · CV tailoring · interview prep · negotiation · priority feed',
    cta: 'Choose Pro',
    flag: true,
  },
  {
    name: 'Max',
    sub: 'Maximum firepower',
    monthly: 39,
    detail: '3× higher limits · 60 CV tailors · 30 interview packs · 30 negotiation packs',
    cta: 'Choose Max',
    flag: false,
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className={styles.pricingSection}>
      <div className={styles.pricingHeader}>
        <div>
          <div className="kicker holo-text" style={{ marginBottom: 16 }}>Pricing</div>
          <h2 className="display-lg" style={{ fontSize: 'clamp(36px, 4vw, 56px)', color: 'var(--marker-black)' }}>
            You pay us.<br />
            <span style={{ color: 'var(--marker-mid)' }}>So we work for you, not the employer.</span>
          </h2>
        </div>
      </div>
      <div className={styles.pricingGrid} style={{ maxWidth: 960, margin: '0 auto' }}>
        {tiers.map(p => (
          <div key={p.name} style={{
            background: p.flag ? 'var(--marker-black)' : 'var(--marker-cream-2)',
            color: p.flag ? 'var(--marker-cream)' : 'var(--marker-text)',
            border: '1px solid ' + (p.flag ? 'var(--marker-black)' : 'var(--marker-border)'),
            borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column',
            gap: 18, minHeight: 320, position: 'relative',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 13, opacity: p.flag ? 0.6 : 0.7, color: p.flag ? 'var(--marker-cream)' : 'var(--marker-mid)' }}>{p.sub}</div>
            </div>
            <div>
              <span className="display-xl" style={{ fontSize: 56, color: p.flag ? 'var(--marker-cream)' : 'var(--marker-black)' }}>
                {p.monthly === 0 ? '£0' : `£${p.monthly}`}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: p.flag ? '#999' : 'var(--marker-mid)', marginLeft: 4 }}>
                {p.monthly === 0 ? 'forever' : '/ mo'}
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
        ))}
      </div>
      <div style={{ marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', textAlign: 'center' }}>
        No employer subscriptions, no ad slots, no data sold. Your fee is the only thing that keeps this running.
      </div>
    </section>
  )
}
