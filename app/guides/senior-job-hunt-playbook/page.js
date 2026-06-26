'use client'

const RULES = [
  {
    n: '01',
    title: 'The job board is the last place a senior role lands',
    body: 'Most roles above Head of level are filled before they are advertised. The hiring manager has already asked their network, spoken to a search firm, or promoted internally. The job board posting exists because all of those failed. That is not always bad (it means the company is now genuinely open) but it does mean you are joining a process that is already behind schedule and probably has a preference candidate.',
    action: 'Treat job boards as a signal, not a source. When you see a senior role advertised, your first move is to find who posted it and whether you have a second-degree connection to the hiring team. The application is the last thing you send.',
  },
  {
    n: '02',
    title: 'Your CV is for the recruiter, not the hiring manager',
    body: 'Hiring managers above VP level often see your CV only once, for 90 seconds, after a recruiter has already decided you are worth surfacing. The recruiter is pattern-matching on title, company name, and tenure. The hiring manager is asking "have they done this before?" Your CV needs to pass the recruiter\'s filter first or it never reaches the person who can say yes.',
    action: 'Structure your CV so the first third answers "what level am I, and what kind of companies have I done it at?" The detail can come later. Titles matter more at senior level than job descriptions; if your title does not reflect your seniority, add the scope in the first bullet.',
  },
  {
    n: '03',
    title: 'Compensation negotiation starts at first contact',
    body: 'At senior level, the first person who says a number loses. If a recruiter asks your salary expectation before you have seen the full brief, you are being anchored to a number that suits their fee structure. The market for senior roles is opaque by design; companies prefer you do not know what the last person was paid or what the budget is.',
    action: 'When asked about salary expectations early in the process, deflect: "I am keeping an open mind at this stage. What is the budgeted range for this role?" If they push, give a broad range anchored to the top of your research. Do not disclose your current package as a starting point unless you are already near market rate.',
  },
  {
    n: '04',
    title: 'The search firm is not your friend',
    body: 'Executive search firms are paid by the company, not by you. Their fee is typically 20-30% of first year\'s salary, paid on placement. That means they are commercially incentivised to place someone quickly and at a salary they can justify to the client, not to get you the best possible deal. They will say they represent you. They represent the client.',
    action: 'Be useful to search firms but do not rely on them. Give them a precise brief of what you are looking for. Ask them directly what the budget range is for roles they approach you about. If they cannot answer, they are fishing. The best search relationships are built on you being easy to place, so be clear, not flexible.',
  },
  {
    n: '05',
    title: 'The hidden job market is your network, not a secret database',
    body: '"Hidden jobs" are not hidden. They are just roles that have not been posted yet because the hiring manager has not exhausted their warm contacts. The way to access them is to be a warm contact. That means staying in touch with former colleagues, being visible in your industry, and making it easy for people to refer you.',
    action: 'Identify 20 people who could plausibly refer you to a senior role in the next 12 months. They are probably former managers, peers who have moved into VP or Director roles, or people you collaborated with on major projects. Send one short message a month: a relevant article, a question, a "how\'s it going." Not a pitch. Just presence.',
  },
  {
    n: '06',
    title: 'Senior interviews test judgment, not skills',
    body: 'Below Director level, interviewers check whether you can do the job. Above it, they check how you think, how you handle ambiguity, and whether they can trust your judgment in front of their stakeholders. The questions sound similar ("tell me about a time you...") but the expected answer is fundamentally different.',
    action: 'At senior level, stories need to include the messy middle: what you did not know, what you got wrong, what you changed. Tidy narratives where everything worked suggest you are either misremembering or did not have full ownership. The best senior interview stories include the moment things went sideways and what you decided to do next.',
  },
  {
    n: '07',
    title: 'The first 90 days matter more than the offer',
    body: 'Most senior hires fail not because they are wrong for the role but because they misread the organisation in the first three months. They move too fast, pick the wrong battles, or underestimate how political things are. The offer negotiation gets all the attention. The onboarding plan gets none.',
    action: 'Before accepting, ask the hiring manager what success looks like in the first 90 days, and whether you can meet two or three of the people you will work alongside. If they cannot arrange that, it is a signal about how structured their onboarding is. The answer to "what does good look like at 90 days?" tells you more about the role than the job description.',
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

export default function SeniorPlaybookPage() {
  return (
    <GuideLayout>

      <div className="no-print" style={{ padding: '24px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/guides" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none' }}>← All guides</a>
        <button onClick={() => window.print()} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--marker-black)', color: 'var(--marker-cream)', border: 'none', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Save as PDF</button>
      </div>

      <div style={{ padding: '40px 0 32px', borderBottom: '3px solid var(--marker-black)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--marker-mid)', marginBottom: 12 }}>Requite · Free guide · 2026</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 16px' }}>
          The Senior Job Hunt Playbook
        </h1>
        <p style={{ fontSize: 15, color: 'var(--marker-mid)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 560 }}>
          Why the rules change above Head of level, and what experienced professionals need to do differently to find roles that are never advertised, negotiate what they are worth, and avoid the traps that derail senior moves.
        </p>
        <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span>12 min read</span>
          <span>·</span>
          <span>Free to share</span>
          <span>·</span>
          <span>requite.io</span>
        </div>
      </div>

      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid var(--marker-border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>The game changes at this level</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          Job hunting advice is overwhelmingly written for people early in their careers. "Tailor your CV." "Research the company." "Be enthusiastic." At Head of and Director level, this advice is not wrong; it is just insufficient. The dynamics are different. The process is less transparent. The stakes are higher.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          This guide covers the seven things that experienced professionals consistently get wrong when they move up a level, and what to do instead. None of it is complicated. Most of it is simply things no one told you because the advice industry is built for a different market.
        </p>
      </div>

      <div style={{ padding: '36px 0 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {RULES.map(r => (
            <div key={r.n} style={{ paddingBottom: 36, borderBottom: '1px solid var(--marker-border)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--marker-lime)', letterSpacing: '0.06em' }}>{r.n}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.015em', margin: 0, lineHeight: 1.3 }}>{r.title}</h3>
              </div>
              <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, margin: '0 0 16px' }}>{r.body}</p>
              <div style={{ background: 'var(--marker-cream-2)', border: '1px solid var(--marker-border)', borderLeft: '3px solid var(--marker-lime)', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>What to do</div>
                <p style={{ fontSize: 13, color: 'var(--marker-mid)', lineHeight: 1.75, margin: 0 }}>{r.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '36px 0 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em', marginBottom: 16 }}>The one thing that ties this together</h2>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          Every rule above is harder to follow when you are managing an active job search alongside a full-time job. You are context-switching constantly. You have three tabs open, two draft responses sitting in a folder, and a follow-up you keep forgetting to send.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8, marginBottom: 12 }}>
          The senior job hunt is a project. It needs a pipeline, a record of what you have applied for and where you are in each process, and a score for each role so you are not making decisions based on vibes at 10pm after a long day.
        </p>
        <p style={{ fontSize: 14, color: 'var(--marker-mid)', lineHeight: 1.8 }}>
          That is what Requite is built for. Not a CRM you have to maintain. A tool that scores roles against your priorities, tracks where you are in each process, and surfaces follow-ups before you miss them.
        </p>
      </div>

      <div className="no-print" style={{ margin: '0 0 80px', padding: '32px', background: 'var(--marker-black)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--marker-cream)', letterSpacing: '-0.02em', marginBottom: 8 }}>Your job search. Ruthlessly efficient.</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>Score any role in 30 seconds. Track everything in one place. Know exactly where you are in every process, and when to follow up.</div>
        <a href="/auth" style={{ display: 'inline-block', background: 'var(--marker-lime)', color: 'var(--marker-black)', padding: '11px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Try Requite free →</a>
      </div>

    </GuideLayout>
  )
}
