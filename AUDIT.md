# REQUITE / MARKER — Stage 0 Audit
> Generated 2026-06-23. Single source of truth for Stage 1+. Update on schema or env changes.

---

## 1. MARKER REPO — FILE-BY-FILE

### Root config
| File | What it does | Status |
|---|---|---|
| `package.json` | Dependencies: next 15, react 19, @anthropic-ai/sdk ^0.52, @supabase/ssr, stripe ^22, resend ^6, docx, @vercel/analytics | ✅ Reuse |
| `next.config.js` | Next.js config | ✅ Reuse |
| `vercel.json` | 5 cron jobs (see Crons section) | ✅ Reuse / extend |
| `middleware.js` | Auth guard — redirects unauthenticated to /auth for `/app`, `/onboard`, `/settings`, `/admin` | ✅ Reuse |
| `.env.local` | Dev env vars (see Env Vars section) | ✅ Keep |
| `PROGRESS.md` | Old Marker build log — superseded by this file | 🔄 Replace |
| `build.log` / `build-debug.log` | Build artefacts | 🗑️ Dead |
| `marker-audit.tar.gz` | Old audit archive | 🗑️ Dead |
| `MARKER-PROCESS-FIX-BRIEF.md` | Old brief | 🗑️ Dead |
| `app/page.js.backup` / `app/page.js.broken` | Backup files | 🗑️ Dead |

### `app/` — Pages

| File | What it does | Status |
|---|---|---|
| `app/layout.js` | Root layout: fonts, analytics, speed insights, cookie banner | ✅ Reuse — add BRAND_NAME |
| `app/globals.css` | Design tokens: `--marker-*` vars, holo-dot, holo-foil, display fonts, A/B test styles | 🔄 Extend with chrome tokens |
| `app/marketing.module.css` | Landing page CSS — hero, pricing, nav | 🔄 Reuse + chrome pass |
| `app/page.js` | Landing/marketing page — hero, pricing, testimonials, guides CTA | 🔄 Stage 1 target — brand + chrome |
| `app/PricingSection.js` | Pricing component (Standby/Lite/Pro/BYO plans) — hardcoded "Marker" | 🔄 Wire to BRAND_NAME |
| `app/auth/page.js` | Login/signup via Supabase magic link | ✅ Reuse |
| `app/auth/callback/page.js` | OAuth callback handler | ✅ Reuse |
| `app/onboard/page.js` | 6-step onboarding wizard: status → CV → profile → requirements → workspace → contract | ✅ Reuse / extend with G3 |
| `app/app/page.js` | **Main dashboard — 320KB monolith.** Tabs: Today, Discover, Pipeline, CV, WLB, Contractor, Notes. Contains: TodayTab, EngineTab, PipelineTab, FeedTab, CvTab, WishlistTab, ContractorTab, BalancedTab, NotesTab, RecruiterPanel, SmartNudge, WeekProgress, FirstRunGuide, focus mode | ✅ Core reuse — Stage 3+ refactor |
| `app/app/dashboard.module.css` | Dashboard CSS module | ✅ Reuse |
| `app/admin/page.js` | Admin panel: accounts, metrics, todos, companies, taglines, guides | ✅ Reuse |
| `app/settings/page.js` | User settings + billing UI | ✅ Reuse |
| `app/pricing/page.js` | Pricing page (three plans) | 🔄 Stage 9/10 — employer pricing |
| `app/privacy/page.js` | Privacy policy | ✅ Reuse — update brand |
| `app/terms/page.js` | Terms of service | ✅ Reuse — update brand |
| `app/cookies/page.js` | Cookie policy | ✅ Reuse |
| `app/notes/page.js` | Blog index | ✅ Reuse |
| `app/notes/[slug]/page.js` | Blog post renderer | ✅ Reuse |
| `app/notes/notes.module.css` | Blog CSS | ✅ Reuse |
| `app/guides/page.js` | Guides index (5 lead magnets) | ✅ Reuse |
| `app/guides/wlb-employer-guide/page.js` | WLB employer guide | ✅ Reuse |
| `app/guides/30-minute-role-check/page.js` | 30-min role check guide | ✅ Reuse |
| `app/guides/senior-job-hunt-playbook/page.js` | Senior playbook | ✅ Reuse |
| `app/guides/linkedin-search-bible/page.js` | LinkedIn search guide | ✅ Reuse |
| `app/guides/parent-job-hunt-guide/page.js` | Parent job hunt guide | ✅ Reuse |
| `app/guides/score-tier-guide/page.js` | Score tier guide | ✅ Reuse |
| `app/opengraph-image.js` | OG image generator | 🔄 Update brand |
| `app/apple-icon.js` / `app/icon.js` | App icons | 🔄 Update brand |

