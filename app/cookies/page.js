export default function CookiesPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', lineHeight: 1.7 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Cookie Policy</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginBottom: 40 }}>Last updated: May 2026 · Marker (marker.work)</div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>What cookies we use</div>
        <div style={{ fontSize: 14, marginBottom: 16 }}>Marker uses only essential cookies. We do not use advertising, tracking, or analytics cookies.</div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--marker-border)' }}>
              {['Cookie', 'Purpose', 'Duration'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--marker-mid)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'sb-*-auth-token', purpose: 'Supabase authentication session; keeps you signed in', duration: 'Session / 1 year' },
              { name: 'sb-*-auth-token-code-verifier', purpose: 'PKCE OAuth security token for sign-in flow', duration: 'Session' },
            ].map(row => (
              <tr key={row.name} style={{ borderBottom: '1px solid var(--marker-border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-black)' }}>{row.name}</td>
                <td style={{ padding: '10px 12px' }}>{row.purpose}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', whiteSpace: 'nowrap' }}>{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Blocking cookies</div>
        <div style={{ fontSize: 14 }}>You can block cookies in your browser settings. Blocking essential cookies will prevent you from signing in to Marker.</div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Third parties</div>
        <div style={{ fontSize: 14 }}>We use <strong>Supabase</strong> for authentication (cookies above) and <strong>Vercel</strong> for hosting (no tracking cookies set by Vercel on your behalf). Anthropic processes API requests server-side and does not set cookies in your browser.</div>
      </div>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--marker-border)' }}>
        <a href="/" style={{ fontSize: 13, color: 'var(--marker-mid)' }}>← Back to Marker</a>
      </div>
    </div>
  )
}
