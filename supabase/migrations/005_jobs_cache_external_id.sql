-- 005_jobs_cache_external_id.sql
--
-- ROOT CAUSE FIX: jobs_cache.id has always been `uuid primary key default
-- gen_random_uuid()` (001_schema.sql), but every writer — cron/adzuna,
-- cron/gov, cron/greenhouse, and the feed-web/feed-gov fresh-scan paths —
-- has always supplied a TEXT id like "adzuna-5798988308" for upsert dedupe.
-- Every insert has been failing with "invalid input syntax for type uuid"
-- since jobs_cache was created (verified 2026-07-13 by running cron/adzuna
-- manually). This is why jobs_cache has been empty this whole time — a
-- pre-existing bug, not a regression from the Stage 17-19 feed-port work.
--
-- Fix: add a separate `external_id` (text, unique) column for each source's
-- natural key. `id` stays the opaque uuid primary key, DB-generated, used
-- unchanged by pipeline_items.job_cache_id (no FK/type migration needed
-- there — this fix is scoped to jobs_cache alone). Writers now upsert on
-- external_id; readers keep using the real uuid `id` unchanged.
--
-- NOT YET APPLIED. Rob has a backup from today (2026-07-13) before running.

alter table public.jobs_cache
  add column if not exists external_id text;

create unique index if not exists jobs_cache_external_id_key
  on public.jobs_cache (external_id)
  where external_id is not null;