### `app/api/` — Routes

| Route | Method | What it does | Model | Status |
|---|---|---|---|---|
| `/api/analyse` | POST | AI job scoring: JD text → structured score (8 factors, signal, office days). Strategy 1: paste JD. Strategy 2: fetch URL + JSON-LD. Strategy 3: web_search fallback. Rate-limited by tier. | Haiku (primary) / Sonnet (web search) | ✅ Core — G3/G4 reuse |
| `/api/cv/generate` | POST | CV tailoring: quick/standard/detailed effort levels. Reads CV from profile hard_filters_json. | Haiku | ✅ Reuse (Stage 6) |
| `/api/cv/cover-letter` | POST | Cover letter generator from CV + JD. | Haiku | ✅ Reuse (Stage 6) |
| `/api/cv/questions` | POST | Pre-application questions from JD. | Haiku | ✅ Reuse (Stage 6) |
| `/api/cv` | GET/POST | Store/retrieve raw CV text to profile. | — | ✅ Reuse |
| `/api/interview-prep` | POST | Interview prep doc from CV + JD + stage. | Sonnet | ✅ Reuse (Stage 6) |
| `/api/job-feed` | POST | Score job feed batch against profile. | Sonnet | ✅ Reuse (Stage 4) |
| `/api/feed-web` | POST | Web/Adzuna job feed with AI scoring. | Sonnet | ✅ Reuse (Stage 4) |
| `/api/feed-gov` | POST | Gov.uk job feed with AI scoring. | Sonnet | ✅ Reuse (Stage 4) |
| `/api/feed-cache` | GET/POST | Read/write jobs_cache table. | — | ✅ Reuse (Stage 4) |
| `/api/feed-tasklist` | POST | Company tasklist/jobs check. | Sonnet | ✅ Reuse |
| `/api/search/live` | POST | Live Adzuna search scored by AI. | Haiku | ✅ Reuse |
| `/api/wishlist/generate` | POST | AI-generate target company wishlist. | Haiku | ⚠️ Reuse — fix import-time bug first |
| `/api/wishlist/check` | POST | Check wishlist companies for open jobs. | — | ✅ Reuse |
| `/api/wishlist/save` | POST | Save wishlist to Supabase. | — | ✅ Reuse |
| `/api/contractor/companies` | POST | Contractor target companies via web_search. | Sonnet | ✅ Reuse |
| `/api/contractor/roles` | POST | Contractor live roles via Adzuna + AI. | Sonnet | ✅ Reuse |
| `/api/contractor/recruiters` | POST | Contractor recruiter agencies via web_search. | Sonnet | ✅ Reuse |
| `/api/perm/recruiters` | POST | Perm recruiter agencies via web_search. | Sonnet | ✅ Reuse |
| `/api/onboard/parse-cv` | POST | Parse uploaded CV to structured fields. | Haiku | ✅ Reuse (Stage 5) |
| `/api/salary-estimate` | POST | Salary market estimate. | — | ✅ Reuse (Stage 6) |
| `/api/profile/save` | POST | Merge-save profile to Supabase. | — | ✅ Reuse |
| `/api/profile/tier` | GET | Return user's current plan/tier + trial status. | — | ✅ Reuse |
| `/api/stripe/checkout` | POST | Create Stripe checkout session. | — | ✅ Reuse (Stage 10) |
| `/api/stripe/portal` | POST | Stripe billing portal redirect. | — | ✅ Reuse (Stage 10) |
| `/api/stripe/webhook` | POST | Stripe webhook: subscription events → DB. | — | ✅ Reuse (Stage 10) |
| `/api/data-export` | GET | GDPR data export. | — | ✅ Reuse |
| `/api/dismiss` | POST | Dismiss a job from feed. | — | ✅ Reuse |
| `/api/resolve-url` | POST | Resolve redirect chains on job URLs. | — | ✅ Reuse |
| `/api/check-links` | POST | Bulk dead-link checker (used for pipeline). | — | ✅ Reuse (G2) |
| `/api/account/delete` | DELETE | Delete account + all data. | — | ✅ Reuse |
| `/api/admin/accounts` | GET | Admin: list all accounts. | — | ✅ Reuse |
| `/api/admin/metrics` | GET | Admin: aggregate metrics. | — | ✅ Reuse |
| `/api/admin/reset-onboard` | POST | Admin: reset onboard flag for user. | — | ✅ Reuse |
| `/api/admin/reset-trial` | POST | Admin: reset trial period. | — | ✅ Reuse |
| `/api/admin/status` | GET | Admin: system status check. | — | ✅ Reuse |
| `/api/admin/taglines` | GET | Admin: tagline A/B data. | — | ✅ Reuse |
| `/api/admin/todos` | GET | Admin: pre-seeded todo list. | — | ✅ Reuse |
| `/api/tagline` | GET | Active A/B tagline for landing. | — | ✅ Reuse |
| `/api/cron/greenhouse` | GET | Nightly Greenhouse job ingestion. | — | ✅ Reuse (Stage 4) |
| `/api/cron/adzuna` | GET | Nightly Adzuna job ingestion. | — | ✅ Reuse (Stage 4) |
| `/api/cron/gov` | GET | Nightly Gov.uk job ingestion. | — | ✅ Reuse (Stage 4) |
| `/api/cron/archive-inactive` | GET | Archive inactive pipeline items. | — | ✅ Reuse |
| `/api/cron/email-trials` | GET | Trial lifecycle emails. | — | ✅ Reuse |
| `/api/dev/reset-onboard` | POST | Dev-only: reset onboard for testing. | — | ✅ Keep |

