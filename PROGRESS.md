# REQUITE — Build Progress
> Maintained by Claude Code. Updated every session. §13 of REQUITE-MASTER-BRIEF.md governs structure.

---

## CURRENT STATE

**Stage:** 1 complete — brand constant, anthropic config, chrome tokens, bug fixes  
**Last commit:** stage 1: brand constant, anthropic config, chrome tokens, bug fixes  
**Live URL:** https://marker-silk.vercel.app (Requite branding — post-Stage 1)  
**Repo:** `~/Desktop/marker` (branch: main)  
**Supabase project:** `vclhyzpvxipkhptwlnkj.supabase.co`

---

## STAGE LOG

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
| G1 — "The marketplace is real, or we say it isn't." | ⬜ Not started | Nothing | `source_type` column, Live Network Meter, real-intro flow, employer schema |
| G2 — "Every job is fresh, or it's flagged." | ⬜ Not started | `cached_at` exists on jobs_cache; `dead_link_flag` on pipeline_items | `first_seen_at`, `last_verified_at`, `freshness` computed field, freshness cron, Freshness Pulse UI, one-tap re-check |
| G3 — "We never forget you." | ⬜ Not started | Profile IS in Supabase (structured); chat history not stored (good) | Loop guard, context reconstruction per AI call, Memory Card UI, "pick up where you left off", bounded context |
| G4 — "Tracking isn't the feature. It's the spine." | 🟡 Partial | Pipeline board exists; pipeline_items table; status flow (watchlist→offer) | Default landing = pipeline board (currently Today tab); auto-capture from feed (partially wired); survives logout confirmed (DB-backed) |

---

## SCHEMA CHANGES

### Existing (from `supabase/migrations/001_schema.sql`)
- `accounts`, `account_members`, `users`, `profiles`, `career_history`, `wishlists`, `jobs_cache`, `pipeline_items`, `ai_usage`, `account_usage`, `tier_allowances`, `applications`, `interview_preps`, `market_intel`, `referrals`, `commission_events`, `admin_todos`, `admin_companies`, `admin_feature_flags`, `admin_metrics_cache`, `admin_outreach`, `admin_taglines`

### Pending (Stage 2 additions)
- `jobs_cache` — ADD `source_type` (requite_managed/public_listing/partner_feed), `first_seen_at`, `last_verified_at`, `freshness` (Fresh/Aging/Stale/Expired)
- `pipeline_items` — ADD `source_type` NOT NULL
- `employer_profiles` — NEW (company, size, sector, billing_status)
- `employer_roles` — NEW (employer_id, title, description, source_type NOT NULL, freshness)
- `candidate_employer_matches` — NEW (anonymised until mutual opt-in)
- `intro_requests` — NEW (G1 warm-intro flow)
- `intro_receipts` — NEW (G1 timestamped receipts)

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

**Stage 2 — Schema additions + G1 marketplace foundation**

Stage 1 is complete. Stage 2 adds the employer-side schema and wires the first Guarantee (G1: "The marketplace is real, or we say it isn't").

Tasks:
1. **Confirm backup** — supabase db dump before any migration
2. **Migration:** Add `source_type`, `first_seen_at`, `last_verified_at`, `freshness` to `jobs_cache` + `pipeline_items`
3. **New tables:** `employer_profiles`, `employer_roles`, `candidate_employer_matches`, `intro_requests`, `intro_receipts`
4. **Live Network Meter** component — shows real employer count on landing page
5. **Freshness Pulse** UI — badge on job cards (Fresh/Aging/Stale/Expired)
6. Confirm schema change with Rob before running migration

**Pre-flight checklist for Stage 2:**
- Read: REQUITE-MASTER-BRIEF.md, PROGRESS.md, AUDIT.md, ASSETS.md
- State in 3 lines: current stage, last done, this session's plan
- Ask Rob to confirm before any schema change
