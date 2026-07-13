-- 004_jobs_cache_scores.sql
-- Feed-port (cost rule 2): score each cached job ONCE, globally, and store the
-- score on the cache row so it is shared across all users. The nightly
-- score-cache cron writes these; user feed clicks read them (no re-scoring).
--
-- This is the candidate-AGNOSTIC baseline score (role quality / seniority /
-- legitimacy). Per-user relevance (target roles, salary floor, office days,
-- track allowlists) is applied deterministically at read time by
-- lib/match-engine.js — zero AI cost, never re-scores.
--
-- NOT YET APPLIED. Per PROGRESS.md backup rule (§14 rule 3), take an explicit
-- Supabase backup before running. Depends on 003_score_tier.sql (score_tier).

alter table public.jobs_cache
  add column if not exists match_score numeric(3,1);

alter table public.jobs_cache
  add column if not exists score_breakdown_json jsonb not null default '{}';

alter table public.jobs_cache
  add column if not exists scored_at timestamptz;

-- Cheap lookup for the nightly cron: "rows ingested but not yet scored".
create index if not exists jobs_cache_unscored_idx
  on public.jobs_cache (scored_at)
  where scored_at is null;
