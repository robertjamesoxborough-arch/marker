'use client'

// The homepage hero's single "here's what a score looks like" example —
// previously always "Staff Product Manager at Monzo", the one thing every
// visitor saw regardless of their own field. Rotates daily, same pattern as
// RotatingLifestyle.js, across genuinely different sectors (clinical,
// trades, corporate law, logistics, hospitality, education, tech) so no
// single profession reads as who this product is actually for.
const SCORE_CARD_EXAMPLES = [
  { company: 'Monzo', role: 'Staff Product Manager', score: '9.2', rows: [['Role fit', '9.4'], ['Office days', '1 / wk'], ['Salary v market', '+8%'], ['Parental leave', 'found · 6mo'], ['WLB score', '4.1'], ['Culture', '8.6']] },
  { company: "Guy's and St Thomas'", role: 'Senior Sister, Cardiology', score: '8.9', rows: [['Role fit', '9.1'], ['Shift pattern', '3 on / 3 off'], ['Salary v market', '+4%'], ['Parental leave', 'found · 8wk full pay'], ['WLB score', '3.6'], ['Culture', '8.1']] },
  { company: 'Balfour Beatty', role: 'Site Electrical Supervisor', score: '8.7', rows: [['Role fit', '9.0'], ['Site days', '5 / wk'], ['Salary v market', '+6%'], ['Parental leave', 'found · 2wk paid'], ['WLB score', '3.8'], ['Culture', '7.9']] },
  { company: 'Clifford Chance', role: 'Senior Associate, Corporate', score: '8.5', rows: [['Role fit', '8.8'], ['Office days', '3 / wk'], ['Salary v market', '+2%'], ['Parental leave', 'found · 26wk full pay'], ['WLB score', '3.1'], ['Culture', '7.4']] },
  { company: 'DPD', role: 'Regional Logistics Manager', score: '9.0', rows: [['Role fit', '9.3'], ['Site days', '4 / wk'], ['Salary v market', '+7%'], ['Parental leave', 'found · 2wk paid'], ['WLB score', '3.9'], ['Culture', '8.0']] },
  { company: 'Pret A Manger', role: 'Regional Operations Manager', score: '8.3', rows: [['Role fit', '8.6'], ['Site days', '5 / wk'], ['Salary v market', '+1%'], ['Parental leave', 'not found'], ['WLB score', '3.4'], ['Culture', '7.6']] },
  { company: 'Ark Schools', role: 'Head of Science', score: '8.8', rows: [['Role fit', '9.0'], ['Term-time only', 'yes'], ['Salary v market', '+3%'], ['Parental leave', 'found · 26wk full pay'], ['WLB score', '4.0'], ['Culture', '8.3']] },
]

export default function RotatingScoreCard() {
  const index = Math.floor(Date.now() / 86400000) % SCORE_CARD_EXAMPLES.length
  const ex = SCORE_CARD_EXAMPLES[index]
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--marker-mid)' }}>{ex.company}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--marker-black)' }}>{ex.role}</div>
        </div>
        <div className="holo-foil" style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, padding: '6px 12px', borderRadius: 6, color: 'var(--marker-black)' }}>{ex.score}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        {ex.rows.map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--marker-border)' }}>
            <span style={{ color: 'var(--marker-mid)' }}>{l}</span>
            <span style={{ color: 'var(--marker-black)' }}>{v}</span>
          </div>
        ))}
      </div>
    </>
  )
}
