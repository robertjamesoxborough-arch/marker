// Audience personas — three anchored cards. Burned-out senior IC is lead.

function Personas() {
  const people = [
    {
      id: 'sam',
      name: 'Sam, 38',
      role: 'Senior Product Manager · London',
      tag: 'LEAD WEDGE · Balanced Roles',
      tagDark: true,
      headline: 'Wants the job hunt to feel less like a second job.',
      stats: [
        { l: 'Current salary', v: '£95k' },
        { l: 'Wants', v: '£90k+, ≤1 office day' },
        { l: 'Avoids', v: 'Quota-led, on-call' },
        { l: 'Tracks 47 companies', v: 'in a messy Notion' },
      ],
      quote: '"I don\'t want a 4-day week handed to me — I want roles where I won\'t need one in the first place."',
      jobs: ['Stable corporates', 'Public sector tech', 'Remote-first SaaS'],
    },
    {
      id: 'priya',
      name: 'Priya, 34',
      role: 'Engineering Manager · Manchester',
      tag: 'Parent track',
      headline: 'Returning from parental leave. Knows her worth.',
      stats: [
        { l: 'Off for', v: '11 months' },
        { l: 'Needs', v: 'Term-time-friendly, hybrid' },
        { l: 'Skips', v: 'Companies w/o enhanced leave' },
        { l: 'Wants', v: 'Honest reviews, fast filtering' },
      ],
      quote: '"I\'m not browsing a job board. I\'m vetting employers."',
      jobs: ['Working Families benchmark', '6+ month parental leave', '4-day week pilots'],
    },
    {
      id: 'james',
      name: 'James, 46',
      role: 'Director of BD · Bristol',
      tag: 'Standby tier',
      headline: 'Quietly looking. Doesn\'t want to be seen looking.',
      stats: [
        { l: 'Status', v: 'Employed, passive' },
        { l: 'Window', v: '6–12 months' },
        { l: 'Tolerance', v: 'Low for noise' },
        { l: 'Pays', v: 'For weekly digest' },
      ],
      quote: '"Wake me up when something\'s worth waking up for."',
      jobs: ['Curated weekly only', 'C-1 roles', 'No alerts at work hours'],
    },
  ];

  return (
    <React.Fragment>
      {people.map((p, i) => (
        <DCArtboard key={p.id} id={`persona-${p.id}`} label={`Persona · ${p.name.split(',')[0]}`} width={460} height={620}>
          <div style={{
            width: '100%', height: '100%',
            background: 'var(--marker-cream)',
            padding: '28px 28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontFamily: 'var(--font-body)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className={p.tagDark ? 'chip chip-dark' : 'chip'}>{p.tag}</div>
              <div className="kicker">P/0{i+1}</div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingTop: 4 }}>
              <div className="placeholder-stripes" style={{ width: 64, height: 64, borderRadius: '50%' }}>
                <span style={{ fontSize: 8 }}>portrait</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: 'var(--marker-black)', letterSpacing: '-0.02em' }}>{p.name}</div>
                <div style={{ fontSize: 13, color: 'var(--marker-mid)', marginTop: 2 }}>{p.role}</div>
              </div>
            </div>

            <div className="display-md" style={{ fontSize: 20, color: 'var(--marker-text)', textWrap: 'pretty' }}>
              {p.headline}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--marker-border)', border: '1px solid var(--marker-border)', borderRadius: 8, overflow: 'hidden' }}>
              {p.stats.map((s, idx) => (
                <div key={idx} style={{ background: 'var(--marker-cream-2)', padding: '10px 12px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{s.l}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--marker-text)', fontWeight: 500 }}>{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              lineHeight: 1.45,
              color: 'var(--marker-text)',
              fontStyle: 'italic',
              borderLeft: '2px solid var(--marker-lime)',
              paddingLeft: 12,
              textWrap: 'pretty',
            }}>
              {p.quote}
            </div>

            <div style={{ marginTop: 'auto' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--marker-mid)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>What surfaces for them</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.jobs.map(j => <span key={j} className="chip" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-body)', fontSize: 11 }}>{j}</span>)}
              </div>
            </div>
          </div>
        </DCArtboard>
      ))}
    </React.Fragment>
  );
}

Object.assign(window, { Personas });
