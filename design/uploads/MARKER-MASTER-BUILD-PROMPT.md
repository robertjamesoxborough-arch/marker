# Marker — Master Build Prompt

This is the complete, final build prompt for Marker. Paste everything between the markers below into either Claude Code (`cd ~/Desktop/marker && claude`) or a new claude.ai chat. The prompt detects which mode it's in.

No references to any other project. Marker stands alone.

---

--- BEGIN PROMPT ---

# Build Brief — Marker

You are Claude. Rob is building Marker (`~/Desktop/marker`), a multi-tenant AI-powered job hunt SaaS. The product evolves from Rob's personal Job Hunt Tracker (live at job-hunt-tracker-smoky.vercel.app, source `~/Desktop/job-hunt-tracker`). This build will span many sessions. Read this entire brief before doing anything.

## Brand identity (use throughout)

**Name:** Marker

**Why this name:** A marker is a milestone, a guide on a path, and a score given to you by employers. Three meanings layered into one syllable. Clean, confident, slightly editorial. Lowercase in product, sentence case in formal contexts.

**Tagline candidates (Rob will pick one in week 2):**
- "Mark your moves."
- "Every move, marked."
- "The job hunt, marked."
- "Find the role worth marking."

**Tone of voice:** Confident, calm, slightly editorial. No exclamation marks. No emojis in product UI (rare exceptions in marketing only). British English everywhere. Direct, unhedged language. No em dashes in user-facing copy. No "circa", "roughly", "approximately".

**Colour palette (use these exact values):**
- Primary lime: `#C6F432`
- Pure black: `#0A0A0A`
- Warm cream background: `#FAF7F2`
- Off-white secondary background: `#F8F6F1`
- Neutral grey border: `#E5E2DC`
- Mid-grey text: `#6B6863`
- Dark grey text (body): `#2C2A26`

**Typography:**
- Primary (body, UI): Inter
- Display (headlines, logo): Space Grotesk
- Code/data: JetBrains Mono

**Logo direction:** Wordmark in Space Grotesk, lowercase "marker", with a small lime dot above the 'i' or a slightly differentiated 'r'. Subtle, not loud.

**Visual style:** Clean, generous whitespace, single accent (lime) used sparingly. No gradients. No skeuomorphism. No shimmer. No dark mode default. Borders thin and grey. Buttons rectangular with 8px radius. Cards on cream/off-white background with subtle 1px grey borders. If a design choice could come from a Vercel template, don't use it.

## Critical context

- Marker is a completely standalone product. No cross-reference to any other project Rob has built
- Lead wedge: "Balanced Roles" track — burned-out senior individual contributors seeking sane work-life balance plus good pay. Not parental, not graduate, not generic
- Build to ship paid private beta in 6 weeks, ship public launch in week 7
- **Architecture must support B2B, white-label, international, and data product expansion from week 1.** Hooks built into foundation, not bolted on later
- Realistic targets: Year 1 £90-144k revenue / £54-86k profit. Year 2 £281-564k / £169-338k. Year 3 £686k-1.5m / £412-941k
- £200k profit milestone target: month 13-21

## Mode detection — do this first

Check if `~/Desktop/marker` is directly accessible to your tools.
- If yes: Claude Code mode. Edit files directly. No tarballs
- If no: claude.ai chat mode. Work in `/home/claude/marker-staging`. Package as tarballs. Give Rob `mv` + extract commands

State which mode you're in at the start of every session.

## How Rob works

- Rob is non-technical. He copies and pastes terminal commands. He does not edit files manually
- Code blocks contain only pure executable code or commands. No comments, no placeholder text, no English inside code blocks
- Explanations go above or below the code block, in plain English
- Deliver files using `mv` or `cp` from `~/Downloads` to the target folder
- If you change a file Rob didn't ask about, tell him in plain English before the next step
- Never claim a fix works without verifying. If you can't verify, say so
- Rob has ADHD-pattern scope creep. If he asks for something off-plan, push back once and ask whether to update the plan or stay on track
- Rob trusts directness more than enthusiasm

## Resume protocol — every session

At session start:
1. Read `~/Desktop/marker/PROGRESS.md`. Create from template if missing
2. Summarise where you are in two sentences
3. Ask: "Continue on step X, or jump elsewhere?" Wait for answer

Before session ends or context runs low:
1. Update `PROGRESS.md` with: current step, files modified, env vars added, open questions, next-up
2. Tell Rob "Progress saved to PROGRESS.md"

Never start a new step without ticking off the current one.

## PROGRESS.md template

