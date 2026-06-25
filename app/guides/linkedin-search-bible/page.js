'use client'

const BOOLEAN_STRINGS = [
  {
    label: 'Senior Marketing roles',
    string: '"Head of Marketing" OR "Marketing Director" OR "VP Marketing" OR "CMO" site:linkedin.com/jobs',
    notes: 'Add your city in quotes: AND "London" OR "Manchester". Remove titles you have already held.',
  },
  {
    label: 'Product leadership (avoiding junior roles)',
    string: '("Head of Product" OR "VP Product" OR "Director of Product") NOT ("Junior" OR "Associate" OR "Assistant")',
    notes: 'The NOT operator filters out junior postings that use similar titles. Always check it is not cutting too much.',
  },
  {
    label: 'Data / Analytics leadership',
    string: '"Head of Data" OR "Director of Analytics" OR "VP Data" OR "Chief Data Officer" OR "Head of Insight"',
    notes: 'Insight, Analytics, and Data are used interchangeably. Search all three to avoid missing a good match.',
  },
  {
    label: 'Finance leadership (UK-relevant titles)',
    string: '"Finance Director" OR "Head of Finance" OR "CFO" OR "Financial Controller" OR "VP Finance"',
    notes: 'UK companies use Finance Director more than VP Finance. US-owned UK companies use VP. Search both.',
  },
  {
    label: 'Technology / Engineering leadership',
    string: '"CTO" OR "VP Engineering" OR "Head of Engineering" OR "Director of Technology" OR "Engineering Director"',
    notes: 'CTO at startups is often a hands-on role. VP Engineering at scale-ups is often managerial. The size matters more than the title.',
  },
  {
    label: 'Operations / COO track',
    string: '"COO" OR "Head of Operations" OR "Director of Operations" OR "VP Operations" OR "Chief Operating Officer"',
    notes: 'Operations roles vary wildly in scope. Add your sector keyword: AND "SaaS" or AND "retail" to narrow by industry.',
  },
]

const INMAIL_TEMPLATES = [
  {
    type: 'Recruiter cold outreach (you reaching out to them)',
    subject: 'Senior [function] roles: open to conversations',
    body: `Hi [Name],

I am a [title] with [X] years in [sector/function], currently at [Company] where I have been responsible for [one-line scope].

I am beginning to explore what comes next and thought it was worth introducing myself directly. I am interested in [type of role] at [size/stage of company or sector], ideally in [location or remote].

I am not in a rush, and I am not interested in every role that exists. I am looking for something specific. If you work on [relevant sector] searches and have something relevant in the pipeline or come across one, I would be happy to have a short call.

[Name]`,
    notes: 'Keep it short. Recruiters get a lot of these. The signal is specificity: you know what you want and are not just blasting everyone.',
  },
  {
    type: 'Warm intro request (through a mutual connection)',
    subject: 'Would you mind introducing me to [Name]?',
    body: `Hi [Name],

Hope you are well. Quick ask: I noticed you are connected to [Target Name] at [Company]. I am exploring a move and think their work on [specific thing] is genuinely interesting.

Would you be comfortable making an introduction? No pressure if it feels awkward. A two-line email is more than enough. I can take it from there.

Thanks,
[Your name]`,
    notes: 'Always make it easy for the introducer. Draft the intro email yourself and offer to send it so they just have to forward it.',
  },
  {
    type: 'Direct outreach to a hiring manager (speculative)',
    subject: '[Your field]: background you might find relevant',
    body: `Hi [Name],

I came across [Company] through [specific context: a product, an article, a person] and was struck by [one genuine specific thing].

I am a [title] with a background in [relevant area]. I am not sure whether you are hiring, but if you are building out [relevant function] and think it is worth 20 minutes, I would be interested in the conversation.

Either way, I will keep an eye on what you are building.

[Name]`,
    notes: 'This only works if the specific context is real. If you cannot name something genuine, do not send it.',
  },
]

