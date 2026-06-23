-- ============================================================
-- Marker — full schema, RLS, triggers, seed
-- Run once in Supabase SQL editor
-- ============================================================

-- ACCOUNTS
create table public.accounts (
  id                 uuid primary key default gen_random_uuid(),
  type               text not null default 'personal'
                       check (type in ('personal','coach','agency','university','outplacement','enterprise')),
  name               text not null,
  plan               text not null default 'free'
                       check (plan in ('free','standby','lite','pro','pro_byo','coach_pro','coach_agency','university','outplacement','enterprise')),
  billing_email      text,
  stripe_customer_id text,
  parent_account_id  uuid references public.accounts(id),
  region             text not null default 'uk',
  headless_mode      boolean not null default false,
  theme_json         jsonb not null default '{}',
  custom_domain      text,
  created_at         timestamptz not null default now()
);

-- ACCOUNT MEMBERS
create table public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner'
               check (role in ('owner','admin','member','client','student')),
  invited_by uuid references auth.users(id),
  joined_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);

-- USERS (public extension of auth.users)
create table public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  default_account_id  uuid references public.accounts(id),
  created_at          timestamptz not null default now(),
  last_active_at      timestamptz,
  trial_ends_at       timestamptz,
  referrer_account_id uuid references public.accounts(id)
);

-- PROFILES
create table public.profiles (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  track                     text check (track in ('balanced','standard','parent','returner','career_changer')),
  status                    text check (status in ('employed_searching','employed_passive','unemployed','on_leave','student','returning')),
  target_roles              text[] not null default '{}',
  seniority                 text check (seniority in ('ic','manager','senior_manager','head','director','vp_plus')),
  industries                text[] not null default '{}',
  postcode                  text,
  max_office_days           numeric(3,1),
  salary_floor              integer,
  hard_filters_json         jsonb not null default '{}',
  byo_anthropic_key_encrypted text,
  name                      text,
  contact_email             text,
  linkedin_url              text,
  region                    text not null default 'uk'
);

-- CAREER HISTORY
create table public.career_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  role_title   text,
  company      text,
  start_date   date,
  end_date     date,
  description  text,
  achievements text[] not null default '{}'
);

-- WISHLISTS
create table public.wishlists (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  account_id       uuid not null references public.accounts(id) on delete cascade,
  company          text not null,
  careers_url      text,
  greenhouse_slug  text,
  rank             numeric(4,1),
  notes            text,
  added_at         timestamptz not null default now(),
  last_checked_at  timestamptz
);

-- JOBS CACHE (shared across users; written by crons only)
create table public.jobs_cache (
  id                           uuid primary key default gen_random_uuid(),
  source                       text not null check (source in ('greenhouse','adzuna','manual','gov')),
  source_id                    text,
  company                      text,
  role_title                   text,
  location                     text,
  salary                       text,
  posted_at                    timestamptz,
  link                         text,
  raw_json                     jsonb not null default '{}',
  cached_at                    timestamptz not null default now(),
  track_tags                   text[] not null default '{}',
  region                       text not null default 'uk',
  adzuna_attribution_required  boolean not null default false,
  unique (source, source_id)
);

-- PIPELINE ITEMS
create table public.pipeline_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  account_id          uuid not null references public.accounts(id) on delete cascade,
  job_cache_id        uuid references public.jobs_cache(id),
  custom_company      text,
  custom_role         text,
  status              text not null default 'watchlist'
                        check (status in ('watchlist','no_jobs','worth_applying','going_to_apply','applied','interviewing','offer','rejected')),
  score               numeric(3,1),
  score_breakdown_json jsonb not null default '{}',
  signal              text check (signal in ('apply','maybe','skip')),
  signal_reason       text,
  office_days         numeric(3,1),
  job_link            text,
  applied_at          timestamptz,
  posted_at           timestamptz,
  notes               text,
  cv_effort_level     integer check (cv_effort_level in (1,2,3)),
  cv_generated_at     timestamptz,
  dead_link_flag      boolean not null default false
);

-- AI USAGE
create table public.ai_usage (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  account_id          uuid not null references public.accounts(id) on delete cascade,
  model               text not null,
  action              text not null,
  input_tokens        integer not null default 0,
  output_tokens       integer not null default 0,
  cost_estimate_gbp   numeric(10,6) not null default 0,
  created_at          timestamptz not null default now()
);

-- ACCOUNT USAGE (rolled up per billing period)
create table public.account_usage (
  account_id          uuid not null references public.accounts(id) on delete cascade,
  period_start        date not null,
  period_end          date not null,
  sonnet_calls        integer not null default 0,
  haiku_calls         integer not null default 0,
  total_cost_estimate numeric(10,4) not null default 0,
  primary key (account_id, period_start)
);

