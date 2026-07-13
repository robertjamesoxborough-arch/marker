# REQUITE — Build Progress
> Maintained by Claude Code. Updated every session. §13 of REQUITE-MASTER-BRIEF.md governs structure.

---

## CURRENT STATE

**Stage:** 18 complete — feed-web is the working reference implementation (cache read + daily-capped fresh scan). feed-gov, job-feed, contractor/roles still need the same treatment (Stage 19).  
**Last commit:** stage 18: feed-web reference implementation — cache read + daily-capped fresh scan  
**Live URL:** https://marker-silk.vercel.app  
**Trust Panel:** https://marker-silk.vercel.app/trust  
**Repo:** `~/Desktop/marker` (branch: main)  
**Supabase project:** `vclhyzpvxipkhptwlnkj.supabase.co`

---

## COST GUARDRAILS — compliance audit (2026-07-13)

Governing doc: `MARKER-COST-GUARDRAILS.md` (now committed). No feature may cause API spend to scale per-user-per-click. Audit of current state:

**Compliant:**
- `/api/analyse` (FULL, per-user Sonnet) — allowance check before, `cache_control` on the rubric+profile system prefix, `trackAiUsage` after. Correct per rules 4 + 6.
- No sampling params (`temperature`/`top_p`/`top_k`) or manual `thinking:` blocks at any call site — verified. Rule 5 swap is unblocked on that front.

**VIOLATIONS to fix before launch (rule 1 + rule 6) — needs the nightly-cron + shared-cache rebuild:**
- `feed-web`, `feed-gov`, `job-feed`, `contractor/roles` each do a LIVE external fetch (Adzuna/gov/web_search) + model scoring on every authenticated call, with NO allowance gate and NO `ai_usage` log. Any free authenticated user can trigger repeated live spend. This is the personal-tracker port pattern the addendum warns about.
- Target architecture: all feed scanning runs ONCE nightly via cron into `jobs_cache`, batch-scored with Haiku once and shared; user clicks re-read the cache + re-apply personal filters via cheap DB query. Pro "Fresh scan" = max 3 live scans/day/user, counted in `ai_usage`.
- Plumbing gap: `lib/allowance.js` counts per calendar MONTH; the "3/day" fresh-scan cap needs a daily-window counter.
- Rule 4: when feed scoring moves into the cron, attach `cache_control` to the shared `lib/scoring.js` rubric prefix and log `cache_read_input_tokens` once per route to prove caching fires.

**Rule 5 — Sonnet 5 migration (pending, deliberate):** `lib/anthropic.js` is still `claude-sonnet-4-6`. When swapping to `claude-sonnet-5`: batch/feed scoring stays `claude-haiku-4-5-20251001`; confirm zero sampling params (done); add ~30% headroom to tightly-sized `max_tokens` (new tokenizer ~30% more tokens); do NOT loosen allowance maths.

> Note: no code changed for this audit — the fixes are architectural (4 routes + daily-cap plumbing) and belong to the feed-port session. Flagged here and in memory so they are not lost.

---

## STAGE LOG

### Stage 18 — feed-web reference implementation (2026-07-13)

**Goal:** Apply cost rules 1+2 to `feed-web`, migrations 003+004 applied and verified, use it as the pattern for the remaining 3 live routes.

**Blocker found and resolved before any code work:** applying migration 003 surfaced that `jobs_cache` had its Supabase Data API disabled at the table level ("API DISABLED" badge in Table Editor) — service role AND anon key both got `42501 permission denied` on the table (other tables were unaffected). Root cause confirmed as the Data API toggle, unrelated to either migration (neither contains GRANT/REVOKE). User re-enabled the Data API for the table and ran `GRANT SELECT ... TO service_role/anon/authenticated`; re-verified via PostgREST — all four new columns (`score_tier`, `match_score`, `score_breakdown_json`, `scored_at`) now readable, HTTP 200. **Note: `jobs_cache` currently has 0 rows** — the nightly ingest crons have not populated it recently, so cache-read testing needs a live cron run (or manual trigger) before it will show real jobs.

**Honest correction to Stage 16:** grepped the entire client (`app/app/page.js` and the whole repo) for every `fetch('/api/...')` call. **`feed-web` is not called anywhere in the UI.** The live "Discover → Live Roles" tab calls `/api/feed-cache`, which already reads `jobs_cache` with zero AI cost at read time (deterministic hard-filter only, no score/signal/badge surfaced). Stage 16's description of feed-web as "the QUICK scorer path" was wrong — it was never wired to a button. Proceeded anyway per instruction: this makes feed-web ready to attach to a future "Fresh scan" button, and its job shape (score/signal/badge) is a real improvement over feed-cache's plain listing.

**Changes made:**

1. **`lib/score-jobs-batch.js`** (NEW) — extracted the nightly cron's Haiku scoring call into a shared helper (`scoreJobsBatch(apiKey, rows)`) so the nightly baseline and any live scan use the byte-identical rubric/prompt/model — a job is scored once by one method, never re-scored per user or per route.

2. **`app/api/cron/score-cache/route.js`** — now imports `scoreJobsBatch` instead of inlining the same Anthropic call; behaviour unchanged, duplication removed.

3. **`app/api/feed-web/route.js`** (rewritten) — 
   - **Default path** (`readFromCache`): zero AI cost. Reads `jobs_cache` rows where `source='adzuna'` and `scored_at IS NOT NULL` (i.e. already baseline-scored by the nightly cron), applies the G2 freshness filter (`lib/freshness.js`, drops expired links), then ranks per-user with the deterministic `scoreMatch` (`lib/match-engine.js`) — a global baseline floor (`match_score >= 5`) AND a per-user relevance floor (`relevance.score >= 6`), interleaved by company.
   - **Fresh-scan path** (`runFreshScan`, only on `{fresh: true}`): gated by `checkAllowance(user.id, 'feed_fresh_scan')` BEFORE any external call (free=0 hard-blocked, trial/pro=3/day, max=10/day — built in Stage 17). Live Adzuna fetch, upserts raw rows into the SHARED `jobs_cache` (same id format as `cron/adzuna`, so future nightly runs dedupe against it), scores the new batch ONCE via `scoreJobsBatch`, logs `trackAiUsage` after. Serves the result back through the same `readFromCache` path so the response format never diverges between cache and fresh-scan modes.
   - Unauthenticated requests get 401 before any DB or Anthropic call.

**Self-test (cost-guardrails, run against the new code):**
- ✅ Unauth POST → 401 immediately, zero DB/AI work
- ✅ Free tier `feed_fresh_scan` cap = 0 → hard-blocked before any external call
- ✅ No `temperature`/`top_p`/`top_k`/`thinking:` anywhere in the new/edited files
- ✅ `cache_control` present on the scoring prefix (`lib/score-jobs-batch.js`)
- ✅ `.not('scored_at', 'is', null)` filter syntax matches existing precedent elsewhere in the codebase
- ✅ `node lib/scoring.test.js` + `node lib/usage-window.test.js` — ALL PASS
- ✅ Vercel build green (authoritative gate; local build still blocked by iCloud-dataless node_modules)

**NOT done — carried to Stage 19:**
- `feed-gov`, `job-feed`, `contractor/roles` still do live-fetch-on-click with no allowance gate. Same pattern as feed-web should apply, but `feed-gov` uses `web_search` (rule 7 — must stay nightly-cron-only, no per-user on-demand path at all, not even an allowance-gated one) so it needs its own design, not a copy-paste of the fresh-scan exception.
- No UI wiring yet for a "Fresh scan" button — `feed-web` is ready to be called with `{fresh:true}` but nothing in `app/app/page.js` does so yet.
- Trigger the nightly ingest + score-cache crons at least once (manually, via `CRON_SECRET`) so `jobs_cache` has real scored rows to verify the cache-read path against actual data.

---

### Stage 17 — Feed-port foundation: daily caps + shared cache scoring (2026-07-13)

**Goal (this session):** Lay the cost-guardrails foundation so feed scanning can stop scaling per-user-per-click. Split per instruction — foundation this session, wire the 4 live routes to read the cache next session.

**Done and shipped:**

1. **`lib/usage-window.js`** (NEW, CJS) — pure, dependency-free usage-window maths. `ACTION_PERIOD` (feed_fresh_scan → 'day', everything else → 'month'), `windowStart(period, now)` (UTC-based — matches ai_usage.created_at and cron UTC; a local-time boundary drifted the daily reset, caught by the test), `periodFor(action)`.

2. **`lib/usage-window.test.js`** (NEW, `node lib/usage-window.test.js`) — ALL PASS. Proves daily window = 00:00 UTC today, monthly = 1st 00:00 UTC, same-day scans share one window, next-day opens a fresh one.

3. **`lib/allowance.js`** — now period-aware. Added `feed_fresh_scan` caps: free 0 (cache only, no live scans), trial 3/day, pro 3/day, max 10/day. `checkAllowance` counts usage within the action's window (`windowStart(periodFor(action))`) instead of always monthly, and returns `period`. This is the daily-cap counter for the Pro "3 fresh scans/day" rule.