const FILTERS = [
  { label: 'Date posted', value: 'Past week', why: 'Roles posted in the last 7 days get fewer applications. The earlier you move, the better.' },
  { label: 'Experience level', value: 'Director / Executive', why: 'Filters out junior roles with inflated titles. Not perfect but cuts noise significantly.' },
  { label: 'Job type', value: 'Full-time (or Contract if relevant)', why: 'Removes volunteer, internship, and apprenticeship listings from results.' },
  { label: 'Location', value: 'Your city + On-site/Hybrid/Remote', why: 'Filter by all three if you are flexible. LinkedIn defaults to on-site which misses hybrid listings.' },
  { label: 'Company size', value: 'Depends on your preference', why: '11-50 = startup risk but big scope. 201-500 = scale-up. 1000-5000 = mid-corp. 5000+ = enterprise process.' },
  { label: 'Under 10 applicants', value: 'Sort: Most Recent', why: 'LinkedIn does not surface this directly but the "Most Recent" sort + checking applicant count manually is the closest you get.' },
]

function GuideLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'var(--font-body)', color: 'var(--marker-text)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>
        {children}
      </div>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
    </div>
  )
}

export default function LinkedInBiblePage() {
  return (
    <GuideLayout>

      <div className="no-print" style={{ padding: '24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/guides" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>← All guides</a>
        <button onClick={() => window.print()} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Save as PDF</button>
      </div>

      <div style={{ padding: '40px 0 32px', borderBottom: '3px solid var(--marker-black)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Marker · Free guide · 2026</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 16px' }}>
          The LinkedIn Job Search Bible
        </h1>
        <p style={{ fontSize: 15, color: 'var(--marker-mid)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 560 }}>
          Boolean search strings that surface senior roles before they hit job boards. InMail templates that actually get replies. The exact filters that cut noise and find what you are looking for faster.
        </p>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>8 min read</span>
          <span>·</span>
          <span>Free to share</span>
          <span>·</span>
          <span>marker.work</span>
        </div>
      </div>

      {/* Boolean strings */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 8 }}>Boolean search strings</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 24 }}>
          Boolean search uses AND, OR, NOT, and quotes to find exactly what you mean. LinkedIn Jobs search supports it; paste these into the keyword box. Adapt the titles to your function. The structure is what matters.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {BOOLEAN_STRINGS.map((s, i) => (
            <div key={i} style={{ borderLeft: '3px solid var(--marker-lime)', paddingLeft: 16 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.01em', marginBottom: 8 }}>{s.label}</div>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--marker-black)', lineHeight: 1.6, marginBottom: 8, wordBreak: 'break-word' }}>{s.string}</div>
              <div style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>{s.notes}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 8 }}>The filters that actually matter</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 24 }}>
          Most people ignore filters entirely or only use location. Here is what each one does and why it is worth setting.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {FILTERS.map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, padding: '14px 0', borderTop: '1px solid var(--marker-border)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Filter</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>{f.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-lime)', marginTop: 2 }}>{f.value}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Why</div>
                <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.6 }}>{f.why}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* InMail templates */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 8 }}>InMail templates that get replies</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 24 }}>
          The reason most InMails do not get replies is not the message; it is the lack of specificity. These templates are written to be specific enough to feel human and short enough to be read. Adapt them; do not copy them verbatim.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {INMAIL_TEMPLATES.map((t, i) => (
            <div key={i}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{t.type}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', marginBottom: 4 }}>Subject: {t.subject}</div>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '14px 16px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.8, whiteSpace: 'pre-line', marginBottom: 10 }}>{t.body}</div>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-lime)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 8 }}>Note</span>
                {t.notes}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '36px 0 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>The bit no guide tells you</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          LinkedIn Job Search is free and powerful. But it is also a place where you quickly accumulate a mess: tabs open, roles you half-read, applications you sent but cannot remember the details of, conversations you meant to follow up on.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          The biggest waste in a senior job search is not missing roles; it is losing track of the ones you have already found. Applying for something good and then forgetting to follow up. Finding a perfect company and never getting round to scanning their jobs properly.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          Marker tracks everything. You paste in the URL, get a score, and it sits in your pipeline with a timestamp. When the follow-up window opens, it flags it. You do the LinkedIn work; Marker keeps the score.
        </p>
      </div>

      <div className="no-print" style={{ margin: '0 0 80px', padding: '32px', background: 'var(--marker-black)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.02em', marginBottom: 8 }}>Find it on LinkedIn. Score it in Marker.</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>Paste any job URL. Get an instant match score against your salary floor, WLB preferences, and role criteria. Track the whole pipeline in one place.</div>
        <a href="/auth" style={{ display: 'inline-block', background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '11px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Try Marker free →</a>
      </div>

    </GuideLayout>
  )
}
