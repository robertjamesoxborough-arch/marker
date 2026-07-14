-- Session S: pipeline_items.added_at has never existed. lib/db.js's jobToRow()
-- has included `added_at` in every insert/upsert payload since the original
-- Stage 0 schema (001_schema.sql defines added_at on `wishlists`, not on
-- `pipeline_items` -- the column was assumed by the app code but never
-- actually created on this table). Every saveJobs()/updateJobInDb() call
-- has been failing with PGRST204 ("Could not find the 'added_at' column of
-- 'pipeline_items' in the schema cache") -- confirmed live against
-- production. The call sites wrap this in .catch(() => {}), so the UI shows
-- success and local React state updates, but nothing has ever persisted
-- through this path. The 20 real rows that do exist for the live test
-- account were written by an earlier version of the code/schema, before
-- this drift; new adds and edits since then have been silently lost on
-- reload.
--
-- Nullable, no default: lib/db.js's jobToRow() explicitly sends
-- `added_at: null` when job.addedAt is unset, so a NOT NULL constraint
-- would just move the same failure to a different column.

alter table public.pipeline_items
  add column if not exists added_at timestamptz;
