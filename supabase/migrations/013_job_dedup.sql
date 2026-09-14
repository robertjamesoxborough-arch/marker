-- Dashboard-wide duplicate / already-handled detection (Stage 58).
--
-- pipeline_items already snapshots company (custom_company) and role
-- (custom_role) independently of jobs_cache, so those survive the source
-- posting being deleted. It does NOT snapshot location or a stable
-- external/ad id -- both needed for lib/job-match.js's matcher -- so this
-- adds them as plain columns (not stuffed into score_breakdown_json,
-- consistent with how office_days/job_link/etc are already real columns).
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS external_id text;

-- Dismissed jobs were previously only a bare, deduped array of URL strings
-- in profiles.hard_filters_json.dismissed (app/api/dismiss/route.js) --
-- exactly the "match on URL alone doesn't work" failure mode this feature
-- exists to fix, since a dismissed job carried no company/role/location at
-- all. That array is left in place (still read by the feed's dismissed-
-- filter Set, app/app/page.js) and this table is written alongside it, not
-- instead of it -- additive, not a replacement, to avoid touching a live
-- read path. This table is what lib/job-match.js actually compares against
-- for "you dismissed this before".
CREATE TABLE IF NOT EXISTS public.dismissed_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  external_id   text,
  company       text,
  role_title    text,
  location      text,
  job_link      text,
  dismissed_at  timestamptz not null default now()
);

-- Per migration 008's finding (service_role does not bypass a missing
-- table-level GRANT, a mechanism distinct from RLS -- silently broke 19
-- tables before being caught), included from the start.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dismissed_jobs TO service_role, authenticated;
