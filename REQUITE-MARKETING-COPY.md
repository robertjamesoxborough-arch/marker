# REQUITE — Marketing Copy Deck (Stage 12)
### Candidate-led, cheeky-but-classy, every claim backed by a built feature

> Rob approves/edits this first. Then it goes to Claude Code to *implement* — Claude Code does not write the copy, it places this copy.
> Rule that keeps us legal and classy: we never name a competitor, never say "unlike X". We make true, specific, confident claims about Requite. Anyone who's used the rivals will feel the point. That's the cheek — confidence, not complaint.

---

## DECISIONS (locked)
- **Hero audience:** candidates first. Employers get a clear one-click path and their own focused page.
- **Tone:** cheeky, warm, confident, dry British wit. Never bitter, never names names.
- **Primary CTA:** "Start free — score a role in 60 seconds." (No card. No waitlist.)
- **Secondary CTA:** "See how it works."
- **Proof anchor:** the /trust page (already built) is linked as the receipts.

---

## 1. CANDIDATE LANDING — HERO

**Kicker (small, above headline):**
For people who've done this before and would like it to be less of a circus.

**Headline (chrome treatment):**
The job hunt, minus the nonsense.

**Sub-headline:**
Requite scores every role against what actually matters to you, keeps your whole search in one place, and remembers you tomorrow. No spray-and-pray. No chatbot amnesia. No £30 a month to find out a job closed last week.

**Primary CTA button:** Start free — score a role in 60 seconds
**Under the button (micro-copy):** No card. No "talk to sales." Cancel by closing the tab.
**Secondary link:** See how it works →

*(Why it works: "done this before" speaks to the senior switcher. "chatbot amnesia" and "closed last week" are the G3 and G2 jabs — true, pointed, no names. "Cancel by closing the tab" is your existing line and it's great — keep it.)*

---

## 2. CANDIDATE LANDING — THE THREE PROMISES (the body)

Short section, three columns or stacked cards. Each is a guarantee, in plain English, with a quiet confidence.

**It remembers you.**
Your profile, your preferences, your whole pipeline — they live in your account, not in a chatbot's short-term memory. Close the tab, come back in a month, everything's exactly where you left it. See it all on your Memory Card.

**It tells you why.**
Every role gets a score across six things you actually care about — salary, seniority fit, location, office days, freshness, and the rest — and it shows you the reasoning. No mystery five-star ratings. No "trust us, it's a great match."

**It's all in one place.**
Discover, score, track, tailor your CV, prep your interview, rehearse the negotiation — one board, start to finish. The thing you'd otherwise be running in a spreadsheet and three browser tabs.

**Small print line under the three (links to /trust):**
We can back every word of that. Here's exactly how →

---

## 3. CANDIDATE LANDING — FRESHNESS / HONESTY STRIP

A one-liner band, dry and confident:

**Every job carries a "last checked" stamp. Stale ones get flagged. Closed ones get binned. You'll never again polish a cover letter for a role that died nine days ago.**

*(This is G2, made human. The specificity — "nine days ago," "polish a cover letter" — is the cheek.)*

---

## 4. CANDIDATE LANDING — FOR EMPLOYERS HANDOFF

A calm, confident strip near the bottom — the bridge to the money side:

**Hiring, not job-hunting?**
Requite introduces you to people who actually fit and actually want it — pre-screened, genuinely interested, no CV spam. You pay only when you hire. (And we're honest about what's automated and what isn't.)
**Button:** For employers →

---

## 5. EMPLOYER PAGE — HERO

**Kicker:**
For lean teams who can't stomach another 25% agency invoice.

**Headline (chrome treatment):**
Hire the people who actually want the job.

**Sub-headline:**
Requite gives you a short list of pre-screened candidates who genuinely fit your role and genuinely want it — not a scraped pile of maybes. You pay 8% only when you hire, with a three-month guarantee. And we'll always tell you what's done by AI and what's done by a human.

**Primary CTA:** Post a role — see your shortlist
**Under button:** No subscription. No fee unless you hire. No fake "we found 200 candidates."
**Secondary:** How the fee works →

*(8% undercuts the 10% rival without naming it. "scraped pile of maybes" and "fake 200 candidates" are the pointed-but-nameless jabs at marketplace vapourware. The human/AI honesty line is your whole brand.)*

---

## 6. EMPLOYER PAGE — HOW IT WORKS (3 steps)

1. **Tell us the role.** Describe what you need in plain language. We build the brief.
2. **See your shortlist.** Real candidates from our pool, scored against your role, anonymised until you both say yes. No noise, no ghosts.
3. **Pay only when you hire.** 8% of first-year base, three-month leaver guarantee. That's it.

**Honest line underneath:**
If we don't have the right people in your niche yet, we'll tell you — and tell you when we do. We'd rather lose your time than waste it.

*(That last line is the entire G1 honesty wedge, and it's the single most trust-building sentence on the employer page. It's also the exact opposite of what disappointed the rival's users.)*

---

## 7. REFERRAL MECHANICS (copy)

**For candidates:**
Know someone who should be using this? Send them your link. If they land a role through Requite, you both get a thank-you that isn't just words. [Get your link]

**For employers:**
Refer another hiring team. When they make their first hire through Requite, you both get a credit toward your next fee. [Refer a team]

*(Keep payout amounts out of the public copy for now — wire the mechanism, set the numbers in the dashboard, per the brief. Paid on success only, covered by the fee.)*

---

## 8. THE ONE-LINER (for meta tags, social, the top of everything)

**Requite — recruitment you can actually trust. Free for candidates, honest on both sides.**

---

## 9. WHAT CLAUDE CODE DOES WITH THIS (Stage 12 scope)
- Place this copy into the landing page and employer page, replacing leftover Marker messaging (the "parental leave / Greenhouse / Adzuna" job-tracker copy).
- Wire the /trust page in as the linked proof section.
- Implement the referral mechanics (links, capture, success-only crediting) using the referrals / commission_events tables that already exist.
- Verify analytics fire on the key events (signup, score, employer post, referral).
- Keep the chrome treatment with restraint; this copy is the content, the existing design system is the skin.
- Every claim here maps to a built feature — no new backend.

## 10. STILL TO RESOLVE BEFORE PUBLIC LAUNCH (not blocking Stage 12 build)
- Real domain + email (the requite.io placeholder isn't owned yet).
- Stripe live keys confirmed (parked).
- ICO registration.
- Final pricing numbers shown where appropriate.
