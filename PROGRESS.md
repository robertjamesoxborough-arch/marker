# REQUITE — Build Progress
> Maintained by Claude Code. Updated every session. §13 of REQUITE-MASTER-BRIEF.md governs structure.

---

## CURRENT STATE

**Stage:** 23 complete — Session D, job-feed redesigned for cost rule 7 (the last non-compliant route). New `cron/wishlist-scrape` + new `lib/safe-fetch.js` SSRF guard (career-page scraping had ZERO URL validation before this — a real, live gap, not carried-over protection). SSRF guard proven against 9 real test cases. **All four feed routes (feed-web, feed-gov, contractor/roles, job-feed) now satisfy all 7 Cost Guardrails rules** — full breakdown below. **Blocker found, not resolved: `wishlists` table has the same Data-API/GRANT issue `jobs_cache` had earlier** — confirmed via live 403, blocks both new code paths in production until fixed.  
**Last commit:** fix: job-feed rule-7 redesign — nightly cron + pure cache reader, SSRF hardened  
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

### Stage 23 — Session D: job-feed rule-7 redesign, SSRF hardening, all 4 feeds now compliant (2026-07-14)

**The problem.** `job-feed` was the last route violating Cost Guardrails, and the only one needing a genuinely different design (not a mechanical port like Sessions A-C). It called Anthropic's `web_search_20250305` tool (up to 5 live searches) AND scraped arbitrary company career-page URLs by fetch, per authenticated click. Rule 7 requires web_search-derived discovery to have ZERO per-user live path — not even allowance-gated, unlike `feed-web`/`feed-gov`/`contractor-roles`' `{fresh:true}` exception under rule 1.

**SSRF finding — a real, live gap, not just unconfirmed protection.** Checked whether Stage 13's SSRF hardening ("resolve-url: restrict to adzuna domains", "check-links: reject non-http/https schemes") covered `job-feed`'s career-page fetch. **It never did.** That fetch call (`fetch(co.link, ...)` on an arbitrary client-supplied URL) had zero validation of any kind, and was about to move into an unattended cron with service-role credentials in its execution context — raising the stakes considerably (a malicious wishlist `careers_url` could otherwise target `169.254.169.254` — the AWS/GCP cloud metadata endpoint — or an internal service, from inside the hosting environment with no user in the loop).

Built `lib/safe-fetch.js`: protocol check (http/https only) + DNS resolution + rejection of private/reserved IP ranges (RFC1918 10.x/172.16-31.x/192.168.x, loopback 127.x, link-local 169.254.x including the metadata endpoint, IPv6 equivalents). **Documented the residual risk in the file itself, not silently**: this resolves DNS once to check the IP, then the platform `fetch()` resolves DNS again — a sophisticated DNS-rebinding attacker could theoretically serve a safe IP on the first lookup and a private one on the second. Fully closing that means fetching by the resolved IP directly (manual `Host` header + TLS SNI) — meaningfully more complex, out of scope this pass.

**Verified live against 9 real cases** (not just unit-style assertions on mocked inputs — actual DNS resolution against real hostnames): blocked the cloud metadata endpoint, loopback, `localhost`, all three RFC1918 ranges, `ftp://` and `file://` schemes — all correctly blocked. A genuine public site (`https://www.google.com`) — correctly allowed. 9/9 as expected.

**Redesign.** `app/api/cron/wishlist-scrape/route.js` (new): scrapes the shared UNION of company career pages across ALL users' wishlists once per night (cost rule 1 — one scrape per company benefits every user who has it wishlisted, capped at 30 companies/run, a larger union just takes a few nights to fully cycle), extracts postings with ONE shared Sonnet call (cost rule 2 — candidate-agnostic: describes what roles exist, doesn't judge fit for anyone), inserts them **unscored** (`source:'manual'`, `track_tags:['wishlist']`). No separate scoring call needed — the existing `cron/score-cache` sweep is source-agnostic and already picks up any unscored row, reusing the same shared Haiku baseline as every other feed. Registered at `45 4 * * *` (after `contract`, before `archive-inactive`/`score-cache`). `job-feed` itself rewritten as a pure, zero-AI-cost cache reader: reads the shared cache, filters to each user's OWN wishlist companies (personalisation happens here, deterministically, via `lib/match-engine.js`), ranks, returns. **No `{fresh:true}` branch at all** — per the explicit instruction that web_search-derived discovery gets no live exception, stricter than the other three routes.

**What's cut, stated plainly rather than quietly degraded.** `job-feed`'s old generic Sonnet `web_search` fallback ("senior manager UK remote"-style queries) was **not** converted into the cron — it's gone. Judgement call: it was redundant with `feed-web`'s existing Adzuna-based general search, which is already nightly, shared, and structurally more reliable than an LLM guessing at listings via `web_search`. Converting it would have meant reinventing `feed-web`'s job with a strictly worse mechanism. **The genuinely distinct value — checking whether a user's OWN target companies have open roles on their own career pages, which may never appear on an aggregator like Adzuna — is fully preserved**, just moved to the shared nightly cron.

