# REQUITE — FITNESS-FOR-PURPOSE REVIEW
### Top-down judgment of the finished product against the Master Brief
> Date: 2026-06-26 · Method: code trace + live-source verification against REQUITE-MASTER-BRIEF.md, PROGRESS.md, AUDIT.md, JOURNEY-AUDIT.md, REQUITE-MARKETING-COPY-v2.md. Read-and-report only; no code changed. Findings are grouped by the seven review areas, Critical/High first.

---

## VERDICT IN ONE PARAGRAPH

The **engine and the guarantees are genuinely well built** — this is not a hollow product. G1, G2 and G4 are delivered as coded invariants a user would actually experience, the schema spine is real, the AI cost discipline is clean (no Opus, capped tokens, deterministic-first), and the v2 marketing copy is placed coherently on both landing surfaces. **But the product is not launch-ready, and the gap is not in the new machinery — it is in the half-finished transition from Marker to Requite.** The candidate pricing is three contradictory systems, none matching the brief, all still branded "Marker." Legal pages, the pricing page, all six guides, the footer and the OG image still say "Marker" and point to `hello@marker.work`. One of the three named G3 sub-invariants (the loop guard) is dead code in production. The British-English/no-em-dash rule reached only 4 of ~18 AI prompts. The CV generator — the artifact a senior actually sends — runs on the cheap model with an advisory-only guardrail. These are all fixable in a focused stage, but as it stands the product would embarrass in front of a real user or investor the moment they leave the new landing page.

**Critical: 2 · High: 3**

---

## AREA 1 — THE FOUR GUARANTEES

### G1 — "The marketplace is real, or we say it isn't." — ✅ DELIVERED (strong)
The invariant is real and enforced at the API layer, not just the DB. `POST /api/employer/role` hardcodes `source_type: 'requite_managed'`; the warm-intro flow requires mutual opt-in before any PII is revealed (`employerEmail`/`candidateEmail`/`companyName` are `null` until `candidate_opted_in && employer_opted_in`, verified in `app/api/candidate/intros/route.js` and `app/api/employer/shortlist/route.js`); `intro_receipts` logs every event; the Live Network Meter reads real counts and says "Launching — be a founding partner" when zero. A candidate genuinely cannot be shown a fake intro. **This is the brief's hardest promise and it is honoured.**
- **Structural note (Low):** at launch the managed pool is empty, so the *flagship experience* of G1 (real intros + receipts) cannot actually be experienced by anyone until liquidity exists. This is honest by design, not a defect, but it means G1 is "provably honest" rather than "demonstrably valuable" on day one.

### G2 — "Every job is fresh, or it's flagged." — ✅ DELIVERED (strong)
`lib/freshness.js` computes freshness at **read time** and overrides the stored DB column (`applyFreshnessToRow`), called on every read in `/api/feed-cache`; Expired excluded from default view; Freshness Pulse badge on cards; daily cron; one-tap "Still open?" recheck. A user sees "verified Xh ago" on every card and never an unflagged stale job in the default view. Delivered as promised.
- Minor: thresholds in code are Fresh <48h / Aging <7d / Stale <14d / Expired ≥14d. The brief's "Stale >7d, Expired filtered" is satisfied; the 14-day Expired cutoff is an unstated implementation choice. Not a problem.

### G3 — "We never forget you." — 🟡 MOSTLY DELIVERED, one named sub-invariant is inert
The core promise is real and is the product's genuine differentiator: there is **no chat-history table at all**; `lib/ai-context.js` rebuilds a bounded (`MAX_CHARS=2000`) context purely from `profiles`/`career_history`/`wishlists` on every call; the Memory Card (`components/MemoryCard.js`) is reachable on the Profile tab and edits persist. Wipe the chat, return next month, profile is byte-identical — that holds.
- **HIGH — the loop guard never fires in production.** The brief names the loop guard as part of the G3 invariant ("response checked vs prior for near-duplication; on loop, serve DB fallback") and PROGRESS claims the self-test passes. But `app/api/analyse/route.js` only runs `checkForLoop` when the request body contains `priorResponse`, and **no client call sends it** — all four `fetch('/api/analyse')` sites in `app/app/page.js` (lines 1915, 3146/3475, 5301) omit it. The guard and its structured fallback are unreachable in the live app. The unit test passes in isolation; the feature is dead in practice. See Area 1 detail. (The headline G3 promise survives because there is no chat memory to loop on — but a documented, self-tested invariant component is non-functional.)

