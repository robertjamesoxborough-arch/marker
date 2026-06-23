// Brand foundation section: logo lockups, palette, type, holo treatment, voice.

function BrandFoundation() {
  return (
    <React.Fragment>

      {/* Primary lockup */}
      <DCArtboard id="logo-primary" label="Logo · Primary" width={820} height={440}>
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--marker-cream)',
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-body)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="kicker">01 · WORDMARK</div>
            <div className="kicker">SPACE GROTESK 500</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
            <Logo size={180} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', maxWidth: 320, lineHeight: 1.6 }}>
              Lowercase wordmark. Holographic dot above the final&nbsp;'r' — the signature mark. Set tight (-3% tracking).
            </div>
            <div className="chip chip-lime">Primary</div>
          </div>
        </div>
      </DCArtboard>

      {/* Holo dot detail */}
      <DCArtboard id="logo-holo" label="Logo · Holo mark" width={400} height={440}>
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--marker-black)',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: 'var(--marker-cream)',
        }}>
          <div className="kicker" style={{ color: 'var(--marker-mid)' }}>02 · SIGNATURE</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <div className="holo-dot" style={{ width: 180, height: 180, borderRadius: '50%' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
            CD-rainbow foil.<br/>
            One holo element per surface — never as wash.
          </div>
        </div>
      </DCArtboard>

      {/* Logo variants */}
      <DCArtboard id="logo-variants" label="Logo · Variants" width={620} height={440}>
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--marker-cream)',
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
        }}>
          <div style={{ borderBottom: '1px solid var(--marker-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative' }}>
            <Logo size={64} holo={false} />
            <div className="kicker" style={{ position: 'absolute', top: 16, left: 20 }}>Lime dot · functional</div>
          </div>
          <div style={{ background: 'var(--marker-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative' }}>
            <Logo size={64} color="var(--marker-cream)" />
            <div className="kicker" style={{ position: 'absolute', top: 16, left: 20, color: 'var(--marker-mid)' }}>Reversed · dark</div>
          </div>
        </div>
      </DCArtboard>

      {/* Palette */}
      <DCArtboard id="palette" label="Palette" width={920} height={440}>
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--marker-cream)',
          padding: '32px 40px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div className="kicker">03 · PALETTE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>
              Lime is sparingly used. Holo is a single highlight per surface.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12, flex: 1 }}>
            {[
              { name: 'Lime', hex: '#C6F432', bg: '#C6F432', fg: '#0A0A0A', note: 'Accent · sparingly' },
              { name: 'Black', hex: '#0A0A0A', bg: '#0A0A0A', fg: '#FAF7F2', note: 'Foreground' },
              { name: 'Cream', hex: '#FAF7F2', bg: '#FAF7F2', fg: '#0A0A0A', note: 'Background', border: true },
              { name: 'Cream 2', hex: '#F8F6F1', bg: '#F8F6F1', fg: '#0A0A0A', note: 'Surfaces', border: true },
              { name: 'Border', hex: '#E5E2DC', bg: '#E5E2DC', fg: '#0A0A0A', note: 'Hairlines' },
              { name: 'Mid', hex: '#6B6863', bg: '#6B6863', fg: '#FAF7F2', note: 'Captions' },
              { name: 'Body', hex: '#2C2A26', bg: '#2C2A26', fg: '#FAF7F2', note: 'Body text' },
              { name: 'Holo', hex: 'iridescent', bg: 'holo', fg: '#0A0A0A', note: 'Signature only' },
            ].map(s => (
              <div key={s.name} style={{
                background: s.bg === 'holo' ? undefined : s.bg,
                color: s.fg,
                border: s.border ? '1px solid var(--marker-border)' : 'none',
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 240,
                position: 'relative',
                overflow: 'hidden',
              }}
              className={s.bg === 'holo' ? 'holo-foil' : ''}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500 }}>{s.name}</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7, marginBottom: 4 }}>{s.hex}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DCArtboard>

      {/* Type */}
      <DCArtboard id="type" label="Typography" width={820} height={460}>
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--marker-cream)',
          padding: '32px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}>
          <div className="kicker">04 · TYPE</div>

          <div style={{ borderTop: '1px solid var(--marker-border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>SPACE GROTESK · DISPLAY</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>500 / -3% / 96% leading</div>
            </div>
            <div className="display-xl" style={{ fontSize: 56, color: 'var(--marker-black)' }}>Mark your moves.</div>
          </div>

          <div style={{ borderTop: '1px solid var(--marker-border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>INTER · BODY</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>400 / -0.5% / 150%</div>
            </div>
            <div className="body" style={{ fontSize: 16, maxWidth: 580 }}>
              The job hunt, calmly tracked. Marker scores every role you find against what you actually want — sane hours, fair pay, the work itself.
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--marker-border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 4 }}>JETBRAINS MONO · DATA</div>
              <div className="mono" style={{ fontSize: 14, color: 'var(--marker-text)' }}>WLB 8.4 · OFFICE 1d · £92k–£108k · LDN/REM</div>
            </div>
            <div className="chip">UI · CAPS · LABELS</div>
          </div>
        </div>
      </DCArtboard>

      {/* Voice */}
      <DCArtboard id="voice" label="Voice" width={520} height={460}>
        <div style={{
          width: '100%', height: '100%',
          background: 'var(--marker-black)',
          color: 'var(--marker-cream)',
          padding: '32px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div className="kicker" style={{ color: 'var(--marker-mid)' }}>05 · VOICE</div>
          <div className="display-md" style={{ fontSize: 28, color: 'var(--marker-cream)' }}>
            Confident. Calm.<br/>Slightly editorial.
          </div>
          <div className="holo-hairline" style={{ height: 1, margin: '4px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12 }}>
              <div style={{ color: '#C6F432' }}>YES</div>
              <div style={{ color: 'var(--marker-cream)' }}>Direct. British English. No hedging.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12 }}>
              <div style={{ color: '#C6F432' }}>YES</div>
              <div style={{ color: 'var(--marker-cream)' }}>Short sentences. Verbs first.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12 }}>
              <div style={{ color: 'var(--marker-mid)' }}>NO</div>
              <div style={{ color: 'var(--marker-mid)' }}>Exclamation marks. Emojis in product.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12 }}>
              <div style={{ color: 'var(--marker-mid)' }}>NO</div>
              <div style={{ color: 'var(--marker-mid)' }}>"Unlock", "supercharge", "unleash".</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12 }}>
              <div style={{ color: 'var(--marker-mid)' }}>NO</div>
              <div style={{ color: 'var(--marker-mid)' }}>Em dashes in user copy.</div>
            </div>
          </div>
        </div>
      </DCArtboard>

    </React.Fragment>
  );
}

Object.assign(window, { BrandFoundation });
