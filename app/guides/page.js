'use client'

const GUIDES = [
  {
    slug: 'wlb-employer-guide',
    title: 'The Work-Life Balance Employer Guide 2026',
    desc: '30+ UK employers ranked by real Glassdoor WLB scores, parental leave data, and office expectations. Know before you apply.',
    tag: 'Flagship guide',
    tagColor: 'var(--marker-lime)',
    time: '15 min read',
  },
  {
    slug: '30-minute-role-check',
    title: 'The 30-Minute Role Assessment',
    desc: 'The 8 things to check before applying for any senior role, and how to do it in half an hour instead of half a day.',
    tag: 'Productivity',
    time: '10 min read',
  },
  {
    slug: 'senior-job-hunt-playbook',
    title: 'The Senior Job Hunt Playbook',
    desc: 'Why the rules change above Head of level, and how experienced professionals find the roles that are never advertised.',
    tag: 'Strategy',
    time: '12 min read',
  },
  {
    slug: 'linkedin-search-bible',
    title: 'The LinkedIn Job Search Bible',
    desc: 'Boolean search strings, InMail templates, and the exact filters that surface senior roles before they hit job boards.',
    tag: 'Tactics',
    time: '8 min read',
  },
  {
    slug: 'parent-job-hunt-guide',
    title: "The Parent's Guide to Finding a Better Job",
    desc: 'How to find employers that are genuinely family-friendly, not just ones that say so on their careers page.',
    tag: 'Parent track',
    time: '10 min read',
  },
  {
    slug: 'score-tier-guide',
    title: 'Stop Applying for Everything. Start Winning the Right Ones.',
    desc: 'How to use your job score to decide where to spend real effort, and where to let AI handle it. Three tiers. One strategy.',
    tag: 'Strategy',
    time: '8 min read',
  },
]

export default function GuidesPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--marker-cream)', fontFamily: 'var(--font-body)' }}>

      <div style={{ padding: '32px 24px 0', maxWidth: 720, margin: '0 auto' }}>
        <a href="/" style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', textDecoration: 'none' }}>
          Requite<span style={{ display: 'inline-block', width: '0.22em', height: '0.22em', borderRadius: '50%', background: 'var(--marker-lime)', marginLeft: '0.04em', position: 'relative', top: '-0.62em', verticalAlign: 'baseline' }} />
        </a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Free guides</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 14px' }}>
          Job hunting is hard enough.<br />At least have the right playbook.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.7, maxWidth: 480, margin: '0 0 48px' }}>
          Free, practical guides for experienced professionals. No fluff. Enough juice to be useful, and enough to show you why having a tool matters.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {GUIDES.map(g => (
            <a key={g.slug} href={`/guides/${g.slug}`} style={{ display: 'block', textDecoration: 'none', background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 12, padding: '20px 22px', transition: 'border-color 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.015em', lineHeight: 1.3 }}>{g.title}</div>
                {g.tagColor
                  ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, background: g.tagColor, color: 'var(--marker-black)', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{g.tag}</span>
                  : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, background: 'var(--marker-cream)', border: '1px solid var(--marker-border)', color: 'var(--marker-mid)', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>{g.tag}</span>
                }
              </div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 10 }}>{g.desc}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{g.time} · Free download</div>
            </a>
          ))}
        </div>

        <div style={{ marginTop: 48, padding: '24px', background: 'var(--marker-black)', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.02em', marginBottom: 8 }}>Rather not do all this manually?</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 16 }}>Requite scores every role against what actually matters (salary, WLB, office days, culture) in 30 seconds. Then tracks it all so you don't have to.</div>
          <a href="/auth" style={{ display: 'inline-block', background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '11px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Try Requite free →</a>
        </div>
      </div>
    </div>
  )
}
