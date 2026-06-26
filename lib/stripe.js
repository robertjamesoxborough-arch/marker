import Stripe from 'stripe'

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-01-27.acacia',
  })
}

export const PLANS = {
  pro: {
    name: 'Pro',
    priceId: 'price_1TZbsgIzu43fVGB0nQ7Lp8Wz',
    priceIdAnnual: 'price_1TZbsgIzu43fVGB0Y4Km9xRp',
    monthlyGBP: 19,
    annualGBP: 190,
  },
  // TODO: create these price IDs in the Stripe dashboard before enabling Max checkout
  max: {
    name: 'Max',
    priceId: 'price_TODO_max_monthly',
    priceIdAnnual: 'price_TODO_max_annual',
    monthlyGBP: 39,
    annualGBP: 390,
  },
}
