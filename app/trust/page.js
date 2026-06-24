import Link from 'next/link'
import { BRAND_NAME } from '../../lib/brand'

function Logo({ size = 20, light }) {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 500, letterSpacing: '-0.03em', color: light ? 'var(--marker-cream)' : 'var(--marker-black)', display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      {BRAND_NAME.toLowerCase()}
      <span className="holo-dot" style={{ display: 'inline-block', width: '0.32em', height: '0.32em', borderRadius: '50%', marginLeft: '0.05em', position: 'relative', top: '-0.55em', flexShrink: 0 }} />
    </span>
  )
}

const GUARANTEES = [
  {
    id: 'G1',
    color: '#C6F432',
    headline: 'Real roles, labelled honestly.',
    kills: 'Kills "Jill doesn\'t exist."',
    body: [
      'Every employer role on Requite carries a mandatory source label — requite_managed (an employer on the platform; you can request a real introduction) or public_listing (aggregated from Adzuna or Gov.uk). This is enforced in the database with a CHECK constraint: it cannot be null, forged, or changed after posting.',
      'The "Request intro" button appears only on requite_managed roles — structurally disabled on public listings. The Live Network Meter shows you the exact live count of managed roles in your field right now. When it\'s low, we tell you. Every successful introduction is permanently logged in intro_receipts — an immutable, timestamped record.',
    ],
    built: 'source_type CHECK constraint · Live Network Meter · intro_receipts timestamped log',
  },
  {
    id: 'G2',
    color: '#00C4A0',
    headline: 'Every job is fresh, or it\'s flagged.',
    kills: 'Kills "that role closed months ago."',
    body: [
      'Every cached role has a last_verified_at timestamp. Freshness is computed at read time — not from a stored value — every time you open the feed. Fresh: under 48 hours. Aging: 2–7 days. Stale: 7–14 days, demoted and badged. Expired: removed from your default view.',
      'A daily cron at 06:00 UTC re-verifies every role. The Freshness Pulse dot on each card shows exactly when it was last confirmed active. "Still open?" lets you trigger a live re-check in seconds.',
    ],
    built: 'lib/freshness.js (read-time enforcement) · Freshness Pulse badge · daily cron 06:00 UTC · "Still open?" one-tap recheck',
  },
  {
    id: 'G3',
    color: '#A855F7',
    headline: 'We never forget you.',
    kills: 'Kills "it forgot me / rolling glitch."',
    body: [
      'Your profile is a structured database record — not a chat log. Every AI call reads your profile fresh from Supabase on every request. It does not rely on what you said in a previous message. Close the browser, return in a month: your profile, pipeline, CV, and career history are byte-identical.',
      'The Memory Card in your Profile tab shows everything Requite knows about you. Every field is editable. Nothing is inferred from conversation — only what you\'ve explicitly set. A loop guard detects AI repetition automatically and switches to a structured fallback.',
    ],
    built: 'Supabase profiles table (source of truth) · lib/ai-context.js (bounded, stateless) · lib/loop-guard.js · Memory Card component',
  },
  {
    id: 'G4',
    color: '#6366F1',
    headline: 'Tracking isn\'t a feature. It\'s the spine.',
    kills: 'Kills "no way to keep track."',
    body: [
      'Your pipeline is the default landing screen — not a bonus tab you have to find. Analysing any role auto-adds it to your Watchlist. No manual step. No extra click. Your pipeline is stored in Supabase, not browser memory — it survives logout, cache clears, and device changes.',
      'The momentum strip at the top of your pipeline shows live counts: roles applied to, interviews active, offers in. Losing your place is structurally impossible — your place is the data.',
    ],
    built: 'pipeline_items table (Supabase-backed) · auto-capture from Analyse tab · Pipeline as default landing · momentum strip',
  },
]

const AI_ROWS = [
  {
    what: 'Job scores (Analyse tab)',
    how: 'Claude Haiku AI — reads the JD against your profile across 8 factors',
    human: 'You choose which role to analyse',
  },
  {
    what: 'Employer shortlist scores',
    how: 'Deterministic algorithm — 6 weighted dimensions, no AI, no hallucination risk',
    human: '—',
  },
  {
    what: 'AI "why" narrative',
    how: 'Claude Haiku — the one-line reason beneath each score',
    human: 'You trigger the analysis',
  },
  {
    what: 'CV & cover letter generation',
    how: 'Claude Haiku — drafted from your profile. Every number is checked against your CV before delivery; flagged if not found',
    human: 'You review and edit before using',
  },
  {
    what: 'Introductions',
    how: 'Algorithmic match surfaces candidates to employers anonymously; both sides manually confirm',
    human: 'Employer clicks "Request intro"; you click "Accept" — both must say yes',
  },
  {
    what: 'Role sourcing',
    how: 'Automated from licensed sources (Adzuna, Gov.uk) + employer-posted managed roles',
    human: '—',
  },
]