### `lib/` — Shared Libraries

| File | What it does | Bug? | Status |
|---|---|---|---|
| `lib/ai-usage.js` | Fire-and-forget AI usage logger. Tracks model, action, tokens, cost_gbp. Has hardcoded cost table. | None | ✅ Reuse — move model costs to config |
| `lib/db.js` | Client-side Supabase ops: loadJobs, saveJobs, updateJobInDb, deleteJobFromDb, loadFeedFromDb, loadSalariesFromDb, getProfile, saveProfile. Has auto-provision fallback for pre-trigger users. | None | ✅ Reuse |
| `lib/stripe.js` | Exports `stripe = getStripe()` — getStripe() guards on key, but still called eagerly at import. PLANS object with 4 tiers. | ⚠️ Eager init (guarded but immediate) | ✅ Reuse — convert `export const stripe` to lazy |
| `lib/email.js` | Resend emails: sendWelcome, sendTrialEnding, sendTrialExpired. Lazy getResend() — clean. FROM is `onboarding@resend.dev` (not custom domain yet). | None | ✅ Reuse — update FROM domain |
| `lib/supabase/client.js` | Browser Supabase client factory. Clean. | None | ✅ Reuse |
| `lib/supabase/server.js` | Server Supabase client factory with cookie handling. Clean. | None | ✅ Reuse |
| `lib/articles.js` | Blog article data/loader. | None | ✅ Reuse |
| `lib/lifestyle.js` | Lifestyle image rotation list. | None | ✅ Reuse |

### `components/`

| File | What it does | Status |
|---|---|---|
| `CookieBanner.js` | Cookie consent banner (localStorage, Privacy Policy link). | ✅ Reuse |
| `NavHamburger.js` | Mobile nav hamburger + menu. | ✅ Reuse |
| `RefCapture.js` | Referral code capture (URL param → localStorage). | ✅ Reuse (Stage 10) |
| `RotatingLifestyle.js` | Rotates lifestyle images in landing hero. | ✅ Reuse / extend with new assets |
| `TaglineTracker.js` | A/B tagline display + conversion tracking. | ✅ Reuse |
| `TrackCTA.js` | Track-specific CTA component. | ✅ Reuse |

### `design/` — Design Mockups (not in build)

| File | What it does | Status |
|---|---|---|
| `design/design-canvas.jsx` | Full design canvas with all screens. | 📐 Reference only |
| `design/components/*.jsx` | Individual screen mockups (Marketing, ProductMobileUI, WebDesktopHome, etc.) | 📐 Reference only |
| `design/FOR-CLAUDE-CODE.md` | Design instructions for Claude Code. | 📐 Reference — superseded by brief |
| `design/uploads/MARKER-MASTER-BUILD-PROMPT.md` | Original Marker build brief. | 📐 Reference |
| `design/styles.css` | Design system styles (separate from app). | 📐 Reference |
| `design/Marker - Brand & Marketing.html` | HTML brand doc. | 📐 Reference |

