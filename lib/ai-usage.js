import { createClient } from '@supabase/supabase-js'

// USD/GBP approximate conversion factor
const USD_TO_GBP = 0.79

// Token cost per million — source: Anthropic pricing
const COSTS = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
  'claude-opus-4-8':           { input: 15.00, output: 75.00 },
}

function estimateCost(model, inputTokens, outputTokens) {
  const rates = COSTS[model] || COSTS['claude-sonnet-4-6']
  const input = (inputTokens / 1_000_000) * rates.input * USD_TO_GBP
  const output = (outputTokens / 1_000_000) * rates.output * USD_TO_GBP
  return input + output
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
    const costGbp = estimateCost(model, inputTokens, outputTokens)

    await service.from('ai_usage').insert({
      user_id: userId,
      account_id: accountId,
      model,
      action,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_estimate_gbp: costGbp,
    })
  } catch {
    // Non-fatal — never surface tracking errors to the user
  }
}
