import Stripe from 'stripe'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-01-27.acacia',
  })
}

export const stripe = getStripe()

export const PLANS = {
  standby: {
    name: 'Standby',
    priceId: 'price_1TZbr9Izu43fVGB0rTmkwRTa',
    priceIdAnnual: 'price_1TZbr9Izu43fVGB0X9Ym3kLp',
    monthlyGBP: 4,
    annualGBP: 38,
  },
  lite: {
    name: 'Lite',
    priceId: 'price_1TZbs0Izu43fVGB0Jm8xQv2T',
    priceIdAnnual: 'price_1TZbs0Izu43fVGB0kL9Rw3Yz',
    monthlyGBP: 12,
    annualGBP: 115,
  },
  pro: {
    name: 'Pro',
    priceId: 'price_1TZbsgIzu43fVGB0nQ7Lp8Wz',
    priceIdAnnual: 'price_1TZbsgIzu43fVGB0Y4Km9xRp',
    monthlyGBP: 24,
    annualGBP: 230,
  },
  byo: {
    name: 'Pro + BYO',
    priceId: 'price_1TZbt2Izu43fVGB0pX3Yn7Kw',
    priceIdAnnual: 'price_1TZbt2Izu43fVGB0qR8Lm4Xz',
    monthlyGBP: 7,
    annualGBP: 67,
  },
}