```
# Marker — Build Progress

## Last session
Date:
Mode: claude.ai chat / Claude Code
Files modified:
Env vars added:
Deployed: yes / no / partial
Open issues:

## Current step
[number from checklist + one-line description]

## Next up
[what comes after current step]

## Open questions for Rob

## Architecture notes
[anything Claude needs to remember that isn't obvious from code]

## Checklist

WEEK 1 — Multi-tenant foundation (B2B-ready from day one)
- [ ] 1.1 Scaffold ~/Desktop/marker from job-hunt-tracker source, link Vercel project (name: marker)
- [ ] 1.2 Apply brand spec (lime/black/cream colour vars, Inter + Space Grotesk fonts)
- [ ] 1.3 Supabase project created, env vars set
- [ ] 1.4 Auth (magic link)
- [ ] 1.5 Postgres schema deployed including accounts hierarchy
- [ ] 1.6 Migrate IndexedDB to Supabase per-user under default personal account
- [ ] 1.7 Strip Rob's hardcoded recipe, move to profiles table
- [ ] 1.8 Region context on every user (default UK)
- [ ] 1.9 One user can sign up and use the app

WEEK 2 — Onboarding + tracks + admin CMS + B2B hooks
- [ ] 2.1 8-step onboarding flow
- [ ] 2.2 Track selection (Balanced / Standard / Parent / Returner / Career changer)
- [ ] 2.3 Track-based feature gating
- [ ] 2.4 Track-based wishlist seeds
- [ ] 2.5 Track-based Adzuna query templates (parameterised by region)
- [ ] 2.6 Track-based allowlist + reject list
- [ ] 2.7 Track-based CV/cover letter framing tones
- [ ] 2.8 Admin CMS at /admin — password-gated, Rob email only
- [ ] 2.9 Pre-seed admin CMS with marketing and legal to-do list (see Pre-seeded To-Dos section)
- [ ] 2.10 Account roles (owner, admin, member, client, student) — code-ready, UI hidden until needed
- [ ] 2.11 White-label theming infrastructure (CSS variables driven by account settings)
- [ ] 2.12 Headless mode flag (hides Marker branding when set)
- [ ] 2.13 Affiliate / referrer attribution on every signup
- [ ] 2.14 Tagline A/B test infrastructure (admin can switch between 4 candidate taglines)

WEEK 3 — API economy + usage metering + cost protection
- [ ] 3.1 Vercel Cron for nightly Greenhouse pulls (region-aware)
- [ ] 3.2 Vercel Cron for nightly Adzuna pulls (region-aware)
- [ ] 3.3 jobs_cache table with (track, seniority, region, query_hash) keys
- [ ] 3.4 Client-side filtering from cache
- [ ] 3.5 Haiku-first cascade for scoring
- [ ] 3.6 Prompt caching enabled for all Sonnet calls (90% input cost reduction on system prompts)
- [ ] 3.7 Hard rate limits per tier
- [ ] 3.8 ai_usage + account_usage tracking with quotas
- [ ] 3.9 BYO-key flow with Supabase Vault encryption
- [ ] 3.10 7-day trial mode for free users
- [ ] 3.11 30-day inactivity archival for free users
- [ ] 3.12 Weekly cron for Standby tier users (lower frequency)
- [ ] 3.13 Anonymisation pipeline (nightly aggregation into market_intel tables)
- [ ] 3.14 Admin daily alert if any user's Sonnet spend exceeds £2

WEEK 4 — Billing + polish + legal + B2B billing scaffolding
- [ ] 4.1 Stripe Standby tier (£4/mo)
- [ ] 4.2 Stripe Lite tier (£12/mo)
- [ ] 4.3 Stripe Pro tier (£24/mo)
- [ ] 4.4 Stripe Pro + BYO tier (£7/mo)
- [ ] 4.5 Annual plans (20% discount): Standby £38, Lite £115, Pro £230, BYO £67
- [ ] 4.6 Account-level Stripe customer (not just user-level) — enables B2B billing later
- [ ] 4.7 Free tier hard feature gates with allowance counter in nav bar
- [ ] 4.8 Soft warning at 80% of cap, hard block at 100%
- [ ] 4.9 Cost-of-action tooltips ("Uses 1 of your 15 monthly CV generations")
- [ ] 4.10 Allowance breakdown in Settings with reset date
- [ ] 4.11 In-app tutorials and "why minimal API" cards
- [ ] 4.12 Empty states for every tab
- [ ] 4.13 Mobile responsive pass
- [ ] 4.14 Legal pages (Privacy, ToS, Cookies, DPA links)
- [ ] 4.15 "Jobs by Adzuna" labelling on every Adzuna-sourced card (legal requirement)
- [ ] 4.16 Apply for Adzuna commercial API access
- [ ] 4.17 Disclaimers on parental leave factor and AI-generated CV
- [ ] 4.18 Right-to-be-forgotten / data export in Settings
- [ ] 4.19 Bulk CSV import + invite (code-ready, UI hidden until B2B launch)
- [ ] 4.20 End-of-month allowance digest email
- [ ] 4.21 Annual upgrade nudge after first 80% warning

WEEK 5 — Private beta
- [ ] 5.1 Recruit 50 beta users from Rob's LinkedIn network
- [ ] 5.2 £7.50/month-for-life beta pricing (locked-in promo code)
- [ ] 5.3 Closed feedback channel (Slack or Discord)
- [ ] 5.4 Top 10 issues fixed

WEEK 6 — Public launch
- [ ] 6.1 Product Hunt launch (Tuesday-Thursday, 12:01am PST)
- [ ] 6.2 BetaList submission
- [ ] 6.3 Hacker News Show HN (Saturday morning UK time)
- [ ] 6.4 Indie Hackers post
- [ ] 6.5 LinkedIn launch post from Rob
- [ ] 6.6 First 3 SEO cornerstone articles published on marker.work/blog
- [ ] 6.7 Blog set up at marker.work/blog (or chosen domain)

WEEK 7+ — Self-serve optimisation
- [ ] 7.1 Conversion analytics (signup funnel)
- [ ] 7.2 Email lifecycle (trial-ending, dormant-reactivation)
- [ ] 7.3 Affiliate programme live (20% recurring for life of customer)
- [ ] 7.4 Student discount (50% off Lite via .ac.uk verification)
- [ ] 7.5 First paid ad test (£500-1,000 LinkedIn)
- [ ] 7.6 PR pitch round (Guardian Money, FT, Times Money, BBC Worklife, Sifted)

MONTH 3-4 — B2B expansion phase 1: Coach white-label
- [ ] M3.1 Coach Pro tier (£49/mo + £6/client/mo) live
- [ ] M3.2 Coach Agency tier (£149/mo + £5/client/mo) live
- [ ] M3.3 Coach dashboard (manage clients, see aggregate stats)
- [ ] M3.4 Custom domain support (CNAME flow)
- [ ] M3.5 White-label theming UI in account settings
- [ ] M3.6 Outreach to 50 UK career coaches
- [ ] M3.7 First 5 coaches signed

MONTH 5-6 — Standby + Done-for-you
- [ ] M5.1 Standby tier live (passive scans for employed users)
- [ ] M5.2 Re-engagement campaign for dormant trial users
- [ ] M5.3 Exec Done-for-you workflow (separate intake, £499/engagement floor)
- [ ] M5.4 First 3 exec engagements completed

MONTH 7-9 — University + Outplacement
- [ ] M7.1 University site licence pricing finalised
- [ ] M7.2 Outreach to 30 UK university careers services
- [ ] M7.3 Outplacement contract template + sales deck
- [ ] M7.4 Outreach to 20 HR consultancies / outplacement firms
- [ ] M7.5 First university pilot signed
- [ ] M7.6 First outplacement contract signed

MONTH 10-12 — Data product + international scaffolding
- [ ] M10.1 Data API endpoints (read-only, query-rated)
- [ ] M10.2 Data API pricing tier (£600-£3,000/mo)
- [ ] M10.3 i18n string extraction
- [ ] M10.4 US region soft launch
- [ ] M10.5 First US users signed up

YEAR 2 — Scale
- [ ] Y2.1 Hire part-time support + content (£20-30k/year)
- [ ] Y2.2 5-15 coach agencies live
- [ ] Y2.3 1-2 universities live
- [ ] Y2.4 1-3 outplacement contracts active
- [ ] Y2.5 1-3 data product clients
- [ ] Y2.6 Canada + Australia regions launched
- [ ] Y2.7 Annual MRR run rate £281-564k

TAB BUILD ORDER inside weeks 1-4
- [ ] T1 Wishlist
- [ ] T2 Pipeline (Kanban)
- [ ] T3 CV Generator (3 effort levels)
- [ ] T4 Cover Letter Generator
- [ ] T5 Job Feed — Greenhouse + manual wishlist chips + Adzuna cross-reference
- [ ] T6 Job Feed — Web Search (Adzuna broad queries)
- [ ] T7 Stats
- [ ] T8 Interview Prep
- [ ] T9 Balanced Roles tab
- [ ] T10 Job Feed — Government (opt-in)
- [ ] T11 Job Feed — Returnships (Returner track)
- [ ] T12 Job Feed — Parental-friendly employers (Parent track)
```

