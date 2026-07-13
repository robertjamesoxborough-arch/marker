-- 006_jobs_cache_external_id_full_unique.sql
--
-- Fixes migration 005. Postgres's ON CONFLICT clause (used by supabase-js's
-- upsert(rows, { onConflict: 'external_id' })) cannot target a PARTIAL
-- unique index — it requires a full unique index/constraint on the exact
-- conflict column(s). Confirmed by Rob running cron/adzuna after 005: the
-- uuid error was gone, but got "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification".
--
-- All 5 writers (cron/adzuna, cron/gov, cron/greenhouse, and the feed-web/
-- feed-gov fresh-scan paths) set external_id unconditionally on every row
-- they push — re-verified by reading each file — so a full (non-partial)
-- unique index is safe. jobs_cache is still empty (0 rows), so there is no
-- existing data to reconcile.

drop index if exists public.jobs_cache_external_id_key;

create unique index if not exists jobs_cache_external_id_key
  on public.jobs_cache (external_id);
