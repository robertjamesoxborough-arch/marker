# JOURNEY-AUDIT.md — Stage 12c
## Full user-journey & failure audit (candidate + employer)

**Date:** 2026-06-24  
**Method:** Code trace only. Findings marked [code-confident] or [needs-human-testing].  
**Scope:** ~55 API routes, all primary UI pages, both journeys end-to-end.  
**Rule:** Read and report only. No fixes.

---

## Severity legend
| Tag | Meaning |
|-----|---------|
| **CRITICAL** | Broken in a way that blocks or crashes a primary journey for real users |
| **HIGH** | Significant gap or error — materially degrades an important flow |
| **MEDIUM** | Friction, wrong instruction, or silent failure — noticeable but non-blocking |
| **LOW** | Cosmetic, UX polish, minor copy inaccuracy |

---

## CANDIDATE JOURNEY — traced flow

```
/ (landing) → /auth (magic link or password) → /auth/callback → /onboard (6 steps) → /app
                                                                                        ├── Today tab (score URL, company wishlist, quick profile questions)
                                                                                        ├── Pipeline tab (kanban cards, Tailor CV, Score, Breakdown)
                                                                                        ├── Discover tab (Target Companies → Live Roles → Civil service)
                                                                                        ├── WLB tab (employer WLB guide)
                                                                                        └── CV/Interview/Stats sub-tabs
/settings → profile update, billing, CV update, delete account
```

## EMPLOYER JOURNEY — traced flow

```
/hire (landing + form, unauthenticated accessible) → /auth (if not logged in) → /hire (re-fill form)
  → POST /api/employer/profile + /api/employer/role → /employer (dashboard)
  → View shortlist → Request intro → Await candidate
  → candidate accepts → employer sees email → initiate contact
```

---

## FINDINGS

---

### C1 · CRITICAL · `recheckJob` undefined crashes Discover tab on stale jobs ✅ FIXED (stage 12d)
**File:** `app/app/page.js:1931–1933, 4884, 4981`  
**[code-confident]**

`FeedTab` is a module-level function (line 1809). `renderFeedCard` is a closure inside it. At lines 1931–1933, `renderFeedCard` references `recheckJob(job.id, job.link)` and `recheckingJobs[job.id]` — neither of which exists in `FeedTab`'s scope. Both are defined only inside the `Dashboard` component (lines 4884 and 4981) and are not passed as props to `FeedTab` (the call sites at lines 5199 and 5350 pass: `jobs, addJob, feedJobs, feedLoading, profile, defaultSubTab, onRefreshFeed`).

When any feed job has `freshness === 'Aging'` or `freshness === 'Stale'`, React attempts to evaluate `recheckingJobs[job.id]` — `recheckingJobs` is `undefined` in this scope, so `undefined[anyKey]` throws `TypeError: Cannot read properties of undefined`. This crashes the entire FeedTab component at render time, blanking the Live Roles view for every user who has stale jobs in their feed.

**Fix applied:** Added `recheckJob` and `recheckingJobs` to FeedTab's props destructuring at line 1809 and to both call sites (lines 5199 and 5350).

---

### H1 · HIGH · Hire page auth redirect uses wrong param — form data lost ✅ FIXED (stage 12d)
**File:** `app/hire/page.js:63`, `app/auth/callback/page.js:17`  
**[code-confident]**

When an unauthenticated user fills in the hire form and submits, `/hire/page.js` line 63 pushes to:
```js
router.push(`/auth?redirect=${returnUrl}`)   // param: "redirect"
```
But the callback handler at `app/auth/callback/page.js:17` reads:
```js
const next = searchParams.get('next') ?? '/app'   // reads: "next"
```
The param name mismatch means the callback never finds the redirect destination, defaults to `/app`, and the employer lands on the candidate dashboard with their hire form data gone. They must navigate back to `/hire` and re-fill everything.

The auth page itself also does not consume a `?redirect=` param (it reads only `?error=`).

**Fix applied:** Changed `/hire/page.js:64` from `?redirect=` to `?next=`. Callback now reads the param correctly and returns employer to `/hire` after sign-in.

---

### H2 · HIGH · Mutual opt-in is asymmetric — candidate has no employer contact ✅ FIXED (stage 12d)
**File:** `app/api/candidate/intros/route.js:78–81`, `app/employer/page.js:309–311`  
**[code-confident]**

