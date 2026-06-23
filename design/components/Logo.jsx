// Marker logo lockup variants. The signature mark: a holographic dot above the 'i'.

function Logo({ size = 48, color = 'var(--marker-black)', holo = true, dotOnly = false }) {
  const dotSize = size * 0.20;
  if (dotOnly) {
    return (
      <span
        className={holo ? 'holo-dot' : ''}
        style={{
          display: 'inline-block',
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: holo ? undefined : 'var(--marker-lime)',
        }}
      />
    );
  }
  return (
    <span className="wordmark" style={{ fontSize: size, color, lineHeight: 1 }}>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        marker
        {/* dot sits above the 'i' (5th char). We position it absolutely over the 'i' stem. */}
        <span
          className={holo ? 'holo-dot' : ''}
          style={{
            position: 'absolute',
            // tuned for Space Grotesk ~500 weight: the 'i' in "marker" stem sits ~0.78em from left at 1em char width.
            // Easier: place the dot relative to the right edge of "marke" — that's the 'r'. The 'i' is 4th char (m-a-r-k-e-r),
            // wait — m-a-r-k-e-r has no 'i'. Let me reconsider — actually "marker" is m,a,r,k,e,r. No 'i'.
            // The brief said "small lime dot above the 'i' OR a slightly differentiated 'r'". There's no 'i' in marker.
            // We'll place the holo dot above the END (above the last 'r' as the differentiator).
            top: -size * 0.18,
            right: size * 0.02,
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: holo ? undefined : 'var(--marker-lime)',
          }}
        />
      </span>
    </span>
  );
}

function LogoLime({ size = 48 }) {
  // Variant with solid lime dot (no holo) — for places where the holo would clash
  return <Logo size={size} holo={false} />;
}

function LogoMono({ size = 48, color = 'var(--marker-black)' }) {
  return (
    <span className="wordmark" style={{ fontSize: size, color, lineHeight: 1 }}>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        marker
        <span
          style={{
            position: 'absolute',
            top: -size * 0.18,
            right: size * 0.02,
            width: size * 0.20,
            height: size * 0.20,
            borderRadius: '50%',
            background: color,
          }}
        />
      </span>
    </span>
  );
}

Object.assign(window, { Logo, LogoLime, LogoMono });
