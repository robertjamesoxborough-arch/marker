'use client'

const CHECKS = [
  {
    n: '01',
    title: 'The salary sanity check',
    time: '3 min',
    how: 'Open Glassdoor, Levels.fyi (for tech), or LinkedIn Salary. Search this exact title at this company. Cross-reference with two competitors in the same sector.',
    signal: 'If the ad says "competitive salary" and comparable roles pay 15-20% more elsewhere, competitive means low. If the ad gives a range, the real offer will be near the bottom unless you negotiate hard.',
    tool: 'Requite scores the salary against your floor automatically, and flags when a role is likely below market before you spend time applying.',
  },
  {
    n: '02',
    title: 'The WLB reality check',
    time: '4 min',
    how: 'Go to Glassdoor. Find the Work-Life Balance score for this company. Then read the last 20 reviews, filtered to your department where possible. Note recurring complaints.',
    signal: 'A WLB score below 3.5 is a warning. A score above 4.0 with consistent recent reviews mentioning flex hours or parental leave is a good sign. Generic praise ("great people!") tells you nothing.',
    tool: 'Requite has a built-in WLB reference tab with Glassdoor scores, parental leave data, and office expectations for 30+ UK employers. Pre-researched.',
  },
  {
    n: '03',
    title: 'The office days count',
    time: '2 min',
    how: 'Count: how many in-office days does the ad specify? If it says "hybrid" with no number, check Glassdoor reviews for "in the office" or "WFH" in the last 6 months. Check LinkedIn for recent posts from employees.',
    signal: '"Hybrid" means 3-4 days in office at most companies until you verify otherwise. "Flexible hybrid" often means 3 days with manager discretion. "Remote-first" usually means what it says.',
    tool: 'Requite extracts office expectations from job ads and surfaces them in your score breakdown alongside WLB signals.',
  },
  {
    n: '04',
    title: 'The "who are you reporting to" check',
    time: '4 min',
    how: 'Find the hiring manager on LinkedIn. Look at their career history: have they stayed at places long? Read their recent posts. Check if they post about "hustle" or "grind" culture. Look at their direct reports. How long have they been there?',
    signal: 'A manager who hops every 12-18 months, posts about 5am starts, or has a team of people who all left within a year is not a safe bet. A manager who\'s been in their role 3+ years with stable team tenure is a good signal.',
    tool: 'Requite tracks company and team signals when you scan the careers page, pulling in what Google finds about the hiring team.',
  },
  {
    n: '05',
    title: 'The growth trajectory check',
    time: '3 min',
    how: 'Open LinkedIn. Search for this company. Go to "People" and filter by "Past employees" then sort by most recent. Count how many people left in the last 12 months relative to the company size. Then look at "Current employees": are they growing or contracting?',
    signal: 'If 15%+ of staff turned over in the last year at a company that\'s not a startup, something is wrong. Sustained headcount growth is a positive sign. Flat headcount with lots of churn at senior levels is not.',
    tool: 'Requite pulls company headcount signals from web sources and includes them in the employer scan.',
  },
  {
    n: '06',
    title: 'The real benefits check',
    time: '3 min',
    how: 'Ignore the bullets in the job ad. Go to Glassdoor Benefits section. Look at what employees actually say they receive versus what is listed. Pay attention to "pension contributions", "health insurance" (is it actually good?), and whether parental leave is shared or mother-only.',
    signal: '"Private medical" that turns out to be cash plan is not private medical. "Enhanced parental leave" with no numbers is a red flag; get the actual weeks. A 3% matched pension at Director level is below market.',
    tool: 'Requite\'s scoring algorithm weights benefits against your stated priorities (parental leave, pension, health cover) and factors them into the overall match score.',
  },
  {
    n: '07',
    title: 'The "how long has this been open" check',
    time: '3 min',
    how: 'Search the exact job title on LinkedIn Jobs and filter by posting date. Then search on Indeed, Reed, and Google Jobs. Note the oldest date you find. Check if the same role was posted before with slightly different wording.',
    signal: 'A role open for 3+ months at a company that\'s actively hiring elsewhere suggests a problem: budget issues, internal disagreement about the hire, or the role has already been turned down by others. Under 4 weeks is normal.',
    tool: 'Requite tracks when you first added a role to your pipeline so you can see how long it\'s taken to progress and spot stale postings before you invest more time.',
  },
  {
    n: '08',
    title: 'The culture alignment check',
    time: '5 min',
    how: 'Read 5 recent LinkedIn posts from the company page. Read the last 10 Glassdoor reviews in full. Then ask: does this culture match how you want to work? Not how you can work. How you want to work.',
    signal: 'Most people apply for roles they can do, not roles that suit how they actually work. If a company is fast-paced and you want predictable hours, that\'s not a culture fit problem; it\'s a values mismatch. Better to know now.',
    tool: 'Requite\'s profile asks about your WLB priority (high/medium/low), contract preference, and work style. The score reflects how well a role\'s culture signals match your actual preferences.',
  },
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

export default function RoleCheckGuidePage() {
  return (
    <GuideLayout>

      <div className="no-print" style={{ padding: '24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/guides" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>← All guides</a>
        <button onClick={() => window.print()} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Save as PDF</button>
      </div>

      <div style={{ padding: '40px 0 32px', borderBottom: '3px solid var(--marker-black)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Requite · Free guide · 2026</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 16px' }}>
          The 30-Minute Role Assessment
        </h1>
        <p style={{ fontSize: 15, color: 'var(--marker-mid)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 560 }}>
          Eight things to check before applying for any senior role: where to look, what to look for, and what the signal means. Do all eight in 30 minutes. Or spend three hours doing them badly.
        </p>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>10 min read</span>
          <span>·</span>
          <span>Free to share</span>
          <span>·</span>
          <span>requite.io</span>
        </div>
      </div>

      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>Why this matters more above Head of</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          The more senior the role, the more you need to vet the company, not just the job description. At Director level and above, you are not just doing a job. You are absorbing the culture, the manager, the team health, and the company trajectory. A bad hire at this level costs you 12-18 months of your career and credibility.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          Most people apply first and research second. By the time they find out the WLB is terrible or the hiring manager is toxic, they have already invested four rounds of interviews and three weeks of their time. This guide reverses that order.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          Each check below takes 2-5 minutes. Together they take under 30. Do them before you write a single line of your cover letter.
        </p>
      </div>

      <div style={{ padding: '36px 0 0' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 28 }}>The 8 checks</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {CHECKS.map(c => (
            <div key={c.n} style={{ borderLeft: '3px solid var(--marker-lime)', paddingLeft: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-lime)', letterSpacing: '0.06em' }}>{c.n}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.015em', margin: 0 }}>{c.title}</h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.04em', marginLeft: 'auto' }}>{c.time}</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>How to do it</div>
                <p style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.75, margin: 0 }}>{c.how}</p>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>What to look for</div>
                <p style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.75, margin: 0 }}>{c.signal}</p>
              </div>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '10px 14px', marginTop: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-lime)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>With Requite</div>
                <p style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.65, margin: 0 }}>{c.tool}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '48px 0 32px', borderTop: '1px solid var(--marker-border)', marginTop: 48 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>The honest reality</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          This checklist works. But even doing it well takes 25-30 minutes per role. If you are applying for 10-15 roles a month, that is 5-7 hours of research before you have written a single word of application material.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          Most people skip most of these checks, not because they do not care but because they do not have the time. They apply blind, invest weeks interviewing, and only learn the truth when they are already in the final round or worse, already in the job.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          Requite runs checks 1-5 automatically the moment you paste in a job URL. The salary score, WLB data, office days, and company signals come back in 30 seconds. You still need to do checks 6-8 yourself, but you start from information, not a blank page.
        </p>
      </div>

      <div className="no-print" style={{ margin: '0 0 80px', padding: '32px', background: 'var(--marker-black)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.02em', marginBottom: 8 }}>Do this in 30 seconds, not 30 minutes.</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>Paste any job URL. Requite scores salary, WLB, office days, and culture fit against your profile, then tracks it so you always know what you applied for and when.</div>
        <a href="/auth" style={{ display: 'inline-block', background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '11px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Try Requite free →</a>
      </div>

    </GuideLayout>
  )
}
