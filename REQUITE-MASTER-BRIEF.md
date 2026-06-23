# REQUITE — DEFINITIVE MASTER BRIEF
### The two-sided AI recruitment platform you can actually trust
### Strategy · Visual direction · Anti-complaint guarantees · Staged build · Layman execution

> **Single source of truth.** Supersedes and absorbs the earlier strategy brief and anti-complaint addendum. Update the PROGRESS section (bottom) every session. Working name **Requite** (placeholder, wired through one `BRAND_NAME` constant — rename = one find-replace). Built in-place on the **Marker** codebase: same Supabase, same Vercel project, same Stripe, same domain. **No new infrastructure.**

---

## CONTENTS
§1 Thesis (corrected after full competitor sweep) · §2 Market flush · §3 Where we win · §4 Audience · §5 Positioning & message · §6 Product · §7 Four anti-complaint guarantees · §8 Visual direction (rainbow chrome) · §9 Pricing · §10 Marketing/GTM · §11 Build philosophy · §12 Stage map · §13 Memory continuity · §14 Pitfalls · §15 Self-testing · §16 Prompt template · §17 Layman execution · §18 Progress

---

## §1 THESIS (corrected after full competitor sweep)

The earlier brief assumed "structure-first tracker + explainable scores" was the moat. **The full sweep proved it isn't.** Teal, Simplify, Careerflow (1.2M users), Jobright, Seekario, Upplai and a dozen others all ship the kanban tracker, AI CV tailoring, match scores and interview prep. Explainability is now *table stakes*, not a differentiator. Shipping only that = the 15th me-too in a red ocean of high-churn candidate subscriptions.

**The real, defensible white space is the two-sided bridge, executed with trust.**
- **Candidate-tool crowd** (Teal, Simplify, Jobright, Careerflow): candidate-side only — no employer marketplace, no warm intros.
- **Employer/recruiter crowd** (GoPerfect, Mokka, Winston, Eightfold): B2B-only — no candidate product. Their "trust layers" are for employers screening candidates, not for candidates trusting the platform.
- **Jack & Jill**: the only player bridging both sides for this audience — and drowning in trust failures ("Jill doesn't exist," glitches, memory loss, expired listings).

**Nobody owns: "the two-sided AI recruitment platform you can actually trust — free for candidates, honest on both sides."** That's the empty chair. Requite sits in it. The four anti-complaint guarantees (§7) make the claim credible where J&J's isn't.

