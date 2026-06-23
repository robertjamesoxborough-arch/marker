import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { articles } from '../../../lib/articles'
import { getSlugImage } from '../../../lib/lifestyle'
import styles from '../notes.module.css'

export async function generateStaticParams() {
  return articles.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }) {
  const article = articles.find(a => a.slug === params.slug)
  if (!article) return {}
  return {
    title: `${article.title} — Marker`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
    },
  }
}

function Logo({ size = 20 }) {
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 500,
      letterSpacing: '-0.03em', color: 'var(--marker-black)',
      display: 'inline-flex', alignItems: 'baseline', lineHeight: 1,
    }}>
      marker
      <span style={{
        display: 'inline-block', width: '0.32em', height: '0.32em',
        borderRadius: '50%', marginLeft: '0.05em', position: 'relative',
        top: '-0.55em', flexShrink: 0,
        background: 'conic-gradient(from 210deg, #e080c8 0deg, #80b8ff 55deg, #70d890 110deg, #f5d840 165deg, #ff8cc0 220deg, #a080ff 275deg, #e080c8 360deg)',
      }} />
    </span>
  )
}

function HeroIllustration({ pattern, accent, accentLight }) {
  const configs = {
    blue:   { c1: '#5090f0', c2: '#80b8ff', c3: '#b0d4ff' },
    green:  { c1: '#50c878', c2: '#70d890', c3: '#a0e8b0' },
    pink:   { c1: '#d84888', c2: '#ff8cc0', c3: '#ffb0d8' },
    yellow: { c1: '#e8c830', c2: '#f5d840', c3: '#ffe880' },
    purple: { c1: '#a060d8', c2: '#c080ff', c3: '#d8a8ff' },
  }
  const cfg = configs[pattern] || configs.blue

  return (
    <svg width="100%" height="100%" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`bg-${pattern}`} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor={accentLight} />
          <stop offset="100%" stopColor="#FAF7F2" />
        </radialGradient>
      </defs>
      <rect width="1200" height="400" fill={`url(#bg-${pattern})`} />
      <circle cx="900" cy="200" r="280" fill={cfg.c1} opacity="0.06" />
      <circle cx="300" cy="100" r="200" fill={cfg.c2} opacity="0.07" />
      <circle cx="1050" cy="350" r="150" fill={cfg.c3} opacity="0.08" />
      {[0,1,2,3,4,5].map(i => (
        <line key={`h${i}`} x1="0" y1={i * 80} x2="1200" y2={i * 80}
          stroke={cfg.c1} strokeWidth="0.5" opacity="0.08" />
      ))}
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
        <line key={`v${i}`} x1={i * 120} y1="0" x2={i * 120} y2="400"
          stroke={cfg.c1} strokeWidth="0.5" opacity="0.06" />
      ))}
      <circle cx="960" cy="120" r="40" fill="none" stroke={cfg.c1} strokeWidth="2" opacity="0.2" />
      <circle cx="960" cy="120" r="60" fill="none" stroke={cfg.c2} strokeWidth="1" opacity="0.12" />
      <circle cx="960" cy="120" r="80" fill="none" stroke={cfg.c3} strokeWidth="0.5" opacity="0.08" />
      <circle cx="960" cy="120" r="18" fill={cfg.c1} opacity="0.85" />
      <circle cx="953" cy="114" r="7" fill="white" opacity="0.45" />
      <line x1="800" y1="0" x2="1200" y2="400" stroke={cfg.c2} strokeWidth="1" opacity="0.1" />
      <circle cx="240" cy="320" r="6" fill={cfg.c2} opacity="0.4" />
      <circle cx="260" cy="300" r="4" fill={cfg.c1} opacity="0.3" />
      <circle cx="1100" cy="60" r="5" fill={cfg.c1} opacity="0.4" />
    </svg>
  )
}

