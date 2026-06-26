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

const PROMISES = [
  {
    title: 'Everything in one place.',
    body: "Discover roles, score them, track your whole pipeline, tailor your CV, prep interviews, rehearse negotiations: start to finish, on one board. No spreadsheet, no fifteen open tabs.",
  },
  {
    title: 'A score you can actually read.',
    body: "Every role gets scored across six things you care about: salary, seniority fit, location, office days, freshness, and culture signals. You can see the reasoning behind each one. Not a mystery rating you're meant to take on faith.",
  },
  {
    title: 'It remembers you.',
    body: "Your profile, preferences and pipeline live in your account, not in a chatbot's memory. Close the tab, come back next month; it's all exactly where you left it. You can see everything it knows on your Memory Card, and edit any of it.",
  },
]

const scoreRows = [
  ['Role fit', '9.4'],
  ['Office days', '1 / wk'],
  ['Salary v market', '+8%'],
  ['Parental leave', 'found · 6mo'],
  ['WLB score', '4.1'],
  ['Culture', '8.6'],
]

const balancedRows = [
  { co: 'BBC',           wlb: '4.3', leave: '6mo',  office: '2d', score: '8.7' },
  { co: 'Nationwide',    wlb: '4.4', leave: '12mo', office: '1d', score: '9.1' },
  { co: 'Ofcom',         wlb: '4.5', leave: '6mo',  office: '2d', score: '8.8' },
  { co: 'Wellcome Trust',wlb: '4.6', leave: '6mo',  office: '1d', score: '9.0' },
  { co: 'GitLab',        wlb: '4.2', leave: '4mo',  office: '0d', score: '8.6' },
]

