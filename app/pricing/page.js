'use client'

import { BRAND_NAME } from '../../lib/brand'

export default function PricingPage() {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '£0',
      period: 'forever',
      tagline: 'Start your search today',
      features: [
        'Pipeline board: track every stage of your search',
        'Job feed filtered to your profile, refreshed nightly',
        'AI job scoring: 3 scores per day',
        'Memory Card: everything Requite knows about you',
        'Basic AI intake and profile setup',
        'Honest limits shown upfront — no hidden paywalls',
      ],
      cta: 'Start free',
      href: '/auth',
      highlight: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '£19',
      period: '/month',
      tagline: 'For an active, serious search',
      features: [
        'Everything in Free',
        'Unlimited AI job scoring',
        'CV tailoring with verified-stats guardrail',
        'Interview prep pack for any role',
        'Salary benchmark and negotiation rehearsal',
        'Priority freshness: daily feed refresh',
        'Advanced filters and profile controls',
      ],
      cta: 'Choose Pro',
      href: '/auth',
      highlight: true,
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ padding: '32px 24px 0', maxWidth: 900, margin: '0 auto' }}>
        <a href="/" style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', textDecoration: 'none' }}>
          {BRAND_NAME.toLowerCase()}<span style={{ display: 'inline-block', width: '0.22em', height: '0.22em', borderRadius: '50%', background: 'var(--marker-lime)', marginLeft: '0.04em', position: 'relative', top: '-0.62em', verticalAlign: 'baseline' }} />
        </a>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '60px 24px 48px', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 14 }}>Pricing</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.0, margin: '0 0 16px' }}>
          Free for candidates.<br />We earn when you&apos;re hired.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--marker-mid)', lineHeight: 1.7, margin: 0 }}>
          Candidate tools are free. Employers pay 8% of first-year salary only when a hire is made.
        </p>
      </div>

      {/* Plans */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', padding: '0 24px 64px', maxWidth: 720, margin: '0 auto' }}>
        {plans.map(plan => (
          <div key={plan.id} style={{
            flex: '1 1 280px',
            maxWidth: 320,
            background: plan.highlight ? 'var(--marker-black)' : 'var(--marker-cream-2)',
            border: `1px solid ${plan.highlight ? 'var(--marker-black)' : 'var(--marker-border)'}`,
            borderRadius: 16,
            padding: '28px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {plan.highlight && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--marker-lime)', marginBottom: 14 }}>Most chosen</div>
            )}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: plan.highlight ? 'var(--marker-cream)' : 'var(--marker-black)', marginBottom: 4 }}>{plan.name}</div>
            <div style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'var(--marker-mid)', marginBottom: 20 }}>{plan.tagline}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 24 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, color: plan.highlight ? 'var(--marker-cream)' : 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1 }}>{plan.price}</span>
              <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'var(--marker-mid)' }}>{plan.period}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {plan.features.map(f => (
                <li key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.8)' : 'var(--marker-text)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--marker-lime)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a href={plan.href} style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              background: plan.highlight ? 'var(--marker-lime)' : 'var(--marker-black)',
              color: plan.highlight ? 'var(--marker-black)' : 'var(--marker-cream)',
            }}>
              {plan.cta}
            </a>
          </div>
        ))}
      </div>

      {/* Employer note */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 48px', textAlign: 'center' }}>
        <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 6 }}>Hiring instead of searching?</div>
          <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.7, marginBottom: 12 }}>Employers pay 8% of first-year salary on a successful hire, with a three-month guarantee. No subscription, no upfront fee.</div>
          <a href="/hire" style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)', textDecoration: 'underline' }}>Post a role →</a>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 28, textAlign: 'center' }}>Common questions</div>
        {[
          { q: 'Is the free tier really free?', a: 'Yes. The pipeline board, nightly job feed, Memory Card, and 3 AI scores per day are free with no trial period and no credit card required. Limits are shown upfront.' },
          { q: 'What does Pro include?', a: 'Unlimited AI scoring, full CV tailoring with our verified-stats guardrail, interview prep packs, salary benchmarks, and negotiation rehearsal tied to your tracked roles.' },
          { q: 'Can I cancel Pro?', a: 'Yes, at any time from Settings. Your account stays active until the end of the billing period. No cancellation fees. Refunds are available within 7 days of any charge.' },
          { q: 'Are the job scores guaranteed?', a: 'No. Scores are AI estimates based on your profile; they are a starting point for your own judgement, not a hiring prediction or professional recommendation. See the full disclaimer in our Terms.' },
          { q: 'Where does job data come from?', a: 'Live roles come from Adzuna, who aggregate listings from thousands of job boards nightly. WLB employer data is sourced from public Glassdoor scores and employer disclosures; always verify directly with the employer.' },
          { q: 'Is my CV data secure?', a: 'Your CV and profile data are stored encrypted in Supabase (AWS EU-West-1). When you use AI features, relevant portions are sent to Anthropic for processing under their API terms. We never sell your data or share it with employers.' },
        ].map(({ q, a }) => (
          <div key={q} style={{ borderBottom: '1px solid var(--marker-border)', padding: '20px 0' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>{q}</div>
            <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.7 }}>{a}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--marker-border)', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', lineHeight: 2 }}>
          <a href="/privacy" style={{ color: 'var(--marker-mid)', marginRight: 16 }}>Privacy Policy</a>
          <a href="/terms" style={{ color: 'var(--marker-mid)', marginRight: 16 }}>Terms of Service</a>
          <span>support@upstreaminsights.co.uk</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', marginTop: 8, letterSpacing: '0.04em' }}>
          Requite is a trading name of Robert Oxborough · England &amp; Wales
        </div>
      </div>
    </div>
  )
}
