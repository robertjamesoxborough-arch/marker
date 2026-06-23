# Marker — Process Fix Brief (OG Tracker Logic → Multi-Tenant Architecture)

## Context

Marker is a multi-tenant AI job hunt SaaS being built at `~/Desktop/marker/`. The visual design is excellent and should not change. The internal processes, data flows, and feature logic are broken and need rebuilding to match the working reference implementation from Rob's personal Job Hunt Tracker.

Rob's personal tracker (the OG) is the gold standard for how every feature should work. This document translates the OG tracker's processes into Marker's multi-tenant Supabase architecture.

**Critical principle:** Keep Marker's visual design, colour scheme (lime/black/cream), typography, and UI layout exactly as they are. This is about fixing the internal logic only — the processes underneath the surface.

---

## Architecture Translation Map

| OG Tracker (personal) | Marker (commercial SaaS) |
|----------------------|--------------------------|
| IndexedDB (4 stores: jobs, feed, dismissed, salaries) | Supabase Postgres (per-user tables with account_id foreign keys) |
| Single user, no auth | Magic link auth, accounts hierarchy, multi-tenant |
| 79 hardcoded seed companies | Per-track curated wishlist, populated from onboarding |
| Unlimited free API via `jobtrackergeneral` | Tiered allowances (Free/Standby £4/Lite £12/Pro £24/BYO £7), hard caps enforced |
| `localStorage` for dismissed IDs | Supabase `dismissed_jobs` table |
| Rob's hardcoded career history | Per-user `profiles` and `career_history` tables |
| No billing | Stripe subscriptions with monthly/annual plans |
| 7 tabs total | Same 7 tabs (Engine → Wishlist in Marker, Easy Life → Balanced Roles) |

**The feature set is identical. The storage layer and access control are different.**

---

## Tab-by-Tab Process Fixes

### 1. Engine Tab (Wishlist in Marker)