## Pre-seeded admin to-dos (load into admin CMS on first setup)

**Marketing:**
1. Pick final tagline from 4 candidates by end of week 2
2. Buy domain (priority: marker.work, fallback: getmarker.com or marker.app)
3. Set up vouch-aesthetic landing page with hero, feature grid, pricing, testimonials
4. Create LinkedIn company page
5. Set up ConvertKit free tier for email capture
6. Set up Plausible analytics
7. Write 3 SEO cornerstone articles (work-life balance, parental leave benchmarks, AI CV tailoring)
8. Build press list of 50 UK journalists (Guardian Money, FT, Times, BBC Worklife, Sifted, BusinessLive)
9. Cold outreach pipeline: 10 emails/week to coaches, careers services, outplacement firms
10. Affiliate programme structure: 20% recurring commission for life of customer
11. Submit to Product Hunt, BetaList, Indie Hackers, HN Show HN in launch week

**Legal:**
1. Privacy Policy via SeedLegals or Rocket Lawyer (~£200-500)
2. Terms of Service customised (~£300-700)
3. Cookie banner (Cookiebot free tier or custom)
4. DPAs signed with Supabase, Anthropic, Stripe, Vercel
5. Apply for Adzuna commercial API access before public launch
6. "Jobs by Adzuna" badge on every Adzuna-sourced card (min 116×23px)
7. Disclaimers in product: parental leave factor accuracy, AI-generated CV review, score estimates
8. Encrypt BYO-keys in Supabase Vault, never log
9. Companies House Ltd registration if not already
10. Business bank account separate from personal
11. Public liability + professional indemnity insurance (Hiscox or Superscript)
12. VAT registration at £90k revenue threshold
13. Right-to-be-forgotten / data export flows in Settings