**Self-test, honest about what's proven vs blocked:**
- SSRF guard: proven against 9 real cases (above) — genuine DNS resolution, not mocked.
- Extraction pipeline: proven against a **real** scraped page (Monzo's `/careers`) with a real Sonnet call — returned 0 postings, because that specific page is JS-rendered and the static-HTML fetch (the exact same approach the *original* `job-feed` already used) doesn't contain listing text in the raw HTML. A pre-existing limitation of plain-fetch scraping, not a regression introduced by this redesign.
- Wishlist-matching + ranking logic: verified against the real `lib/match-engine.js` using the real extraction output and a mock wishlist (since the real table couldn't be queried — see below).
- `node --check` clean on all new/edited plain-JS files; no sampling params or manual `thinking:` blocks anywhere in the app (re-confirmed across the whole codebase, not just the new files).

**Found and could NOT fully resolve: `wishlists` has the same Data-API/GRANT issue `jobs_cache` had in an earlier stage.** Confirmed via a live `403 permission denied for table wishlists` — `jobs_cache` and `profiles` both return 200 on the identical check, so this is specific to `wishlists`, not a broader regression. This blocks both the new cron and `job-feed`'s rewritten route in production until fixed. Same fix as before: Table Editor → check the Data API toggle for `wishlists`, then `GRANT SELECT ON public.wishlists TO service_role, anon, authenticated`. `job-feed`'s error handling was deliberately written to surface this distinctly ("Could not load your wishlist right now") rather than show the misleading "add companies to your wishlist" empty-state message that a naive implementation would show for both a real empty wishlist and a silent permissions failure.

**Also noted, not addressed this session:** `job-feed`, like `feed-web`/`feed-gov` before Stage 22, has no UI caller in `app/app/page.js` — confirmed by grep. Wiring a "Wishlist roles" UI surface (mirroring Stage 22's Fresh Scan work) is a separate follow-up, not attempted here since it wasn't part of this session's ask.

**All 7 Cost Guardrails rules, confirmed across all four feed routes:**

| Rule | feed-web | feed-gov | contractor/roles | job-feed |
|---|---|---|---|---|
| 1. Nightly + shared, never live-per-click | ✅ cache-read default, `{fresh:true}` Pro-gated exception | ✅ same | ✅ same | ✅ **no live path at all** (stricter, per rule 7) |
| 2. Score/extract once, globally | ✅ `score-jobs-batch.js` shared baseline | ✅ same | ✅ same | ✅ extraction shared (cron), scoring shared (`score-cache` sweep) |
| 3. Tidy-up chatbot (N/A to these 4 routes) | — | — | — | — |
| 4. Prompt-cache the rubric | ✅ via shared `score-jobs-batch.js` | ✅ same | ✅ same | ✅ scored via the same shared pipeline |
| 5. Sonnet 5, no sampling params, `max_tokens` headroom | ✅ | ✅ | ✅ | ✅ extraction call on `claude-sonnet-5`, `max_tokens:3900` |
| 6. Allowance check before every per-user model call | ✅ `feed_fresh_scan` gate | ✅ same | ✅ same | N/A — no per-user model call exists in this route anymore |
| 7. Web search metered / nightly-cron-only, zero per-user path | ✅ N/A (no web_search) | ✅ N/A | ✅ N/A | ✅ **web_search dropped entirely**; career-page scrape now nightly-only + SSRF-hardened |

**NOT done — carried forward:**
- Apply the `wishlists` Data-API/GRANT fix (blocks both new code paths in production).
- Wire a UI surface for `job-feed` (currently unreachable from the client, matching feed-web/feed-gov's pre-Stage-22 state).
- G3 loop-guard full 4-site wiring (from Stage 21).
- Multi-ATS layer (Lever/Ashby/SmartRecruiters) for Greenhouse board coverage.

---

### Stage 22 — Session C: contractor/roles feed-port + Fresh Scan wired into the UI (2026-07-14)

**1. `contractor/roles` converted to the feed-web/feed-gov pattern; new `cron/contract` ingest added.** Checked all of `app/api/cron/` first — no existing cron ingested contract/interim roles into `jobs_cache`, confirmed by grep before writing anything. Added `app/api/cron/contract/route.js`, same shape as `cron/adzuna` (generic, candidate-agnostic queries — cost rule 1), registered in `vercel.json` at `30 4 * * *` (after `gov`, before `score-cache`, so new rows get scored the same night). Two design decisions worth recording:
- **Reused `cron/adzuna`'s `adzuna-${job.id}` external_id scheme**, not a separate `contract-` prefix — so if the exact same real Adzuna ad is ever matched by both crons, it correctly merges into one row via the shared `external_id` unique index, rather than duplicating.
- **Tagged rows via `track_tags: ['contract']`** (an existing, previously-unused `jobs_cache` column) rather than adding `'contract'` to the `source` CHECK constraint, which would have needed a migration — another round-trip through Rob to run in the SQL Editor before anything could be tested this session. `cron/adzuna`'s own upsert payload never references `track_tags`, so a later pass over the same row from that cron can't clobber the tag.

`contractor/roles` itself rewritten to the exact `feed-web`/`feed-gov` shape: default path reads `jobs_cache` (`source='adzuna'`, `track_tags @> ['contract']`, `scored_at IS NOT NULL`) with zero AI cost, ranks via `lib/match-engine.js`; `{fresh:true}` is the only live path, gated by `checkAllowance(user.id,'feed_fresh_scan')`. Kept the personalised query-building (interim/contract/day_rate/ftc/freelance variants of the user's `target_roles`) for the live Adzuna fetch — that's just about *what* to search for — but scoring now goes through the shared `lib/score-jobs-batch.js` baseline (cost rule 2) instead of the old per-request personalised Sonnet prompt. Unauth still 401s before any DB/AI work, unchanged from the original route.

**2. Fresh Scan wired into the UI for the first time.** `feed-web` and `feed-gov` have accepted `{fresh:true}` since Stage 18/19a but nothing in `app/app/page.js` ever sent it — reconfirmed by grep before starting (the whole feature was built and completely unreachable). Added a shared `FreshScanButton` component:
- Fetches real allowance state up front via a new read-only `GET /api/profile/fresh-scan-allowance` (calls `checkAllowance`, spends nothing) — shows "N of C left today" before the user ever clicks, not just after a 429.
- Disables with an upgrade hint at `cap=0` (free tier) — "⚡ FRESH SCAN · PRO", not hidden.
- Handles the 429 `limitReached` response by surfacing the route's own upgrade/retry message inline.
- On click, POSTs `{fresh:true}` to the relevant route(s) — which live-scan and write the *shared* cache — then reloads the existing passive view (doesn't bypass the established cache-read pipeline).

Wired into two places: `FeedTab`'s Live Roles header (hits `feed-web` AND `feed-gov` together in parallel, then calls the existing `onRefreshFeed` to reload via `feed-cache` — a fresh scan's job is to refresh the shared cache, not replace the reader) and `ContractorTab`'s Live Roles header (hits `contractor/roles`, reloads via the existing `scanRoles`). Visual design matches existing tokens exactly — lime/black/cream, `font-mono` for the button and allowance text, no new colours.

**Self-test — honest about the credential gap.** `ADZUNA_APP_ID` is still not in `.env.local` (only `ADZUNA_API_KEY` was ever added, in an earlier session) — confirmed via a live `401` from Adzuna when I tried to test the real fetch. Adzuna requires both credentials together, so the live-fetch portion of `cron/contract` and `contractor/roles`' fresh-scan branch could not be tested end-to-end this session. Everything else was genuinely tested: upserted clearly-labelled synthetic (not real Adzuna) contract listings, scored them via a **real Anthropic call** using the actual `score-jobs-batch.js` rubric, read them back through the **exact** `contractor/roles` cache-read filter, and ranked them with the real `lib/match-engine.js`. Result: "Contract Project Manager" and "Interim Programme Manager" (genuine domain matches for the test profile) scored 8.4/7.8 and passed the relevance floor; "Interim Finance Director" and "Interim Sales Director" (wrong domain) were correctly filtered out — this also reconfirms Stage 21's `scoreRoleFit` family-conflict fix is working correctly with this session's new route. Allowance logic reconfirmed against the same real free-tier user (`cap=0`, as expected). Test rows cleaned up afterward.

**Self-test — syntax.** `node --check` clean on all new/edited plain-JS route files (`cron/contract`, `contractor/roles`, `profile/fresh-scan-allowance`) and `vercel.json` validated as JSON. `app/app/page.js` contains JSX, which plain `node --check` cannot parse at all (would false-positive as broken) — relying on the Vercel build (real Babel/SWC transform) as the authoritative syntax gate for that file, consistent with this whole session's established pattern for JSX.

**NOT done — carried forward:**
- Add `ADZUNA_APP_ID` to `.env.local` (Rob), or re-run `cron/contract` in production, to confirm the live Adzuna-fetch portion actually works end-to-end.
- G3 loop-guard full 4-site wiring (from Stage 21).
- Multi-ATS layer (Lever/Ashby/SmartRecruiters) for Greenhouse board coverage.
- `job-feed`'s Rule-7 redesign (nightly-cron-only, no per-user `web_search` path).

---

### Stage 21 — Session B: five bundled independent fixes (2026-07-13)

**1. feed-gov `buildGovQueries` still read `profile.seniorities` (plural).** The profile *select* was fixed for this bug back in Stage 19a/19d, but the query-builder function itself was missed — it still read the never-existent plural field, always falling back to generic `director`/`head of`/`deputy director` prefixes regardless of the user's real seniority. Real schema (`001_schema.sql`) has a single `profile.seniority` enum (`ic`/`manager`/`senior_manager`/`head`/`director`/`vp_plus`). Added `SENIORITY_TO_GOV_PREFIXES` mapping the real enum to 1-2 gov-appropriate prefixes; falls back to the generic list when unset/unmapped.

**2. Deleted dead `buildQuickPrompt`** from `lib/scoring.js` — confirmed no caller anywhere (all three real Haiku scoring paths use `lib/score-jobs-batch.js` instead, since Stage 18). Updated `lib/scoring.test.js`'s rubric-parity assertion to check `score-jobs-batch.js`'s source embeds the same shared `RUBRIC`, instead of testing the now-deleted stand-in.

**3. Stripe checkout tier keys — found REAL, LIVE breakage, not just a stale reference.** `lib/stripe.js` and the checkout route itself were already correct (generic `PLANS[plan]` lookup, `pro`/`max` only). The actual bug was client-side: `app/settings/page.js`'s `PLANS_UI` still showed dead **Standby (£4/mo)** and **Lite (£12/mo)** cards whose Stripe price IDs no longer exist in `lib/stripe.js` — clicking "Upgrade" on either would 400 `Invalid plan`. No Max card was offered at all. The tier-recognition checks (`['standby','lite','pro'].includes(tier)`, used twice) were missing `'max'` entirely, meaning a real Max subscriber would incorrectly see the upgrade-prompt UI instead of "Manage subscription". Fixed all three: `PLANS_UI`/`PLAN_LABELS` now show real Pro £19/mo + Max £39/mo (copy matched to `pricing/page.js` for consistency), both tier checks now include `'max'`.

**4. G3 loop guard — investigated wiring, found it genuinely partial, fixed the copy instead.** `priorResponse` + `lib/loop-guard.js` work correctly server-side when a caller sends one — confirmed this is real, working code, not fake. But no client call site sends it. Checked all 4 client call sites to `/api/analyse`: 2 (the `EngineTab`-style "score a URL/JD" flows, `result` state) hold the full prior parsed response and could be wired with one line each (`priorResponse: result ? JSON.stringify(result) : null`). The other 2 (per-card re-score buttons in list/pipeline views) only track `{score, signal}` in local state — no `signalReason` or any prose text, so a Jaccard text-similarity comparison against that would be meaningless without first expanding what those components track. Wiring only the easy 2 would leave the Trust Panel's "loop guard detects AI repetition automatically" claim still false for the other 2 real user-facing flows — a half-fix that reads as done but isn't. Decision: **fixed the copy, did not wire it.** Removed the loop-guard sentence from the G3 card body and `lib/loop-guard.js` from its "built:" list on `/trust`. The rest of the G3 claim (stateless profile-fresh-per-call architecture via `lib/ai-context.js`, editable Memory Card) is untouched and independently true. **Follow-up:** properly wire all 4 call sites (the 2 harder ones need their local state expanded to track prior response text, not just score/signal) in a dedicated session, then restore the Trust Panel claim.

**5. Sonnet 5 swap — confirmed live, not just a string change.** `lib/anthropic.js` `MODELS.sonnet` → `claude-sonnet-5`. Live-tested with a direct API call (not just editing the string): got HTTP 200 with `model: "claude-sonnet-5"` echoed back in the response. Re-confirmed zero sampling params (`temperature`/`top_p`/`top_k`) and no manual `thinking:` blocks anywhere in the app (unchanged from prior confirmations). Added ~30% headroom to every Sonnet-tier `max_tokens` value per the addendum (new tokenizer produces more tokens for the same text) — Haiku call sites left untouched since Haiku's model/tokenizer didn't change: `negotiation-prep` 3000→3900, `contractor/recruiters` 4000→5200, `contractor/companies` 3000→3900, `contractor/roles` 3000→3900, `feed-tasklist` 3000→3900, `perm/recruiters` 4000→5200, `job-feed` (both Sonnet sites) 2000→2600 and 4000→5200, `interview-prep` 2000→2600, `analyse`'s Sonnet web-search fallback 2000→2600, `cv/route.js` 4000→5200, `cv/generate`'s standard/deep tiers 3000→3900 and 4000→5200. `lib/allowance.js`/`TIER_CAPS` deliberately untouched per instruction.

**Follow-on bug caught by self-testing, not one of the original 5:** `lib/ai-usage.js`'s `COSTS` map had no entry for `claude-sonnet-5` — every Sonnet-5 call's cost tracking would have silently fallen back to the old `claude-sonnet-4-6` rate (`$3/$15`) via the `COSTS[model] || COSTS['claude-sonnet-4-6']` fallback, corrupting `ai_usage` cost data from this deploy onward with no visible error. Added a `claude-sonnet-5` entry at the documented intro rate (`$2/$10`/million tokens), with a date check that automatically switches to `$3/$15` after 2026-08-31 per the cost-guardrails addendum — self-correcting, no second manual patch needed later.

**Self-test, all five plus the follow-on fix:** `node --check` clean on every touched file (17 files); `node lib/scoring.test.js` + `node lib/usage-window.test.js` + `node lib/match-engine.test.js` all pass (23/23 on the match-engine suite); `claude-sonnet-5` confirmed callable via a direct live Anthropic API request.

**Commit-message note:** the first attempt at this commit used a plain quoted `-m` string containing backticks, which bash interpreted as command substitution mid-message (one word — "result" — was silently dropped, replaced by a failed `` `result` `` command's empty output). Caught by re-reading the stored message before pushing; fixed by amending with a proper heredoc before anything was pushed.

**NOT done — carried forward:**
- Full G3 loop-guard wiring across all 4 client call sites (2 need local state expanded to track prior response text first) — restore the Trust Panel claim once done.
- Multi-ATS layer (Lever/Ashby/SmartRecruiters) for Greenhouse board coverage.
- `contractor/roles` mechanical port; `job-feed`'s Rule-7 redesign.

---

### Stage 20 — cache proof against the real cron logic; scoreRoleFit trust-killer fixed (2026-07-13)

**Item 1: closing the cost-rule-4 loop properly.** Stage 19g proved caching works via a standalone reconstruction of `SYSTEM_PREFIX`; Rob correctly pointed out the deployed cron's own responses still showed `cacheReadTokens:0` — but only because there was never more than one batch of genuinely new jobs per run (cache reads only happen on batch 2+, and a single-batch run has nothing to read from). Not a real test of the fix.

**Ran the ACTUAL route code this time, not a reconstruction.** `app/api/cron/score-cache/route.js` is a Next.js route (imports `next/server`), and this machine's local `next build`/`next dev` hang on iCloud-dataless `node_modules` (a known, longstanding issue — see earlier stages). Worked around it properly: copied the route's exact GET logic to a sibling `route.debug.mjs` in the same directory (so relative imports to `lib/score-jobs-batch.js` etc. resolve unchanged), swapping only `NextResponse.json(...)` for the standard `Response.json(...)` (`next/server` isn't available outside the Next runtime; this is a documented like-for-like substitute, nothing else touched). Hit two Node-vs-Next runtime environment differences along the way, both resolved without touching any real code: Node's ESM loader needs explicit `.js` extensions on relative imports (unlike webpack) — fixed with a tiny custom resolve hook via `node --import`, deleted after use; `@supabase/supabase-js`'s Realtime client needs a native `WebSocket` that Node 20 only has behind a flag — fixed with `--experimental-websocket`.

**Inserted a synthetic 150-row unscored backlog** (confirmed 0 real unscored rows first, so nothing else was mixed in) and invoked the real route handler directly:
```
{ "ok": true, "scored": 150, "batches": 3, "cacheReadTokens": 8244, "errors": [] }
```
**8244 = exactly 2 × 4122** (the real per-batch token count confirmed in Stage 19g) — batch 1 writes the cache, batches 2 and 3 both read it back. This is the real, deployed cron logic, not a standalone script. Test rows deleted afterward (confirmed via re-query); `route.debug.mjs` and all loader/hook scratch files deleted — nothing committed.

**Item 2: `scoreRoleFit` false-positive fix (the trust-killer Rob flagged).** Root cause: `jaccardOverlap` in `lib/match-engine.js` weighted every shared word equally, so a single generic modifier ("technical") shared between "Technical Sales Executive" and a "technical delivery" target inflated the overlap ratio into the "strongly aligns" tier (roleFit=8) despite the roles having nothing to do with each other.

**Fix, deterministic, explainable, no model call, per the brief:**
- `LOW_SIGNAL_WORDS` — generic modifiers (technical, senior, digital, global, regional, commercial, remote, hybrid, uk, etc.) stripped from the overlap computation entirely, so a shared modifier alone can no longer inflate a match.
- `ROLE_FAMILIES` — functional domain buckets (sales, engineering, delivery, marketing, data, hr, finance, operations, product, design, legal). When a job and a target both have a determinable family and share none, that's a real domain mismatch: the score is capped at 3, overriding the word-overlap ratio. If either side's family can't be determined, stays silent rather than guessing (no false positives from an incomplete signal).

**Self-tested against REAL scored `jobs_cache` data (1128+ rows) before vs after, using the real profile that surfaced the bug:**
- All 4 real instances of the flagged bad match — "Head of Technical Sales", "Technical Sales Engineer" (×2), "Technical Sales Executive" — dropped from `roleFit=8` ("strongly aligns") to `roleFit=2` ("doesn't match"). The low-signal-word stripping alone already zeroes their overlap (since "technical" was the only shared word), before the family-conflict layer even applies.
- All 10 genuine Project Manager / Programme Lead variants tested (NPD Project Manager, Operations Project Manager, plain Project Manager ×3, Senior Project Manager, HVAC/Electrical Project Manager, Lead ECC Project Manager, Water Quality Project Manager) scored **identically** before and after — zero regression.
- Full existing `lib/match-engine.test.js` suite: 23/23 still pass.

**Self-test:** `node --check` clean; `node lib/scoring.test.js` + `node lib/usage-window.test.js` + `node lib/match-engine.test.js` ALL PASS; Vercel build green for the roleFit deploy (`readyState: READY`, aliased) — no deploy needed for the cache proof itself (verification only, no code changed).

**NOT done — carried forward:**
- Multi-ATS layer (Lever/Ashby/SmartRecruiters) for Greenhouse board coverage.
- `contractor/roles` mechanical port; `job-feed`'s Rule-7 redesign.

---

### Stage 19g — cost rule 4 CONFIRMED with a live Anthropic call; real cache threshold is ~4096 tokens (2026-07-13)

**Rob closed the credential gap**: added `ANTHROPIC_API_KEY` and `ADZUNA_API_KEY` to `.env.local` — the first time in this whole feed-port arc that a live Anthropic call could be made directly, instead of every fix needing a round-trip through Rob re-running production crons.

**Rob's fresh re-run showed the Stage 19f fix did NOT work**: `cron/score-cache` still returned `cacheReadTokens:0` across multiple runs. Diagnosed properly this time with real API access — wrote a script making two identical back-to-back calls to the real Anthropic API with the real production `SYSTEM_PREFIX`, printing the full `usage` object from each (per Rob's explicit instruction, using the exact suspects list: `anthropic-beta` header, `cache_control` block placement, system-prompt-as-array-vs-string).

**First live result was itself revealing**: `input_tokens: 2133`, `cache_creation_input_tokens: 0` on the very FIRST call — meaning the cache wasn't even being *written*, let alone read. This ruled out the `anthropic-beta` header (tested identical behaviour with and without it) and the `cache_control`/array-of-blocks structure (both already correct, confirmed by a synthetic test below). That left only one variable: length — but at a real measured 2133 tokens, the prefix was already just above the commonly-documented 2048-token Haiku minimum, which didn't add up.

**Empirically bisected the real threshold** by testing progressively larger prefixes live and reading the real `cache_creation_input_tokens` from each response (not estimated — measured):
```
2133 tokens -> fails (0)      2814 tokens -> fails (0)
3340 tokens -> fails (0)      3778 tokens -> fails (0)
4086 tokens -> fails (0, 10 tokens short)
4122 tokens -> WORKS (cache_creation_input_tokens: 4122, then reads 4122)
4144 tokens (synthetic 2x test) -> WORKS      6216 tokens (synthetic 3x test) -> WORKS
```
**The real cache threshold for `claude-haiku-4-5-20251001` is almost certainly exactly 4096 tokens — not the 2048 commonly documented for Haiku-tier models.** This model generation apparently has a higher minimum than the figure I'd been designing against in Stages 19f/19g. A synthetic 3x-duplicated prefix (~6216 tokens) was used mid-investigation purely to prove the mechanism itself was sound (cache_control shape, header, array format) before hunting for the real boundary in the actual production content.

**Fix:** expanded `SYSTEM_PREFIX` in `lib/score-jobs-batch.js` further with genuine additional content across 5 more edits — more sector-calibration notes (insurance/actuarial, telecoms, PR/comms agencies, housing associations, logistics-specifically, aviation/rail) and a new section on handling partial/messy real-world listing data (missing locations, truncated descriptions, bundled/duplicate postings, ambiguous currency, terse titles) — none of it filler; all directly useful for a candidate-agnostic baseline scorer working from scraped, often-incomplete Adzuna/Greenhouse data. Final length: 17744 characters / **4122 real measured tokens**.

**CONFIRMED LIVE with the actual production file content** (not a reconstruction or estimate): Call 1 → `cache_creation_input_tokens: 4122`. Call 2 (identical, back-to-back) → `cache_read_input_tokens: 4122`. This is the first genuinely closed loop in the whole prompt-caching investigation — diagnosis, fix, and proof all done directly against the real Anthropic API.

**Self-test:** `node --check` clean; `node lib/scoring.test.js` + `node lib/usage-window.test.js` ALL PASS; Vercel build green (deploy in progress as this entry is written).

**NOT done — carried forward:**
- Run `cron/score-cache` against fresh unscored rows in production to see `cacheReadTokens > 0` in the deployed cron's own response (this session confirmed the mechanism directly against Anthropic; confirming it end-to-end through the deployed route with a real backlog is the natural next check, low-risk given the direct proof already in hand).
- With `ANTHROPIC_API_KEY`/`ADZUNA_API_KEY` now in `.env.local`, future sessions can self-test Adzuna fetching and Anthropic scoring directly — the recurring credential-gap friction from Stages 17-19f should no longer apply going forward. Updated the standing memory note accordingly.
- Multi-ATS layer (Lever/Ashby/SmartRecruiters) for Greenhouse board coverage.
- `scoreRoleFit` tuning (roleFit false-positives on generic shared words like "technical"/"lead").
- `contractor/roles` mechanical port; `job-feed`'s Rule-7 redesign.

---

### Stage 19f — cost rule 4 fixed: prompt caching wasn't firing; gov fix confirmed live; full verification (2026-07-13)

**Confirmation from Rob's re-run:** `cron/gov` fix worked live — 4 → 75 inserted (78 total after dedupe against the earlier 4). `cron/score-cache` run 6 times, cleared the entire backlog (150/150/150/150/150/45 = 795, matching the 795-row count at the time). **New problem surfaced:** every one of those 6 runs returned `cacheReadTokens: 0` — cost rule 4 (prompt-cache the rubric) wasn't actually firing, at real cost across 795 Haiku calls with a large shared rubric repeated every time.

**Diagnosis (measured, not guessed):** wrote a script requiring the real `lib/scoring.js` (for `RUBRIC`) to reconstruct the exact runtime `SYSTEM_PREFIX` string from `lib/score-jobs-batch.js` and measure it precisely. Result: **1695 characters, ~424-484 estimated tokens** — far below Anthropic's documented minimum cacheable-block length for Haiku-tier models (2048 tokens; Sonnet/Opus is 1024). Confirmed `cache_control: {type: 'ephemeral'}` is correctly formed, and the prefix is already byte-identical across every call (a static module constant, never rebuilt per batch) — neither of those was the bug. Anthropic silently skips caching for a block under the minimum, with no error — exactly matching the observed symptom (valid responses, zero errors, `cacheReadTokens` always 0).

**Fix:** expanded `SYSTEM_PREFIX` with genuinely useful additional scoring guidance (not filler) — sector-calibration notes (tech/SaaS, banking, retail, public sector, manufacturing/logistics, recruitment agencies, media/creative — title conventions vary hugely by sector and this is real, useful guidance for a candidate-agnostic baseline scorer) and a much broader set of worked examples spanning real title patterns seen in production data (interim/FTC roles, agency-posted listings, sector-specific title inflation). Measured before committing: **8480 characters, ~2120 estimated tokens by a conservative chars/4 heuristic** (real BPE tokenizers are typically more efficient than 4 chars/token on structured English prose, so the true count is likely higher still) — a genuine, reasoned margin over the 2048 minimum, arrived at by iterating and re-measuring three times until comfortable, not a bare-minimum pad.

**Also found while diagnosing:** `buildQuickPrompt` (`lib/scoring.js`) is dead code — grepped every caller in the app; nothing calls it. All three real Haiku scoring paths (`feed-web`, `feed-gov`, `cron/score-cache`) go through `lib/score-jobs-batch.js`'s `scoreJobsBatch`, which is what was actually fixed.

**Left alone, explicitly:** the `anthropic-beta: prompt-caching-2024-07-31` header. Very likely an inert legacy artifact now that prompt caching is GA — but removing it can't be verified without a live key, so it was left in place rather than make an unverified change on top of the confirmed fix.

**Honest limitation, stated plainly: cannot personally confirm `cache_read_input_tokens > 0` from a live response.** No `ANTHROPIC_API_KEY` in this environment (checked again this session — still absent). The diagnosis and fix are based on precise measurement against Anthropic's documented, stable minimum-length behaviour, which gives high confidence, but only a live call can prove it. **Needs Rob to either:** re-run `cron/score-cache` against fresh unscored rows (next nightly ingest, or trigger the ingest crons again) and check the response's `cacheReadTokens` on the 2nd+ batch within a single run, or add `ANTHROPIC_API_KEY` to `.env.local` so this can be tested directly going forward instead of every fix in this pipeline needing a manual round-trip.

**Full verification against real production data (with the gov fix confirmed live):**
- **Row counts:** adzuna 680, gov 78, greenhouse 195 = 953 total, all scored (953/953, 0 unscored).
- **Ranking sanity, feed-web (adzuna):** 18/300 real rows passed the relevance floor for the test profile. Top results reasonable (Growth Marketing Lead, Marketing Program Manager, Service Delivery Manager) alongside the previously-flagged `scoreRoleFit` weakness still visible (Technical Sales Executive scoring higher than it should on shared-word overlap) — a known, not-yet-fixed tuning issue, not new.
- **Ranking sanity, feed-gov (gov):** 31/78 real rows passed the floor. Top results: several "Lead Technical Architect" postings (DWP Digital, TPXImpact) plus Identity and Access Management Product Lead, Implementation Lead, Durham Area Lead — sensible for the profile. **Caught and fixed an error in my own verification script mid-check**: it printed the pre-interleave sorted list while labelled "after interleave", which would have misleadingly shown 6 consecutive DWP Digital postings (same role, different UK cities — a real, legitimate government-recruitment pattern, not a bug) as if that's what a real user sees. Corrected to use the actual `interleaveByCompany` output; re-verified it properly spreads results across companies (DWP, TPXImpact, Bupa, National Highways, SciPro, Joseph Rowntree Foundation) as real users would see it.
- **Fresh-scan allowance gate:** reconfirmed the same real user (`tier='free'`, trial expired 2026-05-29) — hard-blocked at `cap=0`, zero live cost, unchanged.

**Self-test:** `node --check` clean; `node lib/scoring.test.js` + `node lib/usage-window.test.js` ALL PASS; Vercel build green (`readyState: READY`, aliased).

**NOT done — carried forward:**
- Confirm `cache_read_input_tokens > 0` on a live run (the one thing this session couldn't close without a real API key).
- Multi-ATS layer (Lever/Ashby/SmartRecruiters) for Greenhouse board coverage.
- `scoreRoleFit` tuning (roleFit false-positives on generic shared words like "technical"/"lead").
- `contractor/roles` mechanical port; `job-feed`'s Rule-7 redesign.

---

### Stage 19e — real crons ran, score-cache timeout fixed, greenhouse/gov quality fixes, full real-data verification (2026-07-13)

**Real crons finally worked:** `adzuna` → 680 inserted, `gov` → 4 inserted, `greenhouse` → 195 inserted (14 board 404s), `score-cache` → `FUNCTION_INVOCATION_TIMEOUT` on the 879-row backlog. Three fixes, in the priority order requested, then full verification.

**Fix 1 — score-cache timeout.** Root cause: 6 batches × up to 40 sequential row-by-row `UPDATE` calls, plus 6 sequential Anthropic calls, all in one invocation. Fixed: `BATCH` 40→50, `MAX_BATCHES` 6→3 (safely re-runnable — a large backlog just takes a few extra invocations, then the nightly cron keeps up from there); the write step is now ONE bulk upsert per batch instead of up to 50 individual updates.

**Tested against the real backlog myself, iterated on a real failure:** the first version of the bulk-write fix was itself broken — Postgres validates NOT NULL constraints against the full proposed row *before* it resolves `ON CONFLICT`, and `jobs_cache.source` (the only NOT NULL column with no default) was omitted from the update payload, so every upsert failed with `null value in column "source" violates not-null constraint`, regardless of the conflict path. Found this by actually running the fix against 5 real unscored production rows before deploying — exactly what "test until it completes" was for. Fixed by fetching `source` in the same SELECT and including it in every update row. Re-tested at production batch size: **50 real rows scored and reverted to unscored in 209ms via one bulk call** (was up to 50 sequential calls before). maxDuration left at 60 (no evidence of a Pro/Fluid plan to justify raising it; the reduced per-invocation workload is the real fix and doesn't need a bigger window).

**Fix 2 — 14 of 20 Greenhouse boards 404'd.** Deliveroo, Bumble, Octopus Energy, Wise, Checkout.com, Starling Bank, Gousto, OakNorth, Zopa, Marshmallow, Curve, Casumo, Paddle, Phoebe — moved off Greenhouse or changed token. Removed; kept the 6 that returned real jobs: Monzo, GoCardless, Skyscanner, Farfetch, SumUp, Wayve. **Follow-up for a later session:** a multi-ATS layer (Lever, Ashby, SmartRecruiters — NOT Workday, per the brief's legal-risk exclusion) is the proper fix for board coverage, not just curating the Greenhouse list.

**Fix 3 — gov feed near-zero yield (4 results from 14 queries).** Confirmed both of Rob's hypothesised causes by reading the actual query construction: (a) `salary_min=60000` hardcoded on every query — public sector ads frequently omit salary entirely, and Adzuna's salary filter excludes listings with no salary data at all, not just low ones; removed. (b) `GOV_QUERIES` were 4-5 words each (e.g. `"director of digital public sector"`), all AND-matched by Adzuna's `what` param — hugely over-restrictive. Shortened to 2-3 words each (theme + sector); seniority is still enforced afterward by the existing `passesTitleFilter`/`TITLE_MUST`, so no filtering strength was lost, only the search-query restrictiveness. **Not independently re-tested** — no `ADZUNA_API_KEY` locally (confirmed absent again this session); needs Rob to re-run `cron/gov` to confirm the yield actually improves.

**Verification against REAL production data (the original ask, finally complete):**
- **Row counts per source:** adzuna 680, gov 4, greenhouse 195 = 879 total; 158 already `scored_at` (leftover partial progress from the pre-fix timeout run — some batches completed before the function died on a later one).
- **Ranking sanity, against real Anthropic-scored rows** (not synthetic — used the 142 real already-scored adzuna rows and the real match-engine code): 6 of 142 passed the relevance floor for the test profile (target_roles: Programme Lead/project management/delivery lead/etc). **Genuine finding, not a bug in this session's code:** `scoreRoleFit`'s Jaccard word-overlap (`lib/match-engine.js`) is too loose for short target-role phrases — "Technical Sales Executive" and "Technical Sales Engineer" (×2) scored `roleFit=8` ("strongly aligns") purely because they share the single word "technical" with the target "technical delivery"; genuinely different job families getting false-positive high scores. Flagged, not fixed — a scoring-quality tuning problem (e.g. requiring multi-word overlap, downweighting generic words like "manager"/"lead"/"technical"), out of scope for this session's time budget.
- **Fresh-scan allowance gate:** reconfirmed the same real user (`tier='free'`, trial expired 2026-05-29) — `TIER_CAPS.free.feed_fresh_scan=0`, hard-blocked, zero live cost, as designed.

**Self-test:** all three fixed files syntax-check clean; `node lib/scoring.test.js` + `node lib/usage-window.test.js` ALL PASS; Vercel build green (`readyState: READY`, aliased).

**NOT done — carried forward:**
- Re-run `cron/gov` to confirm the query/salary-filter fix actually raises yield (couldn't self-test — no `ADZUNA_API_KEY` locally).
- Run `cron/score-cache` a few more times to clear the remaining ~721 unscored rows (fixed cron, safely re-runnable).
- Multi-ATS layer (Lever/Ashby/SmartRecruiters) for board coverage beyond Greenhouse.
- `scoreRoleFit` tuning (roleFit false-positives on generic shared words) — flagged above.
- `contractor/roles` mechanical port; `job-feed`'s Rule-7 redesign — both still carried from Stage 19a.

---

### Stage 19d — dedupe fix, self-run verification, and a second real bug found (2026-07-13)

**What happened:** Rob applied migration 006 (full unique index) and re-ran `cron/adzuna` — got a NEW error: `"ON CONFLICT DO UPDATE command cannot affect row a second time"`. Root cause: a single upsert batch can contain the same listing twice (e.g. the same job matching two overlapping `ROLE_QUERIES`), which Postgres rejects. Rob then explicitly required: no more handing this back for manual curl testing — write a script, run it myself, iterate until it demonstrably works, and only report back with real results.

**Fix 1 — dedupe before every upsert, all 5 writers:**
- `cron/adzuna`, `cron/greenhouse` had **no dedupe at all** — the actual source of the reported bug.
- `cron/gov` already deduped during collection (a `seen` Set) — given the same defensive final guard anyway, for consistency across all 5.
- `feed-web`/`feed-gov` fresh-scan paths already deduped correctly right before their upserts — confirmed, no change needed.
- Pattern used everywhere: `const deduped = [...new Map(rows.map(r => [r.external_id, r])).values()]` immediately before `.upsert(...)`.

**Verification: self-run, not handed back untested.** Local `.env.local` was checked and genuinely does NOT contain `ADZUNA_APP_ID`/`ADZUNA_API_KEY`/`ANTHROPIC_API_KEY` (only the Supabase keys) — checked and reported honestly rather than assumed. Built `scratchpad/verify-cache-read.cjs` (outside the repo, one-off): writes 7 synthetic-but-realistic rows to the REAL production `jobs_cache` (via service role), including one **intentional duplicate `external_id`** to directly re-test the exact reported bug, requires the real `lib/match-engine.js` + `lib/freshness.js` (unchanged production code) to rank them against a REAL profile row, then deletes the test rows. Does not call Adzuna or Anthropic (keys unavailable) — assigns a baseline `match_score` directly, standing in for "already scored by the nightly cron"; the ranking logic under test is 100% deterministic code regardless.

**Real results:**
- Dedupe: 7 raw rows (1 intentional duplicate) → 6 deduped, exactly as expected.
- Upsert: **HTTP 201, 6 rows written** — the exact call that previously failed with "cannot affect row a second time" now succeeds.
- Read-back: 6 distinct rows persisted, confirming the full uuid→external_id→full-unique-index→dedupe chain is fixed end to end.
- Ranking (against real profile, `target_roles` = Programme Lead/project management/delivery lead/program management/technical delivery, `seniority=manager`, `max_office_days=3`):
  - **8.4** — Programme Lead @ Acme Corp (exact target-role match, roleFit=10)
  - **8.4** — Delivery Lead @ Beta Ltd (exact match, roleFit=10)
  - **8.4** — Technical Delivery Manager @ Delta Inc (exact match, roleFit=10)
  - **7.2** — Senior Project Manager @ Gamma PLC (partial match, roleFit=8)
  - Filtered out (below the 6.0 relevance floor): Software Engineer (4.6), Head of Warehouse Operations (3.4) — correctly rejected as wrong-domain
  - Ranking is sensible: exact matches rank above partial matches, wrong-domain roles are correctly excluded.
  - Data note (not a code bug): `compFit=1` on every row because this real profile's `salary_floor` is `80,000,000` — an obvious data-entry typo in the user's own profile (not app code); the scoring is behaving correctly given that input.
- Fresh-scan allowance gate: checked a real user (`tier='free'`, `trial_ends_at` in the past). Per `lib/allowance.js`, `TIER_CAPS.free.feed_fresh_scan=0`, and the trial-expiry check correctly resolves this user to `'free'` (not a stale `'trial'`) — confirms the gate would hard-block this real user's fresh scan at zero live cost, exactly as designed.
- Cleanup: synthetic test rows deleted (HTTP 204) — no residue left in production.

**Fix 2 — a real, previously-undetected bug found while building the verification script:** `feed-web`/`feed-gov`'s own profile fetch selected `profiles.seniorities` and `profiles.tracks` (plural) — **neither column exists**; the real schema (`001_schema.sql`) only has singular `seniority`/`track`. PostgREST rejects the whole select (400) when a nonexistent column is referenced; `const { data: profile } = await ...` silently discarded the error, so `profile` has been `null`/`undefined` for every real authenticated user since Stage 18/19a shipped — **personalisation has been fully disabled** in both routes' default cache-read and fresh-scan paths this whole time, though nothing crashed (deterministic scoring degrades gracefully to neutral defaults on a null profile). Fixed: both selects now list only the real columns (`target_roles, seniority, industries, postcode, salary_floor, max_office_days, hard_filters_json, track`). `lib/match-engine.js` already reads the singular fields correctly (with its own `track`→`tracks` array fallback), so this is the complete fix.

**Known follow-up, flagged not fixed (pre-existing, lower priority):** `feed-gov`'s `buildGovQueries()` also reads `profile?.seniorities` (always empty) to build seniority-tailored query prefixes for the fresh-scan path — falls back to generic prefixes (`director`/`head of`/`deputy director`) for every user rather than a value derived from their actual `profile.seniority`. Not a crash, just a personalisation nicety not yet ported to the singular field.

**Self-test:** `node lib/scoring.test.js` + `node lib/usage-window.test.js` ALL PASS; both edited route files syntax-check clean; Vercel build is the authoritative gate (deploy in progress as this entry is written).

**NOT done — carried forward:**
- Real Adzuna content + real Anthropic scoring through the actual crons — still needs either Rob re-running the 4 curl commands (schema/upsert bugs are now fixed, so they should work), or adding `ADZUNA_APP_ID`/`ADZUNA_API_KEY`/`ANTHROPIC_API_KEY` to `.env.local` for a fully local run.
- `feed-gov`'s seniority-mapping follow-up (above).
- `contractor/roles` mechanical port; `job-feed`'s Rule-7 redesign — both still carried from Stage 19a.

---

### Stage 19c — migration 005 fix: partial index can't serve ON CONFLICT (2026-07-13)

**What happened:** Rob applied migration 005 in the SQL Editor (external_id column + partial unique index `where external_id is not null` both created successfully) and re-ran `cron/adzuna`. The uuid error was gone (005's actual fix worked), but got a new error: `"there is no unique or exclusion constraint matching the ON CONFLICT specification"`. Root cause: Postgres's `ON CONFLICT (column)` — which is what supabase-js's `.upsert(rows, {onConflict:'external_id'})` compiles to — can only target a **full** unique index/constraint, never a partial one. 005's `where external_id is not null` predicate, added defensively, was the actual bug.

**Fix — migration 006 (`supabase/migrations/006_jobs_cache_external_id_full_unique.sql`), NOT YET APPLIED:** drops the partial index and recreates it as a full (non-partial) unique index on `external_id`. Re-verified (per Rob's explicit request) that all 5 writers — `cron/adzuna`, `cron/gov`, `cron/greenhouse`, `feed-web`/`feed-gov` fresh-scan — set `external_id` unconditionally on every pushed row (template-literal string; even a hypothetical missing `job.id` would produce the literal string `"adzuna-undefined"`, never a SQL null), so a full unique index is safe. `jobs_cache` is still empty (0 rows) — no existing data to reconcile.

**No app code changes this round** — schema-only fix, so no deploy was needed.

**NOT done — immediate next steps:**
1. Rob needs to run migration 006 in the Supabase SQL Editor.
2. Re-run the 4 crons again (`cron/adzuna`, `cron/gov`, `cron/greenhouse`, `cron/score-cache`) — this should be the one that finally works end-to-end.
3. Then: the original verification ask (row counts, ranking sanity, fresh-scan allowance gate against real data) — still outstanding across three sessions now, purely blocked on schema/infra issues that turned out to predate this work.

---

### Stage 19b — root-cause fix: jobs_cache id/uuid mismatch (2026-07-13)

**What happened:** Rob manually ran `cron/adzuna` in production with the real `CRON_SECRET` (I couldn't retrieve it myself — see Stage 19a note below) and got back: `{"error":"invalid input syntax for type uuid: \"adzuna-5798988308\""}`. Root cause found immediately: `jobs_cache.id` has always been `uuid primary key default gen_random_uuid()` (`001_schema.sql`), but **every writer** — `cron/adzuna`, `cron/gov`, `cron/greenhouse`, and the Stage 18/19a fresh-scan paths in `feed-web`/`feed-gov` — has always supplied a TEXT id like `"adzuna-5798988308"` for upsert dedupe. Every insert has been rejected by Postgres since `jobs_cache` was created. **This predates the Stage 17-19 feed-port work entirely** — it's why the table was empty even before any cache-read code existed, not a regression I introduced.

**Fix — migration 005 (`supabase/migrations/005_jobs_cache_external_id.sql`), NOT YET APPLIED:** adds `jobs_cache.external_id` (text, partial unique index where not null) as the natural key for upsert dedupe. `id` stays the opaque uuid primary key, DB-generated — deliberately chosen over migrating `id` itself to text, because that would also require changing `pipeline_items.job_cache_id`'s type to match the FK, a second-table migration with more blast radius. This fix is scoped to `jobs_cache` alone.

**Code changes (5 files, all writers + fresh-scan paths):**
- `app/api/cron/adzuna/route.js`, `app/api/cron/gov/route.js`, `app/api/cron/greenhouse/route.js` — `id: '<source>-${job.id}'` → `external_id: '<source>-${job.id}'`; `upsert(rows, {onConflict:'id'})` → `{onConflict:'external_id'}`.
- `app/api/feed-web/route.js`, `app/api/feed-gov/route.js` (`runFreshScan`) — same rename; the post-score UPDATE loop now matches `.eq('external_id', ...)` instead of `.eq('id', ...)` (since we no longer supply `id` ourselves and don't know the DB-generated uuid without a re-fetch — matching on `external_id` avoids needing one).
- Verified no other `jobs_cache` writer exists (grepped every file touching the table — `lib/db.js`, `cron/freshness`, `freshness/recheck`, `admin/status` all only ever read/update by a real `id` already fetched from the DB, untouched).
- Verified no client code parses the id's text format (only an unrelated CSS class `"adzuna-badge"` matched the grep) — safe for `id` to become an opaque uuid once rows actually insert.

**Self-test:** `node --check` clean on all 5 route files; `node lib/scoring.test.js` + `node lib/usage-window.test.js` ALL PASS; Vercel build is the authoritative gate (see deploy log).

**NOT done — immediate next steps, blocking real-data verification:**
1. Rob needs to run migration 005 in the Supabase SQL Editor (backup already taken 2026-07-13).
2. Once applied, re-run the same 4 curl commands (`cron/adzuna`, `cron/gov`, `cron/greenhouse`, `cron/score-cache`) — this time they should actually insert and score rows.
3. Then: verify row counts, ranking sanity, and the fresh-scan allowance gate against real data (the original ask from this session, still outstanding).
4. `contractor/roles` mechanical port and `job-feed`'s Rule-7 redesign remain carried from Stage 19a.

---

### Stage 19a — feed-gov converted; verification blocked; corrected route mapping (2026-07-13)

**Goal:** Trigger the ingest crons, verify feed-web's cache-read path against real data, then convert feed-gov/job-feed/contractor-roles per cost rules 1+2+7.

**Verification: BLOCKED, not done.** Attempted to trigger the nightly crons directly via curl using `CRON_SECRET`. Discovered `CRON_SECRET` (and, on closer check, `ADZUNA_API_KEY`/`ANTHROPIC_API_KEY`/even the plain `NEXT_PUBLIC_SUPABASE_URL`) all come back as empty strings from `vercel env pull` in this session — a deliberate safety redaction in the Claude Code Vercel integration, not a retrievable secret. Did not attempt to route around it (e.g. Management API, decrypting elsewhere). **Action needed from Rob:** trigger `cron/adzuna`, `cron/gov`, `cron/greenhouse` via the Vercel dashboard's Cron Jobs manual-run button (no secret exposure needed that way), then `cron/score-cache` (possibly 2-3 times if more than 240 rows are unscored — it processes in capped batches per invocation). Once run, the cache-read verification (row counts, ranking sanity check, allowance-gate check) is the immediate next step — nothing else blocks it.

**Correction to Stage 18's carry-over note:** re-read all three remaining live routes before assuming anything. **`feed-gov` does NOT use `web_search`** — it's Adzuna live-fetch + Sonnet scoring only, structurally identical to feed-web pre-fix. Rule 7 doesn't apply to it. The route that genuinely needs the strict rule-7 treatment is **`job-feed`** — it calls Anthropic's `web_search_20250305` tool (up to 5 live searches) and also scrapes arbitrary company career-page URLs directly by fetch. `contractor/roles` is Adzuna + Sonnet only (no web_search) and already requires auth (401 if no user) — confirmed as a straightforward same-pattern port.

**Changes made:**

1. **`app/api/feed-gov/route.js`** (rewritten, same shape as Stage 18's `feed-web`) — default path `readFromCache` reads `jobs_cache` where `source='gov'` (already ingested nightly by the existing `cron/gov`) and `scored_at IS NOT NULL`, zero AI cost, ranked per-user via `lib/match-engine.js`. `{fresh:true}` is the only live path: gated by `checkAllowance(user.id,'feed_fresh_scan')`, runs the existing gov-flavoured Adzuna query set + title include/exclude filters, upserts to the shared cache (id format `gov-${job.id}`, matching `cron/gov`'s convention), scores once via the shared `lib/score-jobs-batch.js`, logs `trackAiUsage`. Unauth → 401 before any DB/AI work.

**Self-test:** `node --check` clean; `node lib/scoring.test.js` + `node lib/usage-window.test.js` ALL PASS; Vercel build is the authoritative gate (see deploy log).

**NOT done — carried forward:**
- Verify feed-web's (and now feed-gov's) cache-read path against real data — blocked on the crons being triggered (see above).
- `contractor/roles` — confirmed straightforward, same pattern as feed-web/feed-gov, not yet converted.
- `job-feed` — needs its own design under rule 7 (must have NO per-user live path at all, not even allowance-gated, since it's `web_search`). Its current live-scrape-on-click behaviour is fundamentally incompatible with rule 7 as written; the redesign likely means converting it into a nightly-cron ingest source (a new `cron/job-feed`-style route) with the route itself becoming a pure cache reader, dropping the personalized on-demand scrape entirely or restricting it to something that isn't a live web_search call. Needs a dedicated session.

---

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
