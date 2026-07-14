import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import { trackAiUsage } from '../../../lib/ai-usage'
import { MODELS } from '../../../lib/anthropic'
import { scoreMatch } from '../../../lib/match-engine'
import { buildAiContext } from '../../../lib/ai-context'
import { checkForLoop } from '../../../lib/loop-guard'
import { STYLE_RULES } from '../../../lib/brand'
import { checkAllowance } from '../../../lib/allowance'
import { RUBRIC, computeOverall } from '../../../lib/scoring'
import { logIfError } from '../../../lib/log-errors'

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'No API key' }, { status: 500 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let careerHistory = []
  let wishlists = []
  if (user) {
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const [profileRes, historyRes, wishlistRes] = await Promise.all([
      service.from('profiles').select('target_roles, seniority, industries, max_office_days, salary_floor, postcode, hard_filters_json, track').eq('user_id', user.id).single(),
      service.from('career_history').select('role_title, company, start_date, end_date').eq('user_id', user.id).order('start_date', { ascending: false }).limit(5),
      service.from('wishlists').select('company').eq('user_id', user.id).limit(5),
    ])
    logIfError('analyse profiles', profileRes)
    logIfError('analyse career_history', historyRes)
    logIfError('analyse wishlists', wishlistRes)
    profile = profileRes.data
    careerHistory = historyRes.data || []
    wishlists = wishlistRes.data || []
  }

  const { jobLink, roleTitle, company, jdText, priorResponse } = await req.json()
  if (!jobLink && !jdText) return Response.json({ error: 'No job link or description provided' }, { status: 400 })

  // Deterministic score — always runs first, zero AI cost
  const deterministicScore = scoreMatch(profile, {
    role_title: roleTitle || '',
    company: company || '',
    location: '',
    salary: '',
    freshness: null,
    raw_json: {},
  })

  // Allowance gate — checked after deterministic score so we can always return it in the error
  if (user) {
    const { allowed, used, cap, tier } = await checkAllowance(user.id, 'analyse')
    if (!allowed) {
      return Response.json({
        error: cap === 0
          ? 'AI scoring is not available on your current plan. Upgrade to unlock.'
          : `AI scoring limit reached (${used}/${cap} this month on your ${tier} plan). Upgrade to continue.`,
        limitReached: true, used, cap, tier, deterministicScore,
      }, { status: 429 })
    }
  }

  const CANDIDATE = buildAiContext(profile, careerHistory, wishlists)

  const maxOfficeDays = profile?.max_office_days ?? null
  const excludeSalesQuotas = profile?.hard_filters_json?.excludeSalesQuotas || false
  const salaryFloor = profile?.salary_floor || null
  const preferredBenefits = profile?.hard_filters_json?.benefits || []

  const tracks = profile?.hard_filters_json?.tracks || (profile?.track ? [profile.track] : [])

  const TRACK_FILTERS = []
  if (tracks.includes('balanced')) {
    TRACK_FILTERS.push('- BALANCED TRACK: Candidate prioritises WLB. Flag language like "fast-paced", "high-growth startup", "always-on" or any indication of excessive hours. Lower companyCulture score if Glassdoor warns of overwork. Note it in signalReason if relevant.')
  }
  if (tracks.includes('parent')) {
    TRACK_FILTERS.push('- PARENT TRACK: Parental leave and flexibility are critical. Set paternityLeave found=false if policy is not mentioned; do not assume. Boost score for explicit enhanced leave (>16 weeks paid) or flexible hours. Lower score if role is described as inflexible or high-travel.')
  }
  if (tracks.includes('returner')) {
    TRACK_FILTERS.push('- RETURNER TRACK: This candidate may be re-entering the workforce. Award bonus signal for returnship programmes, return-to-work schemes, or employers with stated returner policies. Do not penalise for career gaps; ignore any gap-related concern in signalReason.')
  }
  if (tracks.includes('career_changer')) {
    TRACK_FILTERS.push('- CAREER CHANGER TRACK: Candidate is switching sector or role type. Be lenient on industryFit; transferable skills matter more than exact sector match. Focus roleSkillsMatch on underlying competencies, not industry-specific credentials.')
  }

  const BENEFIT_LABELS = {
    enhanced_parental_leave: 'enhanced parental leave', term_time: 'term-time working',
    four_day_week: '4-day week', fully_remote: 'fully remote', hybrid: 'hybrid',
    share_options: 'share options', private_health: 'private health insurance',
  }
  const benefitList = preferredBenefits.map(b => BENEFIT_LABELS[b] || b).filter(Boolean)

  const HARD_FILTERS = [
    maxOfficeDays != null ? `- Max office days: ${maxOfficeDays}/week. If the role requires more, set signal to 'dont_apply' and lower officeFlexibility score to match the gap (e.g. 5-day role when max is 2 = score 1).` : '',
    excludeSalesQuotas ? `- Sales quotas excluded: if this role carries a revenue quota, set signal to 'dont_apply' regardless of other scores.` : '',
    salaryFloor ? `- Minimum salary: £${Math.round(salaryFloor / 1000)}k. If advertised salary is below this, note it in salaryMarket.` : '',
    benefitList.length > 0 ? `- Preferred benefits: ${benefitList.join(', ')}. If the JD or company is known to offer any of these, note it in signalReason as a positive. This is a soft signal; do not penalise roles that don't mention them.` : '',
    ...TRACK_FILTERS,
  ].filter(Boolean).join('\n')

  // Shared, unified rubric (lib/scoring.js) — identical text is embedded in the
  // feed quick-scan prompt, so both tiers mean the same thing by a given number.
  const SCORING = `${RUBRIC}${HARD_FILTERS ? '\n\nHARD FILTERS (apply before scoring):\n' + HARD_FILTERS : ''}`

  const JSON_SCHEMA = `Return ONLY a valid JSON object, no markdown, no backticks:
{
  "company": "${company || 'Company name from content'}",
  "roleTitle": "${roleTitle || 'Exact role title from content'}",
  "signal": "apply" or "maybe" or "dont_apply",
  "signalReason": "One sentence about role fit only; never mention job availability or whether it is filled",
  "officeDays": 0-5,
  "officeNote": "How you determined office days",
  "score": 0-10,
  "factors": {
    "roleSkillsMatch": { "score": 0-10, "note": "one sentence on skills/experience fit" },
    "seniorityFit": { "score": 0-10, "note": "one sentence on seniority level match" },
    "industryFit": { "score": 0-10, "note": "one sentence on industry/sector fit" },
    "officeFlexibility": { "score": 0-10, "note": "remote/hybrid/office days - 10 = fully remote, 0 = 5 days office" },
    "companyCulture": { "score": 0-10, "note": "Glassdoor/reputation signal if known, else null", "found": true or false },
    "paternityLeave": { "score": 0-10, "note": "paternity/parental leave policy if known - 10 = 26+ weeks paid, else estimate or null", "found": true or false, "detail": "specific policy if found e.g. 26 weeks full pay" },
    "salaryMarket": { "score": 0-10, "note": "salary vs market rate for this seniority if advertised, else null", "found": true or false },
    "careerGrowth": { "score": 0-10, "note": "growth trajectory and progression signals from JD" }
  }
}`

  const SYSTEM = `You are a senior job matching assistant. Analyse job descriptions against the candidate profile below and return structured JSON scores.

CANDIDATE:
${CANDIDATE}

${SCORING}

${JSON_SCHEMA}

${STYLE_RULES}`

  // Strategy 1: JD text pasted directly — most reliable
  if (jdText && jdText.trim().length > 50) {
    const userMsg = [
      jobLink ? 'Job URL: ' + jobLink : '',
      roleTitle ? 'Role: ' + roleTitle : '',
      company ? 'Company: ' + company : '',
      '',
      'JOB DESCRIPTION:',
      jdText.trim().slice(0, 8000),
      '',
      'Analyse this role against the candidate profile. Focus on role fit only.',
    ].filter(l => l !== undefined).join('\n')
    return runClaude(apiKey, SYSTEM, userMsg, user?.id, deterministicScore, priorResponse)
  }

  // Strategy 2: Direct page fetch with JSON-LD extraction
  if (jobLink) {
    let pageContent = ''
    let publishedDate = null

    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 8000)
      const res = await fetch(jobLink, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
        }
      })
      if (res.ok) {
        const html = await res.text()

        // Extract published date
        const datePatterns = [
          /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
          /<time[^>]+datetime=["']([^"']+)["']/i,
          /"datePosted"\s*:\s*"([^"]+)"/i,
          /"datePublished"\s*:\s*"([^"]+)"/i,
        ]
        for (const p of datePatterns) {
          const m = html.match(p)
          if (m?.[1]) { const d = new Date(m[1]); if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) { publishedDate = d.toISOString(); break } }
        }

        // Strategy 2a: Extract JSON-LD job schema (works even on JS-rendered pages)
        const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
        for (const match of jsonLdMatches) {
          try {
            const data = JSON.parse(match[1])
            const items = Array.isArray(data) ? data : [data]
            for (const item of items) {
              if (item['@type'] === 'JobPosting') {
                const parts = [
                  item.title, item.description, item.hiringOrganization?.name,
                  item.jobLocation?.address?.addressLocality,
                  item.employmentType, item.baseSalary?.value?.value
                ].filter(Boolean)
                if (parts.length > 2) {
                  pageContent = parts.join(' ').slice(0, 6000)
                  if (item.datePosted && !publishedDate) {
                    const d = new Date(item.datePosted)
                    if (!isNaN(d.getTime())) publishedDate = d.toISOString()
                  }
                  break
                }
              }
            }
          } catch {}
        }

        // Strategy 2b: Plain text extraction if JSON-LD didn't work
        if (!pageContent) {
          const extracted = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          if (extracted.length > 300) pageContent = extracted.slice(0, 6000)
        }
      }
    } catch {}

    // Strategy 2 succeeded — analyse the fetched content
    if (pageContent) {
      const userMsg = [
        roleTitle ? 'Role (use this exactly): ' + roleTitle : '',
        company ? 'Company (use this exactly): ' + company : '',
        'Job URL: ' + jobLink,
        '',
        'JOB CONTENT:',
        pageContent,
        '',
        'Analyse this role against the candidate profile. Focus on role fit only; never comment on job availability.',
      ].filter(l => l !== undefined).join('\n')

      const result = await runClaude(apiKey, SYSTEM, userMsg, user?.id, deterministicScore, priorResponse)
      if (publishedDate) {
        try { const body = await result.json(); return Response.json({ ...body, created: publishedDate }) }
        catch { return result }
      }
      return result
    }

    // Strategy 3: Web search fallback — conservative, never guesses availability
    const searchPrompt = `You are a job matching assistant for Rob Oxborough.
CANDIDATE: ${CANDIDATE}

Search for and read this job posting: ${jobLink}
${roleTitle ? 'Role title: ' + roleTitle : ''}
${company ? 'Company: ' + company : ''}

Also search for "${company || 'this company'} paternity leave policy UK" to find their parental leave offering.

RULES, follow exactly:
1. Use web search to find and read the job description
2. Analyse ONLY role fit against the candidate profile; never comment on whether the job is available, open, filled or closed
3. If you find the job content, score it properly across all factors
4. If you genuinely cannot find the job content after searching, return: signal "maybe", score 5, signalReason "Could not retrieve job content; paste the JD below for an accurate score"
5. Never invent or assume job content
6. For paternityLeave factor: search specifically for this company's policy. If found, set found:true and include the detail. If not found, set found:false and score null.

${SCORING}
${JSON_SCHEMA}`

    // Gate Sonnet web-search separately — more expensive, tighter cap
    if (user) {
      const searchCheck = await checkAllowance(user.id, 'analyse_search')
      if (!searchCheck.allowed) {
        return Response.json({
          deterministicScore,
          signal: 'maybe',
          score: deterministicScore?.score || 5,
          signalReason: 'Web search limit reached. Paste the job description directly for a full AI score.',
          limitReached: true, action: 'analyse_search',
        })
      }
    }

    const result = await runClaudeWithSearch(apiKey, searchPrompt, deterministicScore, user?.id)
    try {
      const body = await result.json()
      return Response.json({ ...body, _usedWebSearch: true })
    } catch { return result }
  }

  return Response.json({ error: 'No job link or description provided' }, { status: 400 })
}

