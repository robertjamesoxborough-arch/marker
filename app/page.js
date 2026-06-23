import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@supabase/supabase-js'
import { BRAND_NAME } from '../lib/brand'
import styles from './marketing.module.css'
import PricingSection from './PricingSection'
import TaglineTracker from '../components/TaglineTracker'
import TrackCTA from '../components/TrackCTA'
import RotatingLifestyle from '../components/RotatingLifestyle'
import NavHamburger from '../components/NavHamburger'

function Logo({ size = 20 }) {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--marker-black)', display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      {BRAND_NAME.toLowerCase()}
      <span className="holo-dot" style={{ display: 'inline-block', width: '0.32em', height: '0.32em', borderRadius: '50%', marginLeft: '0.05em', position: 'relative', top: '-0.55em', flexShrink: 0 }} />
    </span>
  )
}

function AdzunaBadge() {
  return <div className="adzuna-badge">Jobs by Adzuna</div>
}

function AIDisclaimer({ light }) {
  return (
    <div className="legal-line" style={{ color: light ? '#6B6B6B' : 'var(--marker-mid)' }}>
      AI-generated scores and summaries. Not professional career advice. Verify salary and leave data independently.
    </div>
  )
}

function ReviewDataLine({ light }) {
  return (
    <div className="legal-line" style={{ color: light ? '#6B6B6B' : 'var(--marker-mid)' }}>
      Balanced Roles data sourced from public employee reviews (Glassdoor, Trustpilot ≥ 500 reviews), Working Families benchmark, and employer policy pages. Aggregated, not individually verified.
    </div>
  )
}

function OGLLine() {
  return (
    <div className="legal-line">
      Gov.uk Jobs data contains public sector information licensed under the Open Government Licence v3.0.
    </div>
  )
}

const scoreRows = [
  ['Role fit', '9.4'],
  ['Office days', '1 / wk'],
  ['Salary v market', '+8%'],
  ['Parental leave', 'found · 6mo'],
  ['Glassdoor WLB', '4.1'],
  ['Culture', '8.6'],
]

const balancedRows = [
  { co: 'BBC',           wlb: '4.3', leave: '6mo',  office: '2d', score: '8.7' },
  { co: 'Nationwide',    wlb: '4.4', leave: '12mo', office: '1d', score: '9.1' },
  { co: 'Ofcom',         wlb: '4.5', leave: '6mo',  office: '2d', score: '8.8' },
  { co: 'Wellcome Trust',wlb: '4.6', leave: '6mo',  office: '1d', score: '9.0' },
  { co: 'GitLab',        wlb: '4.2', leave: '4mo',  office: '0d', score: '8.6' },
]

const steps = [
  { n: '01', title: 'Pick a track.', body: 'Balanced Roles, Standard, Parent, Returner, Career-changer. Each one comes with a different wishlist, different filters, and different language in your CV.', chip: 'Balanced Roles · default' },
  { n: '02', title: 'Mark what fits.', body: 'Every role is scored 1–10 across eight things you care about. Salary v market. Office days. Parental leave (verified, not guessed). Glassdoor WLB.', chip: '8-factor score' },
  { n: '03', title: "Apply, or don't.", body: "If a role scores well, go after it properly. If it doesn't, move on. No second-guessing. No evenings wasted on something that was never going to be right.", chip: 'Only apply when it fits' },
]


const FALLBACK_TAGLINE = "You already know what a good job looks like for you. The hard part is finding one fast enough. Marker scores every role against what actually matters: office flexibility, salary, parental leave, company culture. Spot the right one in 30 seconds. Skip everything else."
const MOBILE_TAGLINE = "Know which roles fit before you apply. Office days, salary, parental leave, all confirmed. 30 seconds per role."

