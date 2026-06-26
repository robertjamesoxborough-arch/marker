import { createClient } from '@supabase/supabase-js'

// Monthly action caps per tier.
// Cap 0 = feature not available on this tier (hard block).
export const TIER_CAPS = {
  free: {
    analyse:          30,   // Haiku job scoring (strategies 1+2)
    analyse_search:   3,    // Sonnet web-search fallback (strategy 3)
    cv:               1,    // CV generation
    cover_letter:     0,    // Not on Free
    interview_prep:   0,    // Not on Free
    negotiation_prep: 0,    // Not on Free
  },
  trial: {
    analyse:          1000,
    analyse_search:   60,
    cv:               20,
    cover_letter:     20,
    interview_prep:   8,
    negotiation_prep: 8,
  },
  pro: {
    analyse:          1000,
    analyse_search:   60,
    cv:               20,
    cover_letter:     20,
    interview_prep:   8,
    negotiation_prep: 8,
  },
  max: {
    analyse:          3000,
    analyse_search:   200,
    cv:               60,
    cover_letter:     60,
    interview_prep:   30,
    negotiation_prep: 30,
  },
}

// Returns { allowed, used, cap, tier }
// allowed: false when cap === 0 (tier can't use feature) OR monthly count >= cap
export async function checkAllowance(userId, action) {
  if (!userId || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { allowed: true, used: 0, cap: 9999, tier: 'unknown' }
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: userData } = await service
    .from('users')
    .select('tier, trial_ends_at')
    .eq('id', userId)
    .single()

  const now = new Date().toISOString()
  const trialActive = userData?.trial_ends_at && userData.trial_ends_at > now
  const tier = userData?.tier || (trialActive ? 'trial' : 'free')

  const caps = TIER_CAPS[tier] || TIER_CAPS.free
  const cap = caps[action] ?? 0

  if (cap === 0) return { allowed: false, used: 0, cap: 0, tier }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await service
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', startOfMonth.toISOString())

  const used = count || 0
  return { allowed: used < cap, used, cap, tier }
}