### `public/brand/` — Existing Brand Assets

| File | Type | Suggested Requite Use |
|---|---|---|
| `01-sam-portrait.jpg` | Photo, portrait | Candidate testimonial avatar |
| `02-priya-portrait.jpg` | Photo, portrait | Candidate testimonial avatar |
| `03-james-portrait.jpg` | Photo, portrait | Candidate testimonial avatar |
| `05-linkedin-stat-1.jpg` / `06` / `07` | Stats graphic | Marketing/trust panel social proof |
| `11-og-share-card.jpg` | OG image | Replace with Requite OG |
| `hero-ambient.png` | Abstract background | Chrome-pass hero background |
| `blog-desk.png` / `blog-pillars.png` / `blog-staircase.png` | Blog images | Blog headers |
| `og-dark.png` | OG dark variant | Replace with Requite OG |
| `product-showcase.png` | Product screenshot | Landing page product demo |
| `brand/lifestyle/ls-01-07.png` | Lifestyle photos | Hero/section backgrounds |

---

## 2. JOB-HUNT-TRACKER REPO — OVERLAP ANALYSIS

The job-hunt-tracker (`~/Desktop/job-hunt-tracker`) is the **predecessor** codebase that marker was built from. It is now a strict subset of marker.

**State of repo:** Chaotic. Contains 12+ numbered copies of config files (`next.config 2.js` through `next.config 12.js`, `package 2.json` through `10.json`, `vercel 2.json` through `13.json`) — manual versioning without proper git branches. Not a clean codebase.

**Overlap verdict:** 100% superseded by marker. Every feature in job-hunt-tracker exists in marker in a more complete form. The job-hunt-tracker uses the **same Supabase project** (likely same schema). No unique code worth porting.

**Recommendation:** Ignore entirely. All work happens in marker.

---

## 3. SUPABASE SCHEMA (full, from `supabase/migrations/001_schema.sql`)

### Tables

| Table | Purpose | Key Fields | Requite Notes |
|---|---|---|---|
| `accounts` | Multi-tenant accounts | id, type, name, plan, stripe_customer_id, region | Extend: add `employer` type |
| `account_members` | User↔account mapping | account_id, user_id, role | Add `recruiter` role for Stage 8 |
| `users` | Public user extension | id, email, default_account_id, trial_ends_at | ✅ Extend as-is |
| `profiles` | Job search profile | user_id, track, status, target_roles, seniority, industries, postcode, max_office_days, salary_floor, hard_filters_json, byo_anthropic_key_encrypted | G3: structured profile IS the memory. Add new fields for Requite in Stage 2. |
| `career_history` | Work history entries | user_id, role_title, company, start_date, end_date, achievements | ✅ Reuse for G3 |
| `wishlists` | Target companies | user_id, company, careers_url, greenhouse_slug | ✅ Reuse |
| `jobs_cache` | Shared job feed cache | source (greenhouse/adzuna/manual/gov), source_id, company, role_title, location, salary, cached_at | G2: Add `source_type`, `first_seen_at`, `last_verified_at`, `freshness` in Stage 2/4 |
| `pipeline_items` | Career pipeline | user_id, status (watchlist→offer), score, score_breakdown_json, job_link, applied_at, posted_at | G4: core spine. Add `source_type` foreign key to jobs_cache in Stage 2 |
| `ai_usage` | Per-call AI tracking | user_id, model, action, input_tokens, output_tokens, cost_estimate_gbp | ✅ Reuse |
| `account_usage` | Rolled-up billing | account_id, period_start, sonnet_calls, haiku_calls, total_cost | ✅ Reuse |
| `tier_allowances` | AI caps per tier | tier_name, action_type, monthly_cap_per_user | 🔄 Add Requite tiers in Stage 10 |
| `applications` | CV/CL outputs | user_id, pipeline_item_id, cv_text, cover_letter_text | ✅ Reuse (Stage 6) |
| `interview_preps` | Interview prep docs | user_id, pipeline_item_id, stage, prep_doc | ✅ Reuse (Stage 6) |
| `market_intel` | Anonymous market data | metric_type, region, role_family, seniority, value_json | ✅ Reuse |
| `referrals` | Referral tracking | referrer_account_id, referred_user_id, status, commission_rate | ✅ Reuse (Stage 10) |
| `commission_events` | Referral payouts | referral_id, amount, paid | ✅ Reuse (Stage 10) |
| `admin_todos` | Admin task list | category, title, status | ✅ Reuse |
| `admin_companies` | Curated company list | track, company, careers_url, glassdoor_url | ✅ Reuse |
| `admin_feature_flags` | Feature flags | flag_key, track, account_id, enabled | ✅ Reuse |
| `admin_metrics_cache` | Metrics cache | metric, value | ✅ Reuse |
| `admin_outreach` | B2B CRM | contact_name, email, category, status | 🔄 Extend for employer outreach (Stage 8) |
| `admin_taglines` | A/B tagline test | tagline_text, active, impressions, conversions | ✅ Reuse |

