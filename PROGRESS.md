# REQUITE — Build Progress
> Maintained by Claude Code. Updated every session. §13 of REQUITE-MASTER-BRIEF.md governs structure.

---

## CURRENT STATE

**Stage:** 0 complete — audit, assets, progress files written  
**Last commit:** Stage 0 audit (this commit)  
**Live URL:** https://marker-silk.vercel.app (Marker branding — pre-Requite)  
**Repo:** `~/Desktop/marker` (branch: main)  
**Supabase project:** `vclhyzpvxipkhptwlnkj.supabase.co`

---

## STAGE LOG

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
| `ANTHROPIC_API_KEY` | ✅ Set in Vercel (also legacy alias `jobtrackergeneral` — remove in Stage 1) |
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
4. **Supabase plan** — Free tier has hard limits. Upgrade to Pro ($25/mo) before real users land.
5. **Vercel plan** — Hobby plan ToS excludes commercial use. Upgrade to Pro ($20/mo) before launch.
6. **Brand name confirmation** — Brief says "Requite" is the working name. Wired through `BRAND_NAME` constant from Stage 1. Final rename = one find-replace when decided.
7. **`jobtrackergeneral` env alias** — `analyse/route.js` checks `process.env.jobtrackergeneral || process.env.ANTHROPIC_API_KEY`. Clean up to single `ANTHROPIC_API_KEY` in Stage 1.

---

## NEXT SESSION STARTS WITH

**Stage 1 — Brand + skeleton + chrome tokens**

Tasks:
1. Add `BRAND_NAME = 'Requite'` constant to `lib/brand.js` — wire into layout, email, landing
2. Create `lib/anthropic.js` with `MODELS = { haiku: 'claude-haiku-4-5-20251001', sonnet: 'claude-sonnet-4-6' }` — replace all inline model strings
3. **Fix import-time bug:** `wishlist/generate/route.js` — move `new Anthropic()` inside handler
4. **Fix lazy Stripe:** convert `lib/stripe.js` to export function `getStripe()` only
5. Copy calibre-os chrome tokens into `app/globals.css` (`.aurora-bg`, `.chrome-text`, `.iris-divider`, `.iris-border`, `.btn-iris-sheen`, `.iris-progress`, colour variables, animations)
6. Update landing page (`app/page.js`) with Requite branding + chrome headline treatment
7. Confirm infra: same Supabase + Vercel project, no new infrastructure
8. Run §15 self-test: build passes, routes respond, no secrets leaked
9. Commit + push

**Pre-flight checklist for Stage 1:**
- Read: REQUITE-MASTER-BRIEF.md, PROGRESS.md, AUDIT.md, ASSETS.md
- State in 3 lines: current stage, last done, this session's plan
- Ask Rob to confirm before any schema change