### G4 — "Tracking isn't a feature. It's the spine." — ✅ DELIVERED (strong)
`useState('Pipeline')` is the default tab (`app/app/page.js:4885`); analysing a JD auto-captures it to Watchlist with score; pipeline is fully Supabase-backed (survives logout/device); momentum strip present. Delivered as promised.

---

## AREA 2 — AUDIENCE & POSITIONING

**Landing surfaces: on-brief.** The candidate hero ("Score every job before you waste time on it" / "For people who've job-hunted before…") and employer hero ("A short list of people who fit and genuinely want it" / "For teams who want to hire well without an agency retainer") match the v2 deck and the §5 positioning for the senior switcher and the lean hiring manager. Good.

- **MEDIUM — the dashboard still carries Marker's perm/contractor architecture, which doesn't map to the Requite audience.** The product splits users into `perm` / `contractor` / `both` plans (`app/app/page.js:4714`), exposes a Contractor tab, and ships recruiter-agency finders (`/api/contractor/recruiters`, `/api/perm/recruiters`). The brief's audience is "the senior switcher" and "the lean hiring manager" — there is no perm-vs-contractor axis in that positioning. This is leftover Marker product scope that a senior switcher will find off-key and that dilutes the two-sided story. It contradicts §4/§6 of the brief.

---

## AREA 3 — PRICING & MODEL  — 🔴 CRITICAL MISMATCH

The brief (§9) is explicit: candidate **Free + a single Pro at £12–19**; employer **8% success fee, 3-month guarantee**; referral paid on success.

**Employer side: correct.** 8% of first-year base + three-month guarantee is stated consistently on `/hire` and `/trust`. Referral capture is wired (`commission_rate: 0.08`). Good.

**Candidate side: three contradictory systems, none matching the brief, all Marker-branded.**
| Surface | What it shows |
|---|---|
| Landing `PricingSection.js` (live, rendered on `/`) | **Free / Standby £4 / Lite £12 / Pro £24 (£19 annual)** — a 4-tier Marker-era SaaS ladder |
| `/pricing` page | **"Marker" £12 / "Marker Contractor" £16 / "Marker Pro" £26** — old perm/contractor model |
| Dashboard plan gate (`app/app/page.js:4714`) | **"Marker (£12/mo)" / "Marker Contractor (£16/mo)" / "Marker Pro (£26/mo)"** |
| `lib/stripe.js` PLANS (the real checkout) | **Standby / Lite / Pro / Pro + BYO** |

A user clicking through `/` → `/pricing` → upgrade sees three different brand names, two different tier structures, and prices the brief never specified. None is the clean "Free + Pro £12–19" the brief mandates. The checkout (`stripe.js`) doesn't match the page that links to it. This is the most concrete failure of "does the built product reflect the pricing model" — **Critical.**

---

## AREA 4 — MODEL DISCIPLINE

**Strong on the hard rules:**
- **No Opus is ever called.** `claude-opus-4-8` appears only in the `lib/ai-usage.js` cost table, never in a request. ✅
- Every AI route uses `MODELS.haiku` or `MODELS.sonnet` from `lib/anthropic.js`; no inline model strings remain. ✅
- `max_tokens` is capped on every call (500–4096). ✅

- **HIGH — the British-English / no-em-dash STYLE instruction is in only 4 of ~18 AI prompts.** Present in: `cv/generate`, `cv/cover-letter`, `interview-prep`, `negotiation-prep`. **Missing from** prompts that also generate user-facing text: `analyse` (score reason strings shown on every card), `cv/questions`, `search/live`, `job-feed`, `feed-web`, `feed-gov`, `feed-tasklist`, `contractor/companies`, `contractor/roles`, `contractor/recruiters`, `perm/recruiters`, `wishlist/generate`, `onboard/parse-cv`. The 12f pass purged *existing* em dashes from these prompt strings but did not add the *instruction*, so any new generation from these routes can emit US spelling and em dashes. The brief's requirement is the instruction "in every AI prompt that generates user-facing text" — this is roughly a 22% completion of that rule.

