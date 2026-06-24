# REQUITE — Build Progress
> Maintained by Claude Code. Updated every session. §13 of REQUITE-MASTER-BRIEF.md governs structure.

---

## CURRENT STATE

**Stage:** 3 complete — deterministic explainable match engine  
**Last commit:** stage 3: deterministic explainable match engine  
**Live URL:** https://marker-silk.vercel.app (Requite branding — post-Stage 1)  
**Repo:** `~/Desktop/marker` (branch: main)  
**Supabase project:** `vclhyzpvxipkhptwlnkj.supabase.co`

---

## STAGE LOG

### Stage 3 — Deterministic explainable match engine (2026-06-24)

**Goal:** Build the core IP — a deterministic, zero-AI scorer that gives an overall score + inspectable sub-scores for every named dimension.

**Changes made:**
1. **`lib/match-engine.js`** (NEW) — `scoreMatch(profile, job)` CJS module. Six dimensions:
   - **roleFit (30%)** — Jaccard word-overlap between job title and `target_roles` + `cvKeywords`
   - **seniorityFit (20%)** — Tier mapping (0=intern → 5=C-suite); word-boundary regex prevents false matches (e.g. "partnerships" ≠ "partner")
   - **locationFit (20%)** — Parses office-day count from location/raw_json; compares to `max_office_days`; handles Remote/Hybrid/city signals
   - **compFit (15%)** — Parses salary string (range, shorthand £Nk); compares mid to `salary_floor`
   - **freshness (10%)** — Reads `freshness` field (Fresh/Aging/Stale/Expired); falls back to computing from `cached_at`/`first_seen_at`
   - **cultureWlb (5%)** — Keyword detection against `hard_filters_json.benefits` + `tracks`; flags startup/always-on culture concerns
   - Returns `{ score: 0–10, dimensions: { roleFit, seniorityFit, locationFit, compFit, freshness, cultureWlb } }` — every dimension is `{ score, reason }` in plain English
2. **`lib/match-engine.test.js`** (NEW) — 23 fixture assertions across 6 groups; proves determinism with 10-run identity check
3. **`app/api/analyse/route.js`** (REFACTORED) — deterministic engine now runs FIRST (zero AI cost); result returned as `deterministicScore` on every response path; existing AI narrative layer preserved as-is on top; added `salary_floor` to profile select

**Verification:**
- ✅ `node lib/match-engine.test.js` — 23 PASS, 0 FAIL
- ✅ Determinism proven — 10 identical runs produce identical output
- ✅ `npm run build` — clean, zero errors
- ✅ Zero AI/fetch/Anthropic calls in `lib/match-engine.js` (grep confirmed — only false positive is English word "require" in a reason string)

---

### Stage 2 — Schema spine (2026-06-24)

**Goal:** Extend Supabase schema with freshness tracking + employer/matching tables. Additive only — nothing dropped or modified.

**Changes made:**
1. **`jobs_cache`** — ADD `source_type` (NOT NULL, default `'public_listing'`, CHECK constraint), `first_seen_at`, `last_verified_at`, `freshness` (NOT NULL, default `'Fresh'`, CHECK constraint)
2. **`pipeline_items`** — ADD `source_type` (NOT NULL, default `'public_listing'`, CHECK constraint)
3. **`employer_profiles`** (NEW) — One row per employer user. `user_id`, `account_id`, `company_name`, `company_size`, `sector`, `website_url`, `billing_status`, `hiring_volume`, `created_at`
4. **`employer_roles`** (NEW) — Role posted by employer. `employer_id`, title, description, location, salary, `source_type` NOT NULL (G1 invariant), `freshness`, `status`, timestamps
5. **`candidate_employer_matches`** (NEW) — Anonymised match. `user_id`, `employer_role_id`, `match_score`, `match_json`, `candidate_opted_in`, `employer_opted_in`, `matched_at`. UNIQUE on `(user_id, employer_role_id)`
6. **`intro_requests`** (NEW) — Warm-intro flow (G1). `match_id`, `requested_by` ('candidate'/'employer'), `status`, `message`, timestamps
7. **`intro_receipts`** (NEW) — Immutable timestamped receipt log (G1). `match_id`, `intro_request_id`, `event_type`, `event_at`, `meta_json`
8. **RLS** — Enabled on all 5 new tables. 6 policies: own-row on profiles/matches/requests/receipts; employer manages their roles; authenticated candidates read active roles
9. **`supabase/migrations/002_requite_schema.sql`** (NEW) — Full migration SQL on disk

