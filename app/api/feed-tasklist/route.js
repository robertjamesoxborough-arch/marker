import { MODELS } from '../../../lib/anthropic'

const PROFILE =`Rob Oxborough, Strategic Partnership Manager EMEA at Meta. 12+ years across PlayStation, NatWest, King/Activision Blizzard, Google, B2B SEO consultancy. Won 2x Drum Awards including Best Integrated SEO Campaign. Skills: partnerships, product marketing, digital marketing, online marketing, performance marketing, SEO/organic growth, digital strategy, growth, BD, programme management. Based in Greater London.`
const RECIPE = `MATCH: Partnerships, Product Marketing, Digital Marketing, Online Marketing, Performance Marketing, SEO, Organic Growth, Programme Lead, Digital Strategy, Growth, BD roles. Senior Manager+ at big cos, Head/Director/VP at 100-500 person cos. UK or remote, max 2 days office. Fintech, SaaS, gaming, martech, retail tech, media, energy tech. REJECT: junior, pure sales quota, 3+ office days, non-UK.`

const BOARDS = {
  'tide': 'Tide', 'monzo': 'Monzo', 'elastic': 'Elastic', 'gitlab': 'GitLab', 'awin': 'Awin',
  'sonyinteractiveentertainmentglobal': 'PlayStation / Sony',
  'hubspot': 'HubSpot', 'wise': 'Wise', 'checkout': 'Checkout.com',
  'multiverse': 'Multiverse', 'intercom': 'Intercom', 'segment': 'Segment',
  'braze': 'Braze', 'amplitude': 'Amplitude', 'mixpanel': 'Mixpanel',
  'canva': 'Canva', 'figma': 'Figma', 'notion': 'Notion',
  'shopify': 'Shopify', 'spotify': 'Spotify', 'atlassian': 'Atlassian',
  'netflix': 'Netflix', 'airbnb': 'Airbnb', 'stripe': 'Stripe',
  'deliveroo': 'Deliveroo', 'sumup': 'SumUp', 'phorest': 'Phorest',
  'octopusenergy': 'Octopus Energy', 'bulb': 'Bulb',
  'gousto': 'Gousto', 'bought-by-many': 'Bought By Many',
  'smartly': 'Smartly', 'adroll': 'AdRoll', 'criteo': 'Criteo',
  'yotpo': 'Yotpo', 'recharge': 'Recharge', 'klaviyo': 'Klaviyo',
  'gocardless': 'GoCardless', 'paysafe': 'Paysafe', 'papaya': 'Papaya Global',
}

const KW = ['partner','marketing','growth','strategy','digital','business develop','programme','program','product market','commercial','brand','content','head of','director','vp','senior manager','lead','performance','seo','organic','online market']

const REJECT_TITLE = ['engineer','software','developer','design','data sci','data analy','finance','accounting','legal','compliance','fraud','workforce','recruiter','recruiting','talent acq','people ops','human resource','security','infrastructure','devops','qa ','test ','customer service','sales representative','sales development','sdr','bdr','account executive','german speaking','french speaking','spanish speaking','mandarin','japanese','fincrime','anti-money','payroll','procurement','facilities','warehouse','logistics','driver','nurse','doctor','clinical']

