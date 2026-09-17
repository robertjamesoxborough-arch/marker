-- Cost-hardening (Stage 77, following the Audit Stage 2 worst-case cost
-- model): a fast per-user monthly spend aggregate backing the new spend-
-- ceiling check in lib/allowance.js.
--
-- Every action in TIER_CAPS is a plain COUNT cap, but actions vary in real
-- cost by ~350x (interview_prep_live at ~£0.003 a call vs interview_prep
-- with web_search at up to ~£0.31), so a count cap cannot bound spend --
-- Audit Stage 2 found every plan's worst case at its own published caps
-- is a loss. This function gives checkAllowance() a cheap way to ask "what
-- has this user actually cost this month", using the cost_estimate_gbp
-- lib/ai-usage.js already computes and writes on every row.
--
-- A single Postgres aggregate rather than pulling potentially thousands of
-- ai_usage rows into JS and summing there -- some routes (e.g. /api/analyse)
-- call checkAllowance() two or three times per request, so this runs on
-- every one of those calls and needs to be cheap.
create or replace function public.ai_usage_monthly_spend(p_user_id uuid, p_since timestamptz)
returns numeric
language sql
stable
security invoker
as $$
  select coalesce(sum(cost_estimate_gbp), 0)::numeric
  from public.ai_usage
  where user_id = p_user_id and created_at >= p_since;
$$;

-- security invoker (the default) + this GRANT: service_role already has
-- table-level SELECT on ai_usage (migration 007), so it can execute this
-- function under its own privileges. Per the standing rule from migration
-- 008 (missing GRANTs silently broke 19 tables before), the GRANT is
-- included from the start rather than discovered later.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default. Because
-- this is security invoker, anon/authenticated calling it directly via
-- PostgREST would fail anyway (they have no table-level SELECT on
-- ai_usage -- confirmed live: 42501 permission denied), but revoking the
-- default explicitly means that is enforced twice, not once, and this
-- function never becomes a way to read a DIFFERENT user's monthly spend
-- if the underlying table grant ever changes.
revoke execute on function public.ai_usage_monthly_spend(uuid, timestamptz) from public;
grant execute on function public.ai_usage_monthly_spend(uuid, timestamptz) to service_role;
