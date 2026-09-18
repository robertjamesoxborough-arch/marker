-- TEMPORARY, Stage 80 — supports the 6th dev-only test route, /onboardtier.
-- See lib/test-routes.js and the removal note at the top of PROGRESS.md:
-- this function must be dropped along with everything else in that
-- checklist as soon as Stripe checkout is live and tested.
--
-- Resets ONE fixed test account (rob.test.onboard@requite-internal.test)
-- back to a genuinely blank, never-onboarded state, so /onboardtier can
-- call this on every hit before signing in, landing the user on /onboard
-- every single time rather than a stale mid-onboarding or fully-onboarded
-- state left over from a previous test pass.
--
-- Columns reset on profiles are exactly the ones app/api/profile/save's
-- upsert writes (the real onboarding write path — enumerated from that
-- file, not guessed), reset to that column's own genuinely-blank default
-- (the same values a freshly-trigger-created profile row already has, per
-- information_schema.columns: target_roles/industries default '{}', not
-- null, since both are NOT NULL array columns; hard_filters_json defaults
-- '{}'::jsonb; region defaults 'uk'). name/contact_email/linkedin_url/
-- byo_anthropic_key_encrypted are NOT part of the onboarding write path
-- (set elsewhere, e.g. Settings) and are deliberately left untouched.
--
-- Idempotent by construction: UPDATE ... SET <fixed values> and
-- DELETE ... WHERE both produce the same end state no matter how many
-- times this runs.
create or replace function public.reset_onboarding_test_account(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update profiles set
    track              = null,
    status             = null,
    target_roles       = '{}',
    seniority          = null,
    industries         = '{}',
    postcode           = null,
    max_office_days    = null,
    salary_floor       = null,
    hard_filters_json  = '{}'::jsonb,
    region             = 'uk'
  where user_id = p_user_id;

  delete from career_history  where user_id = p_user_id;
  -- pipeline_items is the real "jobs / scores" table (score, status,
  -- signal, notes columns — confirmed against the live schema, not the
  -- generic name "jobs" the request used).
  delete from pipeline_items  where user_id = p_user_id;
  delete from dismissed_jobs  where user_id = p_user_id;
  delete from wishlists       where user_id = p_user_id;
  -- ai_usage is the real "usage_logs" table. There is no separate monthly
  -- spend aggregate table to also clear: lib/allowance.js's spend ceiling
  -- (Stage 77) is computed LIVE from ai_usage.cost_estimate_gbp via the
  -- ai_usage_monthly_spend() function every time it is checked, so
  -- deleting this user's ai_usage rows already zeroes it out.
  delete from ai_usage        where user_id = p_user_id;
end;
$$;

-- Same defensive double-gate as migration 018's ai_usage_monthly_spend:
-- Postgres grants EXECUTE to PUBLIC by default, so revoke it explicitly
-- and grant only to service_role, even though RLS would independently
-- block anon/authenticated from the underlying tables this touches.
revoke execute on function public.reset_onboarding_test_account(uuid) from public;
grant execute on function public.reset_onboarding_test_account(uuid) to service_role;