**Verification:**
- ✅ All 4 new columns on `jobs_cache` confirmed live
- ✅ `source_type` on `pipeline_items` confirmed live
- ✅ All 5 new tables exist in Supabase
- ✅ RLS enabled on all 5 new tables
- ✅ All 6 policies created and confirmed
- ✅ Original `jobs_cache` columns intact (id, source, source_id, company, role_title, location, salary, posted_at, link, raw_json, cached_at, track_tags, region, adzuna_attribution_required + 4 new)
- ✅ `npm run build` — clean, zero errors

---

### Stage 1 — Brand + skeleton + chrome tokens (2026-06-23)

**Goal:** Wire Requite brand constant, fix three known bugs from audit, add Calibre OS rainbow-chrome design tokens.

**Changes made:**
1. **`lib/brand.js`** (NEW) — `export const BRAND_NAME = 'Requite'`
2. **`lib/anthropic.js`** (NEW) — `export const MODELS = { haiku: 'claude-haiku-4-5-20251001', sonnet: 'claude-sonnet-4-6' }`
3. **Bug fix:** `app/api/wishlist/generate/route.js` — moved `new Anthropic()` from module scope into POST handler; added `MODELS.haiku`
4. **Bug fix:** `lib/stripe.js` — removed `export const stripe = getStripe()` eager call; exported `getStripe` as named function only
5. **Stripe consumers:** `app/api/stripe/checkout/route.js`, `portal/route.js`, `webhook/route.js` — updated to call `getStripe()` inside handlers
6. **jobtrackergeneral removed** from 11 routes: `analyse`, `interview-prep`, `job-feed`, `feed-web`, `feed-gov`, `feed-tasklist`, `contractor/companies`, `contractor/roles`, `contractor/recruiters`, `perm/recruiters`, `onboard/parse-cv`
7. **Model strings replaced** with `MODELS.haiku` / `MODELS.sonnet` across 16 files — no inline model strings remain outside `lib/anthropic.js`
8. **`lib/ai-usage.js`** — updated COSTS table keys: `claude-sonnet-4-20250514` → `claude-sonnet-4-6`, `claude-opus-4-20250514` → `claude-opus-4-8`
9. **`app/layout.js`** — imported BRAND_NAME; replaced all `'Marker'` literals in metadata
10. **`lib/email.js`** — imported BRAND_NAME; replaced FROM address and all email template "Marker" references
11. **`app/page.js`** — imported BRAND_NAME; Logo component uses `BRAND_NAME.toLowerCase()`; hero h1 first line wrapped in `<span className="chrome-text">`
12. **`app/globals.css`** — added chrome tokens: `--color-iris-*` CSS vars, `aurora-drift` (18s) + `chrome-shift` (7s) keyframes, `.aurora-bg`, `.chrome-text`, `.iris-divider`, `.iris-border`, `.btn-iris-sheen`, `.iris-progress` classes

**Verification:**
- ✅ `npm run build` — clean, zero errors (87 static pages + all routes compiled)
- ✅ `/api/profile/tier` → 200
- ✅ `/api/tagline` → 200
- ✅ No `claude-sonnet-4-20250514` or `claude-opus-4-20250514` anywhere in app/ or lib/
- ✅ No `jobtrackergeneral` in app/ or lib/
- ✅ No `new Anthropic()` at module scope (all inside handler functions)

---

### Stage 0.5 — Git repo repair (2026-06-23)

**Problem:** The `~/Desktop/marker/.git` was corrupted — a `refs/heads/main 2` ref (space in name), four duplicate index files (`index 2/3/4`), and ~30 MB of large PNGs committed in previous sessions caused `pack-objects` to crash with SIGBUS (signal 10) on macOS every time `git push` was attempted. All normal git operations were broken.

