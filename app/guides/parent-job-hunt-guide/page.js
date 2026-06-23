'use client'

const CHECKS = [
  {
    n: '01',
    title: 'Read the actual parental leave policy, not the careers page',
    body: 'Most companies advertise "enhanced parental leave" without specifying the numbers. Enhanced could mean 12 weeks at full pay or 4 weeks at 50% — legally, both qualify as enhanced. The careers page is marketing material. The actual policy is in the employee handbook or available on request from HR.',
    action: 'Ask HR directly: "What are the current maternity, paternity, and shared parental leave policies in weeks and pay?" Get the numbers before you invest time applying. If they are cagey about sharing it, that tells you something.',
  },
  {
    n: '02',
    title: 'Find out if parental leave is actually taken',
    body: 'A policy on paper is not the same as a culture where leave is taken without career consequences. Some companies have market-leading policies and a culture where taking more than a few months is quietly career-limiting. The signal is whether senior employees — men in particular — actually take the full leave entitlement.',
    action: 'Ask in the interview: "Can you tell me about how parental leave actually plays out in practice — do people tend to take the full entitlement?" A confident yes with specific examples is good. Hesitation, or an answer that pivots to the policy rather than the practice, is not.',
  },
  {
    n: '03',
    title: 'Count the actual in-office days',
    body: 'For parents managing school runs, nursery drop-offs, or caring responsibilities, the difference between 2 in-office days and 3 is not a minor preference — it can determine whether a job is viable. "Hybrid" tells you almost nothing. Most UK companies using that word mean 2-3 days minimum in the office.',
    action: 'Ask the specific question: "How many days a week do people in this team typically come in?" And: "Is that flexible around specific circumstances, or is it a firm requirement?" Also ask: "Is there flexibility on which days those are?" Commuting Wednesday and Friday is very different from Monday and Friday for school-run logistics.',
  },
  {
    n: '04',
    title: 'Look at what happened to parents in senior roles there',
    body: 'The best evidence that a company is genuinely family-friendly is that parents exist in senior roles and have stayed. Check LinkedIn: how many people at Director level and above have been there 5+ years and have children? You cannot always tell, but career breaks listed on profiles, parental leave advocacy, or posts about school pickups are useful signals.',
    action: 'Search the company on LinkedIn. Filter to employees. Look for Directors and VPs who have been there 4+ years. If virtually everyone at senior level is childless or has had a notably linear, unbroken career, ask why. It is not evidence of a problem, but it is worth probing.',
  },
  {
    n: '05',
    title: 'Check the senior team for flexibility signals',
    body: 'If the CEO posts about 5am starts, 12-hour days, and grinding through weekends as a badge of honour, that culture usually cascades down. Even if your direct manager is reasonable, the ambient culture of the organisation will set expectations over time.',
    action: 'Look at recent LinkedIn posts from the CEO, your likely skip-level manager, and a few peers in the team. What do they post about? Is output celebrated or is effort celebrated? A company that talks about "results and impact" is making different cultural promises than one that talks about dedication and availability.',
  },
  {
    n: '06',
    title: 'Ask about emergency flexibility',
    body: 'No parent can plan for every school closure, sick child, or childcare cancellation. What matters is whether the company has a culture where those situations are handled with trust and common sense, or whether every instance requires a formal process, approval chain, or explanation.',
    action: 'Ask: "If I needed to work from home at short notice because of a childcare issue, how would that typically be handled?" The right answer is something close to "just message your manager and make the time up." The wrong answer involves annual leave, HR forms, or the words "we would need to assess it case by case."',
  },
  {
    n: '07',
    title: 'Watch the interview scheduling itself',
    body: 'How a company schedules interviews is a preview of how they run. If they only offer you slots outside working hours, need multiple rounds with 2-week gaps, or show obvious disorganisation throughout the process, that is a preview of what internal coordination looks like on a Tuesday afternoon when you need to leave for school pickup.',
    action: 'Pay attention to how responsive they are, how well-organised the process is, and whether interviewers have actually read your CV. A smooth, respectful interview process is not proof of a good employer — but a chaotic, disorganised one is a reasonable signal.',
  },
]

