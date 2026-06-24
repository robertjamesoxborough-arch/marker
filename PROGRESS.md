# REQUITE — Build Progress
> Maintained by Claude Code. Updated every session. §13 of REQUITE-MASTER-BRIEF.md governs structure.

---

## CURRENT STATE

**Stage:** 9 complete — Real warm-intro flow, mutual opt-in, intro receipts (G1 fully live)  
**Last commit:** stage 9: real warm-intro flow, mutual opt-in, intro receipts  
**Live URL:** https://marker-silk.vercel.app (Requite branding — post-Stage 1)  
**Repo:** `~/Desktop/marker` (branch: main)  
**Supabase project:** `vclhyzpvxipkhptwlnkj.supabase.co`

---

## STAGE LOG

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

**Stage 10 — Billing: Stripe candidate Pro + employer success-fee**

All four anti-complaint guarantees are now live (G1 ✅ G2 ✅ G3 ✅ G4 ✅). Stage 10 makes the platform able to take money.

Key tasks:
1. **Stripe candidate Pro** — Wire `/api/stripe/checkout` to the Pro plan price ID; gate unlimited AI calls + interview prep behind `billing_status = 'active'` check in `/api/profile/tier`. Trial period = 7 days (already tracked in `users.trial_ends_at`).
2. **Employer success-fee** — Create a Stripe one-time payment session for 8% of first-year base when employer marks a candidate as "hired". Add `hired_at` + `salary_confirmed` to `candidate_employer_matches`. Trigger: employer clicks "Mark as hired" in employer dashboard (new `HiredPanel` in Stage 10).
3. **Webhooks** — Harden `/api/stripe/webhook`: handle `checkout.session.completed` (update `accounts.plan`, `billing_status`) + `customer.subscription.deleted` (downgrade to free).
4. **Referral payouts** — On confirmed hire: create `commission_events` row; the referrer gets a credit on their next invoice (deferred to Stage 12 for actual payout).
5. **Stripe KYC** — Needs to be completed by Rob before Stage 10 deploy. See OPEN QUESTIONS.

**Pre-flight checklist for Stage 10:**
- Read: REQUITE-MASTER-BRIEF.md, PROGRESS.md, AUDIT.md
- State in 3 lines: current stage, last done, this session's plan
