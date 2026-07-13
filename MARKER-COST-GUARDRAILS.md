# MARKER — Cost Guardrails Addendum

Read this in full before continuing with any further sessions. These rules override anything in the feature port brief that conflicts with them. The goal: no feature may cause API spend to scale per-user-per-click. Spend scales with the nightly cache, allowances cap the rest.

---

## RULE 1 — Scans are nightly and shared, never per-user live

The personal tracker runs live scans on every "Run Scan" click. That is fine for one user. It is NOT how Marker works.

- All feed scanning (Greenhouse, Lever, Ashby, SmartRecruiters, Adzuna web, Adzuna gov, contract, recruiters) runs ONCE nightly via cron into the shared `jobs_cache` table
- A user clicking "Run Scan" re-reads the cache and re-applies their personal filters client-side or via a cheap DB query. It does NOT trigger live board fetches or live scoring
- Exception: Pro tier may have a "Fresh scan" button capped at 3 live scans/day per user, counted in `ai_usage`, hard-blocked at the cap
- Never build a route where an unauthenticated or free user can trigger a live external fetch + scoring run

## RULE 2 — Score each cached job once, globally

- When the nightly cron ingests jobs into `jobs_cache`, batch-score them with Haiku ONCE and store the score on the cache row
- Scores are shared across all users. Per-user relevance (track allowlists, salary floor, office days) filters the already-scored cache — it never re-scores
- Never write a loop that scores the same cached job per user. 500 users must not mean 500× scoring
- The personal, full 8-factor Analyse (Sonnet) remains per-user because it is personal — but it is allowance-gated per tier and always was

## RULE 3 — Tidy-up chatbot is Haiku-first, one Sonnet call max

When building the "Help me tidy up" pipeline chatbot:

- Question/answer turns run on Haiku 4.5
- Exactly ONE Sonnet call at the end to produce the re-sort plan
- Prompt caching enabled on the conversation prefix
- Hard cap: 8 turns per tidy-up session, then it must conclude
- Tier gate: Lite and Pro only. Counts as 1 analyse against the monthly allowance
- The re-sort itself (moving jobs between statuses) is plain DB writes — no model calls

## RULE 4 — Prompt-cache the scoring rubric

- The unified scoring rubric (lib/scoring.js equivalent) is embedded in every scoring prompt
- Mark the rubric + candidate-profile block with `cache_control` so repeat calls read it at ~10% input price
- Same for the CV chat system prompt if/when ported
- Verify caching is actually firing: log cache_read_input_tokens in ai_usage for at least one test call per route

## RULE 5 — Sonnet 5 migration specifics

- All Sonnet-class calls use model string `claude-sonnet-5` (intro pricing $2/$10 until 2026-08-31, then $3/$15)
- Feed/batch scoring stays on `claude-haiku-4-5-20251001`
- Sonnet 5 REJECTS sampling parameters: remove ALL temperature, top_p, top_k from every call site before swapping the model string — a leftover temperature means a 400 error in production
- Manual extended thinking (`thinking: {type: "enabled"}`) also returns 400 — remove if present anywhere
- The new tokenizer produces ~30% more tokens for the same text. Do NOT loosen max_tokens or allowance maths on the assumption Sonnet 5 is cheaper — treat it as cost-neutral vs 4.6
- Re-check any max_tokens values sized tightly to expected output; add ~30% headroom

## RULE 6 — Allowance checks stay in front of every model call

- Every route that calls Anthropic must check `ai_usage` against the tier cap BEFORE the call, and log tokens + cost AFTER the call
- No new route ships without both. If a ported feature from the personal tracker has no allowance check (none of them do — it was single-user), the check must be added during the port
- Free tier: any new AI feature defaults to LOCKED unless the brief explicitly says otherwise

## RULE 7 — Web search calls are metered too

- The gov feed and contract feed use web_search passes. Web search costs money per call
- These run inside the nightly cron only (shared result, cached), never per-user on demand
- Interview Prep's web search is per-user but already Pro-only and allowance-capped — keep it that way

---

## Quick self-test before ending any session

1. Could a free user cause an external API call by clicking something repeatedly? If yes — fix it
2. Does any loop call a model per-user for shared data? If yes — move scoring to the cache layer
3. Does every new Anthropic call site have (a) allowance check before, (b) ai_usage log after, (c) no sampling params, (d) cache_control on the static prefix? If any no — fix before deploy

End of addendum.