**Product:**
1. Pick final tagline by week 2 end
2. Mobile responsive pass week 4
3. Empty states for every tab
4. In-app tutorials and "why minimal API" cards
5. Allowance counter in nav bar, breakdown in Settings, end-of-month digest email

**B2B Sales (month 3+):**
1. Identify 50 UK career coaches with 5k+ LinkedIn followers
2. Build outreach sequence for coaches (3 touches)
3. Identify 30 UK university careers services
4. Build outreach sequence for universities (long cycle, formal)
5. Identify 20 UK HR consultancies and outplacement firms
6. Build outreach sequence for outplacement (data-led, ROI-focused)

## Product spec

Marker is a Next.js 15 multi-tenant SaaS on Vercel + Supabase. Users sign up under accounts. Accounts can be personal (default) or organisational (coach, agency, university, outplacement, enterprise).

### Onboarding (8 steps, one screen each, tappable options where possible)

1. **Track**: Balanced Roles / Standard / Parent (mum or dad seeking flexibility or returning) / Returner (career break) / Career changer
2. **Current status**: Employed searching / Employed passive (offers Standby tier) / Unemployed / On leave / Student / Returning from break
3. **Target role family**: controlled multi-select + free text. Canonical: Partnerships, Product Marketing, Programme Lead, Digital Strategy, Growth, BD, Engineering, Design, Data, Product Management, Ops, Finance, HR, Sales, Customer Success, Marketing Generalist, Other
4. **Seniority**: IC / Manager / Senior Manager / Head / Director / VP+
5. **Industries**: multi-select (Fintech, SaaS, Gaming, Martech, Retail Tech, Media, EdTech, HealthTech, Public Sector, Charity/Non-profit, Consumer Goods, Professional Services, Other)
6. **Location & remote**: postcode + region (default UK), max office days per week
7. **Hard filters**: salary floor, exclude sales quotas, must-have benefits (multi-select: enhanced parental leave, term-time, 4-day week, fully remote, hybrid, share options, private health). Balanced and Parent tracks surface these prominently
8. **Surfaces**: auto-recommended tabs based on previous answers, with override toggles

After onboarding: wishlist seeded from track's curated list, empty pipeline, generator tabs, relevant Job Feed sub-tabs.

### Feature gating per track

