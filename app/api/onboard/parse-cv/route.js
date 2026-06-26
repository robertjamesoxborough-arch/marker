import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { MODELS } from '../../../../lib/anthropic'
import { STYLE_RULES } from '../../../../lib/brand'

const ROLE_FAMILIES = [
  'Partnerships', 'Product Marketing', 'Programme Lead', 'Digital Strategy',
  'Growth', 'BD', 'Engineering', 'Design', 'Data', 'Product Management',
  'Ops', 'Finance', 'HR', 'Sales', 'Customer Success', 'Marketing Generalist',
]

const SENIORITY_IDS = ['ic', 'manager', 'senior_manager', 'head', 'director', 'vp_plus']

const INDUSTRIES = [
  'Fintech', 'SaaS', 'Gaming', 'Martech', 'Retail Tech', 'Media',
  'EdTech', 'HealthTech', 'Public Sector', 'Charity / Non-profit',
  'Consumer Goods', 'Professional Services', 'Other',
]

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ suggested: [], keywords: [], seniority: [], industries: [], salaryHint: null, error: 'ANTHROPIC_API_KEY not set' })
  }

  const { cvText } = await request.json()
  if (!cvText || cvText.trim().length < 50) {
    return NextResponse.json({ suggested: [], keywords: [], seniority: [], industries: [], salaryHint: null })
  }

  try {
    const client = new Anthropic()
    const msg = await client.messages.create({
      model: MODELS.haiku,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Analyse this CV and return structured JSON recommendations for onboarding. Be specific and accurate; only suggest what is clearly evidenced.

Canonical role families: ${ROLE_FAMILIES.join(', ')}
Valid seniority IDs: ${SENIORITY_IDS.join(', ')} (ic=individual contributor, manager, senior_manager, head=Head of, director, vp_plus)
Valid industries: ${INDUSTRIES.join(', ')}

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "suggested": ["Product Management"],
  "keywords": ["B2B SaaS", "fintech"],
  "seniority": ["head", "director"],
  "industries": ["Fintech", "SaaS"],
  "salaryHint": 90,
  "rolesReason": "One sentence explaining the role family match",
  "seniorityReason": "One sentence explaining the seniority inference, naming specific titles if visible",
  "industriesReason": "One sentence naming the sectors/companies that indicate these industries",
  "salaryReason": "One sentence on why this salary floor, or null if unclear"
}

Rules:
- "suggested": canonical role families this person clearly matches (max 5)
- "keywords": 3-6 short keywords NOT in the canonical list (skills, sectors, methodologies)
- "seniority": which levels this person is targeting/qualified for (typically 1-2)
- "industries": which industries their experience is in (max 4, must be from the canonical list)
- "salaryHint": estimated salary floor in £k based on seniority and UK market norms; integer only, null if not enough info
- All "Reason" fields: concise one-sentence explanation, referencing specific details from the CV where possible. Use "null" (string) if genuinely no data.

CV text:
${cvText.slice(0, 4000)}

${STYLE_RULES}`,
      }],
    })

    const raw = msg.content[0]?.text?.trim() || '{}'
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(text)

    return NextResponse.json({
      suggested:       Array.isArray(parsed.suggested) ? parsed.suggested.filter(r => ROLE_FAMILIES.includes(r)) : [],
      keywords:        Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
      seniority:       Array.isArray(parsed.seniority) ? parsed.seniority.filter(s => SENIORITY_IDS.includes(s)) : [],
      industries:      Array.isArray(parsed.industries) ? parsed.industries.filter(i => INDUSTRIES.includes(i)) : [],
      salaryHint:      typeof parsed.salaryHint === 'number' ? parsed.salaryHint : null,
      rolesReason:     parsed.rolesReason || null,
      seniorityReason: parsed.seniorityReason || null,
      industriesReason:parsed.industriesReason || null,
      salaryReason:    parsed.salaryReason || null,
    })
  } catch (e) {
    return NextResponse.json({ suggested: [], keywords: [], seniority: [], industries: [], salaryHint: null, error: e?.message || 'Claude API error' })
  }
}