-- TIER ALLOWANCES
create table public.tier_allowances (
  id                   uuid primary key default gen_random_uuid(),
  tier_name            text not null,
  action_type          text not null,
  monthly_cap_per_user integer not null,
  soft_warn_at_pct     integer not null default 80,
  unique (tier_name, action_type)
);

-- APPLICATIONS
create table public.applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  account_id       uuid not null references public.accounts(id) on delete cascade,
  pipeline_item_id uuid references public.pipeline_items(id) on delete set null,
  cv_text          text,
  cover_letter_text text,
  generated_at     timestamptz not null default now()
);

-- INTERVIEW PREPS
create table public.interview_preps (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  account_id           uuid not null references public.accounts(id) on delete cascade,
  pipeline_item_id     uuid references public.pipeline_items(id) on delete set null,
  stage                text,
  submitted_cv_blob_url text,
  prep_doc             text,
  created_at           timestamptz not null default now()
);

-- MARKET INTEL (anonymised, no PII)
create table public.market_intel (
  id           uuid primary key default gen_random_uuid(),
  metric_type  text not null,
  region       text not null,
  role_family  text,
  seniority    text,
  value_json   jsonb not null default '{}',
  computed_at  timestamptz not null default now()
);

-- REFERRALS
create table public.referrals (
  id                  uuid primary key default gen_random_uuid(),
  referrer_account_id uuid not null references public.accounts(id) on delete cascade,
  referred_user_id    uuid not null references auth.users(id) on delete cascade,
  status              text not null default 'pending'
                        check (status in ('pending','converted','churned')),
  commission_rate     numeric(4,2) not null default 0.20,
  lifetime_value      numeric(10,2) not null default 0,
  created_at          timestamptz not null default now()
);