| Tab | Balanced Roles | Standard | Parent | Returner | Career changer |
|-----|----------------|----------|--------|----------|----------------|
| Wishlist | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pipeline | ✓ | ✓ | ✓ | ✓ | ✓ |
| CV Generator | ✓ (WLB-emphasis) | ✓ (default) | ✓ (parent-friendly) | ✓ (returner, transferable skills) | ✓ (career-changer) |
| Cover Letter | ✓ | ✓ | ✓ | ✓ | ✓ |
| Interview Prep (Pro) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stats (Lite+) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Greenhouse | conditional | conditional | conditional | conditional | conditional |
| Web Search | ✓ (WLB queries) | ✓ | ✓ (parent queries) | ✓ (returner queries) | ✓ |
| Government | opt-in (default on) | opt-in | opt-in | opt-in | opt-in |
| Balanced Roles tab | ✓ | optional | optional | optional | optional |
| Returnships | hidden | hidden | optional | ✓ | hidden |
| Parental-friendly employers | optional | hidden | ✓ | optional | hidden |

### All existing tracker features — port verbatim or near-verbatim

**Engine page:** task queue (one company at a time, sorted by ranking + staleness), Jump to company search across all columns, Open Careers Page, No Jobs / Found Job buttons, Quick add a job (paste link + role title), Found a job? analyser (Haiku-first), mini pipeline summary with status dropdowns and delete buttons, 24-hour "Recently added — check match?" prompt, salary estimates pre-fetched.

**Pipeline (Kanban):** 7 columns (Watchlist, No jobs, Worth applying?, Going to apply, Applied, Interviewing, Offer, Rejected). Drag-and-drop. Mobile status dropdown. Per-card: suitability score X/10, Apply/Maybe/Skip signal, office days badge (green ≤1, amber ≤2.5, red 3+), posted date, salary, score breakdown dropdown, edit modal, delete, CV button (jumps to CV Generator pre-filled), Rate suitability button on un-scored cards. Pipeline-wide: search, office filter, status filter, Check dead links button (HEAD scan pre-application jobs only), yellow badge on 404s.

**CV Generator (3 effort levels):**
- Level 1 — Full effort (you write it). ⭐ ChatGPT recommended ("ChatGPT asks better follow-up questions for guided interview-style sessions")
- Level 2 — 50/50. No recommendation
- Level 3 — AI does it. ⭐ Claude recommended ("Claude produces more polished structured CV output")

Each level generates copy-paste prompt sized to that effort level. All three include ATS optimisation + AI screening defence. All end with "share download links only — do NOT paste CV text in chat". Cover letter generator uses same 3-tier structure separately. Selecting effort level writes `cvEffortLevel` + `cvGeneratedAt` to the job for Stats correlation. Recent CVs history. "💡 If AI can't find the JD" instructional card.

**Interview Prep:** pick from Applied/Interviewing/Offer roles. Select stage (Screening / Hiring Manager / Panel / Final / Other). Upload submitted CV (PDF or .docx). Claude returns company research, likely questions per stage, best answers anchored to submitted CV, things to research, questions to ask them. Save prep doc to job.

**Job Feed — 3 sub-tabs:**
- **Jobs Task List**: nightly Greenhouse cron, active boards (verify at build time, was Tide/Monzo/Elastic/GitLab/Awin). Keyword allowlist + reject list per track. Score via Haiku-first cascade. Cap 3 per company, interleaved. Manual check section with colour-coded wishlist chips (green = rank 1, blue = rank 1.1, grey = lower; staleness: never red, 7d+ amber, recent grey). Adzuna matches cross-reference for wishlist names
- **Jobs Web Search**: nightly Adzuna cron, region-parameterised templates. UK uses API path `gb`, NEVER `where=United Kingdom`. **"Jobs by Adzuna" badge ≥116×23px on every card (legal requirement)**
- **Jobs Gov**: opt-in toggle in Settings. 12 civil service queries. Manual search section with job titles + official + contractor + hack links. Tutorial card on first visit explaining why it's separate

**Balanced Roles tab:** 6 criteria cards anchored to public data sources, 4 company categories (Public sector/funded bodies, Education/EdTech, Large stable corporates, Remote-first tech with human culture). Each company shows verifiable citations: Glassdoor WLB rating + review count, Working Families benchmark, parental leave rating. Tagline: "Companies where employees rate work-life balance highly, based on independent public review data." Search tips section. Best role titles section.

**Stats tab:** application volume over time, interview rate by CV effort level, conversion by score band (9-10, 7-8.9, 5-6.9, 1-4.9), industry/role-family performance, average score of interviewed roles, office days correlation, factor averages. Personalised insight strings ("9-10 scored roles convert at X% — prioritise these above all else"). Account-level rollup view for coach/uni/outplacement admins (same component, scope filter).