async function runClaude(apiKey, systemPrompt, userPrompt, userId, deterministicScore, priorResponse) {
  const MODEL = MODELS.haiku
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    const aiData = await aiRes.json()
    if (userId && aiData.usage) {
      after(() => trackAiUsage({ userId, model: MODEL, action: 'analyse', usage: aiData.usage }))
    }
    const text = aiData.content?.map(c => c.text || '').join('') || ''

    // G3 loop guard — discard AI output and serve DB-structured fallback if near-duplicate
    if (priorResponse && typeof priorResponse === 'string') {
      const { isLoop } = checkForLoop(text, priorResponse)
      if (isLoop) {
        return Response.json({ loopDetected: true, deterministicScore, signal: 'maybe', score: deterministicScore?.score || 5, signalReason: 'Analysis could not complete; please paste the JD directly for a fresh score.' })
      }
    }

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: 'Could not parse response', deterministicScore }, { status: 500 })
    const parsed = JSON.parse(jsonMatch[0])
    return Response.json({ ...finaliseFull(parsed), deterministicScore })
  } catch (err) {
    return Response.json({ error: 'Analysis failed: ' + err.message, deterministicScore }, { status: 500 })
  }
}

// FULL tier: overall is computed in code from factors x WEIGHTS (lib/scoring.js).
// The model never sets its own overall. Tags the result as a full-analysis score.
function finaliseFull(result) {
  if (result?.factors && typeof result.factors === 'object' && Object.keys(result.factors).length) {
    const overall = computeOverall(result.factors)
    result.score = overall.score
    result.overallRaw = overall.raw
  }
  result.score_tier = 'full'
  return result
}

