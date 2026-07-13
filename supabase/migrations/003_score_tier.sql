-- 003_score_tier.sql
-- Session 1 (unified scoring model): record which scoring tier produced a score.
-- 'quick' = fast feed scan (Haiku, title/company/location only).
-- 'full'  = /api/analyse against a real JD (8 factors, deterministic overall).
--
-- NOT YET APPLIED. Per PROGRESS.md backup rule (§14 rule 3), take an explicit
-- Supabase backup before running this. The app degrades gracefully without the
-- column: score_tier flows through API payloads and the UI infers the tier from
-- whether a factor breakdown is present, so nothing breaks until this is applied.

alter table public.jobs_cache
  add column if not exists score_tier text
  check (score_tier in ('quick', 'full'));

alter table public.pipeline_items
  add column if not exists score_tier text
  check (score_tier in ('quick', 'full'));
