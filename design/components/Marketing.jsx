// Marketing assets — OG/Twitter card, Email header, Product Hunt thumbnail, Favicon set.

function OGImage() {
  return (
    <DCArtboard id="og" label="OG / Twitter card · 1200×630" width={1200} height={630}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        padding: '64px 72px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={32} />
          <div className="kicker">marker.work</div>
        </div>

        <div>
          <div className="kicker" style={{ marginBottom: 20 }}>For senior people who'd quite like their evenings back</div>
          <h1 className="display-xl" style={{ fontSize: 124, color: 'var(--marker-black)', textWrap: 'balance', lineHeight: 0.95 }}>
            The job hunt,<br/>
            <span style={{ background: 'var(--marker-lime)', padding: '0 12px' }}>marked.</span>
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="holo-dot" style={{ width: 14, height: 14, borderRadius: '50%' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--marker-mid)' }}>Free for 7 days · no card · UK</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--marker-mid)' }}>marker.work</div>
        </div>
      </div>
    </DCArtboard>
  );
}

function EmailHeader() {
  return (
    <DCArtboard id="email" label="Email · Weekly digest header" width={600} height={800}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        border: '1px solid var(--marker-border)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Email chrome — simulated */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--marker-border)',
          background: 'var(--marker-cream-2)',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><span style={{ color: 'var(--marker-text)' }}>From:</span> marker &lt;hello@marker.work&gt;</span>
            <span>Tue 13:42</span>
          </div>
          <div><span style={{ color: 'var(--marker-text)' }}>Subject:</span> Five roles worth your time this week</div>
        </div>

        {/* Hero */}
        <div style={{ padding: '40px 32px 32px', borderBottom: '1px solid var(--marker-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Logo size={22} />
            <div className="kicker">WEEK 21 · STANDBY</div>
          </div>
          <h2 className="display-lg" style={{ fontSize: 36, color: 'var(--marker-black)', textWrap: 'balance', marginBottom: 12 }}>
            Five roles worth your time.<br/>
            <span style={{ color: 'var(--marker-mid)' }}>Two are very worth your time.</span>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--marker-text-soft)', lineHeight: 1.5 }}>
            Sam — here's what we marked this week. No fluff. Open if you fancy it.
          </p>
        </div>

        {/* Cards */}
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { co: 'BBC', role: 'Senior Product Manager', score: '9.3', wlb: '4.3', tag: 'top pick' },
            { co: 'Wellcome Trust', role: 'Director of Product', score: '9.1', wlb: '4.6', tag: 'top pick' },
            { co: 'GitLab', role: 'Sr PM, Growth', score: '7.8', wlb: '4.2' },
          ].map(r => (
            <div key={r.co} style={{
              background: 'var(--marker-cream-2)',
              border: '1px solid var(--marker-border)',
              borderRadius: 10,
              padding: 16,
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r.co}{r.tag ? <span style={{ color: 'var(--marker-black)', marginLeft: 8 }}>· {r.tag}</span> : ''}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, color: 'var(--marker-black)', marginTop: 2 }}>{r.role}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginTop: 4 }}>WLB {r.wlb} · office ≤1d</div>
              </div>
              <div style={{ background: 'var(--marker-lime)', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, padding: '4px 12px', borderRadius: 6, color: 'var(--marker-black)' }}>{r.score}</div>
            </div>
          ))}
        </div>

        {/* Holo hairline + footer */}
        <div style={{ padding: '0 32px' }}><div className="holo-hairline" /></div>
        <div style={{ padding: '16px 32px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <AIDisclaimer />
          <ReviewDataLine />
        </div>
        <div style={{ padding: '12px 32px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--marker-border)' }}>
          <a style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-text)', borderBottom: '1px solid var(--marker-black)', paddingBottom: 1 }}>See all 5 →</a>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>Unsubscribe · Quiet mode · Settings</span>
        </div>
      </div>
    </DCArtboard>
  );
}

function ProductHuntThumb() {
  return (
    <DCArtboard id="ph-thumb" label="Product Hunt · 240×240" width={240} height={240}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-black)',
        fontFamily: 'var(--font-body)',
        padding: 20,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative',
        borderRadius: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div className="holo-dot" style={{ width: 16, height: 16, borderRadius: '50%' }} />
        </div>
        <div className="display-xl" style={{ fontSize: 64, color: 'var(--marker-cream)', lineHeight: 0.92, letterSpacing: '-0.04em' }}>
          mark<br/>
          <span style={{ color: '#C6F432' }}>er.</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          THE JOB HUNT, MARKED
        </div>
      </div>
    </DCArtboard>
  );
}

function FaviconSet() {
  return (
    <DCArtboard id="favicons" label="Favicons & app icons" width={520} height={240}>
      <div style={{
        width: '100%', height: '100%',
        background: 'var(--marker-cream)',
        padding: 28,
        display: 'flex', flexDirection: 'column', gap: 16,
        fontFamily: 'var(--font-body)',
      }}>
        <div className="kicker">APP ICONS · 128 / 64 / 32 / 16</div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[128, 64, 32, 16].map(size => (
            <div key={size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: size, height: size,
                background: 'var(--marker-black)',
                borderRadius: size * 0.22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.55, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.05em', position: 'relative' }}>
                  m
                  <span className={size >= 32 ? 'holo-dot' : ''} style={{
                    position: 'absolute',
                    top: -size * 0.05,
                    right: -size * 0.10,
                    width: size * 0.14,
                    height: size * 0.14,
                    borderRadius: '50%',
                    background: size < 32 ? 'var(--marker-lime)' : undefined,
                  }} />
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)' }}>{size}px</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', borderTop: '1px solid var(--marker-border)', paddingTop: 10 }}>
          At ≥32px the holo dot reads; below that, fall back to solid lime for legibility.
        </div>
      </div>
    </DCArtboard>
  );
}

Object.assign(window, { OGImage, EmailHeader, ProductHuntThumb, FaviconSet });