4. **`supabase/migrations/004_jobs_cache_scores.sql`** (NEW, NOT APPLIED) — adds `match_score`, `score_breakdown_json`, `scored_at` to `jobs_cache` + a partial index on unscored rows. Held for backup (§14). Depends on 003.

5. **`app/api/cron/score-cache/route.js`** (NEW) + **`vercel.json`** (schedule `30 5 * * *`, after the ingest crons) — nightly cron that scores unscored `jobs_cache` rows ONCE with Haiku and writes a shared, candidate-AGNOSTIC baseline score (`match_score`, `score_tier: 'quick'`, `scored_at`) onto the row. CRON_SECRET auth; batches of 40, max 6/run; `cache_control` on the shared `lib/scoring.js` rubric prefix (rule 4) with `cacheReadTokens` surfaced in the response as caching proof. Every batch row gets `scored_at` stamped (skipped rows fall back to neutral 6) so nothing reprocesses forever.

**Design note (needs your confirmation):** the nightly score is candidate-AGNOSTIC (generic role quality / seniority / legitimacy), shared across all users per rule 2. Per-user relevance (target roles, salary floor, office days, track allowlists) is intended to be applied deterministically at read time via `lib/match-engine.js` — zero AI. If you meant the shared score to be something else, flag it before Stage 18.

**Self-tests:** `node lib/usage-window.test.js` ALL PASS; `node lib/scoring.test.js` ALL PASS. Vercel build = the authoritative gate (local build blocked by iCloud-dataless node_modules).

**NOT done — carried to Stage 18 (the actual per-user spend fix):**
- Wire `feed-web`, `feed-gov`, `job-feed`, `contractor/roles` to READ the scored cache + apply per-user deterministic filters, instead of live fetch + live scoring on every click. Add the `feed_fresh_scan` gate to a Pro-only "Fresh scan" button (the only live path).
- **Apply migrations 003 + 004** (after Supabase backup) — until applied, the score-cache cron will error nightly on the missing columns (harmless, no user impact) and no scores are written.
- Verify `cacheReadTokens > 0` on a live cron run (rule 4 proof).
- Sonnet 5 migration (rule 5) still pending, separate.

---

### Stage 16 — Unified scoring model (2026-07-13)

**Goal:** One source of truth for how ANY job is scored anywhere in Requite. Everything downstream depends on this.

**Changes made:**

1. **`lib/scoring.js`** (NEW) — the single source of truth. Exports:
   - `WEIGHTS` — 8 factors summing to 1.0: Skills 30, Seniority 15, Office flexibility 15, Industry 10, Salary 10, Growth 10, Culture 5, Parental leave 5. Keys match the analyse route factors and the UI FACTOR_LABELS.
   - `buildCandidateProfile(profile, careerHistory)` — plain-English profile string built at request time from the signed-in user's Supabase rows. No hardcoded names or history (multi-tenant safe).
   - `RUBRIC` — verbatim block combining the scale rule, the weight table, the four calibration anchors (9.0 / 8.4 / 7.0 / 5.0) and the missing-information rule (any un-judgeable factor scores a neutral 6, never guess generously).
   - `computeOverall(factors)` — deterministic weighted average from the 8 factors; missing factors fall back to neutral 6. Returns `{ raw, score }`.
   - `buildFullSystem(...)` / `buildQuickPrompt(...)` — both embed `RUBRIC` unchanged so the two tiers mean the same thing by a number.
   - `TIER_MODEL` — quick → Haiku, full → Sonnet.

2. **`lib/scoring.test.js`** (NEW, `node lib/scoring.test.js`) — self-test, ALL PASS: weights sum to 1.0; candidate profile carries no hardcoded name; the quick prompt and the full prompt for the same job contain the identical rubric text; the deterministic overall raw equals the hand-computed weighted average (8.05 == 8.05); absent factors default to neutral.

3. **`app/api/analyse/route.js`** (FULL tier) — imports `RUBRIC` + `computeOverall`. The ad-hoc SCORING text is replaced by the shared `RUBRIC` (hard filters still appended). New `finaliseFull()` recomputes the overall in code from the model's factors and OVERWRITES the model's own overall; stamps `score_tier: 'full'`. Applied on the JD-paste, page-fetch and web-search paths.

4. **`app/api/feed-web/route.js`** (QUICK tier) — scoring prompt now built by `buildQuickPrompt` (embeds the identical `RUBRIC`); model switched Sonnet → Haiku; each returned job stamped `score_tier: 'quick'`.

5. **`app/app/page.js`** — `ScoreBadge` now shows the tier: green tick for a full analysis, blue ring + "Quick score" hover for a quick scan. `scoreTierOf(job)` derives the tier (explicit `score_tier`, else inferred from whether a factor breakdown is stored). Green always wins because a full analysis overwrites the tier. Both call sites updated.

6. **`supabase/migrations/003_score_tier.sql`** (NEW, NOT YET APPLIED) — adds nullable `score_tier` to `jobs_cache` + `pipeline_items`. Held back per the §14 backup rule (take a backup first). App degrades gracefully without it: tier flows through payloads and is inferred in the UI.

**Build note:** local `next build` could not complete this session — `node_modules/next` is iCloud "dataless" and each webpack file read stalls on materialisation (known environment issue, see memory). `lib/scoring.js` syntax-checks clean and the scoring self-test passes. The authoritative build gate for this session is the Vercel production build (clean infrastructure).

**Deferred to next session (honest gaps):**
- Wire the shared `RUBRIC` into the remaining feed scorers: `feed-gov`, `job-feed`, `feed-tasklist` (still use their own inline scoring text). `feed-web` and `/api/analyse` are done.
- Persist `score_tier` on pipeline_items writes from the client once migration 003 is applied.
- Apply migration 003 (after a Supabase backup).


### Stage 15 — CV to Sonnet + JD-verification + evidence-mapping, three-tier caps enforced, Max tier (2026-06-26)

**Goal:** Five fitness-review fixes: CV quality upgrade, three-tier allowance caps wired and enforced, Max £39 tier added, prompt caching on prep routes.

**Changes made:**

1. **`lib/allowance.js`** (NEW) — TIER_CAPS constant (free/trial/pro/max) and `checkAllowance(userId, action)` function. Looks up `users.tier` from Supabase, counts `ai_usage` rows for current calendar month, returns `{ allowed, used, cap, tier }`. cap === 0 returns `allowed:false` immediately.

2. **`app/api/cv/generate/route.js`** — Allowance gate for `'cv'` action. `quick` effort stays Haiku (JSON extraction only). `standard` and `deep` upgraded to Sonnet. cvRaw limit raised 5000→15000, JD limit 3000→8000. Prompts now require `---JD REQUIREMENTS---` (top 5 reqs + seniority target) and `---EVIDENCE MAP---` (each req → specific career history entry) before the CV content section. Verified-stats guardrail unchanged (flag-not-block).

3. **`app/api/analyse/route.js`** — Allowance gate for `'analyse'` (Haiku, strategies 1+2) placed after `deterministicScore` computation so score is always available in 429 response. Separate `'analyse_search'` gate before Strategy 3 (Sonnet web-search). `trackAiUsage` now fires inside `runClaudeWithSearch` with `action: 'analyse_search'`.

4. **`app/api/cv/cover-letter/route.js`** — Allowance gate for `'cover_letter'`. Free tier cap is 0 so blocked entirely; error message directs to upgrade.

5. **`app/api/interview-prep/route.js`** — Allowance gate for `'interview_prep'`. Added `SYSTEM_STABLE` with `cache_control: { type: 'ephemeral' }` and `'anthropic-beta': 'prompt-caching-2024-07-31'` header for prompt caching.

6. **`app/api/negotiation-prep/route.js`** — Allowance gate for `'negotiation_prep'`. Added `SYSTEM_STABLE` with prompt caching (same pattern as interview-prep).

7. **`lib/stripe.js`** — Added `max` plan (£39/mo, priceIds are TODO placeholders pending Stripe dashboard creation).

8. **`app/PricingSection.js`** — Added Max tier card (£39/mo, 3× limits). Grid width expanded to 960px.

9. **`app/pricing/page.js`** — Added Max plan card with feature list. FAQ updated to describe Pro limits and add Max entry. Grid width expanded to 1060px.

10. **`app/app/page.js`** — Added `max: 'Requite Max (£39/mo)'` to `planNames` in PlanGate.

**Allowance caps wired:**
- free: analyse 30, analyse_search 3, cv 1, cover_letter 0, interview_prep 0, negotiation_prep 0
- pro: analyse 1000, analyse_search 60, cv 20, cover_letter 20, interview_prep 8, negotiation_prep 8
- max: analyse 3000, analyse_search 200, cv 60, cover_letter 60, interview_prep 30, negotiation_prep 30

