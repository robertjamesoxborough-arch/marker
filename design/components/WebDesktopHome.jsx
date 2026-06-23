// Marker website — desktop homepage. Editorial, generous whitespace.
// Built as a single 1440-wide artboard. Holo used ONCE: thin hairline rule.

function WebDesktopHome() {
  return (
    <DCArtboard id="web-desktop-home" label="Web · Desktop · Home" width={1440} height={3400}>
      <div style={{
        width: '100%', minHeight: '100%',
        background: 'var(--marker-cream)',
        fontFamily: 'var(--font-body)',
        color: 'var(--marker-text)',
      }}>

        {/* NAV */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px 64px', borderBottom: '1px solid var(--marker-border)',
          position: 'sticky', top: 0, background: 'var(--marker-cream)', zIndex: 5,
        }}>
          <Logo size={26} />
          <nav style={{ display: 'flex', gap: 32, fontSize: 14, color: 'var(--marker-text)' }}>
            <a>How it works</a>
            <a>Tracks</a>
            <a>Pricing</a>
            <a>Notes <span style={{ color: 'var(--marker-mid)', fontSize: 11, marginLeft: 4 }}>/blog</span></a>
          </nav>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a style={{ fontSize: 14 }}>Sign in</a>
            <button className="btn btn-primary">Start free</button>
          </div>
        </div>

        {/* HERO */}
        <section style={{ padding: '120px 64px 100px', position: 'relative' }}>
          <div style={{ maxWidth: 1100 }}>
            <div className="kicker" style={{ marginBottom: 24 }}>For senior people who'd quite like their evenings back</div>
            <h1 className="display-xl" style={{ fontSize: 120, color: 'var(--marker-black)', marginBottom: 32, textWrap: 'balance' }}>
              Mark your moves.<br/>
              <span style={{ color: 'var(--marker-mid)' }}>Skip the rest.</span>
            </h1>
            <p className="body" style={{ fontSize: 20, maxWidth: 640, marginBottom: 40, color: 'var(--marker-text)' }}>
              Marker is the job hunt tool for senior people who've done the hustle and would prefer not to do it again. Score every role against what actually matters to you. Then go and live your life.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ fontSize: 15, padding: '14px 22px' }}>Start free · 7 days</button>
              <button className="btn btn-ghost" style={{ fontSize: 15, padding: '14px 22px' }}>See how it scores</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginLeft: 12 }}>No card. No "talk to sales".</span>
            </div>
          </div>

          {/* Holo hairline — the ONE accent for this section */}
          <div style={{ position: 'absolute', bottom: 60, left: 64, right: 64 }}>
            <div className="holo-hairline" />
          </div>

          {/* Floating mini-card — preview of the score */}
          <div style={{
            position: 'absolute',
            right: 64, top: 160,
            width: 360,
            background: 'var(--marker-cream-2)',
            border: '1px solid var(--marker-border)',
            borderRadius: 12,
            padding: 20,
            transform: 'rotate(-1.5deg)',
            boxShadow: '0 20px 60px rgba(10,10,10,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--marker-mid)' }}>Monzo</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>Staff Product Manager</div>
              </div>
              <div style={{
                background: 'var(--marker-lime)',
                fontFamily: 'var(--font-display)',
                fontSize: 22, fontWeight: 500,
                padding: '6px 12px', borderRadius: 6,
                color: 'var(--marker-black)',
              }}>9.2</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {[
                ['Role fit', '9.4'],
                ['Office days', '1 / wk'],
                ['Salary v market', '+8%'],
                ['Parental leave', 'found · 6mo'],
                ['Glassdoor WLB', '4.1'],
                ['Culture', '8.6'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--marker-border)' }}>
                  <span style={{ color: 'var(--marker-mid)' }}>{l}</span>
                  <span style={{ color: 'var(--marker-black)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="chip chip-lime" style={{ fontSize: 9 }}>APPLY</span>
                <span className="chip" style={{ fontSize: 9 }}>WORTH MARKING</span>
              </div>
              <AdzunaBadge />
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--marker-border)' }}>
              <AIDisclaimer />
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF STRIP */}
        <section style={{ padding: '40px 64px', borderTop: '1px solid var(--marker-border)', borderBottom: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 48 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Pulls from
            </div>
            {['Greenhouse', 'Adzuna', 'Gov.uk', 'Working Families', 'Public reviews'].map(s => (
              <div key={s} style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-text)', opacity: 0.5 }}>{s}</div>
            ))}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', whiteSpace: 'nowrap' }}>+ 4 more</div>
          </div>
        </section>

        {/* HOW IT WORKS — 3 step */}
        <section style={{ padding: '120px 64px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 64 }}>
            <div>
              <div className="kicker" style={{ marginBottom: 16 }}>How it works</div>
              <h2 className="display-lg" style={{ fontSize: 64, color: 'var(--marker-black)', maxWidth: 720 }}>
                Three things, done well.<br/>
                <span style={{ color: 'var(--marker-mid)' }}>Nothing else.</span>
              </h2>
            </div>
            <div style={{ fontSize: 14, color: 'var(--marker-mid)', maxWidth: 280, lineHeight: 1.6 }}>
              No dashboards full of nothing. No AI that writes 400-word cover letters about your "passion".
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
            {[
              {
                n: '01',
                title: 'Pick a track.',
                body: 'Balanced Roles, Standard, Parent, Returner, Career-changer. Each one comes with a different wishlist, different filters, and different language in your CV.',
                chip: 'Balanced Roles · default',
              },
              {
                n: '02',
                title: 'Mark what fits.',
                body: 'Every role is scored 1–10 across eight things you care about. Salary v market. Office days. Parental leave (verified, not guessed). Glassdoor WLB.',
                chip: '8-factor score',
              },
              {
                n: '03',
                title: 'Apply, or don\'t.',
                body: 'Generate a tailored CV in your voice. Or copy the prompt and use ChatGPT. We don\'t hide the prompt — it\'s yours.',
                chip: 'CV in 90 seconds',
              },
            ].map(s => (
              <div key={s.n} className="card" style={{ padding: 32, minHeight: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', letterSpacing: '0.08em' }}>{s.n}</div>
                <div className="display-md" style={{ fontSize: 32, color: 'var(--marker-black)' }}>{s.title}</div>
                <div className="body" style={{ fontSize: 15 }}>{s.body}</div>
                <div style={{ marginTop: 'auto' }}>
                  <span className="chip" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-body)', fontSize: 11 }}>{s.chip}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BIG FEATURE — Balanced Roles */}
        <section style={{ padding: '0 64px 120px' }}>
          <div style={{
            background: 'var(--marker-black)',
            color: 'var(--marker-cream)',
            borderRadius: 16,
            padding: '80px 64px',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 64,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div>
              <div className="kicker" style={{ color: '#C6F432', marginBottom: 24 }}>The Balanced Roles track</div>
              <h2 className="display-lg" style={{ fontSize: 56, color: 'var(--marker-cream)', marginBottom: 24, textWrap: 'balance' }}>
                Companies where work-life balance is a fact, not a slide.
              </h2>
              <p style={{ fontSize: 16, color: 'var(--marker-cream)', opacity: 0.7, marginBottom: 32, lineHeight: 1.6, maxWidth: 480 }}>
                Anchored to public data: Glassdoor WLB ratings, Working Families benchmark, verified parental leave policies. We don't take companies' word for it. We check.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['Public sector', 'Education / EdTech', 'Large stable corporates', 'Remote-first w/ culture'].map(t => (
                  <span key={t} style={{
                    border: '1px solid #2A2A2A',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontSize: 13,
                    color: 'var(--marker-cream)',
                  }}>{t}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { co: 'BBC', wlb: '4.3', leave: '6mo', office: '2d' },
                { co: 'Nationwide', wlb: '4.4', leave: '12mo', office: '1d' },
                { co: 'Ofcom', wlb: '4.5', leave: '6mo', office: '2d' },
                { co: 'Wellcome Trust', wlb: '4.6', leave: '6mo', office: '1d' },
                { co: 'GitLab', wlb: '4.2', leave: '4mo', office: '0d' },
              ].map(r => (
                <div key={r.co} style={{
                  background: '#171717',
                  borderRadius: 8,
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: '1.4fr repeat(3, 1fr) 60px',
                  gap: 12,
                  alignItems: 'center',
                  fontSize: 13,
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--marker-cream)' }}>{r.co}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: '#A8A8A8' }}>WLB {r.wlb}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: '#A8A8A8' }}>Leave {r.leave}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: '#A8A8A8' }}>Office {r.office}</div>
                  <div style={{
                    background: 'var(--marker-lime)',
                    color: 'var(--marker-black)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    textAlign: 'center',
                    padding: '4px 0',
                    borderRadius: 4,
                  }}>{(8.6 + Math.random() * 0.4).toFixed(1)}</div>
                </div>
              ))}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#6B6B6B', marginTop: 8 }}>
                Citations: aggregated public employee reviews (≥ 500), Working Families benchmark, employer policy pages
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ReviewDataLine light={true} />
                <AIDisclaimer light={true} />
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section style={{ padding: '40px 64px 120px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48 }}>
            <div>
              <div className="kicker" style={{ marginBottom: 16 }}>Pricing</div>
              <h2 className="display-lg" style={{ fontSize: 56, color: 'var(--marker-black)' }}>
                Pay for what you use.<br/>
                <span style={{ color: 'var(--marker-mid)' }}>Not for what you don't.</span>
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: 4 }}>
              <button style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '8px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Monthly</button>
              <button style={{ background: 'transparent', border: 'none', padding: '8px 14px', fontSize: 13, color: 'var(--marker-text)', cursor: 'pointer' }}>Annual · −20%</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { name: 'Free', sub: '7-day trial', price: '£0', detail: '3 scores · 30 quick checks', cta: 'Start free', flag: false },
              { name: 'Standby', sub: 'Quietly looking', price: '£4', detail: 'Weekly digest · 5 scores · 100 checks', cta: 'Choose Standby', flag: false },
              { name: 'Lite', sub: 'Active hunt', price: '£12', detail: '30 scores · 15 CVs · 15 letters', cta: 'Choose Lite', flag: false },
              { name: 'Pro', sub: 'Going hard', price: '£24', detail: '100 scores · 40 CVs · Interview prep', cta: 'Choose Pro', flag: true },
            ].map(p => (
              <div key={p.name} style={{
                background: p.flag ? 'var(--marker-black)' : 'var(--marker-cream-2)',
                color: p.flag ? 'var(--marker-cream)' : 'var(--marker-text)',
                border: '1px solid ' + (p.flag ? 'var(--marker-black)' : 'var(--marker-border)'),
                borderRadius: 12,
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                minHeight: 360,
                position: 'relative',
              }}>
                {p.flag && <div style={{ position: 'absolute', top: -1, right: -1, background: 'var(--marker-lime)', color: 'var(--marker-black)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', borderRadius: '0 12px 0 8px', letterSpacing: '0.06em' }}>MOST CHOSEN</div>}
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 13, opacity: p.flag ? 0.6 : 0.7, color: p.flag ? 'var(--marker-cream)' : 'var(--marker-mid)' }}>{p.sub}</div>
                </div>
                <div>
                  <span className="display-xl" style={{ fontSize: 56, color: p.flag ? 'var(--marker-cream)' : 'var(--marker-black)' }}>{p.price}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: p.flag ? '#999' : 'var(--marker-mid)', marginLeft: 4 }}>/ mo</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: p.flag ? 'var(--marker-cream)' : 'var(--marker-text-soft)' }}>{p.detail}</div>
                <button className={p.flag ? 'btn btn-lime' : 'btn btn-primary'} style={{ marginTop: 'auto', justifyContent: 'center' }}>{p.cta}</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)' }}>
            Pro + BYO key · £7/mo · same as Pro, your own Anthropic key.&nbsp;&nbsp;Student? 50% off Lite with .ac.uk.
          </div>
        </section>

        {/* CTA + FOOTER */}
        <section style={{ padding: '120px 64px', borderTop: '1px solid var(--marker-border)', background: 'var(--marker-cream-2)' }}>
          <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
            <h2 className="display-xl" style={{ fontSize: 96, color: 'var(--marker-black)', marginBottom: 24, textWrap: 'balance' }}>
              The job hunt, marked.
            </h2>
            <div className="holo-hairline" style={{ margin: '0 auto 24px', maxWidth: 320 }} />
            <p style={{ fontSize: 18, color: 'var(--marker-mid)', marginBottom: 32 }}>Seven days free. No card. Cancel by closing the tab.</p>
            <button className="btn btn-primary" style={{ fontSize: 16, padding: '16px 28px' }}>Start free</button>
          </div>
        </section>

        <footer style={{ padding: '40px 64px', borderTop: '1px solid var(--marker-border)', display: 'flex', flexDirection: 'column', gap: 20, fontSize: 12, color: 'var(--marker-mid)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <Logo size={18} holo={false} />
              <span>© Marker Ltd · UK</span>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <span>Privacy</span><span>Terms</span><span>Cookies</span><span>DPA</span><span>Notes</span><span>Status</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--marker-border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, maxWidth: 720 }}>
              <OGLLine />
              <ReviewDataLine />
              <AIDisclaimer />
            </div>
            <AdzunaBadge />
          </div>
        </footer>

      </div>
    </DCArtboard>
  );
}

Object.assign(window, { WebDesktopHome });