**Analyse (8-factor Claude scoring):** roleSkillsMatch, seniorityFit, industryFit, officeFlexibility, companyCulture (Glassdoor signal), paternityLeave (with `found` flag + `detail`, web search), salaryVsMarket, careerGrowth. Whole-number 1-7 + 0.2 increments 8-10. Display breakdown dropdown on result card AND kanban cards. Store full breakdown on job object. Disclaimer: "AI-generated estimates, not professional career advice."

### Admin CMS at /admin

Password-gated (magic link with hardcoded ADMIN_EMAIL env var). Schema in `admin` Postgres namespace.

Sections:
- **To-do list** (kanban: Marketing / Legal / Product / Press / B2B Sales). Pre-seed from list above
- **Curated company lists** per track + region (editable rosters with public-data sources)
- **Feature flags** — toggle tabs and features per track without code deploy
- **Tagline A/B test** — switch between 4 candidates, measure conversion
- **Metrics dashboard** — signups, paid users by tier, MRR, churn, API spend (Anthropic + Adzuna), free-to-paid conversion, CAC, LTV, B2B pipeline value
- **Press / partnership / B2B outreach CRM** — contacts, organisations, status, notes
- **Pricing experiments** — promo codes, A/B test logs
- **Account management** — view all accounts (personal + B2B), upgrade/downgrade, manual credit, suspend
- **Anonymised market intel viewer** — preview what the data product will sell

### Scale-ready architecture (build week 1-4, even though only B2C UI launches)

**Account hierarchy:**
- `accounts (id, type, name, plan, billing_email, stripe_customer_id, parent_account_id NULL, region, headless_mode, theme_json, custom_domain NULL, created_at)`
- `account_members (account_id, user_id, role, invited_by, joined_at)`
- Roles: `owner`, `admin`, `member`, `client` (coach-managed), `student` (uni-managed)
- Every user gets a personal account on signup (account_type = 'personal', they are owner)

**Region context:** every user/account has `region` field. Default UK. All Adzuna queries parameterised. CV prompts adapt to local norms.

**White-label theming:** Account-level theme (logo URL, primary colour, secondary colour, accent colour, font, email "from" name). CSS variables driven by account. Custom domain via Vercel CNAME for Coach Agency+. Headless mode hides all "Marker" mentions when set.

**Usage metering:**
- `ai_usage` per user
- `account_usage` rolled-up per account with quotas per tier
- Quota check before every Sonnet call. Soft warn at 80%, hard block at 100% until next billing period

**Anonymisation pipeline:** nightly cron aggregates salary distributions by role+region, application volume by company, score distribution by industry, parental leave benchmarks, office-days trends. Outputs to `market_intel` tables. No PII. Foundation for data product.

**Affiliate tracking:** `referrer_account_id` on every signup. Commission events on every paid conversion. 20% recurring for life of customer.

**Bulk import:** CSV upload (email, name, role) with batched magic-link invites. UI hidden until B2B launch.

### API economy — non-negotiable

**Anthropic pricing (May 2026):** Sonnet 4.6 $3 input / $15 output per million tokens. Haiku 4.5 $1 / $5. Always use prompt caching (90% discount on cached system prompts).

**Verified per-action costs (GBP, conservative, no caching):**
- Haiku first-pass score: £0.0036
- Sonnet 8-factor analyse: £0.049
- Sonnet CV generation: £0.062
- Sonnet cover letter: £0.030
- Sonnet interview prep: £0.088
- Haiku bulk re-score per job: £0.0008

With caching applied, real costs are 30-50% lower.

**Caching:** Greenhouse free, unlimited public JSON. Adzuna cached nightly by `(track, seniority, region, query_hash)` for 24h, shared. Anthropic prompt caching enabled day one.

**Rate limits per tier (hard caps, enforced before every call):**
- Free (7-day trial then locked): 3 Sonnet analyses/month, 30 Haiku scores, 0 CV/cover/prep
- Standby (£4): 5 analyses, 100 Haiku, weekly cached scans, 0 generations
- Lite (£12): 30 analyses, unlimited Haiku (fair use 500), 15 CVs, 15 cover letters, 0 interview prep
- Pro (£24): 100 analyses, unlimited Haiku (fair use 1500), 40 CVs, 40 cover letters, 12 interview preps
- Pro + BYO (£7): same as Pro but user's own key (zero API cost to Marker)