async function runClaudeWithSearch(apiKey, prompt, deterministicScore, userId) {
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: MODELS.sonnet,
        max_tokens: 2600,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const aiData = await aiRes.json()
    if (userId && aiData.usage) {
      after(() => trackAiUsage({ userId, model: MODELS.sonnet, action: 'analyse_search', usage: aiData.usage }))
    }
    const text = aiData.content?.filter(c => c.type === 'text').map(c => c.text).join('') || ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return Response.json({ error: 'Could not parse response', deterministicScore }, { status: 500 })
    const result = finaliseFull(JSON.parse(jsonMatch[0]))
    // Hard filter — strip any hallucinated availability language
    const filledPatterns = /filled|no longer available|unavailable|closed|already taken|not accepting|expired|position taken/i
    if (result.signalReason && filledPatterns.test(result.signalReason)) {
      result.signal = 'maybe'
      result.score = 5
      result.signalReason = 'Could not retrieve job content; paste the JD below for an accurate score'
    }
    if (!result.score || result.score === 0) {
      result.signal = 'maybe'
      result.score = 5
      result.signalReason = 'Could not retrieve job content; paste the JD below for an accurate score'
    }
    return Response.json({ ...result, deterministicScore })
  } catch (err) {
    return Response.json({ error: 'Analysis failed: ' + err.message, deterministicScore }, { status: 500 })
  }
}
