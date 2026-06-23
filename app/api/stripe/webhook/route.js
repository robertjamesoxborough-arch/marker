import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getStripe } from '../../../../lib/stripe'

export const config = { api: { bodyParser: false } }

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function setUserTier(userId, tier, subscriptionId, currentPeriodEnd) {
  await service()
    .from('users')
    .update({
      tier,
      stripe_subscription_id: subscriptionId,
      subscription_ends_at: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    })
    .eq('id', userId)
}

export async function POST(request) {
  const stripe = getStripe()
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const sb = service()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId  = session.metadata?.supabase_user_id
    const plan    = session.metadata?.plan
    if (!userId || !plan) return NextResponse.json({ ok: true })

    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(session.subscription)
    await setUserTier(userId, plan, subscription.id, subscription.current_period_end)

    // Clear trial_ends_at — they're now paid
    await sb.from('users').update({ trial_ends_at: null }).eq('id', userId)
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    const { data: userData } = await sb
      .from('users')
      .select('id')
      .eq('stripe_customer_id', sub.customer)
      .single()
    if (!userData) return NextResponse.json({ ok: true })

    // Map price ID back to plan name
    const priceId = sub.items.data[0]?.price?.id
    const { PLANS } = await import('../../../../lib/stripe')
    const plan = Object.entries(PLANS).find(([, p]) => p.priceId === priceId)?.[0] || null

    if (sub.status === 'active' && plan) {
      await setUserTier(userData.id, plan, sub.id, sub.current_period_end)
    } else if (['canceled', 'unpaid', 'past_due'].includes(sub.status)) {
      await setUserTier(userData.id, 'free', null, null)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const { data: userData } = await sb
      .from('users')
      .select('id')
      .eq('stripe_customer_id', sub.customer)
      .single()
    if (userData) await setUserTier(userData.id, 'free', null, null)
  }

  return NextResponse.json({ ok: true })
}
