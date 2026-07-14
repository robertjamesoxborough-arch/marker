-- Full-schema GRANT sweep, 2026-07-14. Prompted by three separate incidents
-- (jobs_cache, wishlists, ai_usage) all silently failing the same way:
-- PostgREST returning 42501 "permission denied" for service_role even
-- though service_role is meant to bypass RLS entirely -- the missing piece
-- is a plain table-level GRANT, a separate mechanism from RLS. Because every
-- Supabase client call in this codebase destructures `{ data }` and mostly
-- ignores `{ error }`, each of these three failures looked like "empty
-- result", not a crash, and went unnoticed for a long time.
--
-- Swept every table service_role touches by requesting
-- `select=*&limit=1` with the real service role key against each and
-- reading the HTTP status + error body. Confirmed every failure below is
-- genuinely `42501 permission denied for table X` (not a missing-table 404
-- or an RLS-driven 401), so a GRANT is the correct and complete fix, not a
-- symptom of something else. Verified via grep that none of these tables
-- are ever queried by client-side/browser code (lib/db.js, app/app/page.js)
-- -- every reference is server-side, using the service role key -- so
-- service_role is the load-bearing grant; authenticated is added for
-- consistency with the existing project convention (Data API on, RLS on)
-- and to not be the reason a future client-side code path silently fails
-- the same way, even though nothing currently depends on it.
--
-- Confirmed working before this migration (service_role already granted,
-- do not need re-granting): accounts, account_members, jobs_cache,
-- pipeline_items, profiles, users, wishlists, ai_usage (fixed in 007).
--
-- Confirmed BROKEN (this migration fixes all 19):
--   account_usage, admin_companies, admin_feature_flags,
--   admin_metrics_cache, admin_outreach, admin_taglines, admin_todos,
--   applications, candidate_employer_matches, career_history,
--   commission_events, employer_profiles, employer_roles,
--   interview_preps, intro_receipts, intro_requests, market_intel,
--   referrals, tier_allowances
--
-- Real, confirmed-live impact: career_history in particular is read by
-- /api/analyse, /api/cv/generate, /api/cv/cover-letter, /api/cv/questions,
-- /api/interview-prep and /api/negotiation-prep, all via buildAiContext() --
-- every one of those routes has been silently building AI context with ZERO
-- career history, degrading personalisation quality invisibly, for as long
-- as this table has existed. tier_allowances is a second cap-adjacent table
-- in the same family as ai_usage worth double-checking against
-- lib/allowance.js next session.
--
-- Verify after running, table by table:
--   curl -s "$SUPA_URL/rest/v1/<table>?select=id&limit=1" -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY"
-- should return [] or real rows, never a 42501 permission error.

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.account_usage,
  public.admin_companies,
  public.admin_feature_flags,
  public.admin_metrics_cache,
  public.admin_outreach,
  public.admin_taglines,
  public.admin_todos,
  public.applications,
  public.candidate_employer_matches,
  public.career_history,
  public.commission_events,
  public.employer_profiles,
  public.employer_roles,
  public.interview_preps,
  public.intro_receipts,
  public.intro_requests,
  public.market_intel,
  public.referrals,
  public.tier_allowances
TO service_role, authenticated;