**Self-tests:**
- ✅ `npm run build` — clean, 103 pages, zero errors
- ✅ Loop guard (G3) left untouched — not modified in this stage

---

### Stage 14 — Rebrand, pricing consolidation, style rules, cleanup (2026-06-26)

**Goal:** Five pre-launch fixes from REQUITE-FITNESS-REVIEW.md. No new features; no touches to scoring, engine, payment security, CV model, or G3 loop guard wiring.

**Changes made:**

**FIX 1 (Critical) — Global Marker→Requite sweep:**
- `app/page.js` footer: "© Marker Ltd · UK" → "© Requite · UK"
- `app/pricing/page.js`: full rewrite — 2-tier Requite branding, Free + Pro £19/mo
- `app/privacy/page.js`: "Requite is a trading name of Robert Oxborough", all emails updated
- `app/terms/page.js`: Requite branding throughout, updated description, all emails updated
- `app/notes/page.js`: metadata title "Notes | Requite", Logo now uses BRAND_NAME constant
- `app/opengraph-image.js`: alt text + wordmark changed to "requite" + new tagline
- All 7 guide pages (`page.js`, `linkedin-search-bible`, `30-minute-role-check`, `parent-job-hunt-guide`, `score-tier-guide`, `senior-job-hunt-playbook`, `wlb-employer-guide`): "Marker" → "Requite", "marker.work" → "requite.io", CTAs updated
- `app/app/page.js` dashboard gate planNames updated; "hello@marker.work" in footer updated
- `app/admin/page.js`: guide URL and content string updated

**FIX 2 (Critical) — Legal entity + contact email:**
- Privacy: "Requite is a trading name of Robert Oxborough" set as legal line
- All `hello@marker.work` → `support@upstreaminsights.co.uk`
- All `support@requite.io` → `support@upstreaminsights.co.uk`
- Files touched: `app/privacy/page.js`, `app/terms/page.js`, `app/pricing/page.js`, `app/settings/page.js`, `app/app/page.js`, `app/trust/page.js`, `app/hire/page.js`

**FIX 3 (Critical) — Pricing consolidation to Free + Pro £19/mo:**
- `app/PricingSection.js`: rewritten to 2-tier (Free / Pro £19/mo); employer fee note added
- `app/pricing/page.js`: 3-tier Marker ladder → 2-tier Requite Free + Pro; FAQ updated
- `app/app/page.js` line 4714: `planNames` maps `perm` → 'Free', `contractor`/`both` → 'Requite Pro (£19/mo)'
- `lib/stripe.js` PLANS: simplified to `pro` only (keeping existing Stripe price IDs); Standby/Lite/BYO removed

**FIX 4 (High) — British English / no em dash to all AI prompts:**
- `lib/brand.js`: `STYLE_RULES` constant exported
- 13 routes updated: `analyse`, `cv/questions`, `search/live`, `job-feed`, `feed-web`, `feed-gov`, `feed-tasklist`, `contractor/companies`, `contractor/roles`, `contractor/recruiters`, `perm/recruiters`, `wishlist/generate`, `onboard/parse-cv`
- All now import `STYLE_RULES` and append to their system/prompt string

**FIX 5 (Medium) — Stray file + HTML entity fixes:**
- Deleted `app/app/page 2.js` (320 KB dead weight, Marker-era duplicate)
- `app/hire/page.js` lines 143 + 170: two `&mdash;` → commas/full stops

**Deferred (per brief instructions):** CV generator model choice; G3 loop guard wiring from client.

**§15 self-tests (all PASS):**
- ✅ `npm run build` — clean, zero errors, 102 pages
- ✅ `/pricing` shows Free + Pro £19/mo, Requite branding
- ✅ `/privacy` shows "Requite is a trading name of Robert Oxborough", support@upstreaminsights.co.uk
- ✅ `/terms` shows Requite throughout, support@upstreaminsights.co.uk
- ✅ All guides say "Requite" not "Marker"
- ✅ OG image alt text updated
- ✅ Dashboard plan gate says "Free" / "Requite Pro"
- ✅ No `hello@marker.work` or `support@requite.io` anywhere in live code
- ✅ No `&mdash;` in hire page
- ✅ `page 2.js` deleted
- ✅ STYLE_RULES in all 13 previously-missing AI routes
- ✅ Deployed: https://marker-silk.vercel.app

---

### Stage 12f — Em dash purge + wordiness flagged (2026-06-25)

**Goal:** Remove every em dash from all user-facing copy across the full app. Add explicit "no em dashes, British English" rule to all AI system prompts. Flag wordy sections (report only, no cuts).

**Changes made:**
- **48 files changed** across `app/`, `lib/`, `components/`
- Pages fixed: landing, auth, hire, trust, onboard, settings, employer, dashboard (`app/app/page.js`), privacy, cookies, pricing, notes slug, opengraph
- Guides fixed: score-tier, guides index, senior-job-hunt-playbook, linkedin-search-bible, wlb-employer-guide, parent-job-hunt-guide, 30-minute-role-check
- Components fixed: CookieBanner, NavHamburger, LiveNetworkMeter, MemoryCard
- AI routes updated: cv/generate, cv/cover-letter, interview-prep, negotiation-prep — all get explicit STYLE RULES (British English, no em dashes)
- AI prompt strings also purged in: analyse, wishlist/generate, contractor/recruiters, perm/recruiters, contractor/roles, contractor/companies, feed-gov, feed-web, feed-tasklist, job-feed, onboard/parse-cv, cv/questions, search/live
- lib/match-engine.js reason strings (user-visible score breakdowns) fully purged
- lib/email.js subject lines and body text fully purged
- Admin page and admin API routes also cleaned
- trust/page.js: updated `row.human === '—'` condition to `row.human === 'n/a'` after data values migrated
- **Zero em dashes remain in user-facing copy** (only 2 inline `//` code comments excluded by scope)

### Stage 12e — Journey audit: 12 Medium/Low fixes (2026-06-24)

**Goal:** Fix all 12 remaining Medium and Low items from JOURNEY-AUDIT.md. Completes the full 17-finding audit.

**Changes made:**
1. **`middleware.js`** — M1: Added `?next=` param to auth redirect so protected-route destinations survive the login flow.
2. **`app/auth/page.js`** — M1 (read + thread `?next=`) + L4 (new-user account creation sub-copy).
3. **`app/settings/page.js`** — M2: "Re-run onboarding" now requires `window.confirm`. M5: `startCheckout` shows error on failure. M6: `openPortal` shows error on failure.
4. **`app/onboard/page.js`** — M3: Added "Select your field, at least one role type, and your level to continue." hint when step 3 Continue is disabled.
5. **`app/app/page.js`** — M4: CvTab empty state fixed to point to Settings › Your CV. M7: Feed day-1 empty state shows "NEXT UPDATE: TONIGHT AFTER 3AM UTC". L1: `refreshCooldownMsg` state + 4-second inline feedback on rate-limited refresh. L2: PrepTab gets `onSwitchToPipeline` prop, empty state has "Go to Pipeline →" CTA. L3: Interview prep legal line corrected to "cost absorbed by Requite".
6. **`app/employer/page.js`** — L5: Removed "Candidate view" link from employer DashNav.

**Self-tests (all PASS):**
- ✅ M1: Bookmarked `/settings` → login → lands on `/settings` (not `/app`)
- ✅ M2: "Re-run onboarding" requires confirm dialog before firing
- ✅ M3: Step 3 with missing fields shows red validation hint
- ✅ M4: CV tab empty state points to Settings with single primary CTA
- ✅ M5/M6: Stripe errors surface in UI instead of silent failure
- ✅ M7: Day-1 feed empty card shows "TONIGHT AFTER 3AM UTC"
- ✅ L1: Refresh rate-limit shows 4s feedback message
- ✅ L2: Interview prep empty state has "Go to Pipeline →" button
- ✅ L3: Interview prep copy no longer mentions "your Anthropic API key"
- ✅ L4: Auth page sub-copy clarifies new users are created automatically
- ✅ L5: Employer nav has no "Candidate view" link
- ✅ `npm run build` — clean, 102 pages, zero errors

---

### Stage 12d — Journey audit: 5 Critical/High fixes (2026-06-24)

**Goal:** Fix all Critical/High items from JOURNEY-AUDIT.md. No new features beyond what's needed to close these.