### New Tables Needed (Stage 2)
- `employer_profiles` — G1: employer accounts (company, size, sector, hiring_volume)
- `employer_roles` — G1: posted roles with `source_type` (requite_managed/public_listing/partner_feed), freshness fields
- `candidate_employer_matches` — anonymised match records
- `intro_requests` — G1: real warm-intro flow (opt-in, timestamps, status)
- `intro_receipts` — G1: timestamped receipt log

### Triggers
- `on_auth_user_created` → `handle_new_user()`: auto-creates account + member + user row + empty profile on signup. ✅ Reuse.

### RLS
All tables have RLS enabled. Policies: users see own rows; jobs_cache/market_intel/tier_allowances/feature_flags are authenticated-read; admin tables are service-role only. ✅ Clean.

---

## 4. ALL ROUTES

### Pages (App Router)
```
/                    Landing (marketing)
/auth                Login/signup
/auth/callback       OAuth callback
/onboard             Onboarding wizard          [AUTH]
/app                 Main dashboard             [AUTH]
/admin               Admin panel                [AUTH]
/settings            Billing + settings         [AUTH]
/pricing             Pricing page
/notes               Blog index
/notes/[slug]        Blog post
/guides              Guides index
/guides/wlb-employer-guide
/guides/30-minute-role-check
/guides/senior-job-hunt-playbook
/guides/linkedin-search-bible
/guides/parent-job-hunt-guide
/guides/score-tier-guide
/privacy             Privacy policy
/terms               Terms of service
/cookies             Cookie policy
```

### API Routes
(See §2 above for full table. Summary by category:)
- **AI scoring:** `/api/analyse`, `/api/job-feed`, `/api/feed-web`, `/api/feed-gov`, `/api/feed-tasklist`, `/api/search/live`
- **CV tools:** `/api/cv`, `/api/cv/generate`, `/api/cv/cover-letter`, `/api/cv/questions`, `/api/onboard/parse-cv`
- **Interview/salary:** `/api/interview-prep`, `/api/salary-estimate`
- **Pipeline:** `/api/dismiss`, `/api/check-links`, `/api/resolve-url`
- **Wishlist:** `/api/wishlist/generate`, `/api/wishlist/check`, `/api/wishlist/save`
- **Contractor:** `/api/contractor/companies`, `/api/contractor/roles`, `/api/contractor/recruiters`, `/api/perm/recruiters`
- **Profile:** `/api/profile/save`, `/api/profile/tier`
- **Auth/account:** `/api/account/delete`, `/api/data-export`
- **Stripe:** `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook`
- **Admin:** `/api/admin/accounts`, `/api/admin/metrics`, `/api/admin/reset-onboard`, `/api/admin/reset-trial`, `/api/admin/status`, `/api/admin/taglines`, `/api/admin/todos`
- **Misc:** `/api/tagline`, `/api/feed-cache`
- **Crons (vercel.json):**
  - `0 2 * * *` → `/api/cron/greenhouse`
  - `0 3 * * *` → `/api/cron/adzuna`
  - `0 4 * * *` → `/api/cron/gov`
  - `0 5 * * *` → `/api/cron/archive-inactive`
  - `0 8 * * *` → `/api/cron/email-trials`

---

## 5. ENVIRONMENT VARIABLES

