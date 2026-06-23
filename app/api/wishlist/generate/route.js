import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'


const client = new Anthropic()

const TRACK_CONTEXT = {
  parent:         'Prioritise companies known for generous parental leave (20+ weeks full pay), flexible return policies, and family-friendly culture.',
  returner:       'Prioritise companies with formal returnship programmes or a track record of hiring people returning after a career break of 1+ years.',
  balanced:       'Prioritise companies with strong work-life balance, hybrid or async-friendly culture, reasonable hours, and high Glassdoor scores.',
  career_changer: 'Prioritise companies known for skills-first hiring, internal mobility, or structured programmes that welcome people switching industries.',
  standard:       'Prioritise companies with strong career growth, competitive compensation, and a clear progression ladder in the user\'s field.',
}

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('hard_filters_json, track')
    .eq('user_id', user.id)
    .single()

  const hfj            = profile?.hard_filters_json || {}
  const cvRaw          = hfj.cvRaw || ''
  const keywords       = (hfj.cvKeywords || []).join(', ')
  const tracks         = hfj.tracks?.length ? hfj.tracks : (profile?.track ? [profile.track] : ['standard'])
  const existing       = (hfj.wishlist || []).map(w => w.company).filter(Boolean)
  const searchMode     = hfj.searchMode || (hfj.openToContract === true ? 'both' : 'perm')
  const isContractor   = searchMode === 'contractor' || searchMode === 'both'

  // Build profile context — CV if available, otherwise profile fields as fallback
  const hasCV = cvRaw && cvRaw.length >= 100
  const profileFallback = [
    hfj.careerSummary ? `Professional summary: ${hfj.careerSummary}` : '',
    hfj.field ? `Field: ${hfj.field}` : '',
    (hfj.targetRoles || []).length ? `Target roles: ${hfj.targetRoles.join(', ')}` : '',
    hfj.yearsExperience ? `Years experience: ${hfj.yearsExperience}` : '',
  ].filter(Boolean).join('\n')

  if (!hasCV && !profileFallback) {
    return NextResponse.json({ error: 'Add a career summary or CV in Settings so we can personalise your list.' }, { status: 400 })
  }

  const profileContext = hasCV ? cvRaw.slice(0, 3000) : profileFallback
  const trackNotes = tracks.map(t => TRACK_CONTEXT[t] || '').filter(Boolean).join(' ')
  const contractorNote = isContractor ? '\nThis person is looking for contract/interim opportunities — prioritise companies known to use senior contractors and interim professionals in this field.' : ''

  const prompt = `You are a senior career advisor. A job seeker wants a personalised list of UK companies to target.

${hasCV ? 'CV' : 'Profile'}:
${profileContext}

${keywords ? `Key skills/keywords: ${keywords}\n` : ''}
Goal: ${tracks.join(', ')}
${trackNotes}${contractorNote}

${existing.length ? `Already on their list (exclude these): ${existing.join(', ')}\n` : ''}

Return a JSON array of exactly 10 company objects. Each object must have:
- "company": company name (string)
- "sector": industry sector (string, 1-3 words)
- "why": one sentence explaining why this company is a strong fit based on their specific background and goal — be concrete, not generic

Rules:
- UK companies or companies with a strong UK presence and real UK hiring
- Spread across 4-6 different sectors to avoid a narrow list
- Tailor to their actual experience level and domain
- For contractor mode: include companies known to use contractors/interims in this field, not just direct employers
- For parent/balanced tracks, weight toward companies publicly known for good culture
- For returner track, weight toward companies with returnship or re-entry programmes
- DO NOT include: generic consulting firms unless clearly relevant, companies already on their list
- Return ONLY valid JSON — no markdown, no explanation, no code fences`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0]?.text || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI returned unexpected format' }, { status: 500 })

    const suggestions = JSON.parse(jsonMatch[0])
    if (!Array.isArray(suggestions)) return NextResponse.json({ error: 'AI returned unexpected format' }, { status: 500 })

    return NextResponse.json({ suggestions: suggestions.slice(0, 10) })
  } catch (err) {
    console.error('wishlist/generate error:', err)
    return NextResponse.json({ error: 'Generation failed — try again' }, { status: 500 })
  }
}
