export async function POST(req) {
  const apiKey = process.env.jobtrackergeneral || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'No API key' }, { status: 500 })

  const { roleTitle, company, jd } = await req.json()

  const prompt = `I need a CV tailored for ${roleTitle} at ${company}. Here's the job description:
${jd}

Requirements:
1. ATS optimisation first. Cross-reference the JD against my experience.
2. Candidate: Rob Oxborough. Strategic Partnership Manager EMEA at Meta (Oct 2024–present). Previous: PlayStation (Senior Partnerships Manager), NatWest (Digital Marketing Lead), King/Activision Blizzard (UA Marketing Manager), Google (Digital Marketing Consultant via agency). Also ran oXo Creatives B2B SEO consultancy. Co-founding Upstream (AI contact centre analytics SaaS) and The 100k Parent. 2:1 Business & Marketing Management, Oxford Brookes University.
3. Mirror the JD's exact keywords in my experience bullets.
4. Quantify achievements with real metrics where possible (revenue, growth %, team size, campaign reach).
5. Bold lead-ins on key achievement bullets so a speed-reader catches the metrics.
6. Include: Profile, Core Expertise, Experience, Current Projects, Tools & Platforms, Awards, Education.
7. Formatting: Calibri, consistent line spacing (~260-268), section dividers, contact details on one line with dot separators, dates right-aligned, A4 page size.
8. Run an ATS and sift simulation before delivering. Tell me: which keywords matched, which are missing, strengths/concerns, and honest percentage chance of interview.
9. Output as professionally formatted text ready to submit.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
  })

  const data = await res.json()
  const text = data.content?.map(c => c.text || '').join('\n') || 'Error generating CV'
  return Response.json({ text })
}