**Fix:**
1. Cloned fresh from GitHub (`git clone git@github.com:robertjamesoxborough-arch/marker.git /tmp/marker-clean`) — 544 KB, single clean commit
2. Deleted broken `.git` and swapped in the clean clone's `.git`
3. Updated `.gitignore` to exclude 19 large images (>1 MB) in `public/brand/` and `app/opengraph-image.png` — **all files preserved on disk, nothing deleted**
4. Normal `git push` now completes in under 5 seconds

**Large images NOT in git (kept on disk, back up in `~/Desktop/marker-backup-20260623/public/`):**
- `public/brand/hero-ambient.png` (2.3 MB)
- `public/brand/lifestyle/ls-01.png` through `ls-07.png` + photo variants (1.3–2.1 MB each)
- `public/brand/blog-pillars.png`, `blog-desk.png`, `blog-staircase.png`, `og-dark.png`, `product-showcase.png`
- `app/opengraph-image.png` (1.9 MB)
- **Action for Stage 7:** Move these to Vercel Blob or a CDN; then they can be removed from disk

**Git is now healthy.** `git status` / `git add` / `git commit` / `git push` all work normally from `~/Desktop/marker`.

---

### Stage 0 — Audit, Assets & Consolidation (2026-06-23)
**Goal:** Complete picture of what exists. No code changes.

**Delivered:**
- `AUDIT.md` — all files in marker + job-hunt-tracker, schema, routes, env vars, model strings, import-time init bugs
- `ASSETS.md` — calibre-os logo SVGs, people photos (hero/boardroom/founder/ChatGPT portraits/Newimage series), design CSS tokens, marker brand assets, Downloads SVGs, missing asset list
- `PROGRESS.md` — this file

