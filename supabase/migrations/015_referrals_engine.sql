-- Referrals engine (Stage 69): candidate-side network outreach. Two new
-- tables, both direct client CRUD (RLS policy + table GRANT from the
-- start, per migration 008's finding that service_role does NOT bypass a
-- missing table-level GRANT, and per this project's repeated GRANT-sweep
-- history of exactly this class of silent failure).
--
-- NOT to be confused with the existing public.referrals table (Requite's
-- own refer-a-friend growth programme, app/api/referral/*) -- this is the
-- candidate's OWN professional network, a completely different concept,
-- hence the distinct table names below.

-- contacts: the people a user knows. Simple, no AI, no scoring -- just a
-- personal address book scoped to job-search outreach.
CREATE TABLE IF NOT EXISTS public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  company            text,
  past_companies     text[] not null default '{}',
  relationship       text,   -- free text: "Former colleague at Acme", "University friend"
  last_contacted_at  timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS contacts_user_idx ON public.contacts (user_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_own" ON public.contacts FOR ALL USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO service_role, authenticated;

-- referral_requests: the ask lifecycle for one contact, optionally tied to
-- one live pipeline role (job_id null = speculative dream-company outreach,
-- not tied to a specific open role). job_id is SET NULL on delete (unlike
-- interview_stage_notes' CASCADE) -- a referral relationship's history is
-- worth keeping even if the pipeline item it started against is later
-- removed; the notes/contact.relationship values persist independently.
CREATE TABLE IF NOT EXISTS public.referral_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  contact_id       uuid not null references public.contacts(id) on delete cascade,
  job_id           uuid references public.pipeline_items(id) on delete set null,
  message_type     text not null check (message_type in ('warm_referral', 'reconnect_ask', 'speculative_outreach', 'nudge', 'intel_request')),
  drafted_message  text,
  status           text not null default 'drafted' check (status in ('drafted', 'sent', 'responded', 'agreed', 'referred', 'declined', 'no_response')),
  sent_at          timestamptz,
  responded_at     timestamptz,
  agreed_at        timestamptz,
  referred_at      timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS referral_requests_user_idx    ON public.referral_requests (user_id);
CREATE INDEX IF NOT EXISTS referral_requests_contact_idx ON public.referral_requests (contact_id);
CREATE INDEX IF NOT EXISTS referral_requests_job_idx     ON public.referral_requests (job_id);

ALTER TABLE public.referral_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_requests_own" ON public.referral_requests FOR ALL USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_requests TO service_role, authenticated;