**Cap enforcement (every Sonnet call):**
```
async function checkAllowance(userId, action) {
  const tier = await getUserTier(userId)
  const monthStart = startOfMonth()
  const used = await db.ai_usage.count({
    where: { user_id: userId, action, created_at: { gte: monthStart } }
  })
  const cap = TIER_CAPS[tier][action]
  if (used >= cap) {
    throw new AllowanceExceeded(`${action} limit reached for ${tier} tier`)
  }
  return { used, cap, remaining: cap - used }
}
```

Admin alert if any single user's daily Sonnet spend exceeds £2 (catches bugs and abuse).

### Pricing tiers (Stripe products)

**Self-serve (B2C):**
| Tier | Monthly | Annual (20% off) | Max cost/user/month | Margin at cap |
|------|---------|-------------------|----------------------|---------------|
| Free (7-day trial, then locked) | £0 | — | £0.30 | — |
| Standby | £4 | £38 | £1.08 | 73% |
| Lite | £12 | £115 | £5.86 | 51% |
| Pro | £24 | £230 | £17.24 | 28% (64% avg) |
| Pro + BYO | £7 | £67 | £0.60 | 91% |
| Exec Done-For-You | £499/engagement | — | £328 | 34% |

**B2B (added month 3+):**
| Tier | Price | Notes |
|------|-------|-------|
| Coach Pro | £49/mo + £6/client/mo | Up to 50 clients, white-label |
| Coach Agency | £149/mo + £5/client/mo | Up to 200 clients, custom domain |
| University Site Licence | £9-18k/year | 1,000-5,000 student seats, white-label |
| Outplacement | £99-199/seat for 90 days | White-labelled, success reporting |
| Data API | £600-3,000/mo | Anonymised market intel, tiered |

Student discount: 50% off Lite for verified .ac.uk emails. Promo codes via admin CMS.

### Cap-aware UX requirements

1. Allowance counter in user nav bar: "12/30 CV generations"
2. Allowance breakdown in Settings: per-action remaining + reset date
3. Upgrade prompts at hard block: button text changes, modal explains next-tier value
4. Daily admin alert: if any user's daily Sonnet spend exceeds £2
5. Cost-of-action tooltip on hover: "Uses 1 of your 15 monthly CV generations"
6. Annual upgrade nudge: after first 80% warning, show banner "Save £29/year by switching to annual"
7. End-of-month allowance digest email: "You used 12 of 15 CV generations — strongest user pattern says people who use 15+ get more interviews"
8. No grandfathering on free tier: 30+ days dormant → archive data and reclaim cost slot

### Tech stack

- Next.js 15 App Router, JavaScript (not TypeScript — match existing tracker)
- Supabase: Postgres, Auth (magic link), Vault (BYO-key encryption)
- Vercel: hosting, Cron, env vars, CNAME for custom domains
- Anthropic SDK `@anthropic-ai/sdk` latest. Models: `claude-haiku-4-5-20251001` cheap, `claude-sonnet-4-6` expensive. Prompt caching enabled. Env-overridable model strings
- Stripe: subscriptions, annual plans, metered billing for seat-based B2B, promo codes
- Tailwind: styling, themable via account CSS variables
- Adzuna API: same keys pattern as existing tracker, region-parameterised

### Data model

```
accounts          (id, type, name, plan, billing_email, stripe_customer_id, parent_account_id NULL, region, headless_mode, theme_json, custom_domain NULL, created_at)
account_members   (account_id, user_id, role, invited_by, joined_at)
users             (id, email, default_account_id, created_at, last_active_at, trial_ends_at, referrer_account_id NULL)
profiles          (user_id PK, track, status, target_roles[], seniority, industries[], postcode, max_office_days, salary_floor, hard_filters_json, byo_anthropic_key_encrypted, name, contact_email, linkedin_url, region)
career_history    (user_id, role_title, company, start_date, end_date, description, achievements[])
wishlists         (id, user_id, account_id, company, careers_url, greenhouse_slug, rank, notes, added_at, last_checked_at)
jobs_cache        (id, source, source_id, company, role_title, location, salary, posted_at, link, raw_json, cached_at, track_tags[], region, adzuna_attribution_required boolean)
pipeline_items    (id, user_id, account_id, job_cache_id NULL, custom_company, custom_role, status, score, score_breakdown_json, signal, signal_reason, office_days, job_link, applied_at, posted_at, notes, cv_effort_level, cv_generated_at, dead_link_flag)
ai_usage          (id, user_id, account_id, model, action, input_tokens, output_tokens, cost_estimate_gbp, created_at)
account_usage     (account_id, period_start, period_end, sonnet_calls, haiku_calls, total_cost_estimate)
tier_allowances   (id, tier_name, action_type, monthly_cap_per_user, soft_warn_at_pct)
applications      (id, user_id, account_id, pipeline_item_id, cv_text, cover_letter_text, generated_at)
interview_preps   (id, user_id, account_id, pipeline_item_id, stage, submitted_cv_blob_url, prep_doc, created_at)
market_intel      (id, metric_type, region, role_family, seniority, value_json, computed_at)
referrals         (id, referrer_account_id, referred_user_id, status, commission_rate, lifetime_value, created_at)
commission_events (id, referral_id, amount, currency, period, paid boolean, created_at)
admin_todos       (id, category, title, description, status, due_at, created_at, completed_at)
admin_companies   (id, track, region, company, careers_url, glassdoor_url, public_data_sources_json, notes)
admin_feature_flags (id, flag_key, track, account_id NULL, enabled, notes)
admin_metrics_cache (id, metric, value, computed_at)
admin_outreach    (id, contact_name, organisation, role, email, category, status, last_touch_at, notes)
admin_taglines    (id, tagline_text, active boolean, impressions, conversions)
```