const QUESTIONS = [
  { q: 'What does a typical day look like for someone in this role?', why: 'Surfaces actual hours and pace. Listen for hints about evening availability expectations or weekend working.' },
  { q: 'How does the team handle urgent requests outside working hours?', why: 'Whether "flexible" means flex for you or for the company. If there is an on-call rota, get the details.' },
  { q: 'What is the parental leave policy — for both parents — in weeks and percentage of pay?', why: 'Forces specifics. "Enhanced" without numbers is not useful information.' },
  { q: 'Do people in senior roles typically take the full parental leave entitlement?', why: 'Probes culture versus policy. An honest answer distinguishes companies that mean it from companies that perform it.' },
  { q: 'How does the team manage if someone needs to finish early or start late occasionally?', why: 'Reveals whether flexibility is genuinely reciprocal or theoretical.' },
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

export default function ParentJobHuntPage() {
  return (
    <GuideLayout>

      <div className="no-print" style={{ padding: '24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/guides" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>← All guides</a>
        <button onClick={() => window.print()} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Save as PDF</button>
      </div>

      <div style={{ padding: '40px 0 32px', borderBottom: '3px solid var(--marker-black)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Marker · Free guide · 2026</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 16px' }}>
          The Parent's Guide to Finding a Better Job
        </h1>
        <p style={{ fontSize: 15, color: 'var(--marker-mid)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 560 }}>
          How to find employers that are genuinely family-friendly — not just ones that say so on their careers page. The seven things to check, the five questions to ask in any interview, and how to read the signals that companies do not advertise.
        </p>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>10 min read</span>
          <span>·</span>
          <span>Free to share</span>
          <span>·</span>
          <span>marker.work</span>
        </div>
      </div>

      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>The problem with "family-friendly"</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          Every company says they are family-friendly. It is the safest possible claim to make — it costs nothing to write on a careers page and is almost impossible to disprove until you are already in the job. What parents actually need to know is not whether a company says the right things, but whether the structure, culture, and senior team make it genuinely viable to do good work and have a life outside of it.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          The gap between policy and practice is where most job search advice falls short. This guide is about reading both — knowing what to look for before you apply, what to ask in interviews, and how to spot the difference between a company that means it and one that is just good at saying it.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          None of this is about asking for less. It is about finding the places where you can do your best work without paying for it in the time your family gets.
        </p>
      </div>

      <div style={{ padding: '36px 0 0' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 28 }}>Seven things to check before applying</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {CHECKS.map(c => (
            <div key={c.n} style={{ borderLeft: '3px solid var(--marker-lime)', paddingLeft: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-lime)', letterSpacing: '0.06em' }}>{c.n}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.015em', margin: 0, lineHeight: 1.3 }}>{c.title}</h3>
              </div>
              <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, margin: '0 0 12px' }}>{c.body}</p>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>What to do</div>
                <p style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.7, margin: 0 }}>{c.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '48px 0 32px', borderTop: '1px solid var(--marker-border)', marginTop: 48 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>Five questions to ask in any interview</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 24 }}>
          These questions are direct but professionally reasonable at any seniority. The tone is curious and practical, not suspicious. An employer who responds badly to them has told you something important.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {QUESTIONS.map((q, i) => (
            <div key={i} style={{ padding: '18px 0', borderTop: '1px solid var(--marker-border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.01em', marginBottom: 8 }}>"{q.q}"</div>
              <div style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.65 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-lime)', letterSpacing: '0.04em', textTransform: 'uppercase', marginRight: 8 }}>Why</span>
                {q.why}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '36px 0 32px', borderTop: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>The honest reality of this search</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          Doing this research properly takes time you often do not have. Reading Glassdoor reviews, tracking down the actual parental leave policy, finding the right contacts to verify culture claims — it is 3-4 hours of work per role before you have even decided whether to apply.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          Marker does not do all of it for you. But it does the parts that are most mechanical and time-consuming: scoring the salary against your floor, surfacing WLB data for listed employers, checking office expectations against your preferences, and tracking everything so you are not starting from scratch every time you open a new job ad.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          The questions you need to ask in interviews — no tool replaces those. But at least you can stop spending your limited time looking up Glassdoor scores and start spending it on the things that actually require your judgment.
        </p>
      </div>

      <div className="no-print" style={{ margin: '0 0 80px', padding: '32px', background: 'var(--marker-black)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.02em', marginBottom: 8 }}>Find the role that fits your whole life.</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>Marker scores any job against your salary floor, WLB priority, office day limit, and parental leave needs — in 30 seconds. Then tracks everything so nothing slips.</div>
        <a href="/auth" style={{ display: 'inline-block', background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '11px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Try Marker free →</a>
      </div>

    </GuideLayout>
  )
}
