// TEMPORARY TEST ROUTE — Stage 78. See lib/test-routes.js and the note at
// the top of PROGRESS.md. DELETE this file (and its 4 siblings, and
// everything they depend on) as soon as Stripe checkout is live and tested.
// Not linked from anywhere in the product; URL-only, gated behind
// ENABLE_TEST_ROUTES + a secret key, 404s otherwise.
//
// This one also exists to let Rob verify, firsthand, whether the trial
// path actually delivers Pro-level caps: the seeded account has a genuine
// future trial_ends_at (see PROGRESS.md Stage 78 seeding notes) but its
// tier column is deliberately left at the real signup default rather than
// forced to the literal string 'trial' -- so this route exercises the
// SAME resolution checkAllowance() would do for any real trialing user,
// including the Stage 77 finding that trial_ends_at alone may not resolve
// to Pro-level caps. If that bug is ever fixed, this account should start
// showing Pro limits without any change to this file.
import { signInAsTestAccount } from '../../lib/test-routes'

export async function GET(request) {
  return signInAsTestAccount('trial', request)
}
