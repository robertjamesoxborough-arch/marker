import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getStripe, PLANS } from '../../../../lib/stripe'

export async function POST(request) {
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Payments are not configured. Contact support@upstreaminsights.co.uk.' }, { status: 500 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await request.json()
  const planConfig = PLANS[plan]
  if (!planConfig) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  if (!planConfig.priceId || planConfig.priceId.startsWith('price_TODO')) {
    return NextResponse.json({ error: `${planConfig.name} checkout isn't set up yet. Contact support@upstreaminsights.co.uk.` }, { status: 500 })
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Get or create Stripe customer — a stored id can go stale (deleted in
    // Stripe, or left over from a different Stripe mode/account); verify it
    // still resolves before reusing it rather than letting checkout 500.
    const { data: userData } = await service
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = userData?.stripe_customer_id
    if (customerId) {
      try { await stripe.customers.retrieve(customerId) } catch { customerId = null }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await service
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://marker-silk.vercel.app'}/settings?upgraded=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://marker-silk.vercel.app'}/settings?cancelled=1`,
      metadata: { supabase_user_id: user.id, plan },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Checkout failed to start.' }, { status: 500 })
  }
}
