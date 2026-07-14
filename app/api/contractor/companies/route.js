import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import { MODELS } from '../../../../lib/anthropic'
import { STYLE_RULES } from '../../../../lib/brand'
import { checkAllowance } from '../../../../lib/allowance'
import { trackAiUsage } from '../../../../lib/ai-usage'
import { logIfError } from '../../../../lib/log-errors'

// Cost rule 1: this route used to call Sonnet + live web_search on every
// click, with no allowance gate at all -- found during the Session L
// orphaned-route sweep (it was never wired to any UI, so nobody had hit
// it). Redesigned to the same cache-read-default pattern as feed-web/
// feed-gov/contractor-roles/job-feed, reusing the EXISTING analyse_search
// allowance bucket (lib/allowance.js) already used for /api/analyse's
// Sonnet+web_search strategy-3 fallback -- an established, already-
// compliant pattern in this codebase for cases with no structured API
// alternative (unlike job discovery, which has Adzuna; there is no
// equivalent structured "which companies use senior contractors" source).
//
// Default: read the cached list from profiles.hard_filters_json.
// {fresh:true}: regenerate via a real Sonnet+web_search call, gated by
// checkAllowance(user.id, 'analyse_search') -- 3/month free, 60/month
// pro/trial, 200/month max -- and logged via trackAiUsage.

async function readCache(service, userId) {
  const res = await service.from('profiles').select('hard_filters_json').eq('user_id', userId).single()
  logIfError('contractor/companies profiles read', res)
  const hfj = res.data?.hard_filters_json || {}
  return { companies: hfj.contractorCompanies || [], cachedAt: hfj.contractorCompaniesCachedAt || null }
}

async function generate(service, apiKey, userId, profile) {
  const hfj = profile?.hard_filters_json || {}
  const field = hfj.contractorField || hfj.field || 'general management'
  const roles = (profile?.target_roles || []).slice(0, 5).join(', ') || 'senior manager, director'
  const contractTypes = (hfj.contractTypes || ['interim']).join(', ')
  const location = profile?.postcode ? `near ${profile.postcode}, UK` : 'UK'
  const ir35Note = hfj.ir35Willing === 'outside' ? 'Candidate strongly prefers outside-IR35 engagements.' : hfj.ir35Willing === 'inside' ? 'Candidate is comfortable with inside-IR35 roles.' : ''
  const goalNote = hfj.contractGoal === 'either' ? 'Open to contract-to-perm or pure contract.' : hfj.contractGoal === 'perm' ? 'Primarily using contracting as a bridge to perm.' : 'Looking for ongoing contract work.'
  const cvSnippet = (hfj.cvRaw || hfj.careerSummary || '').slice(0, 800)

  const prompt = `You are a specialist contract recruitment researcher helping a senior ${field} professional identify their best UK target companies for contract and interim work.

Candidate:
- Field: ${field}
- Target roles: ${roles}
- Contract types: ${contractTypes}
- Location: ${location}
- ${goalNote}
- ${ir35Note}
${cvSnippet ? `- Background: ${cvSnippet}` : ''}

Your task: Identify exactly 12 UK companies in the ${field} space that regularly hire senior contractors and interim professionals for roles like: ${roles}.

For each company, provide evidence-based scores based on what you know about UK hiring patterns, LinkedIn contractor activity, industry norms, and company culture.

Score each company on:
1. contractorVolume (1-10): How actively does this company use senior contractors / interims in ${field}? (10 = very high; they are known to have a large contractor workforce or regularly post interim roles)
2. conversionConfidence (1-10): How confident is a ${roles} contractor to actually land work here, considering the company's hiring behaviour, size, and typical use of contractors in this field?
3. wlb (1-10): Work-life balance evidence from Glassdoor ratings, culture disclosures, and industry reputation

Tier is determined by: average of conversionConfidence and wlb.
Tier 1 = avg >= 8 (prime targets: high confidence + good culture)
Tier 2 = avg >= 6 (strong targets)
Tier 3 = avg >= 4 (worth monitoring)

Return ONLY a JSON array of exactly 12 objects. Each object:
{
  "company": "Company name",
  "sector": "Industry sector (2-4 words)",
  "why": "One sentence: why this company regularly uses contractors in ${field}; be specific",
  "contractorVolume": number 1-10,
  "conversionConfidence": number 1-10,
  "wlb": number 1-10,
  "tier": 1 or 2 or 3,
  "greenhouseSlug": "their-greenhouse-board-slug if they use Greenhouse ATS, otherwise null",
  "careersUrl": "URL to their careers / jobs page"
}

Rules:
- Only include real, named UK companies you are confident about
- Tier 1 should have 2-4 companies (the clearest, most accessible targets)
- Tier 2 should have 5-6 companies
- Tier 3 should have the remainder
- Return ONLY the JSON array, no markdown, no commentary

${STYLE_RULES}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODELS.sonnet,
      max_tokens: 3900,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  if (data.usage) after(() => trackAiUsage({ userId, model: MODELS.sonnet, action: 'analyse_search', usage: data.usage }))

  const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('') || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let companies
  try { companies = JSON.parse(cleaned) } catch {
    return { error: 'Parse error; try again' }
  }
  if (!Array.isArray(companies)) return { error: 'Expected array from model' }

  companies.sort((a, b) => a.tier - b.tier || b.conversionConfidence - a.conversionConfidence)

  const nowIso = new Date().toISOString()
  const updateRes = await service.from('profiles').update({
    hard_filters_json: { ...hfj, contractorCompanies: companies, contractorCompaniesCachedAt: nowIso },
  }).eq('user_id', userId)
  logIfError('contractor/companies cache write', updateRes)

  return { companies, cachedAt: nowIso }
}

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  let body = {}
  try { body = await request.json() } catch {}

  if (body?.fresh !== true) {
    const { companies, cachedAt } = await readCache(service, user.id)
    return Response.json({ companies, cachedAt, source: 'cache' })
  }

  const { allowed, used, cap, tier } = await checkAllowance(user.id, 'analyse_search')
  if (!allowed) {
    const { companies, cachedAt } = await readCache(service, user.id)
    return Response.json({
      companies, cachedAt, limitReached: true, used, cap, tier,
      error: cap === 0
        ? 'Live company research is a Pro feature. Upgrade to refresh your list; free plans can still browse the cached one.'
        : `Refresh limit reached (${used}/${cap} this month on your ${tier} plan). Showing your last cached list.`,
    }, { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'No API key configured' }, { status: 500 })

  const profileRes = await service.from('profiles')
    .select('target_roles, postcode, salary_floor, hard_filters_json')
    .eq('user_id', user.id).single()
  logIfError('contractor/companies profile for generate', profileRes)

  const result = await generate(service, apiKey, user.id, profileRes.data)
  if (result.error) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ companies: result.companies, cachedAt: result.cachedAt, source: 'fresh' })
}
