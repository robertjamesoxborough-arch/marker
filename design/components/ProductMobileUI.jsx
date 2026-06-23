// Product UI teaser — Pipeline (Kanban) view, mobile.
// Wrapped in iOS frame to anchor it as the in-product experience.

function ProductMobileUI() {
  const cards = [
    { co: 'Monzo', role: 'Staff PM', score: '9.2', signal: 'apply', office: '1d', salary: '£108k', wlb: '4.1', src: 'greenhouse' },
    { co: 'Nationwide', role: 'Head of Product', score: '8.8', signal: 'apply', office: '1d', salary: '£95k', wlb: '4.4', src: 'adzuna' },
    { co: 'GitLab', role: 'Sr PM, Growth', score: '7.6', signal: 'maybe', office: '0d', salary: '£110k', wlb: '4.2', src: 'greenhouse' },
    { co: 'Klarna', role: 'Director PM', score: '4.2', signal: 'skip', office: '3d', salary: '£140k', wlb: '3.1', reason: 'Office 3d. Quota culture.', src: 'adzuna' },
  ];

  return (
    <DCArtboard id="product-mobile" label="Product · Pipeline (iOS)" width={460} height={900}>
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--marker-cream)', padding: 20 }}>
        <IOSDevice width={402} height={860}>
          <div style={{
            width: '100%', height: '100%', overflow: 'hidden',
            background: 'var(--marker-cream)',
            fontFamily: 'var(--font-body)',
            color: 'var(--marker-text)',
            display: 'flex', flexDirection: 'column',
            paddingTop: 54, paddingBottom: 34,
          }}>

            {/* App header */}
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--marker-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Logo size={18} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div className="chip" style={{ fontSize: 9, padding: '3px 7px' }}>12/30 SCORES</div>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--marker-border)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--marker-mid)' }}>
                <span style={{ color: 'var(--marker-black)', fontWeight: 500, borderBottom: '2px solid var(--marker-black)', paddingBottom: 6 }}>Pipeline</span>
                <span style={{ paddingBottom: 6 }}>Wishlist</span>
                <span style={{ paddingBottom: 6 }}>Feed</span>
                <span style={{ paddingBottom: 6 }}>CV</span>
                <span style={{ paddingBottom: 6 }}>Stats</span>
              </div>
            </div>

            {/* Column header */}
            <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>Worth applying?</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>4 cards · sorted by score</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-text)' }}>3 / 7</div>
            </div>

            {/* Cards */}
            <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', flex: 1 }}>
              {cards.map(c => {
                const signalColor = c.signal === 'apply' ? '#C6F432' : c.signal === 'maybe' ? '#F0E0A8' : '#E8B8B8';
                const officeColor = c.office === '0d' || c.office === '1d' ? '#C6F432' : c.office === '2d' ? '#F0E0A8' : '#E8B8B8';
                return (
                  <div key={c.co} style={{
                    background: 'var(--marker-cream-2)',
                    border: '1px solid var(--marker-border)',
                    borderRadius: 10,
                    padding: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{c.co}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginTop: 1 }}>{c.role}</div>
                      </div>
                      <div style={{
                        background: c.score >= '7' ? 'var(--marker-lime)' : c.score >= '5' ? 'var(--marker-cream)' : 'var(--marker-border)',
                        border: '1px solid ' + (c.score >= '7' ? 'var(--marker-lime)' : 'var(--marker-border)'),
                        fontFamily: 'var(--font-display)',
                        fontSize: 17, fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 5,
                        color: 'var(--marker-black)',
                      }}>{c.score}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ background: signalColor, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--marker-black)' }}>{c.signal}</span>
                      <span style={{ background: officeColor, fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4, color: 'var(--marker-black)' }}>{c.office}</span>
                      <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4 }}>{c.salary}</span>
                      <span style={{ background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 6px', borderRadius: 4 }}>WLB {c.wlb}</span>
                    </div>

                    {c.reason && (
                      <div style={{ fontSize: 11, color: 'var(--marker-mid)', fontStyle: 'italic', lineHeight: 1.4 }}>
                        {c.reason}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--marker-border)', marginTop: 6, alignItems: 'center' }}>
                      <button style={{ flex: 1, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500 }}>Tailor CV</button>
                      <button style={{ flex: 1, background: 'transparent', color: 'var(--marker-text)', border: '1px solid var(--marker-border)', padding: '7px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-body)' }}>Breakdown</button>
                      {c.src === 'adzuna' && <AdzunaBadge />}
                    </div>
                  </div>
                );
              })}

              {/* Holo accent + legal lines */}
              <div style={{ padding: '12px 4px 4px' }}>
                <div className="holo-hairline" />
              </div>
              <div style={{ padding: '4px 4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <AIDisclaimer />
              </div>
            </div>

            {/* Bottom tab bar */}
            <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', padding: '10px 8px 14px' }}>
              {[
                { l: 'Pipe', active: true },
                { l: 'Feed', active: false },
                { l: 'CV', active: false },
                { l: 'Prep', active: false },
                { l: 'Stats', active: false },
              ].map(t => (
                <div key={t.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, background: t.active ? 'var(--marker-black)' : 'var(--marker-border)' }} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: t.active ? 'var(--marker-black)' : 'var(--marker-mid)' }}>{t.l}</div>
                </div>
              ))}
            </div>

          </div>
        </IOSDevice>
      </div>
    </DCArtboard>
  );
}

Object.assign(window, { ProductMobileUI });
