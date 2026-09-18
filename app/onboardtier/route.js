// TEMPORARY TEST ROUTE — Stage 80. See lib/test-routes.js and the note at
// the top of PROGRESS.md. DELETE this file (and its 5 siblings, and
// everything they depend on) as soon as Stripe checkout is live and tested.
// Not linked from anywhere in the product; URL-only, gated behind
// ENABLE_TEST_ROUTES + a secret key, 404s otherwise.
//
// On EVERY hit, resets its account to a genuinely blank, never-onboarded
// state BEFORE signing in (reset on entry, never on exit -- no
// beforeunload/close detection), then lands on /onboard, not /app.
import { signInAsTestAccount } from '../../lib/test-routes'

export async function GET(request) {
  return signInAsTestAccount('onboard', request)
}
