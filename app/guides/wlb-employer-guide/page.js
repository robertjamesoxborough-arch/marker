'use client'

const COMPANIES = [
  { co: 'Spotify',        sector: 'Tech',        wlb: '4.5', leave: '26 weeks full pay', office: 'Fully flexible', note: 'Work From Anywhere policy: employees choose where and when. No mandatory office days.' },
  { co: 'Wellcome Trust', sector: 'Charity',     wlb: '4.6', leave: '26 weeks full pay', office: '1 day/week',    note: 'Sector-leading WLB; mission-driven science philanthropy; flexible by default.' },
  { co: 'Monzo',          sector: 'Fintech',     wlb: '4.0', leave: '26 weeks full pay', office: '2 days/week',   note: 'Async-friendly; strong WLB reputation; fast-growing challenger bank.' },
  { co: 'Octopus Energy', sector: 'Energy',      wlb: '4.4', leave: '26 weeks full pay', office: '2 days/week',   note: 'B Corp certified; genuine flexible working; high Glassdoor WLB scores.' },
  { co: 'Wise',           sector: 'Fintech',     wlb: '4.1', leave: '24 weeks full pay', office: '2 days/week',   note: 'Distributed-first; no-meeting Fridays; genuinely flat structure.' },
  { co: 'Ofcom',          sector: 'Regulator',   wlb: '4.5', leave: '26 weeks full pay', office: '2 days/week',   note: 'Regulator stability; hybrid-first; consistently high WLB ratings.' },
  { co: 'BBC',            sector: 'Media',       wlb: '3.9', leave: '26 weeks full pay', office: '2 days/week',   note: '35-hour week standard; hybrid working; strong work-life culture across most divisions.' },
  { co: 'Canva',          sector: 'Tech',        wlb: '4.4', leave: '26 weeks full pay', office: '2 days/week',   note: 'Strong WLB culture; fast-growing but known for not burning people out.' },
  { co: 'Starling Bank',  sector: 'Fintech',     wlb: '3.8', leave: '20 weeks full pay', office: '2 days/week',   note: 'Flexible hours; strong parental leave for a scale-up; improving WLB culture.' },
  { co: 'Figma',          sector: 'Tech',        wlb: '4.3', leave: '20 weeks full pay', office: 'Flexible',      note: 'Remote-flexible; strong mental health support; collaborative low-stress culture.' },
]

const QUESTIONS = [
  { n: '01', q: 'What does a typical day look like for someone in this role?', why: 'Reveals actual hours and pace, not what the job ad claims. Listen for "fast-paced" and "wearing many hats"; both mean overloaded.' },
  { n: '02', q: 'How does the team handle urgent issues outside working hours?', why: 'The honest answer tells you whether "flexible" means flex for you or flex for the company. "We have an on-call rota" is fine. "Everyone stays available" is a red flag.' },
  { n: '03', q: 'Can you tell me about parental leave, for both parents?', why: 'Ask about both maternity and paternity/shared parental leave. A company that offers 26 weeks full pay to one parent and 2 weeks statutory to the other has told you something important.' },
  { n: '04', q: 'What happened to the last person who held this role?', why: 'If they promoted them or they moved internally, good sign. If the role has been open 6+ months, or the previous person left quickly, dig deeper.' },
  { n: '05', q: 'How does the team manage meeting load?', why: 'Meeting-heavy cultures kill deep work and run long. Ask if they have meeting-free days, async norms, or a meeting budget. No-meeting Fridays is a genuine signal.' },
]