function ContentBlock({ block, accent, accentLight }) {
  switch (block.type) {
    case 'lead':
      return (
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 20, lineHeight: 1.75,
          color: 'var(--marker-text)', fontWeight: 400,
          marginBottom: 36, letterSpacing: '-0.01em',
        }}>{block.text}</p>
      )

    case 'h2':
      return (
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(19px, 3vw, 24px)', fontWeight: 600,
          color: 'var(--marker-black)', letterSpacing: '-0.025em',
          lineHeight: 1.2, marginTop: 52, marginBottom: 18,
        }}>{block.text}</h2>
      )

    case 'p':
      return (
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.8,
          color: 'var(--marker-text)', marginBottom: 22,
        }}>{block.text}</p>
      )

    case 'list':
      return (
        <ul style={{ marginBottom: 24, paddingLeft: 0, listStyle: 'none' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{
              fontFamily: 'var(--font-body)', fontSize: 16.5, lineHeight: 1.75,
              color: 'var(--marker-text)', marginBottom: 14,
              paddingLeft: 24, position: 'relative',
            }}>
              <span style={{
                position: 'absolute', left: 0, top: '0.65em',
                width: 7, height: 7, borderRadius: '50%',
                background: accent, opacity: 0.7, display: 'block',
              }} />
              {item}
            </li>
          ))}
        </ul>
      )

    case 'quote':
      return (
        <blockquote style={{
          margin: '44px 0',
          padding: '28px 32px',
          background: accentLight,
          borderLeft: `4px solid ${accent}`,
          borderRadius: '0 12px 12px 0',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 19, lineHeight: 1.65,
            color: 'var(--marker-black)', fontWeight: 500,
            fontStyle: 'italic', letterSpacing: '-0.01em', margin: 0,
          }}>{block.text}</p>
        </blockquote>
      )

    case 'stat':
      return (
        <div style={{
          margin: '44px 0',
          padding: '32px 36px',
          background: 'var(--marker-black)',
          borderRadius: 16,
          display: 'flex', alignItems: 'flex-start', gap: 28,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 700,
            color: accent, letterSpacing: '-0.04em', lineHeight: 1,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>{block.label}</div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.65,
            color: 'rgba(250,247,242,0.75)', paddingTop: 6,
          }}>{block.detail}</div>
        </div>
      )

    case 'cta':
      return (
        <div style={{
          margin: '52px 0 16px',
          padding: '36px 40px',
          background: accentLight,
          border: `1px solid ${accent}33`,
          borderRadius: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20,
        }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
            color: 'var(--marker-black)', lineHeight: 1.45, margin: 0,
            letterSpacing: '-0.01em',
          }}>{block.text}</p>
          <Link href="/auth/login" style={{
            fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
            color: 'white', background: 'var(--marker-black)',
            padding: '11px 24px', borderRadius: 10,
            display: 'inline-block', textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}>
            Try Marker free →
          </Link>
        </div>
      )

    default:
      return null
  }
}

export default function ArticlePage({ params }) {
  const article = articles.find(a => a.slug === params.slug)
  if (!article) notFound()

  const formattedDate = new Date(article.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const otherArticles = articles.filter(a => a.slug !== article.slug).slice(0, 3)

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
            <Link href="/notes" style={{
              fontFamily: 'var(--font-body)', fontSize: 13.5,
              color: 'var(--marker-mid)', fontWeight: 400,
            }}>← Notes</Link>
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

      {/* Hero */}
      <div style={{ height: 360, position: 'relative', overflow: 'hidden' }}>
        {article.heroImage ? (
          <Image
            src={article.heroImage}
            alt={article.title}
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
          />
        ) : (
          <Image
            src={getSlugImage(article.slug).src}
            alt={article.title}
            fill
            priority
            style={{ objectFit: 'cover', objectPosition: '70% center' }}
          />
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
          background: 'linear-gradient(to bottom, transparent, var(--marker-cream))',
        }} />
      </div>

      {/* Article */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 96px' }}>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {article.tags.map(tag => (
            <span key={tag} style={{
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
              color: article.accent, background: article.accentLight,
              padding: '4px 12px', borderRadius: 20, letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}>{tag}</span>
          ))}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 5vw, 38px)', fontWeight: 700,
          color: 'var(--marker-black)', lineHeight: 1.15,
          letterSpacing: '-0.03em', marginBottom: 16,
        }}>{article.title}</h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 18, color: 'var(--marker-text-soft)',
          lineHeight: 1.6, marginBottom: 28, letterSpacing: '-0.01em',
        }}>{article.subtitle}</p>

        {/* Meta */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          paddingBottom: 36, marginBottom: 44,
          borderBottom: '1px solid var(--marker-border)',
        }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-mid)' }}>
            {formattedDate}
          </span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--marker-border)' }} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-mid)' }}>
            {article.readTime} min read
          </span>
        </div>

        {/* Content */}
        <div>
          {article.content.map((block, i) => (
            <ContentBlock
              key={i}
              block={block}
              accent={article.accent}
              accentLight={article.accentLight}
            />
          ))}
        </div>
      </main>

      {/* More articles */}
      {otherArticles.length > 0 && (
        <section style={{
          background: 'white',
          borderTop: '1px solid var(--marker-border)',
          padding: '64px 24px',
        }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
              color: 'var(--marker-black)', letterSpacing: '-0.025em',
              marginBottom: 32,
            }}>More from Marker</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 24,
            }}>
              {otherArticles.map(a => {
                const d = new Date(a.date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
                return (
                  <Link key={a.slug} href={`/notes/${a.slug}`} style={{ textDecoration: 'none' }}>
                    <div className={styles.moreCard} style={{
                      padding: '24px',
                      border: '1px solid var(--marker-border)',
                      borderRadius: 12,
                      background: 'white',
                    }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        {a.tags.slice(0, 2).map(tag => (
                          <span key={tag} style={{
                            fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                            color: a.accent, background: a.accentLight,
                            padding: '2px 8px', borderRadius: 20, letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                          }}>{tag}</span>
                        ))}
                      </div>
                      <h3 style={{
                        fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 600,
                        color: 'var(--marker-black)', lineHeight: 1.3,
                        letterSpacing: '-0.02em', marginBottom: 12,
                      }}>{a.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--marker-mid)' }}>{d}</span>
                        <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--marker-border)' }} />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--marker-mid)' }}>{a.readTime} min</span>
                        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, color: a.accent }}>Read →</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--marker-border)',
        padding: '32px 24px',
        textAlign: 'center',
        background: 'var(--marker-cream)',
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
