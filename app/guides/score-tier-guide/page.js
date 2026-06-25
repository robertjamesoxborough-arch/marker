'use client'

const TIERS = [
  {
    tier: '01',
    score: '80 and above',
    label: 'Write it yourself',
    color: 'var(--marker-lime)',
    time: 'High effort: worth it',
    what: 'This role scores highly against your salary, WLB, office days, and culture preferences. The match is real. Apply like it matters.',
    how: [
      'Write a fully personalised cover letter. Reference something specific about the company, not just the job title.',
      'Tailor your CV for this role specifically. Reorder bullet points, surface the most relevant experience.',
      'Research the hiring manager on LinkedIn before the interview. Know their background.',
      'Prepare properly. A high-scoring role is worth three hours of preparation, not 20 minutes.',
      'Follow up if you have not heard back in 7 days. One polite message is appropriate and often noticed.',
    ],
    signal: 'A score this high means the fundamentals align. Your chance of getting an interview from a strong application is significantly higher than average. Do not waste it on a generic application.',
  },
  {
    tier: '02',
    score: '60 to 79',
    label: 'AI drafts it, you personalise',
    color: '#C8E6C9',
    time: 'Medium effort: selective attention',
    what: "There's a genuine match here but it's not perfect. Maybe the office days are slightly higher than you'd like, or the salary is at the lower end of your range. Worth applying, but not worth spending three hours on.",
    how: [
      'Use Marker\'s CV generator to produce a first draft. It will pull from your profile and the job description.',
      'Read the AI output before sending. Change the opening paragraph to be specific to this company.',
      'Do not send the cover letter verbatim. AI-generated letters read as AI-generated. Add one sentence that is clearly yours.',
      'Standard prep is fine: review your relevant experience, think through one or two likely questions.',
      'Set a reminder to follow up in 7 days. Treat it as a real application but allocate time proportionately.',
    ],
    signal: "The gap between a Tier 1 and Tier 2 role isn't the match quality; it's how much of your personal attention the application deserves. AI does the heavy lifting; you add the detail that makes it feel human.",
  },
  {
    tier: '03',
    score: '40 to 59',
    label: 'AI handles it',
    color: 'var(--marker-border)',
    time: 'Low effort: volume play',
    what: "The match isn't strong, but the role isn't completely wrong either. You could get an interview. At this tier, you're playing volume, sending enough to keep options open without investing significant time in any single application.",
    how: [
      'Use Marker\'s CV generator and send the output without heavy editing. The time cost of personalising a low-match application is rarely worth it.',
      'No cover letter unless specifically required. If one is required, use AI to generate it and do not agonise over it.',
      'If you get a first-round interview, that is when you invest properly. Do not pre-invest in research.',
      'Track it in your pipeline. If you hear back, reassess. If you do not, it costs you nothing.',
    ],
    signal: "Most job seekers treat every application the same. That's the mistake. A Tier 3 application that takes 5 minutes and leads to a conversation is better than a Tier 3 application that took 90 minutes and didn't.",
  },
  {
    tier: 'n/a',
    score: 'Below 40',
    label: 'Skip it',
    color: '#FDECEA',
    time: 'No effort: correct decision',
    what: 'The mismatch is significant across multiple factors. Salary is likely below your floor, WLB signals are poor, or the role itself does not fit your profile. Applying anyway is not persistence; it is noise.',
    how: [
      "Your time has a value. Applying for roles with a very low match wastes it without meaningfully improving your chances of getting a job you'll actually want.",
      "A rejected application at this score level would not have been a surprise. Save the energy for roles where the odds are better.",
      "If you find yourself consistently scoring below 40, the issue is not the roles; it is the search. Go back to Discover and reassess your target companies and role criteria.",
    ],
    signal: 'Marker flags these with a "Don\'t apply" signal not to be harsh, but because your time spent on this is genuinely better spent finding a Tier 1 or Tier 2 role.',
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

export default function ScoreTierGuidePage() {
  return (
    <GuideLayout>

      <div className="no-print" style={{ padding: '24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/guides" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>← All guides</a>
        <button onClick={() => window.print()} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Save as PDF</button>
      </div>

      <div style={{ padding: '40px 0 32px', borderBottom: '3px solid var(--marker-black)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Marker · Free guide · 2026</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 16px' }}>
          Stop Applying for Everything.<br />Start Winning the Right Ones.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--marker-mid)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 560 }}>
          Your time is finite. How you allocate it across applications is the biggest lever in a job search. This guide explains how to use your job score to decide where to invest real effort, and where to let AI do the work.
        </p>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>8 min read</span>
          <span>·</span>
          <span>Free to share</span>
          <span>·</span>
          <span>marker.work</span>
        </div>
      </div>

      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>The problem with treating every application the same</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          Most job seekers apply the same way to every role. They spend an hour writing a cover letter for a role that does not fit, then dash off a two-minute application for a role that actually matches perfectly. The effort is distributed randomly rather than strategically.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          The result is predictable: the strong applications are diluted by being surrounded by weak ones, and the roles that genuinely fit do not get the attention they deserve. Meanwhile, the roles that were always going to be a long shot consumed time that could have gone into preparation and follow-up on the good ones.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          A job score changes this. When a tool tells you a role scores 84 against your profile, you know: this deserves your best. When it scores 52, you know: send something decent and move on. The question is not whether to apply; it is how much of your time this role has earned.
        </p>
      </div>

      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 8 }}>The score system</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.7, marginBottom: 28 }}>
          Marker scores every role out of 10 across eight factors: salary, WLB, office days, culture, seniority match, sector fit, benefits, and growth. The overall score determines which tier the role falls into, and how much of your time it deserves.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {TIERS.map(t => (
            <div key={t.tier} style={{ borderLeft: `4px solid ${t.color}`, paddingLeft: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em' }}>TIER {t.tier}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.015em', margin: 0 }}>{t.label}</h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', marginLeft: 'auto' }}>{t.time}</span>
              </div>
              <div style={{ display: 'inline-block', background: t.color, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-black)', padding: '3px 10px', borderRadius: 4, marginBottom: 12, letterSpacing: '0.04em' }}>
                Score: {t.score}
              </div>
              <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, margin: '0 0 14px' }}>{t.what}</p>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>What to do</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {t.how.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: t.color === 'var(--marker-border)' ? 'var(--marker-mid)' : 'var(--marker-mid)', flexShrink: 0, marginTop: 1 }}>·</span>
                      <span style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.7 }}>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 8 }}>The logic</span>
                <span style={{ fontSize: 12, color: 'var(--marker-mid)', lineHeight: 1.65 }}>{t.signal}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>What a good week looks like</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          A well-run job search at senior level typically looks something like this across a week:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { day: 'Monday', action: 'Discover and score. Add 3-5 roles to your pipeline. Note the tier for each one.' },
            { day: 'Tuesday', action: 'Write your Tier 1 application properly. Use AI to draft your Tier 2 application and personalise the first paragraph.' },
            { day: 'Wednesday', action: 'Generate and send Tier 3 applications in bulk using AI. No more than 10 minutes each.' },
            { day: 'Thursday', action: 'Discover again. Score anything new. Research the hiring team for your Tier 1 application.' },
            { day: 'Friday', action: 'Follow up on anything applied 7+ days ago. Review your pipeline. Dismiss anything that no longer fits.' },
          ].map((d, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 16, padding: '12px 0', borderTop: '1px solid var(--marker-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.04em', paddingTop: 1 }}>{d.day}</span>
              <span style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.65 }}>{d.action}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.7, marginTop: 16 }}>
          This is not a rigid template. The point is that effort allocation should follow score, not habit or anxiety. The number of applications you send matters less than whether the right ones got your proper attention.
        </p>
      </div>

      <div style={{ padding: '36px 0 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>The honest bit</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          This strategy only works if you have a score to work from. Most people do not; they apply based on a quick read of the job title and salary and then wonder why their conversion rate is low. The whole model depends on knowing, before you write a word, how well a role actually fits.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          That is what the Marker score gives you. Paste the job URL, get a score in 30 seconds, and immediately know which tier this role falls into. No gut feeling, no guesswork.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          The tier system is simple enough to apply without a tool. The score just makes it objective.
        </p>
      </div>

      <div className="no-print" style={{ margin: '0 0 80px', padding: '32px', background: 'var(--marker-black)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.02em', marginBottom: 8 }}>Know your tier before you type a word.</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>Marker scores any job in 30 seconds (salary, WLB, office days, culture) and tells you exactly which tier it falls into. Spend your time where it counts.</div>
        <a href="/auth" style={{ display: 'inline-block', background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '11px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Try Marker free →</a>
      </div>

    </GuideLayout>
  )
}