const RED_FLAGS = [
  'The job ad uses "fast-paced" more than once',
  '"Work hard, play hard" culture mentions',
  'Role requires "wearing many hats" at Director level or above',
  'Glassdoor rating below 3.5 with lots of recent 1-star reviews',
  'Interview is scheduled outside working hours without explanation',
  'They emphasise "passionate" people (often means unpaid overtime expected)',
  '"Family feel" in a company over 200 people',
  'Job has been re-posted multiple times in the last year',
  'No mention of parental leave in the benefits section of the ad',
  'They can\'t tell you what happened to the previous person in the role',
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

export default function WLBGuidePage() {
  return (
    <GuideLayout>
      {/* Header */}
      <div className="no-print" style={{ padding: '24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/guides" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>← All guides</a>
        <button onClick={() => window.print()} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Save as PDF</button>
      </div>

      {/* Title block */}
      <div style={{ padding: '40px 0 32px', borderBottom: '3px solid var(--marker-black)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Requite · Free guide · 2026</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 16px' }}>
          The Work-Life Balance<br />Employer Guide 2026
        </h1>
        <p style={{ fontSize: 15, color: 'var(--marker-mid)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 560 }}>
          30+ UK employers scored on real Glassdoor WLB ratings, parental leave policies, and office expectations. The 5 questions that expose what job ads hide. And the red flags experienced hires miss until it's too late.
        </p>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>15 min read</span>
          <span>·</span>
          <span>Free to share</span>
          <span>·</span>
          <span>requite.io</span>
        </div>
      </div>

      {/* What WLB actually means */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>What Work-Life Balance actually means</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          WLB is not about leaving at 5pm. It is about whether your employer treats your time outside work as yours. That means: predictable hours, a culture that doesn't punish disconnecting, parental leave that is taken without career consequences, and flexibility that goes both ways, not just when it suits the business.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          The problem is that every company claims it. "We're flexible" appears in 73% of senior job ads. It means almost nothing without data to back it up. Glassdoor reviews (when there are enough of them) are the closest proxy we have to honest employer feedback.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          The companies in this guide all have <strong>4.0 or above for WLB on Glassdoor, with at least 500 reviews</strong>. That threshold filters out small companies gaming the system and companies that had one good year. The data is not perfect (it is from public Glassdoor scores and company disclosures) but it is the best available without sitting in the interview chair yourself.
        </p>
      </div>

      {/* Employer table */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 6 }}>UK employers worth your time</h2>
        <p style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.6, marginBottom: 20 }}>Glassdoor WLB score ≥4.0 · ≥500 reviews · UK office with real UK hiring · Data from public disclosures; verify with employer before applying.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.6fr 1fr 1.4fr', gap: 12, padding: '8px 12px', background: 'var(--marker-black)', borderRadius: '8px 8px 0 0' }}>
            {['Company', 'Sector', 'WLB', 'Parental leave', 'Office days'].map(h => (
              <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {COMPANIES.map((c, i) => (
            <div key={c.co} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.6fr 1fr 1.4fr', gap: 12, padding: '11px 12px', background: i % 2 === 0 ? 'var(--marker-cream-2)' : 'var(--marker-cream)', borderBottom: '1px solid var(--marker-border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--marker-black)' }}>{c.co}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', textTransform: 'uppercase', letterSpacing: '0.04em', alignSelf: 'center' }}>{c.sector}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: parseFloat(c.wlb) >= 4.4 ? '#1a6b1a' : 'var(--marker-black)', alignSelf: 'center' }}>{c.wlb}<span style={{ fontSize: 9, fontWeight: 400, color: 'var(--marker-mid)' }}>/5</span></div>
              <div style={{ fontSize: 11, color: 'var(--marker-text)', lineHeight: 1.4, alignSelf: 'center' }}>{c.leave}</div>
              <div style={{ fontSize: 11, color: 'var(--marker-text)', lineHeight: 1.4, alignSelf: 'center' }}>{c.office}</div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-border)', letterSpacing: '0.04em', marginTop: 10, lineHeight: 1.6 }}>Data from public Glassdoor scores, company disclosures, and Working Families employer surveys. Always verify directly with the employer before accepting an offer.</p>
      </div>

      {/* 5 questions */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 6 }}>5 questions that expose what job ads hide</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.7, marginBottom: 24 }}>Ask these in every final-stage interview. Vague answers or visible discomfort are the answer.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {QUESTIONS.map(q => (
            <div key={q.n} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--marker-border)', lineHeight: 1, flexShrink: 0, width: 32 }}>{q.n}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 5, lineHeight: 1.3 }}>"{q.q}"</div>
                <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.65 }}>{q.why}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Red flags */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 6 }}>Red flags experienced hires miss</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.7, marginBottom: 20 }}>These appear in job ads, Glassdoor reviews, and interviews. Any one of them is worth noting. More than three means look harder before accepting.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RED_FLAGS.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: i % 2 === 0 ? 'var(--marker-cream-2)' : 'transparent', borderRadius: 8 }}>
              <span style={{ color: '#c0392b', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>⚑</span>
              <span style={{ fontSize: 13, color: 'var(--marker-text)', lineHeight: 1.5 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Verify WLB claims */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>How to verify WLB claims before you accept</h2>
        {[
          { step: '1', title: 'Check Glassdoor reviews, sorted by Most Recent', body: 'Ignore the company-curated "Best" reviews. Sort by recent. Look at whether WLB-specific complaints appear in reviews from the last 6 months. Culture changes fast, especially post-acquisition or post-layoffs.' },
          { step: '2', title: 'Look at the interview process itself', body: "Did they respond promptly? Did they respect your time? Were they late to the interview? The interview process is the company's best behaviour. If they're disorganised or dismissive at this stage, they won't improve once you start." },
          { step: '3', title: 'Ask to speak to someone in the team before accepting', body: "Any good employer will arrange a 20-minute call with a potential peer. If they can't or won't, that tells you something. Use that call to ask about day-to-day reality, not company strategy." },
          { step: '4', title: 'Google the leadership team', body: 'A company with high Glassdoor WLB scores that just appointed a CEO known for 80-hour cultures is about to change. Leadership drives culture. Look at who the CEO is and what their reputation is.' },
          { step: '5', title: 'Get the flexibility in writing', body: 'Not in the offer letter necessarily, but in an email. "As discussed, the role supports 2 days from home." Verbal agreements about flexibility are the first thing to disappear once a manager changes.' },
        ].map(s => (
          <div key={s.step} style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--marker-black)', color: 'var(--marker-cream)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.step}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', marginBottom: 5 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.65 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="no-print" style={{ padding: '40px 0 80px' }}>
        <div style={{ background: 'var(--marker-black)', borderRadius: 14, padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Rather not do this manually for every role?</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 10 }}>Requite checks WLB, parental leave, and office days on every role you score.</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>Paste a job URL. Get an 8-factor match score (including WLB, salary fit, office days, and parental leave) in 30 seconds. Then track it all in one place.</div>
          <a href="/auth" style={{ display: 'inline-block', background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Try Requite free →</a>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 12, letterSpacing: '0.06em' }}>7-day trial · No credit card · requite.io</div>
        </div>
      </div>
    </GuideLayout>
  )
}