-- COMMISSION EVENTS
create table public.commission_events (
  id          uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  amount      numeric(10,2) not null,
  currency    text not null default 'gbp',
  period      date not null,
  paid        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ADMIN TODOS
create table public.admin_todos (
  id           uuid primary key default gen_random_uuid(),
  category     text not null
                 check (category in ('marketing','legal','product','press','b2b_sales')),
  title        text not null,
  description  text,
  status       text not null default 'todo'
                 check (status in ('todo','in_progress','done')),
  due_at       timestamptz,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- ADMIN COMPANIES
create table public.admin_companies (
  id                       uuid primary key default gen_random_uuid(),
  track                    text not null,
  region                   text not null default 'uk',
  company                  text not null,
  careers_url              text,
  glassdoor_url            text,
  public_data_sources_json jsonb not null default '{}',
  notes                    text
);

-- ADMIN FEATURE FLAGS
create table public.admin_feature_flags (
  id         uuid primary key default gen_random_uuid(),
  flag_key   text not null,
  track      text,
  account_id uuid references public.accounts(id) on delete cascade,
  enabled    boolean not null default false,
  notes      text,
  unique (flag_key, track, account_id)
);

-- ADMIN METRICS CACHE
create table public.admin_metrics_cache (
  id          uuid primary key default gen_random_uuid(),
  metric      text not null unique,
  value       jsonb not null default '{}',
  computed_at timestamptz not null default now()
);

-- ADMIN OUTREACH CRM
create table public.admin_outreach (
  id            uuid primary key default gen_random_uuid(),
  contact_name  text,
  organisation  text,
  role          text,
  email         text,
  category      text check (category in ('coach','university','outplacement','press','partner')),
  status        text not null default 'not_contacted'
                  check (status in ('not_contacted','contacted','replied','meeting','signed','rejected')),
  last_touch_at timestamptz,
  notes         text
);

-- ADMIN TAGLINES
create table public.admin_taglines (
  id            uuid primary key default gen_random_uuid(),
  tagline_text  text not null,
  active        boolean not null default false,
  impressions   integer not null default 0,
  conversions   integer not null default 0
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.accounts             enable row level security;
alter table public.account_members      enable row level security;
alter table public.users                enable row level security;
alter table public.profiles             enable row level security;
alter table public.career_history       enable row level security;
alter table public.wishlists            enable row level security;
alter table public.jobs_cache           enable row level security;
alter table public.pipeline_items       enable row level security;
alter table public.ai_usage             enable row level security;
alter table public.account_usage        enable row level security;
alter table public.tier_allowances      enable row level security;
alter table public.applications         enable row level security;
alter table public.interview_preps      enable row level security;
alter table public.market_intel         enable row level security;
alter table public.referrals            enable row level security;
alter table public.commission_events    enable row level security;
alter table public.admin_todos          enable row level security;
alter table public.admin_companies      enable row level security;
alter table public.admin_feature_flags  enable row level security;
alter table public.admin_metrics_cache  enable row level security;
alter table public.admin_outreach       enable row level security;
alter table public.admin_taglines       enable row level security;

-- Users: own row only
create policy "users_own" on public.users
  for all using (id = auth.uid());

-- Profiles: own row only
create policy "profiles_own" on public.profiles
  for all using (user_id = auth.uid());

-- Career history: own rows only
create policy "career_history_own" on public.career_history
  for all using (user_id = auth.uid());

-- Accounts: members can read their accounts
create policy "accounts_member_read" on public.accounts
  for select using (
    id in (
      select account_id from public.account_members where user_id = auth.uid()
    )
  );

-- Account members: can read memberships for accounts you belong to
create policy "account_members_read" on public.account_members
  for select using (user_id = auth.uid());

-- Wishlists: own rows only
create policy "wishlists_own" on public.wishlists
  for all using (user_id = auth.uid());

-- Pipeline items: own rows only
create policy "pipeline_items_own" on public.pipeline_items
  for all using (user_id = auth.uid());

-- AI usage: own rows only
create policy "ai_usage_own" on public.ai_usage
  for all using (user_id = auth.uid());

-- Applications: own rows only
create policy "applications_own" on public.applications
  for all using (user_id = auth.uid());

-- Interview preps: own rows only
create policy "interview_preps_own" on public.interview_preps
  for all using (user_id = auth.uid());

-- Jobs cache: authenticated read, service role write
create policy "jobs_cache_read" on public.jobs_cache
  for select using (auth.role() = 'authenticated');

-- Market intel: authenticated read only
create policy "market_intel_read" on public.market_intel
  for select using (auth.role() = 'authenticated');

-- Tier allowances: authenticated read only
create policy "tier_allowances_read" on public.tier_allowances
  for select using (auth.role() = 'authenticated');

-- Admin feature flags: authenticated read only
create policy "feature_flags_read" on public.admin_feature_flags
  for select using (auth.role() = 'authenticated');

-- Admin taglines: authenticated read only (for A/B test display)
create policy "taglines_read" on public.admin_taglines
  for select using (auth.role() = 'authenticated');

-- Admin tables (todos, companies, metrics, outreach): no client access
-- (service role only — accessed via server-side admin routes)

-- ============================================================
-- SIGNUP TRIGGER
-- Auto-creates personal account, membership, user row, and
-- empty profile when a new auth user is registered.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_account_id uuid;
begin
  -- Create personal account
  insert into public.accounts (type, name, plan, billing_email, region)
  values ('personal', coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 'free', new.email, 'uk')
  returning id into new_account_id;

  -- Add user as owner of that account
  insert into public.account_members (account_id, user_id, role)
  values (new_account_id, new.id, 'owner');

  -- Create public user record
  insert into public.users (id, email, default_account_id, trial_ends_at)
  values (new.id, new.email, new_account_id, now() + interval '7 days');

  -- Create empty profile
  insert into public.profiles (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- SEED — tier allowances
-- ============================================================

insert into public.tier_allowances (tier_name, action_type, monthly_cap_per_user, soft_warn_at_pct) values
  ('free',    'analyse',       3,    80),
  ('free',    'haiku_score',  30,    80),
  ('free',    'cv',            0,    80),
  ('free',    'cover_letter',  0,    80),
  ('free',    'interview_prep',0,    80),
  ('standby', 'analyse',       5,    80),
  ('standby', 'haiku_score',  100,   80),
  ('standby', 'cv',            0,    80),
  ('standby', 'cover_letter',  0,    80),
  ('standby', 'interview_prep',0,    80),
  ('lite',    'analyse',      30,    80),
  ('lite',    'haiku_score',  500,   80),
  ('lite',    'cv',           15,    80),
  ('lite',    'cover_letter', 15,    80),
  ('lite',    'interview_prep',0,    80),
  ('pro',     'analyse',      100,   80),
  ('pro',     'haiku_score',  1500,  80),
  ('pro',     'cv',           40,    80),
  ('pro',     'cover_letter', 40,    80),
  ('pro',     'interview_prep',12,   80),
  ('pro_byo', 'analyse',      100,   80),
  ('pro_byo', 'haiku_score',  1500,  80),
  ('pro_byo', 'cv',           40,    80),
  ('pro_byo', 'cover_letter', 40,    80),
  ('pro_byo', 'interview_prep',12,   80);

-- ============================================================
-- SEED — admin taglines (4 candidates for A/B test)
-- ============================================================

insert into public.admin_taglines (tagline_text, active) values
  ('Mark your moves.', true),
  ('Every move, marked.', false),
  ('The job hunt, marked.', false),
  ('Find the role worth marking.', false);
