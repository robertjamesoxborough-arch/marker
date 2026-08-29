import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { MODELS } from '../../../../lib/anthropic'
import { STYLE_RULES } from '../../../../lib/brand'

// Deliberately NOT a closed list this CV is filtered against. Role families
// and industries must be open-vocabulary and derived from whatever the CV
// actually says — a marketing/tech-only canonical list here silently threw
// away correct model output for every other profession (e.g. "Clinical
// Nursing" for a nurse's CV). This example list exists only to show the
// model the SHAPE of a good answer (concise, Title Case, 1-3 words); it is
// never used to filter the model's real output.
const ROLE_FAMILY_EXAMPLES = [
  'Partnerships', 'Product Marketing', 'Clinical Nursing', 'Secondary Teaching',
  'Electrical Trades', 'Engineering', 'Accountancy', 'Legal', 'Social Work',
]

const SENIORITY_IDS = ['ic', 'manager', 'senior_manager', 'head', 'director', 'vp_plus']

// Same principle as role families: examples of shape/specificity only, not
// a closed set the CV is checked against.
const INDUSTRY_EXAMPLES = [
  'Fintech', 'SaaS', 'NHS / Healthcare', 'Education', 'Construction',
  'Public Sector', 'Professional Services', 'Retail', 'Manufacturing',
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
        content: `Analyse this CV and return structured JSON recommendations for onboarding. Be specific and accurate; only suggest what is clearly evidenced. This person could be in ANY profession — clinical, trades, education, legal, hospitality, engineering, marketing, anything. Derive the role families and industries from what THIS CV actually says; do not default toward office/marketing/tech roles just because that is common.

Example role families, for shape/specificity only (yours should fit THIS CV, not be picked from this list): ${ROLE_FAMILY_EXAMPLES.join(', ')}
Valid seniority IDs: ${SENIORITY_IDS.join(', ')} (ic=individual contributor, manager, senior_manager, head=Head of, director, vp_plus)
Example industries, for shape/specificity only: ${INDUSTRY_EXAMPLES.join(', ')}

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "suggested": ["Clinical Nursing"],
  "keywords": ["ADHD", "pain management"],
  "seniority": ["head", "director"],
  "industries": ["NHS / Healthcare"],
  "salaryHint": 90,
  "rolesReason": "One sentence explaining the role family match",
  "seniorityReason": "One sentence explaining the seniority inference, naming specific titles if visible",
  "industriesReason": "One sentence naming the sectors/companies that indicate these industries",
  "salaryReason": "One sentence on why this salary floor, or null if unclear"
}

Rules:
- "suggested": role families this person clearly matches, named in your own words to fit their actual background (max 5); Title Case, 1-4 words each
- "keywords": 3-6 short keywords not already covered by "suggested" (skills, sectors, methodologies, specialisms)
- "seniority": which levels this person is targeting/qualified for (typically 1-2)
- "industries": which industries/sectors their experience is in, in your own words (max 4)
- "salaryHint": estimated salary floor in £k based on seniority and UK market norms for THIS person's actual field; integer only, null if not enough info
- All "Reason" fields: concise one-sentence explanation, referencing specific details from the CV where possible. Use "null" (string) if genuinely no data.

CV text:
${cvText.slice(0, 4000)}

${STYLE_RULES}`,
      }],
    })

    // content[0] is not always the text block — Sonnet/Haiku can prepend a
    // "thinking" block on complex prompts even without thinking explicitly
    // requested (verified live, Stage 45 self-test: content[0]="thinking",
    // content[1]="text" — content[0]?.text silently returned '' in prod).
    const raw = (msg.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim() || '{}'
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(text)

    // Open-vocabulary: only sanitise shape (real strings, trimmed, deduped,
    // capped) — never filter against a fixed list. Seniority stays a closed
    // enum since it's a structural level, not a profession, and the rest of
    // the app (SENIORITIES UI, scoring) depends on these exact IDs.
    const cleanStrings = (arr, max) => Array.isArray(arr)
      ? [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))].slice(0, max)
      : []

    return NextResponse.json({
      suggested:       cleanStrings(parsed.suggested, 5),
      keywords:        cleanStrings(parsed.keywords, 6),
      seniority:       Array.isArray(parsed.seniority) ? parsed.seniority.filter(s => SENIORITY_IDS.includes(s)) : [],
      industries:      cleanStrings(parsed.industries, 4),
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
