// TEMPORARY TEST ROUTE — Stage 78. See lib/test-routes.js and the note at
// the top of PROGRESS.md. DELETE this file (and its 4 siblings, and
// everything they depend on) as soon as Stripe checkout is live and tested.
// Not linked from anywhere in the product; URL-only, gated behind
// ENABLE_TEST_ROUTES + a secret key, 404s otherwise.
//
// Max-tier, deliberately the one account meant to be broken: unlike the
// other 4, nothing about this account's data is treated as something to
// keep pristine for a like-for-like comparison.
import { signInAsTestAccount } from '../../lib/test-routes'

export async function GET(request) {
  return signInAsTestAccount('sandbox', request)
}