**Money logic:** candidate side = free acquisition flywheel (where Rob's code already wins); employer side = monetised moat (success fees). One placement at 8% of £70k = £5,600 ≈ 300 candidate-subscription-months. The tracker/scores aren't what we sell — they're the bait that builds the opted-in pool employers pay to reach.

---

## §2 MARKET — FULL COMPETITOR FLUSH

**Candidate-side (crowded — we go FREE here):** Jobright (~$30–40/mo, US-only, CV hallucinations, billing complaints, 3-edit paywall), Teal (candidate-only), Simplify ($39.99/mo, volume-apply), Careerflow (1.2M users, pure copilot), Seekario (all-in-one but candidate-only), Upplai/LoopCV/Sonara (resume/auto-apply). None has an employer side.

**Employer-side (B2B-only — we monetise here with a flywheel they lack):** GoPerfect (explainable 1–5 scoring, ~$250–300/role, no candidate product), Mokka (850M profiles, "trust layer" for screening only), Winston/SmartRecruiters (enterprise B2B), Eightfold (heavy, consultant-led, Jan-2026 data-sourcing lawsuit), traditional agencies (20–30% fee, slow, biased). None has a consumer side.

**Two-sided bridge (our category):** Jack & Jill — both sides, but trust failing. Requite — both sides, trust as architecture. We don't out-spend them; we out-trust them.

---

## §3 WHERE WE WIN (and why no one else owns it at our level)
1. **Two-sided where the crowd is one-sided** — each side feeds the other.
2. **Trust as architecture, not marketing** — the four guarantees (§7) are coded invariants J&J can't copy without rebuilding their foundation.
3. **Free candidate side = acquisition moat** — we give away what others charge for, because revenue is employer success fees.
4. **Honest about AI vs human** — the market is sliding toward "explainability is table stakes" and candidates abandoning opaque AI. We lead with radical transparency; we're where the disillusioned defect to.
5. **Rainbow-chrome $100M look (§8)** in a category of flat, samey dashboards — we look like the leader before we are one.
Every competitor has one or two of these; none has the set. That's the moat.

---

## §4 AUDIENCE
**Candidate (primary, first — the flywheel):** "the senior switcher," 30s–40s, £60k–£150k, white-collar (marketing/product/growth/partnerships/data, fintech/SaaS/gaming/media = Rob's own profile and network). Hates spray-and-pray, recruiter spam, losing track. Values signal, honesty, being remembered, non-hallucinated CV stats. Secondary: early-career (free, high-volume).
**Employer (the money, second):** "the lean hiring manager," startup/scaleup 10–500, 2–20 hires/yr, can't justify 25% agency fees, drowning in AI-spam applications. Wants a short list of genuinely-interested, matched, pre-screened candidates, pay-on-success. Exactly J&J's under-served ICP.

---

## §5 POSITIONING & MARKET MESSAGE
**Positioning:** For senior professionals tired of shouting into the void, and the lean teams who want to hire them, Requite is the two-sided AI recruitment platform that's honest on both sides — it remembers you, tells you the truth about every match, keeps your whole search in one place, and only connects you to real opportunities. Unlike conversational tools that forget you and one-sided trackers that leave you on your own, Requite is the recruitment platform you can actually trust.
**Message (one line):** *"The only AI recruitment platform that connects candidates and employers directly — and the only one honest enough to show you exactly how it works on both sides."*
**Why a million times better (proof, not boast — each maps to a documented competitor failure):** they forget you → **we never forget you** (G3); they show expired jobs → **fresh or flagged always** (G2); they fake the marketplace → **real roles, labelled honestly** (G1); they leave you juggling tabs → **everything tracked automatically** (G4); they charge/hallucinate/hide limits → **free, verified, transparent**.
**Tone:** data-driven, credible, anti-hype. The restraint is the brand. We win the users the hype-merchants disappoint.

---

## §6 PRODUCT
**Candidate side (from job-hunt-tracker + Marker, ~80% built):** conversational onboarding (Haiku) → structured profile; explainable match engine (deterministic first, AI narrative gated, every score inspectable); the pipeline board (spine, default landing); job feed with freshness flags; CV generator with verified-stats guardrail; interview prep + salary benchmark + negotiation rehearsal tied to tracked roles; Memory Card; honest limits shown upfront.
**Employer side (new — the money):** role brief intake (Sonnet) → structured requirements; matching against opted-in pool (anonymised until mutual interest); real warm-intro flow (opt-in → review → mutual yes → unlock); success-fee billing (Stripe, 3-month leaver refund); per-role ATS-light pipeline.
**Shared spine:** one explainable engine, one Supabase schema (extend marker/`me_` tables — don't fork). Candidates + employers are two roles on one platform; liquidity of one feeds the other.

---

## §7 THE FOUR ANTI-COMPLAINT GUARANTEES (MUST-NOT-HAPPEN INVARIANTS)
> A promise is only as strong as the thing that makes breaking it impossible. Each = coded invariant + flagship feature + self-test. Acceptance criteria, enforced from the noted stage — not polish.

**G1 — "The marketplace is real, or we say it isn't." (Kills "Jill doesn't exist")**
Invariant: mandatory non-null `source_type` (`requite_managed`/`public_listing`/`partner_feed`); warm-intro UI conditionally compiled off `requite_managed` → *impossible* to show "we'll introduce you" on a public listing. Flagship: **Live Network Meter** — honest live count "N managed roles, M partners in [your field]"; when low, says so + "be first" alert (honesty becomes the feature). Plus **real-intro receipts** (timestamped). Enforced Stage 8–9. Self-test: intro CTA can't mount on public listing; zero null source_type; meter reads live.

**G2 — "Every job is fresh, or it's flagged." (Kills "expired listings")**
Invariant: `first_seen_at`/`last_verified_at`/`freshness` computed *at render time* (Fresh<48h / Aging / Stale>7d auto-demoted+badged / Expired filtered from default). Daily cron re-verifies. No default view shows an unflagged stale job (query-layer computation). Hard location/seniority pre-filter excludes wrong-country/band from "matches." Flagship: **Freshness Pulse** dot + "verified 6h ago" on every card. Plus **"Still open?" one-tap re-check**. Enforced Stage 4. Self-test: 10-day job badges+demotes; expired absent from default; wrong-country absent from matches.

**G3 — "We never forget you." (Kills "profile forgotten / rolling glitch") — THE BIG ONE**
Invariant: **database is the single source of truth; chat is a stateless disposable view.** Profile = structured Supabase record (typed fields), never chat history. Every AI turn reads profile fresh, writes facts back to structured fields, then conversation is discardable with zero loss. AI never relies on chat memory to know who you are — wipe chat, return in a month, profile/pipeline/history identical. **Loop guard:** response checked vs prior for near-duplication; on loop, discard + serve DB-rendered fallback (glitch can't present as infinite repeat). Context bounded + reconstructed per call (no overflowing blob). Flagship: **The Memory Card** — always-visible editable "everything Requite knows about you"; the most trust-building screen, direct inversion of "it forgot me"; J&J can't build it. Plus **"Pick up where you left off"** (DB-reconstructed). Enforced Stage 2 (schema) + Stage 5 (AI). Self-test: clear chat rows → profile byte-identical; forced repeat → loop guard fires; context size-bounded; Memory Card renders+persists every field.

**G4 — "Tracking isn't a feature. It's the spine." (Kills "no way to track")**
Invariant: pipeline board = default landing surface; every opportunity touched auto-enters at the right stage (Watchlist→Applied→Interviewing→Offer→Closed), persisted in Supabase; no flow surfaces a job without track option; interactions auto-capture. Losing your place is structurally impossible — place *is* the data model. Flagship: **Career Pipeline visualised** — drag-stage kanban + notes + next-action nudges + momentum strip (apps out/interviews live/offers in). Plus **auto-capture from anywhere**. Enforced Stage 2–3. Self-test: default route = board; express interest auto-adds; survives logout + device switch.

**Meta-guarantee — The Trust Panel:** a public in-product page wiring G1–G4 into one statement; every line a documented competitor failure reframed as our promise. Positioning made literal + a marketing asset. Anti-hype as weapon.

---

## §8 VISUAL DIRECTION — RAINBOW CHROME, $100M PREMIUM
**The look:** clean, premium, investor-grade ("wow, incredible"). Strong **rainbow-chrome** theme throughout — iridescent/holographic metallic gradients (liquid-chrome with spectral sheen) used with restraint over a clean, spacious, high-contrast base so it reads *premium fintech*, not toy. Chrome is the signature; whitespace + typography make it look like $100M.
**Principles:** restraint = premium (chrome as accents + hero moments: logo, key CTAs, score visualisations, hero surfaces, Trust Panel — not wall-to-wall; big calm whitespace, 1–2 chrome focal points per screen); real typographic hierarchy + generous spacing + crisp grid (discipline, not decoration, is what separates "$100M" from "templated"); score/data viz is where chrome earns its keep (iridescent gauges, spectral progress, holographic match cards — make the explainable score beautiful); credible not childish (a Director must feel it's serious — chrome = cutting-edge, whitespace+type = trustworthy, both at once); **reuse Calibre OS / Merit Score design DNA** (prism logo, iridescent/aurora CSS, band-colour palette) — Requite is its sibling; extend don't reinvent.
**Asset reuse (Stage 0):** Rob has stock photos + design assets from Calibre OS. Claude Code must in Stage 0 **search the machine** (Desktop, Downloads, calibre-os repo, common asset folders) for them, **catalogue in `ASSETS.md`** (path/type/dimensions/suggested use), and **use them** for hero imagery/backgrounds/texture — visual built from real premium assets, not placeholders. Theme implemented as reusable CSS tokens + components (frontend-design skill enforces non-templated quality).

---

## §9 PRICING & MONEY MODEL
**Principles:** candidate core free (acquisition + parity); money from employer success fees + optional candidate premium; costs near-zero (deterministic-first, AI gated Haiku/Sonnet/**never Opus**, shared daily feed cache).
**Candidate:** Free (£0 — full pipeline, scored discovery, profile, Memory Card, basic AI intake, limited daily AI "why" + CV gens, limit shown upfront) · Pro (£12–19/mo — unlimited AI + CV tailoring, interview prep + negotiation, priority freshness, advanced filters; undercuts Jobright).
**Employer:** Success fee **8% of first-year base** (undercuts J&J's 10%), 3-month leaver refund — matched, opted-in, pre-vetted shortlist + real warm intros + per-role ATS, pay only on hire. (Subscription later, not v1.) Wedge: *"Same guarantee. More honest about what's automated. Lower fee."*
**Unit economics:** deterministic £0; shared scrape pennies/day total; AI single-digit pence/active candidate/day; one £70k hire @8% = £5,600 (funds AI bill many×). High-margin if AI bounded — kill-switch architecture guarantees it.
**Referral engine (improve J&J's):** candidate-hire + employer-first-hire bonuses, paid on success only, covered by the fee. Growth without a $20M war chest.

---

## §10 MARKETING & GTM (summary; full playbook delivered at Stage 12)
Beachhead: UK marketing/growth/product/partnerships roles (Rob's network — be candidate #1 + first case study). Wedge content: anti-hype thought leadership (documented competitor failures reframed as honest recruitment; Trust Panel is the cornerstone). Candidate acquisition: free tool + referral + LinkedIn. Employer acquisition: founder-led manual outreach to first 5–10 lean hiring managers in the niche (proven Rob playbook; success fee removes their risk). Proof loop: real intro receipts + landed-role stories become the marketing. Launch order: candidate (Stage 7) → pool → employer (Stage 9) → first placement → case study → scale. Consultant (me) writes the full playbook, landing copy, Trust Panel words, outreach scripts, content calendar, launch sequence at Stage 12 and walks Rob through executing each.

---

## §11 BUILD PHILOSOPHY
Reuse don't rebuild (Marker is the foundation; transform, don't greenfield; every stage reads what exists; consolidate + clean the two messy repos). Structure-first (schema + engine spine before polish). Self-test every stage (§15). Continuity every session (§13).

---

## §12 STAGE MAP (each = one focused session, 20–40 min)
- **Stage 0 — Audit, assets & consolidation.** Read both repos → AUDIT.md (files, reusable/dead, overlaps, schema, routes, env vars, model strings [flag deprecated], import-time-init bug check). Search machine for Calibre OS assets → ASSETS.md. Create PROGRESS.md. No code changes.
- **Stage 1 — Brand + skeleton + chrome tokens.** BRAND_NAME constant; dashboard-first shell; rainbow-chrome CSS tokens/components; confirm infra reused.
- **Stage 2 — Schema spine (G3+G4 foundational).** One consolidated schema; structured profile/pipeline/jobs/scores/employer-role tables; reversible migrations; **explicit backup first** (never lose pipeline data again).
- **Stage 3 — Explainable match engine (G4).** Deterministic scorer, named dimensions, inspectable, zero AI cost. Core IP. Fixture-tested.
- **Stage 4 — Job feed + freshness (G2).** Shared daily cache (cron), staleness flags, location/seniority pre-filter, ToS-clean sources only.
- **Stage 5 — Candidate AI layer (G3).** Conversational intake → structured profile; gated "why" narratives; loop guard; Memory Card; kill switches; honest limits.
- **Stage 6 — Candidate tools.** CV generator (verified-stats guardrail), interview prep, salary, negotiation — wired to tracked roles.
- **Stage 7 — Candidate polish + mobile + chrome pass.** Home/Today loop, docked assistant, mobile audit, full chrome design pass with real assets. ✅ **Ship: best-in-class candidate product.**
- **Stage 8 — Employer I (G1).** Role intake, employer schema, matching vs opted-in pool, anonymised shortlist, Live Network Meter.
- **Stage 9 — Employer II (G1).** Real warm-intro flow, intro receipts, per-role ATS. ✅ **Two-sided live.**
- **Stage 10 — Billing.** Stripe candidate Pro + employer success-fee + referral payouts; hardened webhooks (Merit Score pattern). ✅ **Can make money.**
- **Stage 11 — Trust surfaces.** Explainability UI, transparent limits, AI-vs-human disclosures, support, **Trust Panel**. Brand-defining.
- **Stage 12 — Marketing site + launch.** Both-audience landing, messaging from §5, referral live, analytics. (Consultant writes copy + playbook.)
- **Stage 13 — QA, security, deploy.** Full self-test sweep, IDOR/auth audit, production deploy via git push.

---

## §13 MEMORY-CONTINUITY SYSTEM (every prompt)
**First action:** read REQUITE-MASTER-BRIEF, PROGRESS, AUDIT, ASSETS; state in 3 lines: stage, last done, plan; wait for "go" if ambiguous.
**Last action:** update PROGRESS (status, changes, schema/env, GUARANTEE STATUS, open questions, "next starts with"); `git add . && git commit && git push` (Claude Code does it — Rob never runs git); print "next session starts with: …".
**PROGRESS.md structure:** CURRENT STATE (stage/last commit/live URL) · STAGE LOG · GUARANTEE STATUS (G1–G4) · SCHEMA CHANGES · ENV VARS (names only) · OPEN QUESTIONS/BLOCKERS · NEXT SESSION STARTS WITH.

---

## §14 PITFALLS + THE RULE THAT KILLS EACH
1. Name hardcoded → one BRAND_NAME constant, never literal in components. 2. Greenfield drift → Stage 0 audit mandatory, reuse before write. 3. Schema fork/data loss → extend tables, backup before migration, reversible, test on copy. 4. Deprecated model strings → one config (lib/anthropic.js), Stage 0 flags, never inline. 5. Unbounded AI cost → deterministic free, gated kill switches, Haiku/Sonnet/**never Opus**, daily cache, max_tokens capped, truncation guard. 6. Import-time client init hang → lazy-init (getStripe() not new Stripe()), Stage 0 checks. 7. Scraping/ToS/legal → ToS-clean licensed only, never scrape LinkedIn, no data cron without written confirmation. 8. Hallucinated CV stats → verified/confirmed only, never invent. 9. Webhook/auth/IDOR → Merit Score hardening, object-level auth every route, Stage 13 sweep. 10. Over-promising marketplace → never fake employers/intros, thin niche → UI says so (G1). 11. Operator friction → plain English + copy-paste commands only, no comments in code blocks, mv/cp for downloads, Claude Code handles git. 12. Scope creep → one stage = one session = one commit, cap ~40 min. 13. Self-test skipped → §15 gate before "done."

---

## §15 SELF-TESTING PROTOCOL (PASS/FAIL before "done")
1. Build passes (npm run build clean, types OK). 2. Routes respond (non-500). 3. Critical path intact (candidate onboard→scored job→pipeline→move; +employer from Stage 8). 4. No secrets leaked (locked content + keys absent from client). 5. Cost guards present (gated, capped, right model). 6. Data safe (migration on backup, reversible). **Plus the stage's guarantee self-test (G1–G4).** A FAIL blocks the commit.

---

## §16 REUSABLE CLAUDE CODE PROMPT TEMPLATE
```
Read in full first: REQUITE-MASTER-BRIEF.md, PROGRESS.md, AUDIT.md, ASSETS.md (all in ~/Desktop/marker).
Then state in 3 lines: current stage, last done, this session's plan.

THIS SESSION — STAGE <N>: <name>
Goal: <one sentence>
Scope (ONLY this): <bullets>
Reuse before writing: check AUDIT.md for existing code.
Guarantee(s) this stage must satisfy: <G1/G2/G3/G4> — implement invariant AND self-test.
Constraints: follow every §14 rule (brand constant, lazy init, model strings in lib/anthropic.js, AI gated Haiku/Sonnet never Opus, ToS-clean sources, verified stats only, rainbow-chrome tokens from §8 using real ASSETS.md assets, plain-English copy-paste commands for Rob, you handle all git).

When done: run §15 + guarantee self-test, print PASS/FAIL (any FAIL → fix first); update PROGRESS.md (incl GUARANTEE STATUS); git add+commit+push yourself (correct branch); print "next session starts with: …".
If anything is ambiguous or risky (data loss, schema, legal/ToS, cost), STOP and ask one clear question first.
```

---

## §17 LAYMAN EXECUTION — WHAT YOU DO
You copy-paste; Claude Code does the work + all git; I'm your consultant at every step.

**Today:**
1. **Name:** accept **Requite** placeholder (rename later = one command) or ask me for more options. Doesn't block.
2. **Save brief into project:** `mv ~/Downloads/REQUITE-MASTER-BRIEF.md ~/Desktop/marker/REQUITE-MASTER-BRIEF.md` (tell me if your browser saved elsewhere).
3. **Open Claude Code:** `cd ~/Desktop/marker` then `claude`.
4. **Confirm Sonnet:** type `/model`; if not Sonnet, `claude config set model claude-sonnet-4-6`.
5. **Run Stage 0** — paste this to Claude Code:
```
Read ~/Desktop/marker/REQUITE-MASTER-BRIEF.md in full. This is STAGE 0. Goal: a complete picture of what exists, NO code changes.
1. Read every file in ~/Desktop/marker AND ~/Desktop/job-hunt-tracker. Produce AUDIT.md: each file + what it does + reusable/dead + repo overlaps + current Supabase schema + all routes + all env var names + all Anthropic model strings (flag deprecated). Check for import-time client init bugs (new Stripe()/new Resend()/new Anthropic() at module top).
2. Search my machine (Desktop, Downloads, ~/Desktop/calibre-os, common folders) for Calibre OS / Merit Score design assets and stock photos. Produce ASSETS.md (path, type, dimensions, suggested Requite use).
3. Create PROGRESS.md per §13 of the brief.
Change NO code. Commit and push all three files yourself, then tell me in 3 lines what you found and what Stage 1 should do.
```
6. **Bring AUDIT.md + ASSETS.md back to me here.** I tighten Stages 1–13 against your real code + assets and hand you the Stage 1 paste.

**Repeating rhythm (each stage after 0):** you say "ready for Stage N" → I give one copy-paste prompt → you paste, let it run (no Ctrl+C) → if it asks a question, paste it to me → it self-tests, commits, pushes, says what's next → you tell me it's done → I sanity-check + prep next. You never run git, never edit code, never touch the DB directly.

**Where I add value:** turning each stage into a clean prompt against your real code; reading AUDIT/ASSETS/PROGRESS to catch problems early; decisions (naming, pricing, niche, design); **all the marketing at Stage 12** (landing copy, Trust Panel words, LinkedIn content, employer outreach, referral mechanics, launch sequence); post-launch GTM, first-employer outreach, case studies, scaling.

**Your watch-for list:** Claude Code rebuilding something that exists → stop it, tell me. Wants to change the DB → confirm it backed up first. Goes near scraping LinkedIn / enabling a data cron → stop, legal line, tell me. Session runs long/messy → let it finish the commit, we split the next smaller.

---

## §18 PROGRESS (Claude Code maintains from Stage 0)
Stage: pre-0 (definitive brief written, awaiting Stage 0 audit + asset discovery)
GUARANTEE STATUS: G1 ⬜ G2 ⬜ G3 ⬜ G4 ⬜
Next session starts with: Stage 0 — run the §17 step-5 paste.
