import Link from 'next/link'
import Image from 'next/image'
import { BRAND_NAME } from '../../lib/brand'
import { articles } from '../../lib/articles'
import { getSlugImage } from '../../lib/lifestyle'
import styles from './notes.module.css'

export const metadata = {
  title: 'Notes | Requite',
  description: 'Straight talk on the experienced job hunt: flexible working, salary negotiation, CV mistakes, and what actually matters when you know what you want.',
}

function Logo({ size = 20 }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 500,
      letterSpacing: '-0.03em', color: 'var(--marker-black)',
      display: 'inline-flex', alignItems: 'baseline', lineHeight: 1,
    }}>
      {BRAND_NAME.toLowerCase()}
      <span style={{
        display: 'inline-block', width: '0.32em', height: '0.32em',
        borderRadius: '50%', marginLeft: '0.05em', position: 'relative',
        top: '-0.55em', flexShrink: 0,
        background: 'conic-gradient(from 210deg, #e080c8 0deg, #80b8ff 55deg, #70d890 110deg, #f5d840 165deg, #ff8cc0 220deg, #a080ff 275deg, #e080c8 360deg)',
      }} />
    </span>
  )
}

function HeroPattern({ pattern, accent, accentLight }) {
  const configs = {
    blue:   { c1: '#5090f0', c2: '#80b8ff', c3: '#EEF4FF', shapes: [[60,40,80], [140,90,50], [30,100,35]] },
    green:  { c1: '#50c878', c2: '#70d890', c3: '#EDFCF3', shapes: [[50,50,90], [150,80,45], [20,110,30]] },
    pink:   { c1: '#d84888', c2: '#ff8cc0', c3: '#FEF0F6', shapes: [[70,35,75], [130,100,55], [25,90,40]] },
    yellow: { c1: '#e8c830', c2: '#f5d840', c3: '#FEFBEC', shapes: [[45,55,85], [145,75,50], [35,105,32]] },
    purple: { c1: '#a060d8', c2: '#c080ff', c3: '#F6F0FF', shapes: [[55,45,80], [135,85,48], [28,100,38]] },
  }
  const cfg = configs[pattern] || configs.blue

  return (
    <svg width="100%" height="100%" viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="140" fill={cfg.c3} />
      {cfg.shapes.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill={i === 0 ? cfg.c1 : cfg.c2}
          opacity={i === 0 ? 0.12 : 0.08} />
      ))}
      <circle cx="160" cy="30" r="18"
        fill="none" stroke={cfg.c1} strokeWidth="1.5" opacity="0.2" />
      <line x1="0" y1="0" x2="200" y2="140"
        stroke={cfg.c2} strokeWidth="0.5" opacity="0.15" />
      <line x1="200" y1="0" x2="0" y2="140"
        stroke={cfg.c1} strokeWidth="0.5" opacity="0.1" />
      <circle cx="160" cy="30" r="8"
        fill={cfg.c1} opacity="0.7" />
      <circle cx="156" cy="27" r="3"
        fill="white" opacity="0.5" />
    </svg>
  )
}

