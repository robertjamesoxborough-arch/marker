import CookieSettings from '../../components/CookieSettings'

const ESSENTIAL = [
  { name: 'sb-*-auth-token', type: 'Cookie', purpose: 'Supabase authentication session; keeps you signed in', duration: 'Session / 1 year' },
  { name: 'sb-*-auth-token-code-verifier', type: 'Cookie', purpose: 'PKCE security token used during sign-in', duration: 'Session' },
  { name: 'mkr_cookie_consent', type: 'Local storage', purpose: 'Remembers the choice you made on the cookie banner, so we do not ask again and so we know what we are allowed to load', duration: 'Until you clear it' },
]

const FUNCTIONAL = [
  { name: 'mkr_contacts', type: 'Local storage', purpose: 'Your Referrals address book. Held on your device only and never uploaded to us', duration: 'Until you clear it' },
  { name: 'mkr_referral_requests', type: 'Local storage', purpose: 'The status history of referral messages you have drafted. Device only', duration: 'Until you clear it' },
  { name: 'mkr_posted_within', type: 'Local storage', purpose: 'Remembers your "posted within" job feed filter', duration: 'Until you clear it' },
  { name: 'mkr_last_visit', type: 'Local storage', purpose: 'Powers the "welcome back" summary on your dashboard', duration: 'Until you clear it' },
  { name: 'mkr_feed_refresh', type: 'Local storage', purpose: 'Rate-limits the feed refresh button so it cannot be spammed', duration: 'Until you clear it' },
  { name: 'mkr_first_run_done, mkr_tour_*', type: 'Local storage', purpose: 'Remembers which one-off tours and guides you have already dismissed', duration: 'Until you clear it' },
]

const OPTIONAL = [
  { name: 'Vercel Analytics', type: 'No cookie, no stored identifier', purpose: 'Aggregated page-view counts, so we can see which parts of the product are used', duration: 'Not stored on your device' },
  { name: 'Vercel Speed Insights', type: 'No cookie, no stored identifier', purpose: 'Page performance measurements, so we can find slow pages', duration: 'Not stored on your device' },
  { name: 'marker_ref', type: 'Local storage', purpose: 'Remembers that you arrived through someone’s referral link, so it can be credited when you sign up', duration: 'Until you sign up, then removed' },
  { name: 'marker_tagline_id', type: 'Local storage', purpose: 'Records which homepage headline you were shown, so we can tell which wording works', duration: 'Until you clear it' },
]

function Table({ rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--marker-border)' }}>
            {['Name', 'Kind', 'Purpose', 'Duration'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--marker-mid)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name} style={{ borderBottom: '1px solid var(--marker-border)' }}>
              <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-black)' }}>{row.name}</td>
              <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', whiteSpace: 'nowrap' }}>{row.type}</td>
              <td style={{ padding: '10px 12px' }}>{row.purpose}</td>
              <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)' }}>{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

export default function CookiesPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', lineHeight: 1.7 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Cookie Policy</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginBottom: 40 }}>Last updated: September 2026 · Requite</div>

      <Section title="The short version">
        <div style={{ fontSize: 14, marginBottom: 16 }}>
          Requite sets two cookies to keep you signed in, and stores a handful of small settings in your browser so the app remembers your preferences. Analytics and referral attribution are optional and load only if you accept them. We do not use advertising cookies, and we do not track you across other websites.
        </div>
        <CookieSettings />
      </Section>

      <Section title="Strictly necessary">
        <div style={{ fontSize: 14, marginBottom: 14 }}>These are required for the site to work at all, so they are not optional. Blocking them will stop you signing in.</div>
        <Table rows={ESSENTIAL} />
      </Section>

      <Section title="Functional, stored on your device only">
        <div style={{ fontSize: 14, marginBottom: 14 }}>
          These remember your own settings and content. None of them is sent to us, and none is used to track you. The Referrals address book is in this group deliberately: contacts are other people&apos;s personal details, so they stay on your device and are never uploaded.
        </div>
        <Table rows={FUNCTIONAL} />
      </Section>

      <Section title="Optional, only with your consent">
        <div style={{ fontSize: 14, marginBottom: 14 }}>
          None of the below runs unless you choose &ldquo;Accept&rdquo; on the banner. If you choose &ldquo;Necessary only&rdquo;, the analytics scripts are never loaded and the referral identifier is never written. You can change your mind at any time using the control at the top of this page.
        </div>
        <Table rows={OPTIONAL} />
      </Section>

      <Section title="Third parties">
        <div style={{ fontSize: 14 }}>
          We use <strong>Supabase</strong> for authentication, which sets the sign-in cookies above, and <strong>Vercel</strong> for hosting and, with your consent, analytics and performance monitoring. <strong>Anthropic</strong> processes AI requests on our servers and does not set anything in your browser. <strong>Stripe</strong> handles payments and will set its own cookies on its checkout pages, which are governed by Stripe&apos;s own policy. Full detail of who processes what is in our{' '}
          <a href="/privacy" style={{ color: 'var(--marker-black)' }}>Privacy Policy</a>.
        </div>
      </Section>

      <Section title="Blocking storage yourself">
        <div style={{ fontSize: 14}}>
          You can block or clear cookies and site data in your browser settings. Blocking the strictly necessary items will prevent you signing in. Clearing site data will also delete your Referrals address book, because that is held on your device and nowhere else.
        </div>
      </Section>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--marker-border)' }}>
        <a href="/" style={{ fontSize: 13, color: 'var(--marker-mid)' }}>← Back to Requite</a>
      </div>
    </div>
  )
}