| Var | Set? | Where used |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | All Supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server routes, ai-usage, crons |
| `ANTHROPIC_API_KEY` | ✅ (Vercel) | All AI routes (also aliased as `jobtrackergeneral` in analyse route — **fix in Stage 1**) |
| `ADZUNA_APP_ID` | ✅ | Adzuna feed routes, cron |
| `ADZUNA_API_KEY` | ✅ | Adzuna feed routes, cron |
| `CRON_SECRET` | ✅ | Cron auth header |
| `RESEND_API_KEY` | ✅ | lib/email.js |
| `STRIPE_SECRET_KEY` | ✗ NOT SET | lib/stripe.js, all stripe routes |
| `STRIPE_PUBLISHABLE_KEY` | ✗ NOT SET | Client-side Stripe |
| `STRIPE_WEBHOOK_SECRET` | ✗ NOT SET | /api/stripe/webhook |
| `NEXT_PUBLIC_APP_URL` | Unset locally | lib/email.js (fallback to hardcoded URL) |
| `ADMIN_EMAIL` | ✅ | Admin auth check |
| `VERCEL_OIDC_TOKEN` | ✅ (auto) | Vercel OIDC |

**To add in Stage 1:**
- `BRAND_NAME` (or as code constant — not an env var per brief)

---

## 6. ANTHROPIC MODEL STRINGS

| Model string | Used in | Status |
|---|---|---|
| `claude-haiku-4-5-20251001` | analyse (primary), cv/generate, cv/cover-letter, cv/questions, onboard/parse-cv, search/live, wishlist/generate, ai-usage.js cost table | ✅ Current |
| `claude-sonnet-4-20250514` | analyse (web search fallback), contractor/*, perm/recruiters, interview-prep, job-feed, feed-web, feed-gov, feed-tasklist, ai-usage.js cost table | ⚠️ **Flag: this is Sonnet 4 (May 2025). Current model is `claude-sonnet-4-6`. Upgrade in Stage 1 lib/anthropic config file.** |
| `claude-opus-4-20250514` | ai-usage.js cost table ONLY (never called) | ⚠️ Never called — fine as cost reference, but update to `claude-opus-4-8` for accuracy |

**Action for Stage 1:** Create `lib/anthropic.js` with:
```js
export const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  // opus never called — per brief
}
```
Replace all inline model strings with `MODELS.haiku` / `MODELS.sonnet`.

---

## 7. IMPORT-TIME CLIENT INIT BUGS

| File | Bug | Risk | Fix |
|---|---|---|---|
| `app/api/wishlist/generate/route.js` line 7 | `const client = new Anthropic()` at **module top level** (outside handler) | **High** — crashes if `ANTHROPIC_API_KEY` absent at cold start; adds import-time side effect | Move inside POST handler or use lazy init |
| `lib/stripe.js` line 10 | `export const stripe = getStripe()` — calls getStripe() immediately at import | **Low** — getStripe() guards on key presence, but still eager | Convert to `export function getStripe() { ... }` and call at use-site |
| `app/api/cv/generate/route.js` line 47 | `new Anthropic()` inside POST handler | ✅ Clean — inside handler | No action |
| `app/api/onboard/parse-cv/route.js` line 30 | `new Anthropic()` inside handler | ✅ Clean | No action |
| All other routes using fetch to Anthropic API | Not using Anthropic SDK — raw fetch with `x-api-key` header | ✅ Clean — no init | No action |

**Priority fix for Stage 1:** `wishlist/generate/route.js` is the only hard bug. Fix before any deploy.

---

## 8. CALIBRE-OS / MERITENGINE REPO CONTEXT

| Repo | Location | Relation to Requite |
|---|---|---|
| `calibre-os` | `~/Desktop/calibre-os` | **Sibling project — design DNA donor.** Has aurora/chrome CSS system, logos, people photos. Brief says "Requite is its sibling; extend don't reinvent." |
| `calibre-os-docs` | `~/Desktop/calibre-os-docs` | Docs for calibre-os |
| `meritengine` | `~/Desktop/meritengine` | Separate B2B SaaS (freelancer merit scoring). Stripe checkout pattern reusable. Not related to Requite. |
| `meritengine-docs` | `~/Desktop/meritengine-docs` | Docs for meritengine |

**Calibre OS design DNA (reuse in Stage 1):**
- `calibre-os/app/globals.css` — Full aurora/chrome token set: `--color-teal`, `--color-iris-indigo`, `--color-iris-violet`, `--color-iris-rose`, `--color-navy*`. Classes: `.aurora-bg`, `.chrome-text`, `.iris-divider`, `.iris-border`, `.btn-iris-sheen`, `.iris-progress`. Animations: `aurora-drift` (18s), `chrome-shift` (7s). **Copy directly into Requite globals.css.**
- SVG logos, people photo library — see ASSETS.md.