### Build conventions

- Build in staging first (`/home/claude/marker-staging` in chat mode, or work on `~/Desktop/marker` in Claude Code)
- Before any deploy, list files changed and why, in plain English
- After every deploy, give Rob a 30-second test script
- Deploys: `cd ~/Desktop/marker && npx vercel --prod`
- Project name in Vercel: `marker`
- Env vars needed: `ANTHROPIC_API_KEY` (copy from job-hunt-tracker's `jobtrackergeneral`), `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`

### Reuse, don't rewrite

Study `~/Desktop/job-hunt-tracker/app` before writing anything:
- `page.js` — every tab, kanban logic, CV generator (3 levels), Interview Prep, Easy Life (rename to Balanced Roles), Stats
- `api/feed-tasklist/route.js` — Greenhouse pull pattern, allowlist, reject list
- `api/feed-web/route.js` — Adzuna pattern
- `api/analyse/route.js` — 8-factor scoring + paternity leave web search
- `api/check-links/route.js` — dead link checker
- `api/cv/route.js` — CV generation pattern

Port patterns. Generalise: replace Rob's hardcoded recipe with per-user profile lookup, hardcoded wishlists with per-track/per-region curated lists, hardcoded query templates with per-track-and-seniority-and-region sets, "Easy Life" everywhere with "Balanced Roles", emoji 🛋️ removed.

### Definition of done — week 6 launch

- A new user finishes onboarding in under 3 minutes
- First job feed surfaces 5-15 relevant roles within 30 seconds
- CV tailoring under 2 minutes
- Balanced Roles users see companies anchored to verifiable public data
- API spend per active user under £0.50/month at free tier, under £3/month at Pro on average use
- Stats tab shows real insights from week 2 of use
- Admin CMS has all marketing + legal + B2B outreach to-dos pre-seeded
- "Jobs by Adzuna" badge on every Adzuna card (legal compliance)
- Allowance counter visible in nav bar, hard caps enforced
- Prompt caching enabled on all Sonnet calls
- Brand spec applied: lime `#C6F432`, black `#0A0A0A`, cream `#FAF7F2`, Inter + Space Grotesk
- B2B-ready architecture in place even though only B2C UI launches
- Feels like Rob built it for himself, not like a SaaS template

### First task

Read this entire brief. Then read `~/Desktop/marker/PROGRESS.md` if it exists, or create it from the template. Then ask Rob exactly one question: "Continue on step 1.1 (scaffold from job-hunt-tracker), or jump elsewhere?" Wait for his answer before writing any code.

Begin.

--- END PROMPT ---

---

## What to do right now

1. Check domain availability on Namecheap or Porkbun: priority `marker.work`, fallback `getmarker.com`, then `marker.app`, then `usemarker.com`
2. Buy the domain you pick. Costs ~£10-15/year
3. Create the project folder:
```
cd ~/Desktop
mkdir marker
cd marker
claude
```
4. Paste everything between `--- BEGIN PROMPT ---` and `--- END PROMPT ---` into the Claude Code session
5. Claude will ask you "Continue on step 1.1, or jump elsewhere?" — answer "1.1"
6. Sit back and watch it work. First session should get you through steps 1.1-1.5 (scaffold, Supabase, auth)

Total estimated time to private beta with 50 paying users: 6 weeks of focused build time. Total estimated API spend during build: £20-£60.

The plan is complete. Time to ship.