export default function TrustPanel() {
  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}>

      {/* ── Nav ── */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px clamp(20px,5vw,64px)', background: 'var(--marker-black)', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/" style={{ textDecoration: 'none' }}><Logo size={22} light /></Link>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link href="/app" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textDecoration: 'none' }}>Dashboard</Link>
          <Link href="/auth" style={{ background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '8px 18px', borderRadius: 7, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Start free</Link>
        </div>
      </nav>

      {/* ── Hero — dark aurora ── */}
      <div className="aurora-bg" style={{ background: 'var(--marker-black)', padding: 'clamp(72px,10vw,120px) clamp(20px,8vw,80px) clamp(56px,8vw,96px)', textAlign: 'center' }}>
        <div className="kicker holo-text" style={{ marginBottom: 20, fontSize: 11, letterSpacing: '0.15em' }}>Trust Panel · {BRAND_NAME}</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(38px,6vw,80px)', letterSpacing: '-0.035em', lineHeight: 0.93, color: 'var(--marker-cream)', margin: '0 auto 28px', maxWidth: 900 }}>
          Why you can trust<br />
          <span className="chrome-text">{BRAND_NAME}.</span>
        </h1>
        <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'rgba(250,247,242,0.6)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 48px', fontWeight: 400 }}>
          Every claim below is backed by a coded invariant — a rule written into the system that makes the opposite structurally impossible. Not a policy. Not a promise. A constraint.
        </p>
        <div className="iris-divider" style={{ maxWidth: 180, margin: '0 auto' }} />
      </div>

      {/* ── Four guarantees ── */}
      <section style={{ maxWidth: 780, margin: '0 auto', padding: 'clamp(56px,8vw,80px) clamp(20px,5vw,48px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {GUARANTEES.map(g => (
            <div key={g.id} style={{
              background: 'var(--marker-cream-2)',
              border: '1px solid var(--marker-border)',
              borderLeft: `4px solid ${g.color}`,
              borderRadius: '0 14px 14px 0',
              padding: 'clamp(20px,3vw,32px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: g.color, letterSpacing: '0.1em', background: `${g.color}22`, padding: '3px 9px', borderRadius: 4 }}>{g.id}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em' }}>{g.kills}</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px,3vw,26px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 16 }}>{g.headline}</h2>
              {g.body.map((para, i) => (
                <p key={i} style={{ fontSize: 14, color: 'var(--marker-text-soft)', lineHeight: 1.7, marginBottom: i < g.body.length - 1 ? 12 : 16 }}>{para}</p>
              ))}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.05em', paddingTop: 12, borderTop: '1px solid var(--marker-border)' }}>
                Built in: {g.built}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI vs Human disclosure ── */}
      <section style={{ background: 'var(--marker-black)', padding: 'clamp(48px,7vw,72px) clamp(20px,5vw,80px)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div className="kicker holo-text" style={{ marginBottom: 12, fontSize: 11, letterSpacing: '0.12em' }}>Transparency</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,4vw,40px)', fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 8 }}>What's AI, what's human?</h2>
          <p style={{ fontSize: 14, color: 'rgba(250,247,242,0.5)', marginBottom: 36, lineHeight: 1.6 }}>Honest about what's automated and what isn't — before you use it.</p>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.2fr', gap: 16, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 4 }}>
            {['What', 'How it works', 'Your choice'].map(h => (
              <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {AI_ROWS.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.2fr', gap: 16, padding: '14px 0', borderBottom: `1px solid rgba(255,255,255,${i < AI_ROWS.length - 1 ? '0.06' : '0'})` }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.01em', lineHeight: 1.4 }}>{row.what}</div>
              <div style={{ fontSize: 12, color: 'rgba(250,247,242,0.55)', lineHeight: 1.6 }}>{row.how}</div>
              <div style={{ fontSize: 12, color: row.human === '—' ? 'rgba(255,255,255,0.2)' : 'var(--marker-lime)', lineHeight: 1.6 }}>{row.human}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Honest limits ── */}
      <section style={{ maxWidth: 780, margin: '0 auto', padding: 'clamp(56px,7vw,72px) clamp(20px,5vw,48px)' }}>
        <div className="kicker" style={{ marginBottom: 12, fontSize: 11, letterSpacing: '0.12em' }}>Pricing — no surprises</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,4vw,38px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 36 }}>Honest limits,<br />upfront.</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {/* Candidate */}
          <div style={{ border: '1px solid var(--marker-border)', borderRadius: 14, padding: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Candidate</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 4 }}>Free, forever.</div>
            <p style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 20, lineHeight: 1.6 }}>Full pipeline, job feed, scored discovery, Memory Card, career history, wishlist tracker.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'AI role scoring — 3 analyses/day on free tier',
                'Unlimited pipeline tracking',
                'Memory Card — everything we know about you, editable',
                'Pro (£12–19/mo): unlimited AI, interview prep, CV tailoring',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: i === 0 ? '#F59E0B' : i === 3 ? 'var(--marker-mid)' : 'var(--marker-lime)', fontSize: 12, flexShrink: 0, marginTop: 1 }}>{i === 3 ? '→' : '✓'}</span>
                  <span style={{ fontSize: 12, color: i === 3 ? 'var(--marker-mid)' : 'var(--marker-text-soft)', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Employer */}
          <div style={{ border: '1px solid var(--marker-border)', borderRadius: 14, padding: 24, background: 'var(--marker-cream-2)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Employer</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 4 }}>8% on hire.</div>
            <p style={{ fontSize: 13, color: 'var(--marker-mid)', marginBottom: 20, lineHeight: 1.6 }}>Matched, anonymised, opted-in shortlist. Real warm intros. Per-role ATS. Pay only on confirmed hire.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'No upfront fee — success fee only',
                '8% of first-year base salary',
                '3-month leaver refund',
                'Undercuts traditional agencies (20–30%) and J&J (10%)',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--marker-lime)', fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 12, color: 'var(--marker-text-soft)', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Support ── */}
      <section style={{ background: 'var(--marker-cream-2)', borderTop: '1px solid var(--marker-border)', borderBottom: '1px solid var(--marker-border)', padding: 'clamp(40px,6vw,64px) clamp(20px,5vw,48px)', textAlign: 'center' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="kicker" style={{ marginBottom: 12, fontSize: 11, letterSpacing: '0.12em' }}>Support</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 12 }}>We respond to every message.</h2>
          <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.7, marginBottom: 24 }}>
            This is a small team — not a ticket queue. We read everything and reply within 24 hours on weekdays.
          </p>
          <a href="mailto:support@requite.io" style={{ display: 'inline-block', background: 'var(--marker-black)', color: 'var(--marker-cream)', padding: '12px 28px', borderRadius: 9, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
            Email support@requite.io →
          </a>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginTop: 14, letterSpacing: '0.04em' }}>Reply within 24h on weekdays</div>
        </div>
      </section>

      {/* ── CTA footer ── */}
      <section className="aurora-bg" style={{ background: 'var(--marker-black)', padding: 'clamp(56px,8vw,80px) clamp(20px,5vw,48px)', textAlign: 'center' }}>
        <div className="kicker holo-text" style={{ marginBottom: 16, fontSize: 11, letterSpacing: '0.14em' }}>Free for candidates. Pay on hire for employers.</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,4vw,48px)', fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 32 }}>
          The only AI recruitment platform<br />honest enough to show you how it works.
        </h2>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/auth" className="btn-iris-sheen" style={{ display: 'inline-block', background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '13px 32px', borderRadius: 9, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, textDecoration: 'none', position: 'relative', overflow: 'hidden' }}>
            Start free — candidates
          </Link>
          <Link href="/hire" style={{ display: 'inline-block', background: 'transparent', color: 'rgba(250,247,242,0.7)', border: '1px solid rgba(255,255,255,0.15)', padding: '13px 28px', borderRadius: 9, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Post a role →
          </Link>
        </div>
        <div style={{ marginTop: 40, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 28, display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          {[['/', 'Home'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/notes', 'Notes'], ['/hire', 'For employers']].map(([href, label]) => (
            <Link key={href} href={href} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </section>

    </div>
  )
}