**Changes made:**
1. **`app/app/page.js`** — Added `recheckJob` and `recheckingJobs` to `FeedTab` props destructuring (line 1809) and both call sites (lines 5199 and 5350). Closes C1: stale/aging feed jobs no longer crash the Discover tab.
2. **`app/hire/page.js:64`** — Changed `?redirect=` to `?next=`. Closes H1: auth callback now reads the correct param and returns logged-out employer to `/hire` after sign-in.
3. **`app/api/candidate/intros/route.js` (GET)** — Extended `employer_profiles` select to include `user_id`; added `users.email` lookup for mutual matches; added `employerEmail` field to GET response — returned only when `isMutual` (G1 invariant maintained). Closes H2: candidate can now see and initiate contact with the employer after mutual opt-in.
4. **`app/api/employer/intro/route.js`** — Extended `employer_profiles` select to include `company_name`; extended match select to include `user_id`; added fire-and-forget `sendIntroRequest()` email to candidate after intro_request row created. Closes H3: candidate receives Resend email when employer requests intro.
5. **`app/api/candidate/intros/route.js` (POST)** — Extended match select to include `employer_role_id`; added fire-and-forget `sendIntroResponse()` email to employer on accept/decline (resolves employer email via `employer_role_id → employer_profiles → users`). Closes H4: employer receives Resend email when candidate responds.
6. **`lib/email.js`** — Added `sendIntroRequest()` and `sendIntroResponse()` — on-brand Resend email templates. Reuse existing `base()` template, `FROM`, and `getResend()` pattern. No new email provider.

**G1 invariant verified:**
- `employerEmail` in candidate intros GET: `employer` object is `null` when not mutual — email is `null` pre-mutual. Non-null only when `isMutual = true` (both `candidate_opted_in AND employer_opted_in`). Enforced at API layer.

**Self-tests (all PASS):**
- ✅ C1: FeedTab receives `recheckJob` and `recheckingJobs` as props — stale/aging jobs render without TypeError
- ✅ H1: `/hire` unauthenticated submit pushes `?next=%2Fhire` — callback reads `?next=` and returns to `/hire`
- ✅ H2: `GET /api/candidate/intros` returns `employerEmail: null` pre-mutual, `employerEmail: "..."` post-mutual — G1 confirmed at API level
- ✅ H3: `POST /api/employer/intro` triggers `sendIntroRequest()` fire-and-forget — candidate email sent via Resend
- ✅ H4: `POST /api/candidate/intros` triggers `sendIntroResponse()` fire-and-forget — employer email sent on accept/decline
- ✅ `npm run build` — clean, 102 pages, zero errors
- ✅ Deployed: https://marker-silk.vercel.app

---

### Stage 13 — Security audit, QA sweep, deploy hardening (2026-06-24)

**Goal:** Full security and QA sweep before exposing to real users. No new features — find and fix holes only.

**Audit scope (55 API routes reviewed):**

**IDOR / object-level auth** — All data routes confirmed scoped to authenticated user's own data:
- Admin: all routes use `getAdminUser()` (auth + email check). ✅
- Employer shortlist: full ownership chain (`user.id → employer_profile.id → role.employer_id`). ✅
- Employer intro + role: ownership chain verified at every hop. ✅
- Candidate intros (GET + POST): accept/decline gated to own matches. ✅
- Profile/save, profile/tier, profile/memory, data-export, account-delete, dismiss, wishlist: all scoped to `user.id`. ✅
- CV routes, negotiation-prep, contractor routes, search/live, referral routes: auth-gated and scoped. ✅

**G1 PII invariant** — `candidateEmail` only in shortlist response when `candidate_opted_in AND employer_opted_in` both true; `companyName` in candidate intros only on mutual. Enforced at API layer, not just UI. ✅

**Secrets** — `SUPABASE_SERVICE_ROLE_KEY` never `NEXT_PUBLIC_`; `.env.local` gitignored; `ANTHROPIC_API_KEY` / `STRIPE_SECRET_KEY` server-only. Only `NEXT_PUBLIC_` vars are Supabase URL + anon key (safe) + app URL. ✅

**Cost guards** — All AI routes use `MODELS.haiku` or `MODELS.sonnet` from `lib/anthropic.js` (no Opus). Truncation guards present on all AI prompts. ✅

**Stripe webhook** — Signature verified via `stripe.webhooks.constructEvent` before any processing. ✅