**OG behaviour:**
- Task queue shows one company at a time, sorted by ranking (1 → 1.1 → 1.5 → 2) then staleness (never checked = red, 7d+ = amber, recent = grey)
- "Found a job?" analyse box at top with link input, optional Paste JD mode
- Analyse flow: POST to `/api/analyse` → on success store result with 8-factor breakdown → auto-fetch salary if score ≥5 → show result card with signal (apply/maybe/dont_apply), score, office days, breakdown button → "Add to Pipeline" saves to jobs table with status mapped from signal
- On analyse failure (429/redirect/can't read page), automatically switch to Paste JD mode and show error
- Mini pipeline summary below showing jobs by status with dropdowns to change status + delete buttons
- "Recently added — check match?" prompt for jobs added in last 24h without a score yet
- Jump to company search across all pipeline columns
- Quick add a job (paste link + optional role title) button
- Salary estimates pre-fetched for jobs in pipeline on tab load (Apply/Consider/Applied statuses only)

**What Marker needs to fix:**
- The task queue logic exists but doesn't sort correctly by ranking then staleness
- Analyse results aren't persisting to the pipeline correctly — the "Add to Pipeline" button either doesn't work or creates duplicate entries
- Status mapping from signal is wrong (apply → should go to "Worth applying?" column, not "Watchlist")
- Salary auto-fetch on high scores isn't firing
- Paste JD fallback on analyse failure isn't automatic — user has to manually click it
- Mini pipeline summary doesn't sync reactively when you change a job's status in the full Pipeline tab

**Supabase schema requirements:**
```sql
-- wishlists table (the task queue companies)
CREATE TABLE wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  account_id uuid REFERENCES accounts NOT NULL,
  company text NOT NULL,
  careers_url text,
  greenhouse_slug text,
  rank numeric, -- 1, 1.1, 1.5, 2, 3
  notes text,
  added_at timestamptz DEFAULT now(),
  last_checked_at timestamptz
);

-- pipeline_items table (the kanban jobs)
CREATE TABLE pipeline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  account_id uuid REFERENCES accounts NOT NULL,
  job_cache_id uuid REFERENCES jobs_cache, -- nullable, links to feed source
  custom_company text, -- for manually added jobs
  custom_role text,
  status text NOT NULL, -- watchlist|no_jobs|considering|to_apply|applied|interviewing|offer|rejected
  score numeric,
  score_breakdown_json jsonb, -- the 8 factors
  signal text, -- apply|maybe|dont_apply
  signal_reason text,
  office_days numeric,
  job_link text,
  applied_at timestamptz,
  posted_at timestamptz,
  notes text,
  cv_effort_level int, -- 1|2|3
  cv_generated_at timestamptz,
  dead_link_flag boolean DEFAULT false,
  source text, -- greenhouse|web_search|gov_search|manual
  added_at timestamptz DEFAULT now()
);

-- salary_estimates table (persisted, never re-fetch)
CREATE TABLE salary_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  job_id uuid, -- references pipeline_items.id or a temp analyse ID
  salary_text text, -- "£75k-£110k" or "~£82k (estimate)"
  fetched_at timestamptz DEFAULT now()
);

-- dismissed_jobs table (global across all feed tabs)
CREATE TABLE dismissed_jobs (
  user_id uuid REFERENCES auth.users NOT NULL,
  job_identifier text NOT NULL, -- company+role+link hash or feed ID
  dismissed_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, job_identifier)
);
```

**Process fix checklist:**
- [ ] Task queue sorts by rank ASC, last_checked_at ASC NULLS FIRST (never-checked = red)
- [ ] Analyse success → upsert to pipeline_items with correct status mapping: signal='apply' → status='considering', signal='maybe' → status='considering', signal='dont_apply' → status='no_jobs'
- [ ] Analyse success with score ≥5 → auto-fetch salary via `/api/salary` and store in salary_estimates
- [ ] Analyse failure (4xx/5xx) → auto-switch UI to Paste JD mode, preserve the link in state, show error
- [ ] "Add to Pipeline" button → insert into pipeline_items, insert into dismissed_jobs (so it doesn't re-appear in feed), clear analyse state
- [ ] Mini pipeline summary reads from pipeline_items WHERE user_id = current, groups by status, allows inline status change via dropdown
- [ ] Status change in mini summary → updates pipeline_items, triggers re-render of full Pipeline tab if it's open
- [ ] Jump to company search → searches across pipeline_items.custom_company and wishlists.company
- [ ] Quick add → validates link, creates pipeline_item with status='watchlist', source='manual'
- [ ] Recently added prompt → shows pipeline_items WHERE added_at > now() - interval '24 hours' AND score IS NULL

---

### 2. Pipeline Tab (Kanban)

**OG behaviour:**
- 8 columns: Watchlist, No jobs (not_applying in OG, no_jobs in Marker), Worth applying? (considering), Going to apply (to_apply), Applied, Interviewing, Offer, Rejected
- Drag-and-drop between columns updates status immediately
- Mobile: dropdown instead of drag (drag doesn't work on touch)
- Per-card display: company (mono uppercase), role title (display font), score badge (lime bg if ≥7, cream if ≥5, grey if <5), signal chip (lime=apply, amber=maybe, pink/red=skip), office days chip (lime ≤1d, amber ≤2.5d, red 3d+), posted date or "Added X" fallback, salary if available
- Score breakdown dropdown on every card (8 factors with colour-coded scores: lime 8+, blue 6+, amber 4+, red <4, ✕ for not found)
- Edit modal per card: edit company, role, link, office days, notes, posted date
- Delete button with confirmation
- CV Generator button per card (opens CV tab pre-filled with this job)
- "Rate suitability" button on un-scored cards → calls `/api/analyse` inline
- Check dead links button (pipeline-wide) → HEAD requests all job_link URLs in Apply/Consider/Going to apply columns only, flags 404s with yellow badge
- Search box filters across company + role
- Office days filter dropdown
- Status filter dropdown
- All columns sort by score DESC

**What Marker needs to fix:**
- Drag-and-drop either doesn't work or doesn't persist status changes to Supabase
- Mobile dropdown status changer missing or broken
- Score badge colours wrong (not matching lime ≥7, cream ≥5, grey <5 logic)
- Office days chip colours wrong
- Signal chip missing or wrong colours
- Posted date shows "Added X" even when posted_at exists
- Score breakdown dropdown either missing or shows old scoreBreakdown field instead of factors JSON
- CV Generator button doesn't pre-fill the job in CV tab
- Rate suitability button missing or doesn't inline-score
- Check dead links button missing or doesn't flag 404s correctly
- Filters don't work or reset on re-render
- Columns don't sort by score DESC

**Process fix checklist:**
- [ ] Drag-and-drop → onDrop extracts new status from drop zone, updates pipeline_items SET status = new_status WHERE id = dragged_job_id, re-fetches pipeline data
- [ ] Mobile dropdown → same update query, conditional render based on touch capability detection
- [ ] ScoreBadge component: score ≥7 → bg lime, border lime; score ≥5 → bg cream, border grey; score <5 → bg grey, border grey. Font: display, 17px, weight 500
- [ ] Office days chip: days ≤1 → bg lime; days ≤2.5 → bg amber; days ≥3 → bg red/pink
- [ ] Signal chip: signal='apply' → bg lime, text black; signal='maybe' → bg amber, text black; signal='dont_apply' → bg red, text white
- [ ] Posted date priority: show posted_at if exists, else cross-reference jobs_cache by job_link to get created, else "Added [timeAgo(added_at)]"
- [ ] Score breakdown dropdown reads factors JSON, displays 8 rows: roleSkillsMatch, seniorityFit, industryFit, officeFlexibility, companyCulture, paternityLeave, salaryMarket, careerGrowth. Each shows score + note. Colour-code score ≥8 lime, ≥6 blue, ≥4 amber, <4 red. If factor.found === false show ✕
- [ ] CV Generator button → sets global state cvPrefilledJob = this job, switches tab to CV, CV tab reads cvPrefilledJob and auto-selects it in Step 1
- [ ] Rate suitability button → POST to `/api/analyse` with {jobLink: job.job_link, company: job.custom_company, roleTitle: job.custom_role}, on success update pipeline_items with score + factors + signal, tier allowance check before calling
- [ ] Check dead links → map all jobs in considering|to_apply|applied statuses to {id, url: job_link}, POST to `/api/check-links`, on response update pipeline_items SET dead_link_flag = true WHERE id IN (404 IDs), show yellow "Dead link" badge on flagged cards
- [ ] Search filter → client-side filter on pipeline_items WHERE custom_company ILIKE or custom_role ILIKE
- [ ] Office filter → WHERE office_days <= selected_max
- [ ] Status filter → WHERE status = selected
- [ ] Column sort → ORDER BY score DESC NULLS LAST within each status group

---

### 3. CV Generator Tab

**OG behaviour:**
- 4-step linear flow: Pick job → Pick effort → Copy prompt → Mark applied
- Step 1: Dropdown of jobs from pipeline filtered to considering|to_apply|applied statuses, sorted by score DESC. "Or analyse a new job" link jumps to Engine tab
- Step 2: Three effort cards — Level 1 ⭐ ChatGPT (full effort, you write it), Level 2 either (50/50), Level 3 ⭐ Claude (AI does it). Clicking a card stores cvEffortLevel on the job immediately, advances to Step 3
- Step 3: Shows tailored prompt for the selected effort level. All 3 levels include ATS optimisation + AI screening defence. All end with "share download links only — do NOT paste CV text in chat". Copy button, then "Next" advances to Step 4
- Step 4: Confirm application. "Yes, applied" button sets status = applied, appliedAt = now(), cvGeneratedAt = now(). "Not yet" goes back to Step 1
- Recent CVs history at bottom: shows last 10 jobs where cvGeneratedAt exists, with company, role, effort level, date
- Cover Letter Generator: identical 4-step flow, separate state, separate recent history
- "💡 If AI can't find the JD" card: shows when Step 3 active, explains to paste JD manually into Claude/ChatGPT if the link scrape fails

**What Marker needs to fix:**
- Step 1 dropdown either empty or shows all jobs not just considering|to_apply|applied
- Effort level selection doesn't store cvEffortLevel on the job
- Step 3 prompts either generic or missing the effort-level customisation
- ATS + AI screening defence instructions missing from prompts
- "Share download links only" instruction missing
- Step 4 doesn't set appliedAt or update status to applied
- Recent CVs history missing or shows wrong data
- Cover Letter generator either missing or shares state with CV generator (should be separate)
- JD paste tip card missing

**Supabase requirements:**
Already covered by pipeline_items table. Fields: cv_effort_level, cv_generated_at, status, applied_at.

**Process fix checklist:**
- [ ] Step 1 dropdown → SELECT * FROM pipeline_items WHERE user_id = current AND status IN ('considering', 'to_apply', 'applied') ORDER BY score DESC NULLS LAST
- [ ] Step 2 effort card click → UPDATE pipeline_items SET cv_effort_level = clicked_level WHERE id = selected_job, advance UI to Step 3
- [ ] Step 3 prompt generation → read user's profile.career_history, selected job's custom_role + custom_company + job_link, selected cv_effort_level. Generate effort-appropriate prompt with ATS/AI defence footer. All prompts end: "Important: share download links to the final CV only — do not paste the CV text directly in this chat."
- [ ] Step 3 Copy button → navigator.clipboard.writeText(prompt), show "Copied" feedback
- [ ] Step 4 "Yes, applied" → UPDATE pipeline_items SET status = 'applied', applied_at = now(), cv_generated_at = now() WHERE id = selected_job, reset CV generator state to Step 1
- [ ] Recent CVs → SELECT * FROM pipeline_items WHERE user_id = current AND cv_generated_at IS NOT NULL ORDER BY cv_generated_at DESC LIMIT 10
- [ ] Cover Letter state completely separate from CV state (separate step indices, separate selected job, separate history query)
- [ ] JD paste tip card renders in Step 3 always, says: "💡 If the AI can't find the job description: Paste the full JD text manually into Claude or ChatGPT after the prompt. This happens when job boards block automated access."

---

### 4. Job Feed Tab (3 sub-tabs)

**OG behaviour:**
- 3 sub-tabs: Jobs Task List (Greenhouse), Jobs Web Search (Adzuna broad), Jobs Gov (Adzuna civil service)
- **Jobs Task List:** pulls from active Greenhouse boards (Tide, Monzo, Elastic, GitLab, Awin confirmed working), scores each via Haiku, applies keyword allowlist + reject list, caps at 3 results per company interleaved, shows manual wishlist company chips (colour-coded by rank: lime=1, blue=1.1, grey=lower) with staleness indicators (red=never, amber=7d+, grey=recent), cross-references Adzuna for wishlist company names
- **Jobs Web Search:** 12 broad Adzuna queries (Senior Product Marketing Manager, Senior Partnerships Manager, Senior Programme Manager, etc.), UK API path is `gb` not `where=United Kingdom`, 15 results per query scored via Haiku, cap 60 total
- **Jobs Gov:** opt-in toggle in Settings, 12 civil service Adzuna queries, manual search section with links to Civil Service Jobs, Find a Job, LinkedIn "government", Escape the City
- All 3 sub-tabs share: dismissed IDs are global (dismissing in one tab hides from all 3), "Jobs by Adzuna" badge on every Adzuna-sourced card (legal requirement ≥116×23px), salary auto-fetch for jobs scoring 7.5+ without listed salary, Apply/Maybe/Skip stats at top exclude dismissed jobs
- Feed cards show: company, role, score, signal chip, office days, salary, posted date, source badge (Greenhouse / Adzuna), "Add to Pipeline" button (inserts into pipeline_items + dismissed_jobs), "Dismiss" button (inserts into dismissed_jobs only)

**What Marker needs to fix:**
- Greenhouse cron pulls aren't working or aren't scoring results
- Adzuna queries using wrong API path (`where=United Kingdom` returns zero results — must use `gb` in path)
- Keyword allowlist + reject list either missing or not applied
- 3-per-company cap not enforced
- Wishlist chips missing or not colour-coded by rank
- Staleness indicators missing
- Adzuna cross-reference for wishlist companies missing
- Dismissed IDs not shared across tabs (dismissing in Task List still shows in Web Search)
- "Jobs by Adzuna" badge missing or too small
- Salary auto-fetch not firing for high-scoring feed jobs
- Add to Pipeline button creates job but doesn't dismiss it from feed
- Stats at top (Apply/Maybe/Skip counts) either missing or include dismissed jobs

**Supabase schema requirements:**
```sql
-- jobs_cache table (nightly cron results, shared across users)
CREATE TABLE jobs_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, -- greenhouse|web_search|gov_search
  source_id text, -- Greenhouse job ID or Adzuna ID
  company text NOT NULL,
  role_title text NOT NULL,
  location text,
  salary text,
  posted_at timestamptz,
  link text NOT NULL,
  raw_json jsonb,
  cached_at timestamptz DEFAULT now(),
  track_tags text[], -- for track-based filtering later
  region text DEFAULT 'UK',
  adzuna_attribution_required boolean DEFAULT false
);
```

**Process fix checklist:**
- [ ] Greenhouse cron (`/api/cron/greenhouse`) runs nightly at 3am, pulls from active boards (verify Tide/Monzo/Elastic/GitLab/Awin slugs), upserts to jobs_cache with source='greenhouse', deduplicates by company+role_title+link
- [ ] Adzuna Web cron (`/api/cron/adzuna-web`) runs nightly at 3:30am, queries: "Senior Product Marketing Manager UK", "Senior Partnerships Manager UK", etc. (12 queries total), API path is `https://api.adzuna.com/v1/api/jobs/gb/search/1?...` (gb in path, NOT where param), upserts to jobs_cache with source='web_search', adzuna_attribution_required=true
- [ ] Adzuna Gov cron (`/api/cron/adzuna-gov`) runs nightly at 4am IF user has gov_search enabled in settings, queries: "Civil Service", "Government Policy", etc. (12 gov queries), same `gb` path, upserts with source='gov_search', adzuna_attribution_required=true
- [ ] Jobs Task List renders: fetch jobs_cache WHERE source='greenhouse' AND id NOT IN (SELECT job_identifier FROM dismissed_jobs WHERE user_id = current), apply allowlist (keywords: senior, lead, head, director, manager, partnerships, marketing, product, growth, strategy), apply reject list (keywords: engineering, developer, compliance, sales development, account executive, mandarin, german, french), score via Haiku (`/api/score-batch`), group by company, take top 3 per company by score, interleave, display
- [ ] Wishlist chips: fetch wishlists WHERE user_id = current, map to chips. Colour by rank: 1 → lime bg, 1.1 → blue bg, ≥1.5 → grey bg. Staleness: last_checked_at IS NULL → red border + "Never", last_checked_at < now() - interval '7 days' → amber border + "7d+", else grey border + "Recent". For each wishlist company, search jobs_cache for matching company name, show count if >0
- [ ] Jobs Web Search renders: fetch jobs_cache WHERE source='web_search' AND id NOT IN dismissed, score via Haiku, sort by score DESC, limit 60, display with AdzunaBadge component on every card
- [ ] Jobs Gov renders: IF settings.gov_search_enabled, fetch jobs_cache WHERE source='gov_search' AND id NOT IN dismissed, score via Haiku, display with AdzunaBadge + manual search links section
- [ ] AdzunaBadge component: width 116px, height 23px, black bg, cream text, mono font 9px uppercase "JOBS BY ADZUNA", appears on every card where adzuna_attribution_required=true
- [ ] Feed card "Add to Pipeline" → INSERT INTO pipeline_items (company, role, job_link, source, score, factors, signal, posted_at, added_at), INSERT INTO dismissed_jobs (job_identifier), re-fetch feed to remove from UI
- [ ] Feed card "Dismiss" → INSERT INTO dismissed_jobs (job_identifier), re-fetch feed
- [ ] Salary auto-fetch: after scoring, for any feed job with score ≥7.5 AND salary IS NULL, POST to `/api/salary`, store in salary_estimates, display on card
- [ ] Stats at top: COUNT feed jobs WHERE score ≥7.5 AND signal='apply' (Apply), WHERE score ≥5 AND signal='maybe' (Maybe), WHERE score <5 OR signal='dont_apply' (Skip), all EXCLUDE dismissed

---

### 5. Interview Prep Tab

**OG behaviour:**
- Step 1: Pick job from Applied|Interviewing|Offer pipeline statuses
- Step 2: Pick stage (Screening / Hiring Manager / Panel / Final / Other)
- Step 3: Upload submitted CV (PDF or .docx, converts to base64)
- Step 4: Optional notes field
- Generate button → POST to `/api/interview-prep` with job + stage + cvBase64 + notes, Claude Sonnet with web_search enabled, returns 7-section prep pack (company research, likely questions, best answers anchored to CV, things to research, questions to ask, body language tips, follow-up strategy)
- Save prep doc to the job for later reference

**What Marker needs to fix:**
- Job picker either empty or shows wrong statuses
- Stage picker missing or doesn't store selection
- CV upload either missing or doesn't convert to base64
- Generate button doesn't call the API or doesn't handle the response
- Prep pack display missing or malformatted
- Save button doesn't persist prep doc to pipeline_items

**Supabase requirements:**
```sql
-- interview_preps table
CREATE TABLE interview_preps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  account_id uuid REFERENCES accounts NOT NULL,
  pipeline_item_id uuid REFERENCES pipeline_items,
  stage text,
  submitted_cv_blob_url text, -- Supabase Storage URL if we store the file
  prep_doc text, -- the generated prep pack
  created_at timestamptz DEFAULT now()
);
```

**Process fix checklist:**
- [ ] Step 1 dropdown → SELECT * FROM pipeline_items WHERE user_id = current AND status IN ('applied', 'interviewing', 'offer') ORDER BY applied_at DESC
- [ ] Step 2 stage radio buttons: Screening, Hiring Manager, Panel, Final, Other
- [ ] Step 3 file upload → read file via FileReader, convert to base64, store in state as cvBase64
- [ ] Generate button → tier allowance check (Interview Prep is Pro-only), POST to `/api/interview-prep` with {job: selected_pipeline_item, stage, cvBase64, notes}, response is {prepDoc}, display in expandable sections
- [ ] Save button → INSERT INTO interview_preps (pipeline_item_id, stage, prep_doc, created_at), show "Saved" confirmation
- [ ] Display past preps: SELECT * FROM interview_preps WHERE pipeline_item_id = selected_job ORDER BY created_at DESC, show as collapsible cards below the generator

---

### 6. Stats Tab

**OG behaviour:**
- 4 KPI cards at top: Total Applied, Interviews, Interview Rate %, Offers
- Chart: Applications over time (weekly bars)
- Breakdown tables:
  - Score band → Interview rate (9-10, 7-8.9, 5-6.9, <5)
  - CV effort level → Interview rate (Level 1, Level 2, Level 3)
  - Job source → Interview rate (Greenhouse, Web Search, Gov, Manual)
  - Industry → Performance (if we tracked industry per job)
- Insights: "Roles scored 9-10 converted at X% — prioritise these", "Level 3 CVs got Y% more interviews than Level 1"
- Average score of applied vs interviewed jobs comparison

**What Marker needs to fix:**
- KPIs either showing zeros or wrong calculations
- Applications over time chart missing or flat
- Breakdown tables missing
- Insights either generic or missing
- No correlation between effort level and interview outcomes

**Supabase queries:**
```sql
-- Total applied
SELECT COUNT(*) FROM pipeline_items WHERE user_id = current AND status = 'applied';

-- Interviews
SELECT COUNT(*) FROM pipeline_items WHERE user_id = current AND status IN ('interviewing', 'offer');

-- Interview rate
SELECT (COUNT(*) FILTER (WHERE status IN ('interviewing', 'offer'))::float / NULLIF(COUNT(*) FILTER (WHERE status = 'applied'), 0)) * 100
FROM pipeline_items WHERE user_id = current;

-- Applications over time
SELECT date_trunc('week', applied_at) AS week, COUNT(*) 
FROM pipeline_items WHERE user_id = current AND applied_at IS NOT NULL 
GROUP BY week ORDER BY week;

-- Score band breakdown
SELECT 
  CASE 
    WHEN score >= 9 THEN '9-10'
    WHEN score >= 7 THEN '7-8.9'
    WHEN score >= 5 THEN '5-6.9'
    ELSE '<5'
  END AS band,
  COUNT(*) FILTER (WHERE status = 'applied') AS applied,
  COUNT(*) FILTER (WHERE status IN ('interviewing', 'offer')) AS interviews
FROM pipeline_items WHERE user_id = current GROUP BY band;

-- Effort level breakdown
SELECT cv_effort_level, 
  COUNT(*) FILTER (WHERE status = 'applied') AS applied,
  COUNT(*) FILTER (WHERE status IN ('interviewing', 'offer')) AS interviews
FROM pipeline_items WHERE user_id = current AND cv_effort_level IS NOT NULL GROUP BY cv_effort_level;
```

**Process fix checklist:**
- [ ] KPIs calculated from pipeline_items WHERE user_id = current, using queries above
- [ ] Applications over time chart: data from weekly aggregation query, render as bar chart (use recharts or similar)
- [ ] Score band table: 4 rows (9-10, 7-8.9, 5-6.9, <5), shows applied count + interview count + rate %
- [ ] Effort level table: 3 rows (L1, L2, L3), shows applied count + interview count + rate %
- [ ] Source table: 4 rows (greenhouse, web_search, gov_search, manual), shows applied + interviews + rate
- [ ] Insights generation: if 9-10 band has ≥3 applied AND interview rate ≥40%, show "Roles scored 9-10 converted at X% — prioritise these above all else". If L3 cv_effort_level has higher interview rate than L1, show "Level 3 AI-written CVs got X% more interviews than Level 1 — consider trusting the AI more"
- [ ] Average score comparison: AVG(score) WHERE status='applied' vs AVG(score) WHERE status IN ('interviewing', 'offer'), display as "You applied to roles averaging X, but interviewed for roles averaging Y"

---

### 7. Balanced Roles Tab (Easy Life in OG, 🛋️ emoji)

**OG behaviour:**
- Curated list of companies with good work-life balance, verified parental leave, genuine remote, stable (not hypergrowth chaos), £75k+ salaries, clear scope roles
- 4 company categories: Public sector/funded, Education/EdTech, Large stable corporates, Remote-first tech
- Each company shows: Glassdoor WLB rating + review count (e.g. "4.3/5 from 1,240 reviews"), Working Families benchmark citation if applicable, parental leave policy (e.g. "6 months full pay"), link to careers page
- Search tips section: how to find these roles (LinkedIn searches, job board filters)
- Best role titles for balanced + good pay: Product Manager, Programme Manager, Partnerships Lead, Strategy Manager, Operations Lead
- Tagline: "For senior people who'd quite like their evenings back" — NOT selling it as "easy" but as "sane WLB without sacrificing pay/seniority"

**What Marker needs to fix:**
- Tab name still says "Easy Life" with emoji — should be "Balanced Roles" (legal safety, no emoji)
- Company list either missing or shows generic/unverified companies
- Glassdoor WLB ratings missing or not sourced
- Parental leave data missing or editorial not data-sourced
- No Working Families citations
- Search tips missing
- Role titles list missing
- Tagline either wrong or missing

**Supabase requirements:**
```sql
-- admin_companies table (pre-seeded via admin CMS)
CREATE TABLE admin_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track text, -- 'balanced' for this tab
  region text DEFAULT 'UK',
  company text NOT NULL,
  careers_url text,
  glassdoor_url text,
  public_data_sources_json jsonb, -- {wlb_rating: 4.3, wlb_review_count: 1240, parental_leave: "6mo full pay", working_families_benchmark: true}
  notes text
);
```

**Process fix checklist:**
- [ ] Tab renamed to "Balanced Roles" everywhere, remove 🛋️ emoji
- [ ] Fetch companies: SELECT * FROM admin_companies WHERE track = 'balanced' AND region = user's region, grouped into 4 categories
- [ ] Each company card displays: company name as link to careers_url, Glassdoor WLB rating from public_data_sources_json (e.g. "Glassdoor WLB: 4.3/5 from 1,240 reviews"), parental leave from public_data_sources_json with disclaimer "Verified from public sources [date]. Confirm with employer before relying on this.", Working Families badge if public_data_sources_json.working_families_benchmark = true
- [ ] Tagline at top: "Companies where employees rate work-life balance highly, based on independent public review data. For senior people who'd quite like their evenings back."
- [ ] Search tips section: "How to find balanced roles: LinkedIn AI search with 'low applicant competition senior product manager remote £80k+', Glassdoor company filter by WLB rating ≥4.0, Escape the City 'purpose-driven' filter, Working Families Top Employers list"
- [ ] Role titles section: "Best titles for senior + balanced: Product Manager, Programme Manager, Partnerships Lead, Digital Strategy Manager, Operations Lead, Customer Success Lead, Marketing Manager (avoid 'Growth' — often high-pressure)"

---

## Critical Cross-Tab Data Sync Rules

**The OG tracker has these rules. Marker must enforce them identically:**

1. **When a job is added to pipeline from any source:**
   - Generate unique ID
   - Set source field (greenhouse|web_search|gov_search|manual)
   - Insert into dismissed_jobs so it never re-appears in feed
   - Set added_at timestamp
   - Set posted_at from feed data if available

2. **When status changes to 'applied':**
   - Set applied_at timestamp
   - Applies whether changed via CV Generator Step 4, Pipeline dropdown, or Edit modal

3. **When CV effort level is chosen:**
   - Immediately store cv_effort_level on the job (don't wait for Step 4)
   - Set cv_generated_at when "Yes, applied" clicked in Step 4

4. **When a job is deleted:**
   - Remove from pipeline_items
   - Remove from salary_estimates
   - Keep in dismissed_jobs (don't re-show in feed)

5. **Feed dismissal logic:**
   - dismissed_jobs is GLOBAL across all 3 feed sub-tabs
   - Adding to pipeline = auto-dismiss
   - Explicit dismiss = dismiss
   - Stats counts exclude dismissed

6. **Salary estimate caching:**
   - Once fetched for a job_id, never re-fetch unless user clicks manual Refresh
   - Persisted in salary_estimates table
   - Auto-fetch triggers: pipeline jobs in Apply/Consider/Applied on tab load, feed jobs scoring 7.5+ without salary on scan complete, analyse results scoring 5+ on result render

7. **Posted date display priority:**
   - Show posted_at if exists on pipeline_item
   - Else cross-reference jobs_cache by job_link to get posted_at
   - Else "Added [timeAgo(added_at)]" for manual jobs

8. **Card sorting:**
   - All pipeline columns: ORDER BY score DESC NULLS LAST
   - Engine mini summary: same
   - Feed cards: default ORDER BY score DESC, optional ORDER BY posted_at DESC via dropdown

---

## Tier-Gated Features (OG has none, Marker has these)

Map OG's unlimited features to Marker's tier allowances:

| Feature | OG (unlimited) | Marker Free (7-day trial) | Standby £4 | Lite £12 | Pro £24 |
|---------|----------------|---------------------------|-----------|----------|---------|
| Analyse (Sonnet) | Unlimited | 3/month then locked | 5/month | 30/month | 100/month |
| CV Generator (Sonnet) | Unlimited | 0 after trial | 0 | 15/month | 40/month |
| Interview Prep (Sonnet) | Unlimited | 0 after trial | 0 | 0 | 12/month |
| Feed scans (Haiku) | Unlimited | Daily | Weekly | Daily | Daily |
| Pipeline scoring (Haiku) | Unlimited | 30/month | 100/month | 500/month | 1500/month |

**Before every Sonnet call**, check:
```javascript
const usage = await getMonthlyUsage(userId, 'analyse') // or 'cv_gen' or 'interview_prep'
const cap = TIER_CAPS[userTier]['analyse']
if (usage >= cap) {
  throw new Error('Monthly allowance reached. Upgrade to continue.')
}
```

Show allowance counter in nav bar: "12/30 CV generations" in mono font chip.

---

## Subtle Process Improvements (Beyond OG)

These are enhancements to make the processes more cohesive, not in the OG:

1. **Store cvPromptCopied flag** when user clicks Copy in CV Generator Step 3. Gives better Stats fidelity (some users pick an effort then bail without copying)

2. **Feed "snooze" option** — instead of just Dismiss + Add, a "Remind me in 7 days" button. Stores un-dismiss date in dismissed_jobs, cron un-dismisses expired ones nightly

3. **Salary confidence score** — flag estimates vs real Adzuna data: "~£75-110k (estimate)" vs "£82-105k (Adzuna data)"

4. **Inline score breakdown tooltip** — hovering the overall score badge shows mini factor breakdown, no need to click Breakdown button

5. **Smart feed dedup** — if a feed scan returns a job already in pipeline (matching company + role + link), hide it from feed results automatically

6. **Duplicate detector on manual add** — when adding a job manually, check if job_link or company+role already exists in pipeline, show "Already exists at status X — open it?" instead of creating duplicate

7. **Two-way reactive sync** — changes in Pipeline tab instantly update Engine mini summary without tab switch

8. **Bulk operations in Pipeline** — select multiple jobs, apply status change or delete to all at once

9. **Activity feed per job** — "Last updated X" on each pipeline card

10. **Account-level rollup for coaches/unis** — Stats tab has a "View all clients" toggle for B2B accounts (same component, scope filter)

---

## What NOT to Change

**Visual design:**
- Lime #C6F432 / black #0A0A0A / cream #FAF7F2 colour palette
- Space Grotesk display font, Inter body, JetBrains Mono labels
- Card layout, generous whitespace, thin grey borders
- Holo accent (one per surface max)
- Logo with holo dot
- Nav bar structure
- Homepage hero layout
- Kanban card visual design from ProductMobileUI.jsx

**UI flow:**
- 7 tabs total (Wishlist, Pipeline, CV Generator, Cover Letter, Interview Prep, Stats, Job Feed, Balanced Roles)
- Tab state in useState
- 4-step CV Generator linear flow
- 8-step onboarding (already built)
- Kanban drag-and-drop

**Brand voice:**
- Calm, confident, editorial tone
- British English, no em dashes, no "circa/roughly/approximately"
- Taglines as designed

---

## Implementation Strategy for Claude Code

**Session 1 (20 mins) — Engine/Wishlist tab process fix**
Focus: task queue sorting, analyse flow, salary auto-fetch, Add to Pipeline persistence, mini summary sync

**Session 2 (20 mins) — Pipeline tab process fix**
Focus: drag-and-drop Supabase update, score badge colours, breakdown dropdown, CV button pre-fill, filters, dead link checker

**Session 3 (20 mins) — CV Generator process fix**
Focus: job picker filter, effort level storage, prompt generation, Step 4 status update, recent CVs history

**Session 4 (20 mins) — Feed tabs process fix**
Focus: Greenhouse cron, Adzuna `gb` path fix, allowlist/reject, 3-per-company cap, wishlist chips, dismissed sync, Adzuna badge

**Session 5 (20 mins) — Stats + Interview Prep**
Focus: Stats KPIs + breakdowns + insights, Interview Prep flow + tier gate

**Session 6 (20 mins) — Balanced Roles + cross-tab sync**
Focus: rename tab, company data source, Glassdoor citations, search tips, enforce all 8 sync rules globally

Each session: read PROGRESS.md, make focused changes, deploy, test 30 seconds, update PROGRESS.md, end.

---

## First Claude Code Prompt (Session 1)

Paste this into Claude Code:

```
Read ~/Desktop/marker/PROGRESS.md to see what's built. Then read this entire brief at [location of this file]. This is a process fix — the UI looks great, keep it exactly as is. Focus on Session 1: Engine/Wishlist tab.

Fix these 7 process bugs:
1. Task queue (wishlists table) sorts by rank then staleness but currently doesn't — fix the query
2. Analyse success doesn't persist correctly to pipeline_items — fix the upsert with correct status mapping (signal='apply' → status='considering')
3. Salary auto-fetch on score ≥5 isn't firing — add the POST to /api/salary after analyse success
4. Analyse failure doesn't auto-switch to Paste JD mode — add the error handler
5. "Add to Pipeline" doesn't insert into dismissed_jobs — fix the dual insert
6. Mini pipeline summary doesn't sync when Pipeline tab changes a status — make it reactive
7. Recently added prompt (jobs added <24h with no score) isn't showing — add the query + UI

After fixing, deploy to Vercel, test the Analyse flow end-to-end, update PROGRESS.md, tell me what you fixed and what to test.
```

---

End of brief. This is the process translation from OG tracker to Marker architecture. Keep the look, fix the brain.
