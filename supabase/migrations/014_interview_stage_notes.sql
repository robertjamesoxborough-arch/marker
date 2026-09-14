-- Interview prep overhaul (Stage 67): stage-by-stage interview notes,
-- append-only by design. Unlike pipeline_items.score_breakdown_json (the
-- whole row is upserted on every job save -- see lib/db.js's jobToRow),
-- a note logged after one interview stage must survive every later save
-- of the SAME job untouched, so it lives in its own table rather than a
-- JSON bag that a later, unrelated pipeline update could silently
-- overwrite. A real lesson from the personal tracker.
--
-- Read/written exclusively via app/api/interview-prep/stage-notes/route.js
-- using the service-role client (same pattern as channel_checks, migration
-- 012), so no RLS policy is needed, only the table-level GRANT -- included
-- from the start per migration 008's finding that service_role does NOT
-- bypass a missing table-level GRANT, a distinct mechanism from RLS that
-- has silently broken tables in this project before.
--
-- Append-only: only SELECT + INSERT are granted, deliberately no UPDATE or
-- DELETE -- a stage note is a historical record, never edited after the
-- fact.

CREATE TABLE IF NOT EXISTS public.interview_stage_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  job_id     uuid not null references public.pipeline_items(id) on delete cascade,
  stage      text not null check (stage in ('screening', 'hiring_manager', 'panel', 'final', 'task', 'ceo')),
  note       text not null,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS interview_stage_notes_job_idx ON public.interview_stage_notes (user_id, job_id, created_at);

GRANT SELECT, INSERT ON public.interview_stage_notes TO service_role, authenticated;