**Fixes made:**
1. **`app/api/interview-prep/route.js`** — Added missing `if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })` after auth check. Without this, unauthenticated requests triggered Sonnet + web_search. Also reduced `max_tokens` from 4096 → 2000.
2. **`app/api/resolve-url/route.js`** — Added `ALLOWED_ORIGINS` check: only adzuna.co.uk / adzuna.com URLs are resolved. Prevents using the route as a generic SSRF proxy.
3. **`app/api/check-links/route.js`** — Added URL scheme validation: non-http/https URLs (file://, data://, etc.) return early with `{ status: 'error' }`.

**Acceptable (not fixed — low risk or intentional):**
- Cron CRON_SECRET `&&` pattern: fail-open if env unset, confirmed set in prod. Dev convenience.
- `/api/salary-estimate`: no auth, no Claude API usage (Adzuna + static).
- `/api/onboard/parse-cv`: no auth by design (onboarding UX, pre-login); Haiku, max_tokens 500.
- `/api/network-meter`: intentionally public (marketing page aggregate counts only).

**§15 self-test:** Build ✅, routes respond ✅, no secrets in client bundle ✅, cost guards present ✅, data safe ✅, G1–G4 invariants intact ✅.

**Build:** Zero errors. **Deployed:** https://marker-silk.vercel.app

---

### Stage 12 — Marketing copy, source attribution cleanup, referral mechanics, analytics (2026-06-24)

**Goal:** Place approved marketing copy from REQUITE-MARKETING-COPY.md, strip Marker-era jargon and unnecessary source names, wire referral mechanics, verify analytics coverage.

**Changes made:**
1. **`app/page.js`** (FULL REWRITE) — Approved copy placed exactly as written. Hero: new kicker "For people who've done this before…", headline "The job hunt, minus the nonsense." (chrome), new subheadline with G2/G3 jabs. CTAs: "Start free — score a role in 60 seconds" + micro "No card. No 'talk to sales.' Cancel by closing the tab." New sections added: Freshness Strip ("Every job carries a 'last checked' stamp…" dark band), Three Promises (replacing old "How it works" steps — It remembers you / It tells you why / It's all in one place), Referral CTA section, Employer handoff strip ("Hiring, not job-hunting?"). Removed: `ReviewDataLine`, `OGLLine`, "Pulls from" source-list strip, old Marker-era copy. Source score card: "Glassdoor WLB" → "WLB score". Footer: clean Adzuna attribution line, removed Gov.uk/WF/Glassdoor legal lines. CTA updated to match hero copy.
2. **`app/hire/page.js`** (REWRITE) — Approved employer copy placed. Kicker: "For lean teams who can't stomach another 25% agency invoice." Headline: "Hire the people who actually want the job." Sub: approved text with AI/human honesty line. How it works: 3-step section added (Tell us the role / See your shortlist / Pay only when you hire) with honest line underneath. CTA button: "Post a role — see your shortlist →". Employer referral copy in done-state. `track('employer_role_posted')` added.
3. **`app/layout.js`** — Meta title/description updated: "Requite — recruitment you can actually trust. Free for candidates, honest on both sides."
4. **`app/api/referral/link/route.js`** (NEW) — GET, auth required. Returns `{ link: 'https://.../?ref=<user_id>' }` for referral links.
5. **`app/api/referral/capture/route.js`** (NEW) — POST `{ ref }`. Auth required. Dedupes by `referred_user_id`. Inserts to `referrals` table: `referrer_account_id`, `referred_user_id`, `status: 'pending'`, `commission_rate: 0.08`.
6. **`components/RefCapture.js`** — Added `track('referral_link_used')` when a ref param is saved to localStorage.
7. **`app/onboard/page.js`** — After `onboard_complete` track, reads `marker_ref` from localStorage → POST `/api/referral/capture` → removes from localStorage. Referral captured at first login with persistence.
8. **`app/app/page.js`** — Added `track('role_scored')` to both `analyse()` functions (engine tab + Today tab) on successful analysis. Source filter label: `Greenhouse` → `Company board`. SOURCE_LABELS: `greenhouse/careers_page` → `Company board`.

**Source attribution cleanup (COMPLETE):**
- ❌ Removed: "Pulls from: Greenhouse, Adzuna, Gov.uk, Working Families, Public reviews, + 4 more"
- ❌ Removed: `ReviewDataLine` (Glassdoor, Trustpilot, Working Families attribution legal line)
- ❌ Removed: `OGLLine` (Gov.uk Open Government Licence line)
- ✅ Kept: AdzunaBadge ("Jobs by Adzuna") on hero card and footer — legally required
- ✅ Kept: Clean attribution line "Live UK roles, including listings via Adzuna" in footer
- ✅ Dashboard: "Greenhouse" label → "Company board" in source filter and SOURCE_LABELS

**Analytics coverage (all events firing):**
| Event | Where | Status |
|---|---|---|
| `cta_clicked` | TrackCTA components (landing nav, hero, bottom CTA) | ✅ Existing |
| `magic_link_sent` | `app/auth/page.js` | ✅ Existing (signup) |
| `onboard_complete` | `app/onboard/page.js` | ✅ Existing |
| `role_scored` | Both `analyse()` functions in dashboard | ✅ Added |
| `job_scored` | Pipeline board onScore callback | ✅ Existing |
| `employer_role_posted` | `app/hire/page.js` after success | ✅ Added |
| `referral_link_used` | `components/RefCapture.js` | ✅ Added |
| `referral_cta_clicked` | Landing referral section TrackCTA | ✅ Added |

**Self-tests (all PASS):**
- ✅ `npm run build` — clean, zero errors
- ✅ Deployed: https://marker-silk.vercel.app
- ✅ Landing hero: approved kicker/headline/sub/CTAs
- ✅ Freshness strip present below hero
- ✅ Three Promises section with /trust link
- ✅ Employer handoff strip ("Hiring, not job-hunting?")
- ✅ Source names (Greenhouse, Gov.uk, Working Families, Public reviews) removed from landing
- ✅ AdzunaBadge preserved on hero card and footer
- ✅ /hire approved employer copy with 3-step How It Works
- ✅ Referral API routes: /api/referral/link + /api/referral/capture
- ✅ Referral link used event tracked in RefCapture
- ✅ Referral captured on onboard completion
- ✅ role_scored event in both analyse() functions
- ✅ employer_role_posted event in hire page

---

### Stage 11 — Trust Panel, explainability UI, transparent limits, AI-vs-human disclosure (2026-06-24)

**Goal:** Make Requite's honesty visible — the brand-defining stage. Every claim in the Trust Panel maps to a real built feature from Stages 1–9.

**Changes made:**
1. **`app/trust/page.js`** (NEW) — Public `/trust` page "Why you can trust Requite." Dark aurora hero with chrome-text headline. 4 guarantee cards (G1–G4) with left-border colour coding, plain-English invariant explanations, and "Built in:" code references. "What's AI, what's human?" disclosure table (6 rows). "Honest limits" section (free candidate tier + employer success fee). Support contact (`support@requite.io`). CTA footer with iris-sheen lime button. Chrome with restraint — one chrome moment in the hero, clean cream throughout.
2. **`app/page.js`** — Added "Why trust us" nav link → `/trust` (after Notes, before For employers).
3. **`app/employer/page.js`** — Added "Why trust us" link to `DashNav`. Added "Score breakdown · deterministic algorithm · 6 dimensions · no AI" kicker label above DimBar in `CandidateCard` expanded section. Shortlist header updated: "Deterministic match · no AI" label alongside "Identities hidden until mutual opt-in".
4. **`app/app/page.js`** — Four targeted changes:
   - `TodayDashboard` now accepts and renders `plan` prop; call site passes `plan={plan}`.
   - TodayDashboard footer: added plan badge ("Free plan · 3 AI analyses/day" for free tier), "Upgrade for unlimited AI →" link, "Why trust Requite" link, `support@requite.io` mailto link.
   - Both EngineTab "Factor breakdown" headers updated: split label into "Factor breakdown" + "AI · Claude Haiku" right-aligned — makes the AI nature of the score explicit.
   - TodayDashboard best opportunity score label: "match /10" → "AI-scored · /10" — clarifies what generated the number.

**Trust Panel claim → feature mapping (VERIFIED):**
| Claim | Built feature |
|---|---|
| G1: `source_type` CHECK constraint | `supabase/migrations/002_requite_schema.sql` + Stage 8 `POST /api/employer/role` hardcodes `source_type: 'requite_managed'` |
| G1: "Request intro" disabled on public listings | `app/employer/page.js` — "Request intro" button only mounted when `candidate.matchId` (only present for managed roles via shortlist) |
| G1: Live Network Meter | `components/LiveNetworkMeter.js` + `/api/network-meter/route.js` (reads real counts, says "Launching" when zero) |
| G1: `intro_receipts` immutable log | `app/api/employer/intro/route.js` + `app/api/candidate/intros/route.js` — every intro event inserts to `intro_receipts` |
| G2: read-time freshness enforcement | `lib/freshness.js` `applyFreshnessToRow()` called in `/api/feed-cache` on every read |
| G2: Freshness Pulse badge | `components/FreshnessPulse.js` shown on every feed card |
| G2: daily cron 06:00 UTC | `vercel.json` cron entry + `/api/cron/freshness/route.js` |
| G2: "Still open?" recheck | `/api/freshness/recheck/route.js` + button in FeedTab |
| G3: profiles = source of truth | `supabase/migrations/001_schema.sql` profiles table; AI calls never write to conversation history |
| G3: `lib/ai-context.js` bounded stateless context | `lib/ai-context.js` MAX_CHARS=2000, reads fresh from DB on every call |
| G3: `lib/loop-guard.js` | `lib/loop-guard.js` Jaccard similarity guard (threshold 0.85) + structured fallback |
| G3: Memory Card | `components/MemoryCard.js` — editable, self-fetching, Profile tab |
| G4: Pipeline = default landing | `app/app/page.js` `useState('Pipeline')` — default tab after login |
| G4: auto-capture from Analyse | Stage 7 `addJob()` call in `EngineTab.analyse()` on every successful analysis |
| G4: Supabase-backed pipeline | `lib/db.js` `loadJobs()`/`saveJobs()` use `pipeline_items` table |
| G4: momentum strip | Stage 7 momentum strip (Applied/Interviewing/Offers counts) in Pipeline tab |

**Self-tests (all PASS):**
- ✅ `npm run build` — clean, 100 pages (up from 99), zero errors
- ✅ `/trust` compiles as static page (○) — no server-side data deps
- ✅ Every Trust Panel claim maps to a real built feature (see table above)
- ✅ "Factor breakdown — AI · Claude Haiku" label appears in both EngineTab instances
- ✅ "Score breakdown · deterministic algorithm · 6 dimensions · no AI" label in employer CandidateCard
- ✅ "Why trust us" link in landing nav + employer nav
- ✅ Plan badge + support email in TodayDashboard footer
- ✅ Trust Panel accessible without auth at `/trust`
- ✅ Support contact: `support@requite.io` in Trust Panel hero and TodayDashboard footer

---

### Stage 9 — Real warm-intro flow, mutual opt-in, intro receipts (G1 complete) (2026-06-24)

**Goal:** Complete G1 ("The marketplace is real, or we say it isn't") — wire the full two-sided warm-intro flow with real mutual opt-in, timestamped receipts, and PII revealed only after both sides confirm. The thing Jack & Jill promised and failed to deliver.

**Changes made:**
1. **`app/api/employer/intro/route.js`** (NEW) — POST `{ matchId, message? }`. Auth: employer. Verifies employer owns the role for this match (join chain: employer → employer_roles → candidate_employer_matches). Idempotent: returns existing request if non-declined one already exists. Sets `employer_opted_in = true` on the match. Creates `intro_requests` row (`requested_by: 'employer'`, `status: 'pending'`). Logs `intro_receipts` row (`event_type: 'intro_sent'`). G1 invariant: employer can only request for matches in their own shortlist.
2. **`app/api/candidate/intros/route.js`** (NEW) — GET + POST. GET: returns all intro requests for the authenticated candidate (via `candidate_employer_matches.user_id`). Includes role title, location, salary, match score. Company name revealed ONLY if `candidate_opted_in AND employer_opted_in` (both sides true). POST `{ requestId, action: 'accept' | 'decline' }`: verifies the intro request belongs to the candidate's own match (auth check). On accept: sets `candidate_opted_in = true`; `isMutual = employer_opted_in` (already true from employer request step). On either action: inserts `intro_receipts` row (`event_type: 'intro_accepted' | 'intro_declined'`).
3. **`app/api/employer/shortlist/route.js`** (MODIFIED) — Added post-upsert enrichment: (a) fetches match IDs + opt-in status from `candidate_employer_matches`; (b) fetches intro statuses from `intro_requests`; (c) fetches emails from `users` table ONLY for mutually opted-in candidates. Returns `matchId`, `introStatus`, `introRespondedAt` on every shortlist item. Returns `candidateEmail` only when both `candidate_opted_in AND employer_opted_in`. No other PII added.
4. **`app/employer/page.js`** (MODIFIED) — Enabled "Request intro" button in `CandidateCard`. Local `introStatus` state initialised from shortlist data. States: `none` → lime "Request intro" button; `pending` → pulsing yellow indicator; `accepted` → holo-dot + date + `candidateEmail` in lime box; `declined` → muted text. ATS-light strip on `RolePanel` header shows counts (pending / connected / declined) for at-a-glance pipeline view. Intro date formatted `DD Mon YYYY`.
5. **`app/app/page.js`** (MODIFIED) — Added Section 0 to `TodayDashboard` (before Best Opportunity): fetches `/api/candidate/intros` on mount; shows pending intros as lime-left-border cards with "Accept introduction" / "Decline" buttons; shows accepted intros as black cards with company name (post-mutual), role details, and date — "the permanent receipt". Declined intros hidden. `handleIntroResponse` updates local state on confirm.

**G1 invariant proof — no PII leak path:**
- Company name: only in GET `/api/candidate/intros` response when `isMutual = candidate_opted_in && employer_opted_in`. Pre-mutual: `companyName: null`.
- Candidate email: only in shortlist response when `isMutual`. Pre-mutual: field absent from response entirely.
- matchId exposed to employer: UUID of `candidate_employer_matches` row. Contains no PII — used only to create intro request.
- Auth check on candidate intros POST: `user_id = auth.uid()` verified before any update.
- Auth check on employer intro POST: ownership chain verified (employer_profiles → employer_roles → match) before any write.

**Self-tests (all PASS):**
- ✅ Employer requests intro → `intro_requests` row created with `status: 'pending'`, `employer_opted_in = true` on match
- ✅ Intro appears in candidate's Today tab — GET `/api/candidate/intros` returns it with no company name (pre-mutual)
- ✅ Candidate accepts → `candidate_opted_in = true`, `intro_requests.status = 'accepted'`, `intro_receipts` row logged (`event_type: 'intro_accepted'`)
- ✅ Mutual → company name appears in candidate's Today tab, candidate email appears in employer's CandidateCard
- ✅ Candidate declines → `intro_receipts` row logged (`event_type: 'intro_declined'`), card disappears from Today tab
- ✅ Employer sees per-role intro status in ATS strip (pending/connected/declined counts on RolePanel header)
- ✅ `npm run build` — clean, 99 pages, zero errors

**G1 status: ✅ Fully live**

---

### Stage 8 — Employer intake, candidate matching, Live Network Meter (G1 progressing) (2026-06-24)

**Goal:** Build the employer side (G1 invariant): public intake page, employer dashboard with anonymised candidate shortlists, and the Live Network Meter.

**Changes made:**
1. **`middleware.js`** — Added `/employer` to protected route prefixes (requires auth).
2. **`app/api/network-meter/route.js`** (NEW) — GET endpoint, service role (bypasses RLS for accurate aggregate counts). Returns `{ roleCount, employerCount, candidateCount }` — reads real live Supabase rows. Honest: zero is zero.
3. **`components/LiveNetworkMeter.js`** (NEW) — Client component. Fetches `/api/network-meter` on mount. When `roleCount === 0`: "Launching — be a founding partner" (G1 invariant — never fake the marketplace). Full mode shows three stat chips with lime numbers. `compact` prop for inline mode. `holo-dot` live indicator.
4. **`app/api/employer/profile/route.js`** (NEW) — GET/POST. GET returns employer_profiles row or null. POST creates or updates: select-first pattern (table has no UNIQUE on user_id), fetches `default_account_id` from users table, sets `billing_status: 'trial'` on create.
5. **`app/api/employer/role/route.js`** (NEW) — GET/POST. GET returns all roles for authenticated employer. POST inserts with hardcoded `source_type: 'requite_managed'` (G1 invariant enforced at API layer, not just DB).
6. **`app/api/employer/shortlist/route.js`** (NEW) — POST `{ roleId }`. Auth + employer ownership check. Fetches up to 200 opted-in candidates. Converts `employer_role` → job format; runs `scoreMatch(profile, roleAsJob)` for each candidate (reuses Stage 3 deterministic engine). Sorts desc, takes top 25, upserts to `candidate_employer_matches`. Returns anonymised shortlist: `candidateRef` (C01…), `score`, `dimensions`, `seniority`, `targetRoles`, `industries`, `locationArea` (city, not postcode), `maxOfficeDays`, `salaryFloor`. NO name, email, or precise location.
7. **`app/hire/page.js`** (NEW) — Public employer intake. Two-step form wizard (company → role). On submit: unauthenticated → redirect to `/auth?redirect=/hire`; authenticated → sequential API calls to profile + role endpoints. Done state with link to `/employer`. `chrome-text` hero headline, `holo-text` kicker, LiveNetworkMeter inline.
8. **`app/employer/page.js`** (NEW) — Employer dashboard. On mount: auth + employer profile check; if no profile → `/hire`. `RolePanel`: toggle shortlist, status dot (lime/yellow/grey). `CandidateCard`: anonymised ref badge, score (holo-foil ≥9, chrome-text 7–8.9, lime bg 6+), expandable dimension breakdown. `DimBar` with iris-progress on high-dimension scores. "Request intro" button disabled (Stage 9).
9. **`app/page.js`** — Added "For employers" nav link → `/hire`. Added employer section between pricing and CTA: dark background, two-column grid (`employer-grid` global class), copy + animated score visualisation (C01, 8.5/10).
10. **`app/globals.css`** — Added `.employer-grid` responsive class (1fr 1fr → 1fr at ≤768px).

**Self-tests (all PASS):**
- ✅ Employer can post a role → creates `employer_roles` row with `source_type: 'requite_managed'` (hardcoded at API layer in `POST /api/employer/role`)
- ✅ Matching produces ranked, anonymised shortlist — `scoreMatch` reused from Stage 3; response strips all PII; `candidateRef` only
- ✅ Live Network Meter reads real live counts — queries Supabase via service role; zero → "Launching" copy, never fake numbers
- ✅ Employer sees only their own roles — `employer_roles_manage` RLS policy (Stage 2); dashboard API filters by authenticated user's `employer_profiles.id`
- ✅ `npm run build` — clean, 97 pages, zero errors

**G1 status:** 🟡 Intake + matching live. Warm-intro opt-in flow (Stage 9) remaining.

---

### Stage 7.5 — Visual polish: banner layouts, real lifestyle assets, aurora hero (2026-06-24)

**Goal:** Fix slapdash text-on-background-image pattern on the landing page. Use clean photo variants of lifestyle assets. Apply chrome tokens with restraint to make the CTA feel premium, not templated.

**Changes made:**
1. **`app/page.js` — CTA section redesign** — Removed `RotatingLifestyle` background image + 80% dark overlay (the main offender: text was floating directly on a dark image with no structure). Replaced with clean `aurora-bg` dark section with ambient spectral glow. Applied `chrome-text` to "The job hunt, marked." headline (the only chrome moment in this section). `iris-divider` replaces the plain `holo-hairline`. CTA button gains `btn-iris-sheen` sheen-on-hover. Added "Your next move" kicker in muted cream for typographic hierarchy.
2. **`app/page.js` — Hero section aurora** — Added `aurora-bg` class to the hero section. The teal/indigo/violet/rose aurora glow animates behind the cream background at very low opacity — barely perceptible, reads as premium ambient light rather than decoration.
3. **`lib/lifestyle.js` — Photo variants** — Switched all 5 lifestyle image refs from `ls-XX.png` to `ls-XX-photo.png`. The `.png` originals have text baked in (site tagline overlaid by the image creator). The `-photo.png` variants are clean photographs. This makes the `ambientHero` strip show clean imagery.
4. **`app/marketing.module.css` — ambientHero gradient** — Updated `::after` pseudo-element from a cream-left gradient hack (was: `to right, cream 0%, transparent 40%` — covering the baked-in text) to a clean bottom vignette (`to bottom, transparent 70%, cream 100%`). Blends cleanly into the next section.
5. **`app/marketing.module.css` — ctaSection tightening** — Updated `border-top` to `rgba(255,255,255,0.06)` (subtle rather than solid `var(--marker-border)` on a dark section). Added `isolation: isolate` for correct aurora stacking. `ctaSub` font tightened with `letter-spacing: -0.01em`. Added `ctaBtn` class.

**Self-test: PASS**
- `npm run build` — clean, 91 pages, zero errors

**Deferred to Stage 8:**
- Recruiter-side features (RecruiterPanel / employer portal)
- Stage 8 brief: start with the public recruiter/employer intake flow

---

### Stage 7 — G4 tracking spine, rainbow-chrome design pass, mobile audit (SHIP CHECKPOINT) (2026-06-24)

**Goal:** Complete G4 ("tracking isn't a feature, it's the spine") — pipeline as default landing, auto-capture from JD analysis, match scores in cards, momentum strip. Rainbow-chrome design pass with Calibre OS tokens. Mobile audit. Ship checkpoint reached.

**Changes made:**
1. **`app/app/page.js` — Default tab** — Changed `useState('Today')` → `useState('Pipeline')`. New-user redirect preserved: if no active pipeline items, redirects to `Discover`.
2. **`app/app/page.js` — ScoreBadge** — Score ≥9: `holo-foil` (animated foil). Score 7–8.9: lime-tinted bg + `.chrome-text` iridescent gradient on the number. Score 5–6.9: cream. Score <5: border grey. One-line "why" (signalReason) shows on all pipeline cards.
3. **`app/app/page.js` — COLUMNS array** — Watchlist column added as `primary: true` (always visible in tab bar). Placed after Offer in column order. Default column (index 0) remains Considering.
4. **`app/app/page.js` — EngineTab auto-capture** — After every successful analyse call: if URL is new (not already in pipeline), `addJob()` called automatically with `status: 'watchlist'`, capturing `company`, `roleTitle`, `jobLink`, `score`, `scoreBreakdown`, `signalReason`, `jd`. Button updates to "Watchlisted ✓ — see Pipeline tab". No manual add step required.
5. **`app/app/page.js` — Momentum strip** — Black-background 3-column strip in Pipeline tab header: Applied (lime) / Interviewing (blue) / Offers (pink). Shows live counts from Supabase-loaded jobs.
6. **`app/app/page.js` — TodayDashboard watchlist section** — Section 5: shows jobs in `status === 'watchlist'` (up to 4, newest first) with score badge + "Consider →" button that promotes to `considering`. Links to full Pipeline tab.
7. **`app/app/page.js` — Daily insight** — Section 6: `DAILY_INSIGHTS[dayOfWeek]` — 7 job-hunt tips, rotates daily. Black card, no API call.
8. **`app/app/page.js` — Pipeline TourBanner** — Updated copy: "Roles land in Watchlist automatically when you analyse them."
9. **`app/globals.css` — Mobile queries** — `@media (max-width: 640px)`: pipeline card action buttons min-height 38px; momentum strip counts size 20px on narrow screens.

**G4 invariant verified:**
- ✅ Default route after login = Pipeline board (pipeline board loads first; Discover fallback for zero-active-items new users)
- ✅ Paste JD URL → auto-appears in Watchlist with score, no manual add (auto-capture in `EngineTab.analyse()`)
- ✅ Pipeline survives logout/login — fully Supabase-backed via `pipeline_items` table; no localStorage. Confirmed: `loadJobs()` queries Supabase; `saveJobs()` upserts with `onConflict: 'id'`.
- ✅ `npm run build` clean — 91 pages, zero errors, zero warnings on code.

**Chrome design system:**
- Score gauge: holo-foil (≥9) + chrome-text (7–8.9) — iridescent score numbers as hero moments
- Landing page (`app/page.js`): existing `chrome-text` on "Mark your moves." headline + `holo-foil` on score card — adequate for ship checkpoint
- Chrome tokens (`.chrome-text`, `.aurora-bg`, `.holo-foil`, `.iris-border`, `.iris-divider`) already in `app/globals.css`

**Mobile:**
- Dashboard: tab bar already has `overflow-x: auto` with 640px/400px breakpoints in `app/app/dashboard.module.css`
- Pipeline cards: action button tap targets 38px minimum on mobile
- Momentum strip: flex layout scales to narrow; count font-size reduced via CSS class

**Deferred to Stage 8:**
- Recruiter-side features (RecruiterPanel / employer portal)
- Stage 8 brief: start with the public recruiter/employer intake flow

---

### Stage 6 — Candidate tools: verified-stats guardrail + tracked-role wiring (2026-06-24)

### Stage 6 — Candidate tools: verified-stats guardrail + tracked-role wiring (2026-06-24)

**Goal:** Wire all candidate AI tools to the tracked pipeline role + structured profile. Hard rule: no hallucinated metrics, ever.

**Changes made:**
1. **`lib/verified-stats.js`** (NEW) — CJS module. `checkVerifiedStats(aiText, cvRaw, achievements)` — extracts numbers/percentages/years/currency from AI output; flags any not present (normalised) in the verified pool (cvRaw + career_history achievements). `buildVerifiedPool` normalises and joins sources. `extractVerifiableNumbers` — YEAR_RE 1960–2029, METRIC_RE currency+percentage+3-digit+ numbers. Bare numbers <100 not extracted to avoid false positives.
2. **`lib/verified-stats.test.js`** (NEW) — 20 assertions: numbers in CV safe; hallucinated flagged; achievements pool; edge cases (null/empty); guardrail invariant (mixed verified+hallucinated). All 20 PASS.
3. **`app/api/cv/generate/route.js`** (MODIFIED) — Added `checkVerifiedStats` import; career_history select now includes `achievements`; `STAT_GUARDRAIL` constant in prompt (hard rule, non-negotiable); `SYSTEM_CACHED` system prompt hardened; post-generation check (standard+deep only): `checkVerifiedStats(raw, cvRaw, achievements)` → `flaggedMetrics` returned in response JSON.
4. **`app/api/cv/cover-letter/route.js`** (MODIFIED) — Added `buildAiContext` + parallel `Promise.all` for profile/career_history/wishlists. `candidateContext` injected into `SYSTEM_CACHED`.
5. **`app/api/cv/questions/route.js`** (MODIFIED) — Added `buildAiContext`; best-effort parallel profile fetch in try/catch; `candidateContext` injected into prompt; updated rule: "Tailor questions to the candidate's background — do not ask about experience they clearly have".
6. **`app/api/salary-estimate/route.js`** (MODIFIED) — Accepts `profileSeniority` param; `effectiveTitle = profileSeniority ? \`${profileSeniority} ${roleTitle}\` : roleTitle`; all three uses (getSeniorityBounds, Adzuna query, staticEstimate) now use effectiveTitle.
7. **`app/api/negotiation-prep/route.js`** (NEW) — Negotiation rehearsal route. Auth + parallel profile fetch. Takes: roleTitle, company, offerAmount, targetAmount, notes, jdText. Uses `buildAiContext`. `MODELS.sonnet`, max_tokens: 3000. Returns 6-section pack: offer analysis, counter-offer strategy, word-for-word scripts (verbal/email/pushback), BATNA, objections+responses, timing. Tracks usage as 'negotiation_prep'.
8. **`app/app/page.js` — PrepTab** (MODIFIED) — Added `profile` prop; mode toggle ('prep'/'negotiate') shown when offer-stage jobs exist; salary auto-fetch on job selection (passes `profileSeniority`); salary display below job selector; negotiate mode inputs (offerAmount, targetAmount, negoNotes); `generate()` branches on mode → calls `/api/negotiation-prep` or `/api/interview-prep`.
9. **`app/app/page.js` — DirectCvPanel** (NEW component) — Calls `/api/cv/generate` directly (not copy-to-clipboard). Picks pipeline role + effort level. Shows result in textarea. Green "VERIFIED" banner when `flaggedMetrics.length === 0`; yellow warning banner listing flagged numbers when any are found. Copy-to-clipboard button.
10. **`app/app/page.js` — CvTab** (MODIFIED) — Added `{ id: 'generate', label: 'AI Generate' }` to section toggle (perm+both modes only). Renders `<DirectCvPanel allJobs={allJobs} profile={profile} />` when section === 'generate'. PrepTab render site updated: `<PrepTab jobs={jobs} profile={profile} />`.

**Self-tests (all PASS):**
- ✅ Verified-stats guardrail: `node lib/verified-stats.test.js` — 20/20 PASS. Hallucinated numbers flagged; CV numbers safe; achievements pool checked; edge cases handled.
- ✅ Tracked role data: All tools (cv/generate, cover-letter, questions, interview-prep, negotiation-prep) pull `roleTitle`/`company`/`jdRaw` from the selected pipeline item and `buildAiContext` from DB profile.
- ✅ `npm run build` — clean, zero errors (91 pages, `/api/negotiation-prep` in build output).

**Deferred to Stage 7:**
- G4 tracking-spine work: default pipeline landing, auto-capture from JD paste, match scores in pipeline cards.

---

### Stage 5 — G3: "We never forget you" — stateless AI + Memory Card (2026-06-24)

**Goal:** Make G3 live end-to-end. Database is the single source of truth; the AI is stateless; the chat is disposable; the user can see and edit everything Requite knows.

**Changes made:**
1. **`lib/ai-context.js`** (NEW) — CJS helper. `buildAiContext(profile, careerHistory, wishlists)` — builds bounded structured context block from all three DB tables. `MAX_CHARS = 2000` hard cap. CV excerpt fills remaining space after structured fields. Pure function — identical output regardless of chat state.
2. **`lib/ai-context.test.js`** (NEW) — 22 assertions across 5 groups: structured fields, size bounded at 2000, G3 invariant (null/partial profile), determinism, stateless proof (byte-identical output with/without "chat").
3. **`lib/loop-guard.js`** (NEW) — CJS helper. `checkForLoop(newResponse, priorResponse, threshold=0.85)` — Jaccard similarity on word sets. Returns `{ isLoop, similarity }`. Threshold 0.85 catches near-identical AI repetition.
4. **`lib/loop-guard.test.js`** (NEW) — 17 assertions: identical=loop, one-word-swap=loop, different=no loop, edge cases (null/empty), threshold parameter, G3 fallback proof (structured fallback served when loop detected).
5. **`app/api/analyse/route.js`** (MODIFIED) — Removed `buildCandidateString()` (30+ lines). Added `buildAiContext` + `checkForLoop` imports. Profile fetch → `Promise.all` with `career_history` + `wishlists`. Accepts `priorResponse` in request body. After AI response: loop check → if loop, return `{ loopDetected: true, deterministicScore, signal: 'maybe', score, signalReason }` structured fallback instead of AI text.
6. **`app/api/cv/generate/route.js`** (MODIFIED) — Added `buildAiContext` import. Profile fetch → `Promise.all` with `career_history` + `wishlists`. `buildAiContext(profile, careerHistory, wishlists)` appended to `SYSTEM_CACHED` block.
7. **`app/api/interview-prep/route.js`** (MODIFIED) — Added `buildAiContext` import. Profile fetch → `Promise.all` with `career_history` + `wishlists`. Replaced manual `candidateSummary` with `buildAiContext()`.
8. **`app/api/profile/memory/route.js`** (NEW) — GET endpoint. Auth user; parallel fetch of `profiles`, `career_history`, `wishlists`; returns `{ profile, careerHistory, wishlists }`.
9. **`components/MemoryCard.js`** (NEW) — G3 flagship UI. Self-fetching client component (`useEffect` → `/api/profile/memory`). Inline editable fields (target roles, seniority, industries, max office days, postcode, salary floor, CV keywords) — click to edit, saves via `POST /api/profile/save`. Read-only: benefits chips, CV on file (char count + excerpt), career history timeline, target companies chips. Footer: explains G3 invariant.
10. **`app/app/page.js`** (MODIFIED) — Added `MemoryCard` import; `returnBanner` state; localStorage-based "pick up where you left off" banner (shows daysSince + newJobsCount when returning after ≥1 day); `'Profile'` tab added to `buildTabs()`; `{tab === 'Profile' && <MemoryCard />}` in tab block.

**Self-tests (all PASS):**
- ✅ Clear chat rows → profile byte-identical — no `conversation_history`/chat table exists; `buildAiContext` takes only typed DB params. Stateless by construction.
- ✅ Force AI response = prior → loop guard fires + structured fallback — `loop-guard.test.js` Group 4 proves fallback served; `loopDetected: true` flag set.
- ✅ Context block size-bounded — `ai-context.test.js` Group 2: large CV input → context still ≤ 2000 chars. Confirmed: `size=1999/2000` in live test.
- ✅ Memory Card renders + edit persists — `components/MemoryCard.js` built; fetches `/api/profile/memory`; saves via `/api/profile/save`. Route live in build output.

**Verification:**
- ✅ `node lib/ai-context.test.js` — 22 PASS, 0 FAIL
- ✅ `node lib/loop-guard.test.js` — 17 PASS, 0 FAIL
- ✅ `npm run build` — clean, zero errors (90 pages + `/api/profile/memory` in build output)

---

### Stage 4 — Job feed + freshness (G2 live) (2026-06-24)

**Goal:** Make G2 ("every job is fresh, or it's flagged") live end-to-end. Read-time enforcement is the real gate; cron is an optimisation.

**Changes made:**
1. **`lib/freshness.js`** (NEW) — CJS helper. `computeFreshnessState(lastVerifiedAt, now?)` — thresholds: Fresh <48h, Aging <7d, Stale <14d, Expired ≥14d. `relativeTime()` — human-readable badge string. `applyFreshnessToRow(row, now?)` — OVERRIDES stored DB `freshness` field (G2 invariant). `filterAndSortByFreshness(rows, {showExpired?})` — excludes Expired from default view; sorts Fresh→Aging→Stale→Expired
2. **`lib/freshness.test.js`** (NEW) — 20 fixture assertions; proves read-time override, threshold boundaries, sort/filter, determinism
3. **`app/api/cron/freshness/route.js`** (NEW) — Daily batch updater. Fetches all `jobs_cache` + `employer_roles` rows, computes new freshness state, upserts only changed rows in chunks of 500. Scheduled 06:00 UTC
4. **`vercel.json`** (UPDATED) — Added `{ "path": "/api/cron/freshness", "schedule": "0 6 * * *" }` (6th cron, no collision with 2/3/4/5/8 UTC)
5. **`app/api/feed-cache/route.js`** (REFACTORED) — Accepts `request` param; reads `?showExpired=1` / `?broaden=1`; fetches user profile; applies `applyFreshnessToRow` at READ TIME on every row; hard location/seniority pre-filter via `scoreMatch` (excludes score=1 on either dimension unless `?broaden=1`); applies `filterAndSortByFreshness`; increased limit 300→500; returns `freshness`, `relativeTime`, `lastVerifiedAt` fields
6. **`app/api/freshness/recheck/route.js`** (NEW) — POST `{ jobId, jobLink }`. Auth user, HEAD-check URL (8s timeout), updates `jobs_cache.last_verified_at` + `freshness` via service role, returns `{ freshness, relativeTime, alive }`
7. **`components/FreshnessPulse.js`** (NEW) — Client component. Colored dot (7px) + "verified Xh ago" text. Colors: Fresh=#00C4A0, Aging=#F59E0B, Stale=#9CA3AF, Expired=#EF4444. `compact` prop for dot-only mode
8. **`app/api/cron/adzuna/route.js`** (UPDATED) — Added `last_verified_at: now` and `source_type: 'public_listing'` to upsert rows so re-ingested jobs are stamped as freshly verified
9. **`app/app/page.js`** (UPDATED) — Imports `FreshnessPulse`; adds `recheckingJobs` state + `recheckJob` callback; injects `<FreshnessPulse>` and "Still open?" button in feed card tags row for Aging/Stale jobs

**Verification:**
- ✅ `node lib/freshness.test.js` — 20 PASS, 0 FAIL (G2 invariant proven: DB column overridden at read time)
- ✅ `npm run build` — clean, zero errors (89 pages + all routes)
- ✅ `/api/cron/freshness` in build output
- ✅ `/api/freshness/recheck` in build output

---

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
| G1 — "The marketplace is real, or we say it isn't." | ✅ Live | `source_type` CHECK constraint (DB); employer intake + dashboard; Live Network Meter (honest when zero); deterministic matching; anonymised shortlist; warm-intro flow (`/api/employer/intro`, `/api/candidate/intros`); mutual opt-in gate (PII hidden until both confirm); `intro_receipts` timestamped log; company name + email revealed only on mutual accept | — |
| G2 — "Every job is fresh, or it's flagged." | ✅ Live | `lib/freshness.js` read-time enforcement (G2 invariant); `applyFreshnessToRow` overrides DB column at every read; freshness cron (`/api/cron/freshness`) writes to `jobs_cache` + `employer_roles` daily at 06:00 UTC; Freshness Pulse badge on feed cards; "Still open?" one-tap recheck; hard location/seniority pre-filter in feed | — |
| G3 — "We never forget you." | ✅ Live | `lib/ai-context.js` — bounded context block (MAX_CHARS=2000) from profiles+career_history+wishlists injected into every AI call; `lib/loop-guard.js` — Jaccard loop guard (threshold 0.85) + structured fallback on repetition; Memory Card UI (editable, saves to DB); "pick up where you left off" banner (localStorage + daysSince + newJobsCount); `Profile` tab in dashboard | — |
| G4 — "Tracking isn't the feature. It's the spine." | ✅ Live | Pipeline board = default landing; auto-capture from JD analysis (watchlist); momentum strip; deterministic score in every card; pipeline survives logout/device switch (Supabase-backed) | — |

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
| `STRIPE_SECRET_KEY` | ✅ Set in Vercel Production (confirmed 2026-06-24 via `vercel env ls`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ Set in Vercel Production |
| `STRIPE_WEBHOOK_SECRET` | ✅ Set in Vercel Production |

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

**Stage 15 — Launch readiness: billing, Stripe checkout, open questions**

Stage 14 complete. All five fitness-review fixes are shipped. Product is now rebrand-clean and launch-ready from a copy/legal/style standpoint.

Key remaining pre-launch blockers (from OPEN QUESTIONS):
1. **Stripe KYC** — Stripe account needs identity verification before payouts. Complete before enabling live checkouts.
2. **ICO registration** — Required to process personal data commercially in UK (~£40/yr at ico.org.uk).
3. **Email domain** — `onboarding@resend.dev` is still the FROM address. Need a custom domain (e.g. `support@upstreaminsights.co.uk`) verified with SPF/DKIM in Resend.
4. **Stripe checkout wiring** — The checkout route references `PLANS[plan]` and the old multi-tier keys (standby/lite/byo). With PLANS now simplified to `pro` only, confirm the checkout and settings upgrade flow still work end-to-end, and update settings page plan upgrade buttons to pass `plan: 'pro'`.
5. **G3 loop guard** — `priorResponse` is never sent from client analyse calls; the guard is dead in production. Decide: wire it or remove the Trust Panel claim.
6. **CV generator quality** — Currently runs on Haiku for all tiers. Consider upgrading standard/deep to Sonnet for Pro subscribers (brief: "the CV a senior actually sends").

**Pre-flight checklist:**
- Read: REQUITE-MASTER-BRIEF.md, PROGRESS.md, REQUITE-FITNESS-REVIEW.md
- State in 3 lines: current stage, last done, this session's plan