**Key findings:**
1. **Marker is ~80% of the candidate-side product.** Dashboard, pipeline, job feed, AI scoring, CV gen, interview prep, settings, billing skeleton all exist. Strong foundation.
2. **Import-time init bug** in `app/api/wishlist/generate/route.js` line 7: `const client = new Anthropic()` at module scope — fix in Stage 1.
3. **Model string audit:** `claude-haiku-4-5-20251001` ✅ current. `claude-sonnet-4-20250514` ⚠️ outdated — should be `claude-sonnet-4-6`. Fix in Stage 1 via `lib/anthropic.js`.
4. **Dual API key alias:** analyse route checks `process.env.jobtrackergeneral || process.env.ANTHROPIC_API_KEY` — clean up to single `ANTHROPIC_API_KEY` in Stage 1.
5. **Stripe not configured:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` are unset. Billing is non-functional until Stage 10.
6. **Calibre OS design DNA is ready:** `~/Desktop/calibre-os/app/globals.css` contains the exact aurora/chrome token set referenced in §8. Copy directly in Stage 1. Logos, hero people photos, boardroom shot all available.
7. **job-hunt-tracker is dead:** 100% superseded by marker. Ignore.
8. **Schema is solid** for candidate side. Needs new tables for employer side (Stage 2): `employer_profiles`, `employer_roles`, `candidate_employer_matches`, `intro_requests`, `intro_receipts`.
9. **`lib/stripe.js`** calls `getStripe()` eagerly at import (guarded but not lazy) — borderline issue, fix in Stage 1.

---

## GUARANTEE STATUS

| Guarantee | Status | What's built | What's missing |
|---|---|---|---|
| G1 — "The marketplace is real, or we say it isn't." | 🟡 Partial | `source_type` CHECK constraint on `jobs_cache`, `pipeline_items`, `employer_roles` (schema enforces invariant at DB level); `employer_profiles`, `intro_requests`, `intro_receipts` tables | Live Network Meter component, real-intro UI flow, employer onboarding |
| G2 — "Every job is fresh, or it's flagged." | 🟡 Partial | `first_seen_at`, `last_verified_at`, `freshness` columns on `jobs_cache` and `employer_roles` | Freshness cron (compute & write freshness field), Freshness Pulse UI badge, one-tap re-check |
| G3 — "We never forget you." | ⬜ Not started | Profile IS in Supabase (structured); `candidate_employer_matches` schema ready | Loop guard, context reconstruction per AI call, Memory Card UI, "pick up where you left off", bounded context |
| G4 — "Tracking isn't the feature. It's the spine." | 🟡 Partial | Pipeline board exists; `pipeline_items` table; `source_type` column on pipeline_items; status flow (watchlist→offer); **deterministic scorer built** — every score inspectable, zero AI cost | Default landing = pipeline board (currently Today tab); auto-capture from feed; scores surfaced in pipeline UI |

---

## SCHEMA CHANGES

### Existing (from `supabase/migrations/001_schema.sql`)
- `accounts`, `account_members`, `users`, `profiles`, `career_history`, `wishlists`, `jobs_cache`, `pipeline_items`, `ai_usage`, `account_usage`, `tier_allowances`, `applications`, `interview_preps`, `market_intel`, `referrals`, `commission_events`, `admin_todos`, `admin_companies`, `admin_feature_flags`, `admin_metrics_cache`, `admin_outreach`, `admin_taglines`

### Stage 2 additions (LIVE in Supabase as of 2026-06-24)
- `jobs_cache` — ADDED `source_type`, `first_seen_at`, `last_verified_at`, `freshness`
- `pipeline_items` — ADDED `source_type`
- `employer_profiles` — NEW ✅ (RLS: own row)
- `employer_roles` — NEW ✅ (RLS: employer manages; authenticated candidates read active)
- `candidate_employer_matches` — NEW ✅ (RLS: own row)
- `intro_requests` — NEW ✅ (RLS: own matches only)
- `intro_receipts` — NEW ✅ (RLS: own matches only)

**BACKUP RULE (§14 rule 3):** Before ANY migration, take explicit backup first. Claude Code will prompt for confirmation before writing any migration.

---

## ENV VARS (names only — no values)

| Var | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set |
| `ANTHROPIC_API_KEY` | ✅ Set in Vercel (`jobtrackergeneral` alias removed in Stage 1) |
| `ADZUNA_APP_ID` | ✅ Set |
| `ADZUNA_API_KEY` | ✅ Set |
| `CRON_SECRET` | ✅ Set |
| `RESEND_API_KEY` | ✅ Set |
| `ADMIN_EMAIL` | ✅ Set |
| `NEXT_PUBLIC_APP_URL` | ⚠️ Unset locally (fallback hardcoded in email.js) |
| `STRIPE_SECRET_KEY` | ✗ NOT SET — billing broken |
| `STRIPE_PUBLISHABLE_KEY` | ✗ NOT SET |
| `STRIPE_WEBHOOK_SECRET` | ✗ NOT SET |

---

## OPEN QUESTIONS / BLOCKERS

1. **Stripe KYC** — Stripe account needs identity verification before payouts. Complete before Stage 10.
2. **ICO registration** — Required to process personal data commercially in UK (~£40/yr at ico.org.uk). Complete before launch.
3. **Email domain verification** — `onboarding@resend.dev` is the current FROM address. Need custom domain (e.g. `hello@requite.io`) verified with SPF/DKIM in Resend before launch.
4. **Brand name** — ✅ Confirmed: **Requite**. Wired through `BRAND_NAME` constant. Rename later = one find-replace.
5. **Infrastructure** — ✅ Building on existing paid Marker Supabase + Vercel projects throughout all 13 stages. No new projects or subscriptions needed.
6. **`jobtrackergeneral` env alias** — ✅ Removed in Stage 1. All routes now use `ANTHROPIC_API_KEY` only.

---

## NEXT SESSION STARTS WITH

**Stage 4 — Job feed + freshness (G2)**

Stage 3 is complete. Stage 4 makes the freshness schema live end-to-end — cron writes to it, UI reads from it.

Tasks:
1. **Freshness cron** (`/api/cron/freshness`) — compute Fresh/Aging/Stale/Expired from `first_seen_at`/`last_verified_at` on `jobs_cache`; write back `freshness` field; add to `vercel.json`
2. **Freshness Pulse UI** — badge component on job cards (Fresh dot / Aging / Stale / Expired chip); consume `freshness` field from feed response
3. **One-tap re-check** — "Still open?" button on pipeline items that triggers a link-check and updates `last_verified_at`
4. **Hard location/seniority pre-filter** in feed routes — exclude wrong-country / wrong-band from default results

**Pre-flight checklist for Stage 4:**
- Read: REQUITE-MASTER-BRIEF.md, PROGRESS.md, AUDIT.md
- State in 3 lines: current stage, last done, this session's plan
