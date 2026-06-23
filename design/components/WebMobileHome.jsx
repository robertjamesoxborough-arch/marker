// Marker website — mobile view. 390 wide (iPhone 14).

function WebMobileHome() {
  return (
    <DCArtboard id="web-mobile-home" label="Web · Mobile · Home" width={390} height={2400}>
      <div style={{
        width: '100%', minHeight: '100%',
        background: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        color: 'var(--marker-text)',
      }}>

        {/* Mobile nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--marker-border)' }}>
          <Logo size={20} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>Sign in</span>
            <div style={{ width: 24, height: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
              <div style={{ height: 1.5, background: 'var(--marker-black)' }} />
              <div style={{ height: 1.5, background: 'var(--marker-black)' }} />
            </div>
          </div>
        </div>

        {/* Hero */}
        <section style={{ padding: '40px 24px 24px' }}>
          <div className="kicker" style={{ marginBottom: 20 }}>For senior people who'd quite like their evenings back</div>
          <h1 className="display-xl" style={{ fontSize: 52, color: 'var(--marker-black)', marginBottom: 20, textWrap: 'balance' }}>
            Mark your moves.<br/>
            <span style={{ color: 'var(--marker-mid)' }}>Skip the rest.</span>
          </h1>
          <p className="body" style={{ fontSize: 16, marginBottom: 24 }}>
            The job hunt tool for senior people who've done the hustle and would prefer not to do it again.
          </p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '14px' }}>Start free · 7 days</button>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', textAlign: 'center', marginTop: 10 }}>No card. No "talk to sales".</div>
        </section>

        {/* Inline score card */}
        <section style={{ padding: '24px' }}>
          <div style={{
            background: 'var(--marker-cream-2)',
            border: '1px solid var(--marker-border)',
            borderRadius: 12,
            padding: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--marker-mid)' }}>Monzo</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)' }}>Staff Product Manager</div>
              </div>
              <div style={{ background: 'var(--marker-lime)', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, padding: '4px 10px', borderRadius: 6 }}>9.2</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {[['Role fit', '9.4'], ['Office', '1 / wk'], ['Salary', '+8%'], ['WLB', '4.1']].map(([l,v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--marker-border)' }}>
                  <span style={{ color: 'var(--marker-mid)' }}>{l}</span><span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Holo hairline divider */}
        <div style={{ padding: '24px' }}><div className="holo-hairline" /></div>

        {/* How it works — stacked */}
        <section style={{ padding: '24px 24px 64px' }}>
          <div className="kicker" style={{ marginBottom: 16 }}>How it works</div>
          <h2 className="display-lg" style={{ fontSize: 40, color: 'var(--marker-black)', marginBottom: 32 }}>
            Three things,<br/>done well.
          </h2>

          {[
            { n: '01', title: 'Pick a track', body: 'Balanced Roles, Standard, Parent, Returner, Career-changer.' },
            { n: '02', title: 'Mark what fits', body: 'Every role scored 1–10 across eight things you actually care about.' },
            { n: '03', title: 'Apply, or don\'t', body: 'Tailored CV in your voice. No "passion" paragraphs.' },
          ].map(s => (
            <div key={s.n} style={{ borderTop: '1px solid var(--marker-border)', padding: '20px 0', display: 'flex', gap: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', minWidth: 24 }}>{s.n}</div>
              <div>
                <div className="display-md" style={{ fontSize: 20, color: 'var(--marker-black)', marginBottom: 6 }}>{s.title}</div>
                <div className="body" style={{ fontSize: 14 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Balanced roles dark */}
        <section style={{ padding: '64px 24px', background: 'var(--marker-black)', color: 'var(--marker-cream)' }}>
          <div className="kicker" style={{ color: '#C6F432', marginBottom: 16 }}>Balanced Roles</div>
          <h2 className="display-lg" style={{ fontSize: 36, color: 'var(--marker-cream)', marginBottom: 16, textWrap: 'balance' }}>
            Companies where work-life balance is a fact, not a slide.
          </h2>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 24, lineHeight: 1.6 }}>
            Anchored to Glassdoor, Working Families, and verified policy pages.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { co: 'BBC', wlb: '4.3', score: '9.0' },
              { co: 'Nationwide', wlb: '4.4', score: '8.8' },
              { co: 'Wellcome Trust', wlb: '4.6', score: '9.1' },
            ].map(r => (
              <div key={r.co} style={{ background: '#171717', borderRadius: 8, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1.4fr 1fr 50px', gap: 12, alignItems: 'center', fontSize: 13 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>{r.co}</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: '#A8A8A8', fontSize: 11 }}>WLB {r.wlb}</div>
                <div style={{ background: 'var(--marker-lime)', color: 'var(--marker-black)', fontFamily: 'var(--font-display)', fontWeight: 500, textAlign: 'center', padding: '4px 0', borderRadius: 4, fontSize: 12 }}>{r.score}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section style={{ padding: '64px 24px' }}>
          <div className="kicker" style={{ marginBottom: 16 }}>Pricing</div>
          <h2 className="display-lg" style={{ fontSize: 40, color: 'var(--marker-black)', marginBottom: 24 }}>
            Pay for what you use.
          </h2>
          {[
            { name: 'Standby', price: '£4', detail: 'Weekly digest', flag: false },
            { name: 'Lite', price: '£12', detail: '30 scores · 15 CVs', flag: false },
            { name: 'Pro', price: '£24', detail: '100 scores · 40 CVs · Prep', flag: true },
          ].map(p => (
            <div key={p.name} style={{
              background: p.flag ? 'var(--marker-black)' : 'var(--marker-cream-2)',
              color: p.flag ? 'var(--marker-cream)' : 'var(--marker-text)',
              border: '1px solid ' + (p.flag ? 'var(--marker-black)' : 'var(--marker-border)'),
              borderRadius: 12,
              padding: 20,
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{p.detail}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500 }}>{p.price}<span style={{ fontSize: 12, opacity: 0.6 }}>/mo</span></div>
            </div>
          ))}
        </section>

        {/* Bottom CTA */}
        <section style={{ padding: '64px 24px', borderTop: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)', textAlign: 'center' }}>
          <h2 className="display-xl" style={{ fontSize: 48, color: 'var(--marker-black)', marginBottom: 16 }}>
            The job hunt,<br/>marked.
          </h2>
          <div className="holo-hairline" style={{ margin: '0 auto 20px', maxWidth: 200 }} />
          <p style={{ fontSize: 14, color: 'var(--marker-mid)', marginBottom: 20 }}>Seven days free. No card.</p>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>Start free</button>
        </section>

        <footer style={{ padding: '24px', fontSize: 11, color: 'var(--marker-mid)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Logo size={16} holo={false} />
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Privacy</span><span>Terms</span><span>Cookies</span><span>Notes</span>
          </div>
          <div style={{ borderTop: '1px solid var(--marker-border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <OGLLine />
            <ReviewDataLine />
            <AIDisclaimer />
            <div style={{ marginTop: 4 }}><AdzunaBadge /></div>
          </div>
        </footer>

      </div>
    </DCArtboard>
  );
}

Object.assign(window, { WebMobileHome });
