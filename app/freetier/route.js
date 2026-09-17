// TEMPORARY TEST ROUTE — Stage 78. See lib/test-routes.js and the note at
// the top of PROGRESS.md. DELETE this file (and its 4 siblings, and
// everything they depend on) as soon as Stripe checkout is live and tested.
// Not linked from anywhere in the product; URL-only, gated behind
// ENABLE_TEST_ROUTES + a secret key, 404s otherwise.
import { signInAsTestAccount } from '../../lib/test-routes'

export async function GET(request) {
  return signInAsTestAccount('free', request)
}