export async function POST() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    const allJobs = []

    const promises = Object.entries(BOARDS).map(async ([slug, name]) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) return []
        const data = await res.json()
        return (data.jobs || []).filter(j => {
          const t = (j.title || '').toLowerCase()
          const loc = (j.location?.name || '').toLowerCase()
          const uk = loc.includes('uk') || loc.includes('london') || loc.includes('remote') || loc.includes('emea') || loc === ''
          return uk && KW.some(k => t.includes(k)) && !REJECT_TITLE.some(r => t.includes(r))
        }).map(j => ({
          title: j.title,
          company: name,
          location: j.location?.name || '',
          url: j.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${j.id}`,
          created: j.updated_at || '',
        }))
      } catch { return [] }
    })

    const results = await Promise.allSettled(promises)
    for (const r of results) {
      if (r.status === 'fulfilled') allJobs.push(...r.value)
    }

    // Dedupe
    const seen = new Set()
    const deduped = allJobs.filter(j => {
      const k = (j.title + '|' + j.company).toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    if (deduped.length === 0) return Response.json({ jobs: [], total: 0 })

    if (!apiKey) {
      return Response.json({ jobs: deduped.slice(0, 30).map((j, i) => ({ ...j, id: 'gh-' + i, score: 0, signal: 'maybe', badge: 'Unscored', reason: 'No API key for scoring', office: 'Unknown', source: 'careers_page', foundAt: new Date().toISOString() })), total: deduped.length })
    }

    // Score with Claude — max 3 per company pre-filter
    const companyCounts = {}
    const toScore = deduped.filter(j => {
      const k = j.company.toLowerCase()
      companyCounts[k] = (companyCounts[k] || 0) + 1
      return companyCounts[k] <= 3
    }).slice(0, 60)

    const summaries = toScore.map((j, i) => `[${i}] "${j.title}" at ${j.company} | ${j.location} | ${j.url}`).join('\n')

    const prompt = `Score these Greenhouse jobs for: ${PROFILE}\nCriteria: ${RECIPE}\n\nJOBS:\n${summaries}\n\nRULES, follow strictly:
1. Maximum 2 results per company. Pick ONLY the best-matching roles.
2. The candidate's domain is: partnerships, product marketing, digital strategy, growth marketing, business development, programme/project management in marketing. ONLY return roles where this is the PRIMARY function of the job.
3. "Head of Workforce Management" = REJECT. "BDR German Speaking" = REJECT. "Lead Change Partner FinCrime" = REJECT. These are not marketing/partnerships/growth roles regardless of seniority or company. The title must clearly indicate marketing, partnerships, growth, strategy, BD, or programme management as the core function.
4. REJECT: engineering, design, finance, operations, data science, HR, legal, compliance, fraud, customer support, sales quota-carrying, account management, workforce management, IT, security, analytics (unless marketing analytics).
5. REJECT junior/mid-level: coordinator, associate, assistant, specialist, representative, executive (unless "senior"). Only Senior Manager+, Head of, Director, VP in relevant domains.
6. Minimum score 5 to include. A 5 means partial match worth considering. 8+ means strong match.
7. If a company has zero relevant roles, return NOTHING for that company. An empty array is better than irrelevant results.
8. When in doubt, EXCLUDE. Only include roles where you are confident the candidate's experience is genuinely relevant.

Return JSON array only. Each object: {"i": index, "score": 1-10, "signal": "apply"/"maybe"/"skip", "reason": "one sentence", "badge": "Best Match"/"Strong Fit"/"Worth a Look"/"Stretch"/null, "office": "Remote"/"1 day"/"2 days"/"3+ days"/"Unknown"}.
SCORING: 1-7 use whole numbers. 8+ use increments of 0.2 (8.0, 8.2, 8.4, 8.6, 8.8, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0).
Return ONLY JSON array, no markdown. If nothing matches, return [].`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELS.sonnet, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    const aiData = await aiRes.json()
    const text = aiData.content?.map(c => c.text || '').join('') || '[]'
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let scored
    try { scored = JSON.parse(cleaned) } catch { return Response.json({ jobs: [], error: 'Parse error', raw: cleaned.slice(0, 200) }) }
    if (!Array.isArray(scored)) scored = [scored]

    const now = new Date().toISOString()
    const scoredJobs = scored.filter(s => s.score >= 5).map((s, idx) => {
      const orig = toScore[s.i] || {}
      return { id: `gh-${(orig.title||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,30).toLowerCase()}-${(orig.company||'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}`, title: orig.title || 'Unknown', company: orig.company || 'Unknown', url: orig.url || '', score: s.score, signal: s.signal, reason: s.reason, badge: s.badge, office: s.office, source: 'careers_page', created: orig.created || '', foundAt: now }
    })

    // Hard cap: max 2 per company, highest score first
    scoredJobs.sort((a, b) => (b.score || 0) - (a.score || 0))
    const postCap = {}
    const jobs = scoredJobs.filter(j => {
      const k = j.company.toLowerCase()
      postCap[k] = (postCap[k] || 0) + 1
      return postCap[k] <= 2
    })

    // Interleave companies
    const byCompany = {}
    jobs.forEach(j => { const k = j.company; if (!byCompany[k]) byCompany[k] = []; byCompany[k].push(j) })
    const queues = Object.values(byCompany)
    const interleaved = []
    const maxLen = Math.max(...queues.map(q => q.length), 0)
    for (let i = 0; i < maxLen; i++) { for (const q of queues) { if (i < q.length) interleaved.push(q[i]) } }

    return Response.json({ jobs: interleaved, total: deduped.length, scored: toScore.length })
  } catch (err) {
    return Response.json({ jobs: [], error: err.message }, { status: 500 })
  }
}