function FeaturedCard({ article }) {
  const formattedDate = new Date(article.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <Link href={`/notes/${article.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
      <article className={styles.cardFeatured} style={{
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--marker-border)',
      }}>
        <div className={styles.cardFeaturedInner}>
          <div className={styles.cardFeaturedImage}>
            <Image
              src={article.heroImage || getSlugImage(article.slug).src}
              alt={article.title} fill
              style={{ objectFit: 'cover', objectPosition: '85% center' }}
            />
          </div>
          <div className={styles.cardFeaturedText}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {article.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{
                  fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500,
                  color: article.accent, background: article.accentLight,
                  padding: '3px 10px', borderRadius: 20, letterSpacing: '0.02em',
                }}>{tag}</span>
              ))}
            </div>
            <h2 className={styles.cardFeaturedTitle}>{article.title}</h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--marker-text-soft)',
              lineHeight: 1.65, marginBottom: 28,
            }}>{article.excerpt}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)' }}>
                {formattedDate}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--marker-border)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)' }}>
                {article.readTime} min read
              </span>
              <span style={{
                marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: 13,
                fontWeight: 500, color: article.accent,
              }}>Read →</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}

function ArticleCard({ article }) {
  const formattedDate = new Date(article.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <Link href={`/notes/${article.slug}`} style={{ display: 'block', textDecoration: 'none', height: '100%' }}>
      <article className={styles.card} style={{
        background: 'white',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid var(--marker-border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ height: 160, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <Image
            src={article.heroImage || getSlugImage(article.slug).src}
            alt={article.title} fill
            style={{ objectFit: 'cover', objectPosition: '85% center' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, transparent 50%, rgba(10,10,10,0.35) 100%)',
          }} />
        </div>
        <div style={{ padding: '24px 24px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {article.tags.slice(0, 2).map(tag => (
              <span key={tag} style={{
                fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 500,
                color: article.accent, background: article.accentLight,
                padding: '2px 8px', borderRadius: 20, letterSpacing: '0.02em',
              }}>{tag}</span>
            ))}
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600,
            color: 'var(--marker-black)', lineHeight: 1.3, marginBottom: 10,
            letterSpacing: '-0.02em', flex: 1,
          }}>{article.title}</h2>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--marker-text-soft)',
            lineHeight: 1.6, marginBottom: 18,
          }}>{article.excerpt}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--marker-mid)' }}>
              {formattedDate}
            </span>
            <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--marker-border)' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--marker-mid)' }}>
              {article.readTime} min
            </span>
            <span style={{
              marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: 12,
              fontWeight: 500, color: article.accent,
            }}>Read →</span>
          </div>
        </div>
      </article>
    </Link>
  )
}

export default function NotesPage() {
  const [featured, ...rest] = articles

  return (
    <div style={{ minHeight: '100vh', background: 'var(--marker-cream)' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250, 247, 242, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--marker-border)',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56,
        }}>
          <Link href="/">
            <Logo size={20} />
          </Link>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <Link href="/" style={{
              fontFamily: 'var(--font-body)', fontSize: 13.5,
              color: 'var(--marker-mid)', fontWeight: 400,
            }}>Home</Link>
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 13.5,
              color: 'var(--marker-black)', fontWeight: 500,
            }}>Notes</span>
            <Link href="/auth/login" style={{
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
              color: 'white', background: 'var(--marker-black)',
              padding: '7px 16px', borderRadius: 8,
            }}>Sign in</Link>
          </div>
        </div>
      </nav>

      {/* Rainbow bar */}
      <div className="holo-hairline" />

      {/* Header */}
      <header style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 24px 48px' }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
            color: 'var(--marker-mid)', letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: 16,
          }}>Notes &amp; thinking</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 600,
            color: 'var(--marker-black)', lineHeight: 1.1, letterSpacing: '-0.03em',
            marginBottom: 18,
          }}>
            For experienced people<br />who&apos;d quite like their<br />
            <span style={{
              background: 'linear-gradient(90deg, #5090f0 0%, #a060d8 50%, #d84888 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>evenings back.</span>
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--marker-text-soft)',
            lineHeight: 1.7, maxWidth: 480,
          }}>
            Straight talk on job hunting at Director level and above. Flexible working lies,
            salary negotiation, CV mistakes, and what actually matters.
          </p>
        </div>
      </header>

      {/* Articles */}
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px 96px' }}>
        <div style={{ marginBottom: 48 }}>
          <FeaturedCard article={featured} />
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 24,
        }}>
          {rest.map(article => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--marker-border)',
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <Link href="/">
            <Logo size={16} />
          </Link>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--marker-mid)',
            marginTop: 12, lineHeight: 1.6,
          }}>
            AI-generated scores and summaries. Not professional career advice.
          </p>
        </div>
      </footer>
    </div>
  )
}
