-- Notes tab (Stage 76): a plain, free-form scratchpad. Deliberately the
-- cheapest possible feature in the app -- no AI call anywhere in this
-- path, just a text column read and written directly.
--
-- Unlike every other table in this codebase, this one IS queried directly
-- from the browser client (see app/app/tabs/NotesTab.js), not through an
-- API route with a service-role write. That's a genuine architecture
-- change for this repo: RLS is the only thing standing between one user
-- and another user's notes, so both the policies below and the table
-- GRANT are load-bearing, not defence in depth on top of a server check.
-- Per migration 008's finding (service_role does NOT bypass a missing
-- table-level GRANT, and this exact class of bug silently broke 19 tables
-- before) the GRANT is included from the start, and per migration 009's
-- finding (RLS enabled with no policy silently blocks every write with a
-- 42501, not a visible bug) both SELECT and every write verb get an
-- explicit own-row policy below, verified, not assumed.
--
-- The 10-note cap is enforced here in Postgres, not just in the client.
-- A client-side count check alone can be raced (two tabs open, or the
-- check itself is trivially skippable) and would fail the "must never
-- silently fail" requirement if it did -- the trigger below is what
-- actually guarantees the cap holds, and raises a clear message the
-- client surfaces verbatim.

CREATE TABLE IF NOT EXISTS public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes (user_id, updated_at desc);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_own" ON public.notes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notes_insert_own" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes_update_own" ON public.notes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes_delete_own" ON public.notes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated, service_role;

-- 10-note-per-user hard cap, enforced server-side so it can't be raced or
-- bypassed by skipping a client-side check.
CREATE OR REPLACE FUNCTION public.enforce_notes_cap()
RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM public.notes WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'notes_cap_reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notes_cap_before_insert ON public.notes;
CREATE TRIGGER notes_cap_before_insert
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_notes_cap();

-- keep updated_at honest on every edit, same convention as other tables
CREATE OR REPLACE FUNCTION public.notes_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notes_touch_updated_at ON public.notes;
CREATE TRIGGER notes_touch_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.notes_set_updated_at();