After both sides opt in, the employer dashboard reveals `candidate.candidateEmail` (employer/page.js line 309). But the candidate's intros API (`/api/candidate/intros` GET, line 78–81) returns only:
- `companyName` (only if mutual)
- `roleTitle`, `roleLocation`, `roleSalary`
- `matchScore`, `status`

No employer email or contact method is returned to the candidate. The candidate sees "Introduction confirmed" and the company name, but has no way to initiate contact. The employer must reach out first — but the candidate has no way of knowing this, and the UI shows no explanation.

**Fix applied:** `/api/candidate/intros` GET now returns `employerEmail` (employer's account email, from `employer_profiles.user_id → users.email`). Field is `null` when not mutual — G1 invariant maintained: `employer` object is only non-null when `isMutual`.

---

### H3 · HIGH · No candidate notification when employer requests intro ✅ FIXED (stage 12d)
**File:** `app/api/employer/intro/route.js`  
**[code-confident]**

When an employer calls `POST /api/employer/intro`, the route creates an `intro_requests` row and logs to `intro_receipts` — but sends no email or push notification to the candidate. The candidate must proactively visit the Intros section of the dashboard to discover the pending request. If they don't, the request sits unanswered indefinitely.

**Fix applied:** `employer/intro` POST now calls `sendIntroRequest()` (new function in `lib/email.js`) after creating the intro_request row. Candidate email fetched via `users.email` for `match.user_id`. Fire-and-forget — any failure is swallowed without blocking the API response.

---

### H4 · HIGH · No employer notification when candidate accepts or declines intro ✅ FIXED (stage 12d)
**File:** `app/api/candidate/intros/route.js:127–155`  
**[code-confident]**

When a candidate calls `POST /api/candidate/intros` with `action: 'accept'` or `action: 'decline'`, the route updates the `intro_requests` row and inserts into `intro_receipts` — but sends no notification to the employer. The employer must manually reload the employer dashboard to see the status change. On a decline, the employer may not realise they need to move to the next candidate.

**Fix applied:** `candidate/intros` POST now calls `sendIntroResponse()` (new function in `lib/email.js`) after updating the intro_request. Employer email resolved via `match.employer_role_id → employer_roles.employer_id → employer_profiles.user_id → users.email`. Fire-and-forget — failure is swallowed without blocking the API response.

---

### M1 · MEDIUM · Middleware auth redirect has no `?next=` param — destination lost
**File:** `middleware.js:33–34`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

The middleware protects `/app`, `/onboard`, `/settings`, `/admin`, `/employer`. When an unauthenticated user hits a protected path directly (e.g. they bookmark `/settings`), the middleware redirects to:
```js
url.pathname = '/auth'
// no ?next= param added
```
After login, the auth callback defaults to `/app`. Users navigating directly to `/settings` end up on `/app` and must navigate manually. (The auth page itself doesn't read a redirect param either — so even if middleware passed `?next=`, the auth page wouldn't use it.)

**Fix applied:** `middleware.js` now sets `url.searchParams.set('next', pathname)`. `app/auth/page.js` reads `?next=`, validates it starts with `/`, threads it into magic link `emailRedirectTo` and password `router.replace()`. Destination preserved end-to-end.

---

### M2 · MEDIUM · "Re-run onboarding" is a destructive `<a>` link with no confirmation
**File:** `app/settings/page.js:478`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

```jsx
<a href="/api/dev/reset-onboard">Re-run onboarding</a>
```
A plain anchor tag performs the GET request on click with no confirmation dialog. One mis-click clears the user's onboarding track and redirects them to `/onboard`. The user's pipeline is preserved (per the route's implementation) but their track/preferences are reset. This is surprising destructive behaviour from a settings page link.

**Fix applied:** Replaced with a `<button>` + `onClick` that calls `window.confirm('Reset your onboarding settings? Your pipeline data will be preserved.')` before redirecting.

---

### M3 · MEDIUM · Onboarding step 3 blocked with no validation message
**File:** `app/onboard/page.js:383–387`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

Step 3 requires `field`, at least one `targetRole`, and at least one `seniority`. If any are missing, `canContinue` is false and the Continue button stays grey/disabled — but there is no inline error or instruction telling the user which fields are required. New users staring at a disabled Continue button have no idea what's missing.

**Fix applied:** Added validation hint above the Continue button in the sticky nav: "Select your field, at least one role type, and your level to continue." — visible only when `step === 3 && !canContinue`.

---

### M4 · MEDIUM · CV tab empty state sends users to wrong place
**File:** `app/app/page.js:1690`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

`CvTab` shows this when no CV is stored:
> "Go to the **Today** tab and answer 3 quick questions"

But the Today tab (score/engine flow) doesn't have a CV entry step. CV is stored either (a) during onboarding step 2, or (b) via Settings > Your CV. The "answer 3 quick questions" description matches a Today tab quick-profile flow that may not actually exist or doesn't store CV text.

**Fix applied:** Copy changed to "Paste your CV in **Settings › Your CV** to unlock tailored CV prompts. Takes 30 seconds." Primary CTA is now "Paste CV in Settings →" linking to `/settings`. "Go to Engine →" button removed.

---

### M5 · MEDIUM · Stripe checkout silent failure — no error shown
**File:** `app/settings/page.js:118–125`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

```js
async function startCheckout(plan) {
  setUpgrading(plan)
  try {
    const r = await fetch('/api/stripe/checkout', ...)
    const data = await r.json()
    if (data.url) window.location.href = data.url
  } catch { setUpgrading(null) }   // ← silent failure
}
```
If the checkout API call fails (network error, Stripe down, auth issue), the catch block silently resets the upgrading state. The "Upgrade" button reactivates with zero feedback. The user has no idea the payment setup failed.

**Fix applied:** `startCheckout` now calls `setError('Checkout failed — try again or contact support@requite.io.')` on failure. Error is cleared at the top of each attempt.

---

### M6 · MEDIUM · Stripe portal silent failure
**File:** `app/settings/page.js:128–135`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

Same pattern as M5. `openPortal()` catch block does only `setPortalLoading(false)` with no error message. Paying customers who can't access their billing portal see nothing wrong.

**Fix applied:** `openPortal` now calls `setError('Could not open billing portal — try again or contact support@requite.io.')` on failure.

---

### M7 · MEDIUM · Discover feed empty on day 1 with no in-app action
**File:** `app/app/page.js:2096–2118`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

Brand-new users who complete onboarding immediately visit Discover > Live Roles and find nothing — the Adzuna cron runs nightly. The empty state (line 2098) correctly explains this, but the suggested actions ("Add target companies ↑" / "WLB guide →") are the only options. There's no task or prompt to come back tomorrow, no estimated time, and no "notify me when roles are ready" option.

This is not broken but it's the first thing a new user sees after onboarding: an empty list. The impact on day-1 impression and retention is meaningful.

**Fix applied:** Added `NEXT UPDATE: TONIGHT AFTER 3AM UTC` timing note inside the lime empty-state card, directly below the explanatory text.

---

### L1 · LOW · Refresh button silently rate-limits with no feedback
**File:** `app/app/page.js:1824–1836`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

`handleRefresh()` checks localStorage and silently returns if the feed was refreshed within the last hour:
```js
if (Date.now() - last < 60 * 60 * 1000) return
```
The "↻ REFRESH" button does nothing, with no tooltip, toast, or message explaining the rate limit. Users clicking it repeatedly see no response.

**Fix applied:** Added `refreshCooldownMsg` state. When rate-limited, shows "Refreshed <1h ago — check back later" inline next to the refresh button for 4 seconds, then auto-dismisses.

---

### L2 · LOW · Interview prep empty state has no CTA to the pipeline
**File:** `app/app/page.js:653–660`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

When `activeJobs.length === 0`, PrepTab shows:
> "Mark a role as Applied first. Interview prep is available for roles at the Applied, Interviewing, or Offer stage."

Good explanation — but no link or button to go to the Pipeline tab and change a role's status. Dead end.

**Fix applied:** Added `onSwitchToPipeline` prop to `PrepTab`. Empty state now includes "Go to Pipeline →" button that calls `() => setTab('Pipeline')` via the prop.

---

### L3 · LOW · Interview prep legal line is factually incorrect
**File:** `app/app/page.js:784`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

```
"Live web research included. Takes 30-60 seconds. Uses your Anthropic API key."
```
The app uses its own Anthropic API key (from `ANTHROPIC_API_KEY` env), not the user's. This is a copy error that misrepresents the pricing model and could cause confusion.

**Fix applied:** Replaced with "Live web research via Claude — cost absorbed by Requite. Takes 30–60 seconds."

---

### L4 · LOW · Auth page copy doesn't indicate new users can create an account here
**File:** `app/auth/page.js:116–125`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

The auth page heading says "Sign in" and copy says "Enter your email and we will send you a magic link." The landing CTA is "Start free — score a role in 60 seconds." New users arriving from that CTA see "Sign in" and may not realise this is also where they create their account (Supabase OTP creates the user on first use).

**Fix applied:** Added sub-copy below the description: "No account yet? Just enter your email — we'll create yours automatically."

---

### L5 · LOW · Employer "Candidate view" link may confuse employer-only users
**File:** `app/employer/page.js:363`  
**[code-confident]** ✅ **RESOLVED — stage 12e**

The employer dashboard nav has `<Link href="/app">Candidate view</Link>`. Employers who have not completed candidate onboarding will be redirected to `/onboard` instead of seeing a meaningful candidate view. Employer-only users who click it may be confused by being dropped into candidate onboarding.

**Fix applied:** Removed the "Candidate view" link from the employer DashNav entirely. Employer nav now only contains "+ Post role" and "Why trust us".

---

## HANDOFF SEAMS — Summary

| Seam | Status | Severity |
|------|--------|----------|
| Employer requests intro → candidate notified | ✗ Missing | H3 |
| Candidate accepts intro → employer notified | ✗ Missing | H4 |
| Both opt in → employer gets candidate email | ✓ Implemented | — |
| Both opt in → candidate gets employer contact | ✗ Missing | H2 |
| Employer posts role → candidate pool visible | ✓ Implemented | — |
| New candidate onboards → score used in shortlist | ✓ Implemented | — |

---

## EDGE / EMPTY STATES — Summary

| State | Handled? | Notes |
|-------|----------|-------|
| New user day-1, empty Discover feed | ✓ Handled | Timing note added (M7 ✅) |
| No pipeline roles → CV tab | ✓ Handled | Settings CTA fixed (M4 ✅) |
| No applied roles → Interview tab | ✓ Handled | Pipeline CTA added (L2 ✅) |
| Employer no roles yet | ✓ Handled | Good empty state |
| Employer roles but no candidates | ✓ Handled | G1 "tell you plainly" message |
| Feed has stale/aging jobs | ✗ Crashes | recheckJob undefined (C1) |
| Stripe checkout fails | ✓ Error shown | setError on failure (M5 ✅) |
| Stripe portal fails | ✓ Error shown | setError on failure (M6 ✅) |
| Magic link sign-in fails (bad token) | ✓ Handled | Redirects to /auth?error=… |
| Already onboarded → /onboard | ✓ Handled | Redirects to /app |

---

## ERRORS — Summary

| Error path | Handled? | Notes |
|------------|----------|-------|
| Auth OTP send fails | ✓ | Inline error shown |
| Magic link token invalid | ✓ | Redirects to /auth?error= |
| Profile save fails (onboard) | ✓ | saveError shown inline |
| CV parse fails | ✓ | cvParseError shown inline |
| Analyse/score API fails | ✓ | scoreError shown per card |
| Hire form API fails | ✓ | setError shown |
| Stripe checkout fails | ✓ | Error shown (M5 ✅) |
| Stripe portal fails | ✓ | Error shown (M6 ✅) |
| Recheck job (stale) | ✗ | Crashes FeedTab (C1) |
| Intro request fails | ✓ | Error surfaced (employer/intro) |

---

## CONFIDENCE NOTES

All findings above are code-confident (traced from source) unless noted below:
- **C1**: Confirmed via scope analysis — `recheckJob` at line 4981 is inside `Dashboard`, `FeedTab` at line 1809 is module-level, no prop passed at call sites (lines 5199, 5350). [code-confident]
- **H1**: Confirmed — `/hire/page.js:63` uses `?redirect=`, callback reads `?next=`. [code-confident]
- **H2**: Confirmed — candidate intros API (GET) returns `companyName` only; no employer email field in response. [code-confident]
- **H3/H4**: Confirmed — neither intro route file contains email-sending logic. [code-confident]
- **M4**: "Today tab answer 3 quick questions" — exact content of Today tab's quick-profile flow not fully traced. Flagged as likely wrong but [needs-human-testing to confirm what Today tab actually shows to a new user with no CV].
- **M7**: Cron frequency confirmed nightly — [code-confident that day-1 feed is empty].

---

## FINDINGS COUNT

| Severity | Count | Resolved |
|----------|-------|---------|
| Critical | 1 | 1 (stage 12d) |
| High | 4 | 4 (stage 12d) |
| Medium | 7 | 7 (stage 12e) |
| Low | 5 | 5 (stage 12e) |
| **Total** | **17** | **17 — all resolved** |