---

## AREA 5 — THE CV GENERATOR  — 🟡 HIGH (good assistant, not a send-ready artifact)

The structure is sound: three efforts (quick = ATS keyword JSON; standard = targeted rewrite; deep = ATS + full rewrite + sift assessment), `STYLE RULES` + `STAT_GUARDRAIL` in the prompt, profile/career-history context injected, and a post-generation `checkVerifiedStats` pass on standard/deep. The verified-stats *idea* (the brief's #1 trust rule) is genuinely implemented and unit-tested.

Where it is weak in practice:
- **Quality-tier inversion (Medium→High):** the actual CV rewrite runs on **Haiku** (`MODELS.haiku`, line 140), the volume model, while lower-stakes tools (interview prep, negotiation) use Sonnet. The single highest-stakes written artifact — the CV a senior professional sends to an employer — is generated by the cheapest model. Haiku tailoring tends toward keyword-stuffing and flatter prose; a Director-level user would likely find the output generic and would not send it unedited.
- **The guardrail only flags, it does not enforce (Medium):** a hallucinated number surfaces as a yellow banner (`flaggedMetrics`), but nothing blocks or regenerates. A user who ignores the banner can still send fabricated stats. The brief frames this as a "must-not-happen invariant"; in practice it is advisory.
- **Silent truncation (Medium):** `cvRaw.slice(0, 5000)` (~800–1000 words) and `jd.slice(0, 3000)`. Senior 2–3 page CVs exceed 5000 chars, so later career history is silently dropped from the tailoring source — exactly the experience a senior switcher most wants represented.
- Output carries `[UPDATED]` markers that the user must strip before sending.

**Honest answer to "would a senior send this?"** As a fast first draft, yes — it is a competent assistant. As a finished document, no — the model choice, truncation, and advisory guardrail mean it produces a starting point, not a send-ready CV. That is a reasonable product, but it is below the bar the brief implies ("would a senior professional actually send what this produces").

---

## AREA 6 — COHERENCE OF THE ADDITIONS (v2 copy, 12d/12e, 12f)

**What cohered well:**
- The **v2 marketing copy is actually placed** (the PROGRESS Stage 12 log references v1 headlines, but the live `app/page.js` and `app/hire/page.js` carry the v2 hero, three promises, freshness strip, employer handoff, and referral copy). Good — the deck and the product agree.
- The **journey-audit 12d/12e fixes are real**: the `recheckJob` prop crash (C1), the `?next=` redirect mismatches (H1/M1), the intro notification emails (H3/H4), and the Stripe error surfacing (M5/M6) are all present in source. The 17-finding audit was genuinely closed.

**What is half-wired or contradictory:**
- **MEDIUM — split contact identity.** New pages use `support@requite.io` (`/trust`, `/hire`, settings, dashboard footer); legacy pages use `hello@marker.work` (`/privacy`, `/terms`, `/pricing`, settings line 251, dashboard footer line 5433). The same product shows two different support addresses on two different domains.
- **MEDIUM — stray `app/app/page 2.js` is committed to git.** It is a pre-12f duplicate of the 320 KB dashboard monolith (Marker-era copy, 45 em dashes, old "Request failed —" strings). Next.js does not route `page 2.js`, so it is not user-facing, but it is dead weight in the repo and a clear sign of an unfinished cleanup. It should be deleted.
- **LOW — the 12f "zero em dashes" claim is overstated but largely true.** Literal `—` in user-facing copy is genuinely gone (the 33 in `app/app/page.js` are all `//` and `{/* */}` comments). But the purge missed HTML-entity em dashes: `&mdash;` appears twice in live employer copy (`app/hire/page.js:143` and `:170`) and renders as real em dashes — see Area 7.

---

## AREA 7 — ANYTHING EMBARRASSING IN FRONT OF A USER OR INVESTOR

### 🔴 CRITICAL — the product is still pervasively branded "Marker" outside the new landing pages
Stage 1's PROGRESS claims it "replaced all 'Marker' literals," but in fact it only touched `layout.js`, `email.js` and the hero. Everywhere a user or investor would actually look beyond the homepage still says Marker:
- **Footer:** `© Marker Ltd · UK` (`app/page.js:385`)
- **`/pricing`:** plans named "Marker", "Marker Contractor", "Marker Pro"; logo wordmark "Marker"
- **`/privacy`:** "Marker is operated by Robert Oxborough, trading as Marker… Contact: hello@marker.work"
- **`/terms`:** "Marker is a job search management tool…"; liability clauses name Marker
- **All six guides** (`/guides/*`): "Marker scores every role…", "Try Marker free →", "More from Marker"
- **`/notes`** index + post titles: "Notes | Marker", "Try Marker free →"
- **OG share image** (`app/opengraph-image.js`): alt text "Marker: for experienced people who'd quite like their evenings back" — this is what renders when the link is shared on LinkedIn
- **Dashboard upgrade gate:** "Marker (£12/mo)" etc.
- **Admin page** copy references Marker

For a launch or an investor demo, clicking past the homepage into pricing, privacy, terms, the guides, or sharing the link on social immediately exposes the old brand. This is the single most damaging finding.

### Other embarrassments
- **HIGH (folds into the above):** `hello@marker.work` is a *different domain* — legal/contact pages point users at an address that isn't even the Requite brand.
- **LOW:** two `&mdash;` em dashes render on the live employer page (Area 6).
- **LOW:** the FROM address on all transactional email is still `onboarding@resend.dev` (a known open question, acceptable pre-launch but visible to every new user).
- **LOW:** stray `app/app/page 2.js` in the repo.

---

## WHAT IS GENUINELY STRONG (so it is not lost in the criticism)
1. **The four guarantees are real engineering, not marketing.** G1's mutual-opt-in PII gate and G2's read-time freshness override are the kind of coded invariants the brief promised competitors can't easily copy. G3's no-chat-history architecture is a genuine differentiator.
2. **AI cost discipline is clean** — no Opus, deterministic-first scoring, capped tokens, gated routes. The unit economics argument in §9 holds.
3. **The deterministic match engine** (`lib/match-engine.js`, 23 fixture tests, proven determinism) is real, inspectable IP and is correctly reused on both the candidate and employer sides.
4. **The new landing + employer + trust surfaces** are coherent, on-positioning, and the Trust Panel maps every claim to a built feature.
5. **Security/journey hygiene** (Stage 13 + 12d/12e) genuinely closed real holes (IDOR scoping, intro notifications, redirect params, Stripe error surfacing).

---

## PRIORITISED FIX LIST (for a future stage — not done here)
1. **(Critical) Global Marker→Requite sweep** across `/pricing`, `/privacy`, `/terms`, all guides, `/notes`, footer, OG image, dashboard plan names, admin; unify contact to `support@requite.io`.
2. **(Critical) Reconcile candidate pricing** to the brief's Free + single Pro (£12–19); make `PricingSection`, `/pricing`, the dashboard gate, and `lib/stripe.js` PLANS agree; retire the perm/contractor/BYO ladder or justify it explicitly.
3. **(High) Wire `priorResponse`** from the client analyse calls so the G3 loop guard actually fires, or remove the claim from the Trust Panel/brief.
4. **(High) Add the British/no-em-dash STYLE block** to the remaining ~14 user-facing AI prompts.
5. **(High) Reconsider the CV generator:** use Sonnet for standard/deep rewrites, raise/flag the CV truncation limit, and decide whether the stats guardrail should block rather than warn.
6. **(Medium) Decide the perm/contractor architecture's place** in the Requite audience story, or hide it.
7. **(Low) Delete `app/app/page 2.js`; fix the two `&mdash;`; verify the email FROM domain.**
