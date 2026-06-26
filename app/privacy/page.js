export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'var(--font-body)', color: 'var(--marker-text)', lineHeight: 1.7 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>Privacy Policy</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', marginBottom: 40 }}>Last updated: May 2026 · Requite</div>

      {[
        { title: 'Who we are', body: 'Requite is a trading name of Robert Oxborough. We are based in the United Kingdom. Contact: support@upstreaminsights.co.uk.' },
        { title: 'What data we collect', body: 'We collect: (1) your email address to create and authenticate your account; (2) profile data you provide, including CV text, target roles, seniority, industries, work preferences, and postcode; (3) pipeline data, including job roles you add, scores, and notes; (4) usage data, including pages visited and features used, collected via Vercel Analytics.' },
        { title: 'How we use your data', body: 'Your data is used to: power the job scoring and CV tailoring features; personalise your job feed; improve our service. We do not sell your data to third parties. We do not share your CV text or personal preferences with employers or job boards.' },
        { title: 'AI processing', body: 'When you use CV tailoring, scoring, or interview prep features, relevant portions of your profile and CV are sent to Anthropic (claude.ai) for processing. Anthropic processes this data under their API Terms of Service. We do not use your data to train AI models. You can opt out by not using these features.' },
        { title: 'Data storage', body: 'Your data is stored in Supabase (PostgreSQL) hosted on AWS EU-West-1 (Ireland). Data is encrypted at rest and in transit.' },
        { title: 'Data retention', body: 'We retain your data for as long as your account is active. You can request deletion at any time by emailing support@upstreaminsights.co.uk. We will delete your data within 30 days of receiving a valid request.' },
        { title: 'Your rights', body: 'Under UK GDPR, you have the right to: access your personal data; correct inaccurate data; request deletion; object to processing; data portability. To exercise these rights, contact support@upstreaminsights.co.uk.' },
        { title: 'Cookies', body: 'We use essential cookies for authentication (Supabase session). We do not use advertising or tracking cookies. See our Cookie Policy for details.' },
        { title: 'Changes', body: 'We may update this policy. We will notify you by email of material changes. Continued use after notification constitutes acceptance.' },
        { title: 'Contact', body: 'For privacy queries: support@upstreaminsights.co.uk' },
      ].map(({ title, body }) => (
        <div key={title} style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 14 }}>{body}</div>
        </div>
      ))}

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--marker-border)' }}>
        <a href="/" style={{ fontSize: 13, color: 'var(--marker-mid)' }}>← Back to Requite</a>
      </div>
    </div>
  )
}