const FALLBACK_TAGLINE = "Requite scores each role against what actually matters to you (salary, seniority, location, office days, and more) and shows you why. Then it keeps your whole search in one place: discover roles, track them, tailor your CV, prep the interview. And it remembers everything, so you never start from scratch."
const MOBILE_TAGLINE = "Score roles against what matters. No noise, no amnesia, no wasted evenings."

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
          <a href="#promises">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link href="/notes">Notes</Link>
          <Link href="/trust" style={{ color: 'var(--marker-mid)' }}>Why trust us</Link>
          <Link href="/hire" style={{ color: 'var(--marker-mid)' }}>For employers</Link>
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
      <section className={`${styles.hero} aurora-bg`}>
        <div style={{ maxWidth: 1100 }}>
          <div className="holo-text" style={{
            fontFamily: 'var(--font-body)', fontSize: 'clamp(17px, 2vw, 22px)', fontWeight: 500,
            letterSpacing: '-0.015em', lineHeight: 1.4, marginBottom: 20,
            display: 'inline-block',
          }}>
            For senior professionals who&apos;d quite like their evenings back.
          </div>
          <h1 className="display-xl" style={{ fontSize: 'clamp(40px, 8vw, 120px)', marginBottom: 24, textWrap: 'balance' }}>
            <span className="chrome-text">Score every job before you waste time on it.</span>
          </h1>
          <p className={`body ${styles.heroBody} ${styles.heroBodyDesktop}`}>
            {activeTagline?.tagline_text || FALLBACK_TAGLINE}
          </p>
          <p className={`body ${styles.heroBody} ${styles.heroBodyMobile}`}>
            {MOBILE_TAGLINE}
          </p>

          <div className={styles.heroActions}>
            <TrackCTA href="/auth" event="cta_clicked" props={{ location: 'hero' }} className="btn btn-lime" style={{ fontSize: 16, padding: '14px 26px', fontWeight: 600 }}>Start free: score a role in 60 seconds</TrackCTA>
            <a href="#promises" className="btn btn-ghost" style={{ fontSize: 14, padding: '13px 20px' }}>See how it works →</a>
            <span className={styles.heroNote}>No card. No &ldquo;talk to sales.&rdquo; Cancel by closing the tab.</span>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--marker-mid)', marginTop: 20, lineHeight: 1.5 }}>
            No spray-and-pray, no monthly fee to find out a job closed last week.
          </p>
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
              <span className="chip" style={{ fontSize: 9 }}>WORTH IT</span>
            </div>
            <AdzunaBadge />
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--marker-border)' }}>
            <AIDisclaimer />
          </div>
        </div>
      </section>

      {/* Holo divider, hero → freshness */}
      <div className="holo-hairline" />

      {/* ── FRESHNESS STRIP ── */}
      <section style={{ padding: '32px 64px', background: 'var(--marker-black)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(15px, 2vw, 20px)', color: 'var(--marker-cream)', textAlign: 'center', maxWidth: 820, lineHeight: 1.55, margin: 0 }}>
          Every job shows when it was last checked. Stale ones get flagged, closed ones get removed, so you&apos;re only ever spending effort on roles that are actually open.{' '}
          <span style={{ color: 'var(--marker-lime)', fontWeight: 500 }}>(No more polishing a cover letter for something that died last week.)</span>
        </p>
      </section>

      {/* Holo divider, freshness → ambient */}
      <div className="holo-hairline" />

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
            At this stage, you know exactly what you will not compromise on. The problem is that most job boards are not built for people who have standards.
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

      {/* Holo divider, stats → promises */}
      <div className="holo-hairline" />

      {/* ── THREE PROMISES ── */}
      <section id="promises" className={styles.howSection}>
        <div className={styles.howHeader}>
          <div>
            <div className="kicker holo-text" style={{ marginBottom: 16 }}>How it works</div>
            <h2 className="display-lg" style={{ fontSize: 'clamp(40px, 5vw, 64px)', color: 'var(--marker-black)', maxWidth: 720 }}>
              Three things, done properly.<br />
              <span style={{ color: 'var(--marker-mid)' }}>Nothing else.</span>
            </h2>
          </div>
          <div className={styles.howSub}>
            Built for people who have stopped pretending that almost-right is good enough.
          </div>
        </div>
        <div className={styles.stepsGrid}>
          {PROMISES.map((p, i) => (
            <div key={p.title} className={`card ${styles.stepCard}`}>
              <div className="kicker holo-text">{String(i + 1).padStart(2, '0')}</div>
              <div className="display-md" style={{ fontSize: 'clamp(24px, 3vw, 32px)', color: 'var(--marker-black)' }}>{p.title}</div>
              <div className="body" style={{ fontSize: 15 }}>{p.body}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Link href="/trust" style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--marker-text)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
            We can back every word of that. Here&apos;s exactly how →
          </Link>
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE ── */}
      <div className="holo-hairline" />
      <section className={styles.productShowcase}>
        <Image
          src="/brand/product-showcase.png"
          alt={`${BRAND_NAME}: AI copilot for experienced job hunters`}
          width={2400}
          height={1200}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </section>

      {/* Holo divider, showcase → personas */}
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
              <div className={styles.personaLine}>Looking for the next step, not just a lateral move. Done with roles where &ldquo;flexible&rdquo; means Fridays at home if you ask nicely.</div>
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
              Anchored to verified public data. We don&apos;t take companies&apos; word for it. We check.
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
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #2A2A2A' }}>
              <AIDisclaimer light />
            </div>
          </div>
        </div>
      </section>

      {/* Holo divider, balanced → pricing */}
      <div className="holo-hairline" />

      <PricingSection />

      {/* Holo divider, pricing → referral */}
      <div className="holo-hairline" />

      {/* ── REFERRAL ── */}
      <section style={{ padding: '64px 64px', background: 'var(--marker-cream-2)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 600, textAlign: 'center' }}>
          <div className="kicker" style={{ marginBottom: 16 }}>Know someone who should be using this?</div>
          <p style={{ fontSize: 17, color: 'var(--marker-text)', lineHeight: 1.65, marginBottom: 28 }}>
            Share your link. If they land a role through {BRAND_NAME}, there&apos;s a thank-you in it for both of you.
          </p>
          <TrackCTA href="/app" event="referral_cta_clicked" props={{ location: 'landing' }} className="btn btn-ghost" style={{ fontSize: 14 }}>
            Get your link →
          </TrackCTA>
        </div>
      </section>

      {/* Holo divider, referral → hiring */}
      <div className="holo-hairline" />

      {/* ── HIRING? STRIP ── */}
      <section style={{ padding: '80px 64px', background: 'var(--marker-black)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="kicker" style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Hiring, not job-hunting?</div>
          <h2 className="display-lg" style={{ fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--marker-cream)', marginBottom: 20, textWrap: 'balance' }}>
            Requite introduces you to candidates who fit your role and genuinely want it. Pre-screened, no CV spam. You only pay when you actually hire.
          </h2>
          <Link href="/hire" className="btn btn-lime btn-iris-sheen" style={{ fontWeight: 600, fontSize: 15, display: 'inline-flex' }}>For employers →</Link>
        </div>
      </section>

      {/* Holo divider, hiring → cta */}
      <div className="holo-hairline" />

      {/* ── CTA ── */}
      <section className={`${styles.ctaSection} aurora-bg`}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <div className="kicker" style={{ color: 'rgba(250,247,242,0.35)', marginBottom: 20 }}>Your next move</div>
          <h2 className="display-xl" style={{ fontSize: 'clamp(48px, 7vw, 96px)', marginBottom: 28, textWrap: 'balance' }}>
            <span className="chrome-text">Score every job before you waste time on it.</span>
          </h2>
          <div className="iris-divider" style={{ margin: '0 auto 28px', maxWidth: 240 }} />
          <p className={styles.ctaSub}>No card. No &ldquo;talk to sales.&rdquo; Cancel by closing the tab.</p>
          <TrackCTA href="/auth" event="cta_clicked" props={{ location: 'bottom_cta' }} className={`btn btn-lime btn-iris-sheen ${styles.ctaBtn}`} style={{ fontSize: 16, padding: '16px 28px', fontWeight: 600 }}>Start free: score a role in 60 seconds →</TrackCTA>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Logo size={18} />
            <span>© Requite · UK</span>
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
            <AIDisclaimer />
            <div className="legal-line">Live UK roles, including listings via Adzuna. Independently sourced and scored. Not affiliated with employers listed.</div>
          </div>
          <AdzunaBadge />
        </div>
      </footer>

    </div>
  )
}
