-- Job Aggregator tab (Stage 57): per-user, per-channel "last checked"
-- tracking so the daily-sweep cadence flags know when a channel is
-- overdue (see lib/channel-urls.js CHANNEL_CADENCE_DAYS). One row per
-- (user_id, channel); a real click-through or an explicit dismiss both
-- just bump last_checked_at to now().
--
-- Read/written exclusively via app/api/aggregator/channel-click/route.js
-- using the service-role client (same pattern as app/api/profile/save),
-- never queried directly by client-side code -- so no RLS policy is
-- needed, only the table-level GRANT. Per migration 008's finding
-- (service_role does NOT bypass a missing table-level GRANT, a distinct
-- mechanism from RLS, and this exact class of bug silently broke 19
-- tables before), the GRANT below is included from the start rather
-- than discovered later.

CREATE TABLE IF NOT EXISTS public.channel_checks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  channel         text not null check (channel in ('indeed', 'linkedin', 'adzuna', 'target_companies')),
  last_checked_at timestamptz not null default now(),
  unique (user_id, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_checks TO service_role, authenticated;
