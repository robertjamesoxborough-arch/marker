-- referrals RLS fix, 2026-07-14. Distinct from migrations 007/008: those
-- were missing table-level GRANTs (service_role couldn't see the table at
-- all). This one is different and was flagged explicitly by Rob for
-- verification: the GRANT is fine (authenticated has SELECT/INSERT/UPDATE/
-- DELETE from migration 008), but RLS is enabled on referrals with NO
-- policy permitting an authenticated user to touch their own row.
--
-- Confirmed live, direct from Postgres (bypassing the Next.js route, which
-- has its own bug of always returning {ok:true} regardless of success --
-- fixed alongside this in app/api/referral/capture/route.js): a real
-- authenticated INSERT via PostgREST with the user's own JWT returned
--   {"code":"42501","message":"new row violates row-level security policy
--   for table \"referrals\""}
-- This means /api/referral/capture has been silently doing nothing for
-- every real referral capture attempt -- the referral programme has never
-- actually recorded a referral.
--
-- app/api/referral/capture/route.js uses the anon-key SSR client (not
-- service role), reading and inserting rows scoped to `referred_user_id`
-- (the referred user capturing that someone referred them). The correct
-- policy shape: a user may see and insert only rows where they are the
-- referred_user_id.
--
-- Verify after running, with a real user JWT (not the service role key):
--   curl -s -X POST "$SUPA_URL/rest/v1/referrals" -H "apikey: $ANON_KEY" \
--     -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
--     -d '{"referrer_account_id":"...","referred_user_id":"<that same user's id>","status":"pending","commission_rate":0.08}'
-- should insert successfully, not return a 42501 RLS error.

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own" ON public.referrals
  FOR SELECT TO authenticated
  USING (referred_user_id = auth.uid());

CREATE POLICY "referrals_insert_own" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (referred_user_id = auth.uid());
