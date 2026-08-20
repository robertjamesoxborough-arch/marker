import { createClient } from '@supabase/supabase-js'

// USD/GBP approximate conversion factor
const USD_TO_GBP = 0.79

// Token cost per million — source: Anthropic pricing
const COSTS = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 }, // corrected Stage 52; was 0.80/4.00, ~20% under actual
  'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
  'claude-sonnet-5':           { input: 2.00, output: 10.00 }, // intro pricing until 2026-08-31, then $3/$15
  'claude-opus-4-8':           { input: 15.00, output: 75.00 },
}

const SONNET_5_INTRO_ENDS = new Date('2026-08-31T23:59:59Z')

// Prompt-caching multipliers, applied to the model's normal input rate.
// A cached prefix is NOT counted in usage.input_tokens, so before Stage 52 these
// tokens were billed by Anthropic but recorded here as zero.
const CACHE_WRITE_MULTIPLIER = 1.25
const CACHE_READ_MULTIPLIER = 0.10

function estimateCost(model, inputTokens, outputTokens, cacheWriteTokens = 0, cacheReadTokens = 0) {
  let rates = COSTS[model] || COSTS['claude-sonnet-5']
  if (model === 'claude-sonnet-5' && new Date() > SONNET_5_INTRO_ENDS) {
    rates = { input: 3.00, output: 15.00 }
  }
  const input = (inputTokens / 1_000_000) * rates.input * USD_TO_GBP
  const output = (outputTokens / 1_000_000) * rates.output * USD_TO_GBP
  const cacheWrite = (cacheWriteTokens / 1_000_000) * rates.input * CACHE_WRITE_MULTIPLIER * USD_TO_GBP
  const cacheRead = (cacheReadTokens / 1_000_000) * rates.input * CACHE_READ_MULTIPLIER * USD_TO_GBP
  return input + output + cacheWrite + cacheRead
}

// Fire-and-forget usage logger. Never throws.
export async function trackAiUsage({ userId, model, action, usage }) {
  if (!userId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return

  try {
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Get user's default account_id
    const { data: userData } = await service
      .from('users')
      .select('default_account_id')
      .eq('id', userId)
      .single()

    const accountId = userData?.default_account_id
    if (!accountId) return

    const inputTokens = usage?.input_tokens || 0
    const outputTokens = usage?.output_tokens || 0
    // Cached tokens are billed but excluded from input_tokens. The ai_usage table has
    // no columns for them (Stage 52), so they are folded into cost_estimate_gbp only.
    const cacheWriteTokens = usage?.cache_creation_input_tokens || 0
    const cacheReadTokens = usage?.cache_read_input_tokens || 0
    const costGbp = estimateCost(model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)

    const { error } = await service.from('ai_usage').insert({
      user_id: userId,
      account_id: accountId,
      model,
      action,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_estimate_gbp: costGbp,
    })
    // Still non-fatal to the user's request (this runs after the response
    // via after()), but a silent insert failure here is exactly how the
    // ai_usage GRANT bug went unnoticed -- log it loudly so it shows up in
    // Vercel logs instead of vanishing.
    if (error) console.error(`[trackAiUsage] insert failed for user=${userId} action=${action}:`, error.message)
  } catch (e) {
    console.error(`[trackAiUsage] threw for user=${userId} action=${action}:`, e.message)
  }
}
