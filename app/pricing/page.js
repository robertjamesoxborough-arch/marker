'use client'

export default function PricingPage() {
  const plans = [
    {
      id: 'perm',
      name: 'Marker',
      price: '£12',
      period: '/month',
      tagline: 'For the permanent job search',
      features: [
        'Job scoring — 8-factor AI match score on any role',
        'Nightly job feed filtered to your profile',
        'Company Scan — track and check your target employers',
        'Pipeline — manage your search across every stage',
        'CV tailoring prompts and cover letter generator',
        'Interview prep pack for any role',
        'WLB employer guide — culture data before you apply',
        '7-day free trial',
      ],
      cta: 'Start free trial',
      href: '/auth',
      highlight: false,
    },
    {
      id: 'contractor',
      name: 'Marker Contractor',
      price: '£16',
      period: '/month',
      tagline: 'For the contract and interim market',
      features: [
        'Everything in Marker',
        'Generic contractor CV generator — ready for recruiter blast',
        'Contractor role scanner — live contract and interim listings',
        'Agency finder — curated recruiter directory for your field',
        'Target company list weighted for companies that use contractors',
        '7-day free trial',
      ],
      cta: 'Start free trial',
      href: '/auth',
      highlight: true,
    },
    {
      id: 'both',
      name: 'Marker Pro',
      price: '£26',
      period: '/month',
      tagline: 'Perm and contractor — full toolkit',
      features: [
        'Everything in Marker and Marker Contractor',
        'All perm tools plus all contractor tools in one workspace',
        'Dual job feed — perm and contract roles together',
        'Switch between modes at any time in Settings',
        '7-day free trial',
      ],
      cta: 'Start free trial',
      href: '/auth',
      highlight: false,
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ padding: '32px 24px 0', maxWidth: 900, margin: '0 auto' }}>
        <a href="/" style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', textDecoration: 'none' }}>
          Marker<span style={{ display: 'inline-block', width: '0.22em', height: '0.22em', borderRadius: '50%', background: 'var(--marker-lime)', marginLeft: '0.04em', position: 'relative', top: '-0.62em', verticalAlign: 'baseline' }} />
        </a>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '60px 24px 48px', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 14 }}>Pricing</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.0, margin: '0 0 16px' }}>
          Your job search.<br />Ruthlessly efficient.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--marker-mid)', lineHeight: 1.7, margin: 0 }}>
          7-day free trial on every plan. No credit card required to start. Cancel any time.
        </p>
      </div>

      {/* Plans */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', padding: '0 24px 64px', maxWidth: 960, margin: '0 auto' }}>
        {plans.map(plan => (
          <div key={plan.id} style={{
            flex: '1 1 260px',
            maxWidth: 300,
            background: plan.highlight ? 'var(--marker-black)' : 'var(--marker-cream-2)',
            border: `1px solid ${plan.highlight ? 'var(--marker-black)' : 'var(--marker-border)'}`,
            borderRadius: 16,
            padding: '28px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {plan.highlight && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--marker-lime)', marginBottom: 14 }}>Most popular</div>
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

      {/* FAQ */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 28, textAlign: 'center' }}>Common questions</div>
        {[
          { q: 'How does the free trial work?', a: 'You get 7 days of full access with no credit card required. At the end of your trial you can subscribe to keep access — your pipeline and settings are preserved.' },
          { q: 'Can I switch plans later?', a: 'Yes. You can upgrade, downgrade, or switch between perm and contractor mode at any time from Settings.' },
          { q: 'What happens if I cancel?', a: 'Your account stays active until the end of the billing period. We do not charge cancellation fees. You can request a refund within 7 days of any charge.' },
          { q: 'Are the job scores guaranteed?', a: 'No. Scores are AI estimates based on your profile — they are a starting point for your own judgement, not a hiring prediction or professional recommendation. Read the full disclaimer in our Terms.' },
          { q: 'Where does job data come from?', a: 'Live roles come from Adzuna, who aggregate listings from thousands of job boards nightly. Company career page checks use publicly available career page data. WLB employer data is sourced from public Glassdoor scores, company disclosures, and employer surveys — always verify directly with the employer.' },
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
          <span>hello@marker.work</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', marginTop: 8, letterSpacing: '0.04em' }}>
          Marker · Robert Oxborough · England & Wales
        </div>
      </div>
    </div>
  )
}