export default async function Home() {
  let activeTagline = null
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data } = await sb.from('admin_taglines').select('id, tagline_text').eq('active', true).single()
    activeTagline = data || null
  } catch {}

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}>

      {/* ── NAV ── */}
      <div className={styles.nav}>

        <Logo size={26} />
        <nav className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#how">Tracks</a>
          <a href="#pricing">Pricing</a>
          <Link href="/notes">Notes</Link>
        </nav>
        <div className={styles.navActions}>
          <Link href="/auth" style={{ fontSize: 14 }} className={styles.navSignIn}>Sign in</Link>
          <TrackCTA href="/auth" event="cta_clicked" props={{ location: 'nav' }} className={`btn btn-lime ${styles.navCTA}`}>Start free</TrackCTA>
          <span className={styles.navBurger}><NavHamburger /></span>
        </div>
      </div>
      <div className={styles.navRule}><div className="holo-hairline" /></div>

      <TaglineTracker taglineId={activeTagline?.id ?? null} />

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div style={{ maxWidth: 1100 }}>
          <div className="holo-text" style={{
            fontFamily: 'var(--font-body)', fontSize: 'clamp(17px, 2vw, 22px)', fontWeight: 500,
            letterSpacing: '-0.015em', lineHeight: 1.4, marginBottom: 20,
            display: 'inline-block',
          }}>
            For experienced people who&apos;d quite like their evenings back
          </div>
          <h1 className="display-xl" style={{ fontSize: 'clamp(40px, 8vw, 120px)', marginBottom: 24, textWrap: 'balance' }}>
            <span className="chrome-text">Mark your moves.</span><br />
            <span style={{ color: 'var(--marker-mid)' }}>Skip the rest.</span>
          </h1>
          <p className={`body ${styles.heroBody} ${styles.heroBodyDesktop}`}>
            {activeTagline?.tagline_text || FALLBACK_TAGLINE}
          </p>
          <p className={`body ${styles.heroBody} ${styles.heroBodyMobile}`}>
            {MOBILE_TAGLINE}
          </p>

          {/* Feature highlights, the above-fold value prop */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
            {[
              { label: 'Know if a role fits before you apply', sub: '30 seconds' },
              { label: 'Office days & WLB, properly verified', sub: 'not guessed' },
              { label: 'Parental leave confirmed for every role', sub: 'not assumed' },
              { label: 'Spend effort only on roles that count', sub: 'skip the rest' },
            ].map(({ label, sub }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '7px 12px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--marker-lime)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-text)', fontWeight: 500 }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em' }}>{sub}</span>
              </div>
            ))}
          </div>

          <div className={styles.heroActions}>
            <TrackCTA href="/auth" event="cta_clicked" props={{ location: 'hero' }} className="btn btn-lime" style={{ fontSize: 16, padding: '14px 26px', fontWeight: 600 }}>Start free, 7 days →</TrackCTA>
            <a href="#how" className="btn btn-ghost" style={{ fontSize: 14, padding: '13px 20px' }}>See how it works</a>
            <span className={styles.heroNote}>No card. No "talk to sales". 60 seconds to your first score.</span>
          </div>
        </div>

        {/* Floating score card */}
        <div className={styles.heroCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)' }}>Monzo</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>Staff Product Manager</div>
            </div>
            <div className="holo-foil" style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, padding: '6px 12px', borderRadius: 6, color: 'var(--marker-black)' }}>9.2</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {scoreRows.map(([l, v]) => (
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

      {/* Holo divider, hero → proof */}
      <div className="holo-hairline" />

      {/* ── SOCIAL PROOF STRIP ── */}
      <section className={styles.proofStrip}>
        <div className={styles.proofInner}>
          <div className="kicker" style={{ whiteSpace: 'nowrap' }}>Pulls from</div>
          {['Greenhouse', 'Adzuna', 'Gov.uk', 'Working Families', 'Public reviews'].map(s => (
            <div key={s} className={styles.proofItem}>{s}</div>
          ))}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-mid)', whiteSpace: 'nowrap' }}>+ 4 more</div>
        </div>
      </section>

      {/* ── AMBIENT LIFESTYLE STRIP, rotates daily ── */}
      <section className={styles.ambientHero}>
        <RotatingLifestyle priority />
      </section>

      {/* Holo divider, ambient → stats */}
      <div className="holo-hairline" />

      {/* ── THE REALITY STATS ── */}
      <section className={styles.statsSection}>
        <div className={styles.statsCopy}>
          <div className="kicker" style={{ marginBottom: 16 }}>The reality</div>
          <h2 className="display-lg" style={{ fontSize: 'clamp(32px, 4vw, 52px)', color: 'var(--marker-black)', marginBottom: 20, textWrap: 'balance' }}>
            Experienced job hunting<br />plays by different rules.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--marker-mid)', lineHeight: 1.7, maxWidth: 400 }}>
            At this stage, you know exactly what you will not compromise on. The problem is that most job boards are not built for people who have standards. Marker is.
          </p>
        </div>
        <div className={styles.statsCards}>
          <div className={styles.statCard} style={{ '--rot': '-2.5deg' }}>
            <Image src="/brand/05-linkedin-stat-1.jpg" alt="74% of senior professionals aren't actively looking but are open to the right opportunity" width={400} height={400} style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }} />
          </div>
          <div className={styles.statCard} style={{ '--rot': '1.5deg' }}>
            <Image src="/brand/06-linkedin-stat-2.jpg" alt="3x shortlisted rate increase when your CV is tailored to the role" width={400} height={400} style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }} />
          </div>
          <div className={styles.statCard} style={{ '--rot': '-1deg' }}>
            <Image src="/brand/07-linkedin-stat-3.jpg" alt="82% of senior hires come from network, not job boards" width={400} height={400} style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }} />
          </div>
        </div>
      </section>

      {/* Holo divider, stats → how */}
      <div className="holo-hairline" />

      {/* ── HOW IT WORKS ── */}
      <section id="how" className={styles.howSection}>
        <div className={styles.howHeader}>
          <div>
            <div className="kicker holo-text" style={{ marginBottom: 16 }}>How it works</div>
            <h2 className="display-lg" style={{ fontSize: 'clamp(40px, 5vw, 64px)', color: 'var(--marker-black)', maxWidth: 720 }}>
              Three things, done well.<br />
              <span style={{ color: 'var(--marker-mid)' }}>Nothing else.</span>
            </h2>
          </div>
          <div className={styles.howSub}>
            Built for people who have stopped pretending that almost-right is good enough.
          </div>
        </div>
        <div className={styles.stepsGrid}>
          {steps.map(s => (
            <div key={s.n} className={`card ${styles.stepCard}`}>
              <div className="kicker holo-text">{s.n}</div>
              <div className="display-md" style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: 'var(--marker-black)' }}>{s.title}</div>
              <div className="body" style={{ fontSize: 15 }}>{s.body}</div>
              <div style={{ marginTop: 'auto' }}>
                <span className="chip" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-body)', fontSize: 11 }}>{s.chip}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE ── */}
      <div className="holo-hairline" />
      <section className={styles.productShowcase}>
        <Image
          src="/brand/product-showcase.png"
          alt="Marker, the AI copilot for experienced job hunters"
          width={2400}
          height={1200}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </section>

      {/* Holo divider, how → personas */}
      <div className="holo-hairline" />

      {/* ── WHO IT'S FOR ── */}
      <section className={styles.personaSection}>
        <div className={styles.personaHeader}>
          <div className="kicker holo-text" style={{ marginBottom: 16 }}>Who it&apos;s for</div>
          <h2 className="display-lg" style={{ fontSize: 'clamp(32px, 4vw, 52px)', color: 'var(--marker-black)', marginBottom: 0, textWrap: 'balance' }}>
            People who&apos;ve earned<br />the right to be specific.
          </h2>
        </div>
        <div className={styles.personaGrid}>
          <div className={styles.personaCard}>
            <div className={styles.personaPortrait}>
              <Image src="/brand/01-sam-portrait.jpg" alt="Head of Product considering their next move" width={320} height={320} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className={styles.personaText}>
              <div className={styles.personaRole}>Head of Product · 8 years in</div>
              <div className={styles.personaLine}>Looking for the next step, not just a lateral move. Done with roles where "flexible" means Fridays at home if you ask nicely.</div>
            </div>
          </div>
          <div className={styles.personaCard}>
            <div className={styles.personaPortrait}>
              <Image src="/brand/02-priya-portrait.jpg" alt="Marketing Director returning to work with clear priorities" width={320} height={320} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className={styles.personaText}>
              <div className={styles.personaRole}>Marketing Director · parent · returner</div>
              <div className={styles.personaLine}>Back in market after mat leave. Has a clear view of what matters now. Needs the job hunt to fit around real life, not eat it.</div>
            </div>
          </div>
          <div className={styles.personaCard}>
            <div className={styles.personaPortrait}>
              <Image src="/brand/03-james-portrait.jpg" alt="Commercial Director with two decades of experience" width={320} height={320} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className={styles.personaText}>
              <div className={styles.personaRole}>Commercial Director · 20 years in</div>
              <div className={styles.personaLine}>Has done it the hard way. Knows exactly what he won&apos;t do again. Wants to move once, deliberately, and get it right.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Holo divider, personas → balanced */}
      <div className="holo-hairline" />

      {/* ── BALANCED ROLES ── */}
      <section className={styles.balancedSection}>
        <div className={styles.balancedInner}>
          <div>
            <div className="kicker" style={{ color: '#C6F432', marginBottom: 24 }}>The Balanced Roles track</div>
            <h2 className="display-lg" style={{ fontSize: 'clamp(32px, 4vw, 56px)', color: 'var(--marker-cream)', marginBottom: 24, textWrap: 'balance' }}>
              Companies where work-life balance is a fact, not a slide.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--marker-cream)', opacity: 0.7, marginBottom: 32, lineHeight: 1.6, maxWidth: 480 }}>
              Anchored to public data: Glassdoor WLB ratings, Working Families benchmark, verified parental leave policies. We don't take companies' word for it. We check.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Public sector', 'Education / EdTech', 'Large stable corporates', 'Remote-first w/ culture'].map(t => (
                <span key={t} style={{ border: '1px solid #2A2A2A', padding: '8px 14px', borderRadius: 6, fontSize: 13, color: 'var(--marker-cream)' }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {balancedRows.map(r => (
              <div key={r.co} className={styles.balancedRow}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--marker-cream)' }}>{r.co}</div>
                <div className={styles.balancedMeta}>WLB {r.wlb}</div>
                <div className={styles.balancedMeta}>Leave {r.leave}</div>
                <div className={styles.balancedMeta}>Office {r.office}</div>
                <div style={{ background: 'var(--marker-lime)', color: 'var(--marker-black)', fontFamily: 'var(--font-display)', fontWeight: 500, textAlign: 'center', padding: '4px 0', borderRadius: 4 }}>{r.score}</div>
              </div>
            ))}
            <div className="legal-line" style={{ color: '#6B6B6B', marginTop: 8 }}>
              Citations: aggregated public employee reviews (≥ 500), Working Families benchmark, employer policy pages
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <ReviewDataLine light />
              <AIDisclaimer light />
            </div>
          </div>
        </div>
      </section>

      {/* Holo divider, balanced → pricing */}
      <div className="holo-hairline" />

      <PricingSection />

      {/* Holo divider, pricing → cta */}
      <div className="holo-hairline" />

      {/* ── CTA, lifestyle image background, rotates daily ── */}
      <section className={styles.ctaSection}>
        <RotatingLifestyle />
        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.80)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="display-xl" style={{ fontSize: 'clamp(48px, 7vw, 96px)', color: 'var(--marker-cream)', marginBottom: 24, textWrap: 'balance' }}>
            The job hunt, marked.
          </h2>
          <div className="holo-hairline" style={{ margin: '0 auto 24px', maxWidth: 320 }} />
          <p className={styles.ctaSub}>Seven days free. No card. Cancel by closing the tab.</p>
          <TrackCTA href="/auth" event="cta_clicked" props={{ location: 'bottom_cta' }} className="btn btn-lime" style={{ fontSize: 16, padding: '16px 28px', fontWeight: 600 }}>Start free, 7 days →</TrackCTA>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Logo size={18} />
            <span>© Marker Ltd · UK</span>
          </div>
          <div className={styles.footerLinks}>
            {[
              { l: 'Notes', href: '/notes' },
              { l: 'Privacy', href: '/privacy' },
              { l: 'Terms', href: '/terms' },
              { l: 'Cookies', href: '/cookies' },
              { l: 'DPA', href: null },
              { l: 'Status', href: null },
            ].map(({ l, href }) => href
              ? <a key={l} href={href} style={{ color: 'inherit', textDecoration: 'none' }}>{l}</a>
              : <span key={l} style={{ opacity: 0.4 }}>{l}</span>
            )}
          </div>
        </div>
        <div className={styles.footerBottom}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, maxWidth: 720 }}>
            <OGLLine />
            <ReviewDataLine />
            <AIDisclaimer />
          </div>
          <AdzunaBadge />
        </div>
      </footer>

    </div>
  )
}
