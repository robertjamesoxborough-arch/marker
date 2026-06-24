-- ============================================================
-- 002_requite_schema.sql
-- Stage 2: Additive schema extensions for Requite
-- Adds freshness tracking to jobs_cache + pipeline_items.
-- Creates 5 new employer/matching tables with RLS.
-- SAFE: no DROP, no ALTER of existing columns, no data changes.
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS.
-- ============================================================


-- ── 1. ALTER jobs_cache: add freshness + source tracking ──

ALTER TABLE public.jobs_cache
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'public_listing'
    CHECK (source_type IN ('requite_managed', 'public_listing', 'partner_feed'));

ALTER TABLE public.jobs_cache
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.jobs_cache
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.jobs_cache
  ADD COLUMN IF NOT EXISTS freshness text NOT NULL DEFAULT 'Fresh'
    CHECK (freshness IN ('Fresh', 'Aging', 'Stale', 'Expired'));


-- ── 2. ALTER pipeline_items: add source_type ──

ALTER TABLE public.pipeline_items
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'public_listing'
    CHECK (source_type IN ('requite_managed', 'public_listing', 'partner_feed'));


-- ── 3. NEW TABLE: employer_profiles ──
-- One row per employer user. Holds company info + billing status.

CREATE TABLE IF NOT EXISTS public.employer_profiles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  account_id      uuid        NOT NULL REFERENCES public.accounts(id)   ON DELETE CASCADE,
  company_name    text        NOT NULL,
  company_size    text        CHECK (company_size IN ('1-10','11-50','51-200','201-500','501-2000','2000+')),
  sector          text,
  website_url     text,
  billing_status  text        NOT NULL DEFAULT 'inactive'
                                CHECK (billing_status IN ('inactive','trial','active','suspended')),
  hiring_volume   integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ── 4. NEW TABLE: employer_roles ──
-- A role posted by an employer. source_type enforces G1 invariant.

CREATE TABLE IF NOT EXISTS public.employer_roles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id      uuid        NOT NULL REFERENCES public.employer_profiles(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  description      text,
  location         text,
  salary_min       integer,
  salary_max       integer,
  source_type      text        NOT NULL
                                 CHECK (source_type IN ('requite_managed', 'public_listing', 'partner_feed')),
  freshness        text        NOT NULL DEFAULT 'Fresh'
                                 CHECK (freshness IN ('Fresh', 'Aging', 'Stale', 'Expired')),
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  status           text        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'paused', 'closed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);


-- ── 5. NEW TABLE: candidate_employer_matches ──
-- Anonymised match record. Both sides must opt in before identities unlock.

CREATE TABLE IF NOT EXISTS public.candidate_employer_matches (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  employer_role_id   uuid        NOT NULL REFERENCES public.employer_roles(id) ON DELETE CASCADE,
  match_score        numeric(3,1),
  match_json         jsonb       NOT NULL DEFAULT '{}',
  candidate_opted_in boolean     NOT NULL DEFAULT false,
  employer_opted_in  boolean     NOT NULL DEFAULT false,
  matched_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, employer_role_id)
);


-- ── 6. NEW TABLE: intro_requests ──
-- G1: either side can request a warm intro once both have opted in.

CREATE TABLE IF NOT EXISTS public.intro_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid        NOT NULL REFERENCES public.candidate_employer_matches(id) ON DELETE CASCADE,
  requested_by  text        NOT NULL CHECK (requested_by IN ('candidate', 'employer')),
  status        text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  message       text,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz
);


-- ── 7. NEW TABLE: intro_receipts ──
-- G1: immutable timestamped receipt log for every intro event.

CREATE TABLE IF NOT EXISTS public.intro_receipts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         uuid        NOT NULL REFERENCES public.candidate_employer_matches(id) ON DELETE CASCADE,
  intro_request_id uuid        REFERENCES public.intro_requests(id) ON DELETE SET NULL,
  event_type       text        NOT NULL
                                 CHECK (event_type IN ('intro_sent','intro_accepted','intro_declined','intro_expired')),
  event_at         timestamptz NOT NULL DEFAULT now(),
  meta_json        jsonb       NOT NULL DEFAULT '{}'
);


-- ── 8. ROW LEVEL SECURITY ──

ALTER TABLE public.employer_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_employer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intro_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intro_receipts             ENABLE ROW LEVEL SECURITY;

-- Employer profiles: own row only
CREATE POLICY "employer_profiles_own" ON public.employer_profiles
  FOR ALL USING (user_id = auth.uid());

-- Employer roles: employer manages their own roles;
-- authenticated candidates can read active roles (for matching UI)
CREATE POLICY "employer_roles_manage" ON public.employer_roles
  FOR ALL USING (
    employer_id IN (
      SELECT id FROM public.employer_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "employer_roles_read" ON public.employer_roles
  FOR SELECT USING (auth.role() = 'authenticated' AND status = 'active');

-- Candidate matches: candidates see their own match records
CREATE POLICY "candidate_matches_own" ON public.candidate_employer_matches
  FOR ALL USING (user_id = auth.uid());

-- Intro requests: candidates can read intros linked to their matches
CREATE POLICY "intro_requests_own" ON public.intro_requests
  FOR SELECT USING (
    match_id IN (
      SELECT id FROM public.candidate_employer_matches WHERE user_id = auth.uid()
    )
  );

-- Intro receipts: candidates can read receipts linked to their matches
CREATE POLICY "intro_receipts_own" ON public.intro_receipts
  FOR SELECT USING (
    match_id IN (
      SELECT id FROM public.candidate_employer_matches WHERE user_id = auth.uid()
    )
  );
