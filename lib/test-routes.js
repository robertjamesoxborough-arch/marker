/**
 * lib/test-routes.js — TEMPORARY, Stage 78.
 *
 * ============================================================================
 * DELETE THIS FILE (and everything it supports) AS SOON AS STRIPE CHECKOUT
 * IS LIVE AND TESTED. See the note at the top of PROGRESS.md for the full
 * removal checklist. This whole system exists only because there is no
 * other way yet to experience a paid tier without paying; once real payment
 * works, it is pure risk with no purpose — a paid-tier backdoor left lying
 * around in a launched product.
 * ============================================================================
 *
 * Backs the 5 dev-only sign-in routes (app/freetier, app/protier,
 * app/maxtier, app/trialtier, app/sandbox). Each one signs Rob into a
 * dedicated, pre-seeded test account for that tier and drops him into /app,
 * so real tier differences can be experienced firsthand rather than
 * inferred from the code.
 *
 * SECURITY — this is a genuine backdoor (it grants a paid tier with no
 * payment), so it is gated TWICE, both required, fail closed on either:
 *   1. process.env.ENABLE_TEST_ROUTES must be the literal string 'true'.
 *      Never set in the Vercel Production environment by default -- see
 *      "How to toggle" below.
 *   2. The request must carry ?key=<TEST_ROUTES_SECRET> matching a second
 *      env var, so even an accidental ENABLE_TEST_ROUTES=true in production
 *      is not, by itself, enough for a stranger to use these routes -- they
 *      would also need to know a random secret that is never linked from
 *      anywhere in the product (no nav, no sitemap, URL-only, told to Rob
 *      out of band).
 * With either check failing, every one of the 5 routes returns a plain 404,
 * identical to a route that doesn't exist -- no error message, no hint,
 * nothing that tells a stranger this system exists at all.
 *
 * HOW TO TOGGLE (local dev):
 *   .env.local already has ENABLE_TEST_ROUTES=true and a TEST_ROUTES_SECRET
 *   for local testing. Visit e.g. http://localhost:3000/protier?key=<secret>
 *
 * HOW TO TOGGLE (production, only when Rob actually wants to test live):
 *   vercel env add ENABLE_TEST_ROUTES production        (enter: true)
 *   vercel env add TEST_ROUTES_SECRET production        (enter: a real secret)
 *   vercel --prod --yes                                  (redeploy to pick them up)
 *   Then visit https://marker-silk.vercel.app/protier?key=<secret>
 *   To turn back off: vercel env rm ENABLE_TEST_ROUTES production, redeploy.
 *   Production should default to NOT having ENABLE_TEST_ROUTES set at all.
 */

// One fixed, pre-seeded account per tier. Emails use the .test TLD, which is
// IANA-reserved specifically for testing and will never resolve or deliver
// real mail -- and admin.generateLink() never sends an email anyway, it only
// mints a token this server then redeems itself.
export const TEST_ACCOUNTS = {
  free:    { email: 'rob.test.free@requite-internal.test',    label: 'Free' },
  pro:     { email: 'rob.test.pro@requite-internal.test',     label: 'Pro' },
  max:     { email: 'rob.test.max@requite-internal.test',     label: 'Max' },
  trial:   { email: 'rob.test.trial@requite-internal.test',   label: 'Trial (Pro-level; also exercises the real trial_ends_at path -- see the Stage 77 finding on whether it actually delivers Pro limits)' },
  sandbox: { email: 'rob.test.sandbox@requite-internal.test', label: 'Sandbox (Max-tier, free to break)' },
}

/**
 * Both checks must pass. Returns false (never throws) on any missing or
 * mismatched value, including a missing TEST_ROUTES_SECRET itself -- an
 * unset secret must never be treated as "no secret required".
 */
export function testRoutesAllowed(request) {
  if (process.env.ENABLE_TEST_ROUTES !== 'true') return false
  const secret = process.env.TEST_ROUTES_SECRET
  if (!secret) return false
  const key = request.nextUrl.searchParams.get('key')
  return key === secret
}

/**
 * Shared sign-in logic for all 5 routes, so there is exactly one place that
 * mints a session for a test account rather than 5 near-identical copies
 * that could drift. Mirrors the app's OWN existing magic-link mechanism
 * (app/auth/callback/page.js calling supabase.auth.verifyOtp client-side)
 * rather than hand-rolling any cookie construction here: this route only
 * mints a token server-side with the admin API, then redirects the browser
 * to the callback page that already knows how to turn a token_hash into a
 * real session with correctly-set cookies.
 *
 * @param {'free'|'pro'|'max'|'trial'|'sandbox'} tierKey
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function signInAsTestAccount(tierKey, request) {
  if (!testRoutesAllowed(request)) {
    // Identical to a route that doesn't exist -- no error body, no hint.
    return new Response(null, { status: 404 })
  }

  const account = TEST_ACCOUNTS[tierKey]
  if (!account) return new Response(null, { status: 404 })

  // Dynamic imports so nothing here is pulled into a bundle that ships to
  // the browser, and so the service-role client is only ever constructed
  // when both gates above have already passed.
  const { createClient } = await import('@supabase/supabase-js')
  const { NextResponse } = await import('next/server')

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: account.email,
  })

  const hashedToken = data?.properties?.hashed_token
  if (error || !hashedToken) {
    console.error(`[test-routes] generateLink failed for ${tierKey}:`, error?.message || 'no hashed_token returned')
    return NextResponse.json({ error: 'Test account sign-in failed. Has it been seeded yet? See PROGRESS.md Stage 78.' }, { status: 500 })
  }

  const callbackUrl = new URL('/auth/callback', request.url)
  callbackUrl.searchParams.set('token_hash', hashedToken)
  callbackUrl.searchParams.set('type', 'magiclink')
  callbackUrl.searchParams.set('next', '/app')
  return NextResponse.redirect(callbackUrl)
}
