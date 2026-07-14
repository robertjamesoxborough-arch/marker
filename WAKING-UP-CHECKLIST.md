# WAKING UP CHECKLIST — Requite (marker)

Run this **every time you come back after a gap of more than a few days**, before you touch anything else. It tells you, in order, whether the thing is actually alive or quietly broken. Every command is copy-paste, single-line, read-only unless it says otherwise. Nothing here edits a file.

First, always start here:

```
cd ~/Desktop/marker
```

All the checks below read your keys straight out of `~/Desktop/marker/.env.local`, so you do not need to paste any secrets.

---

## 1. Is Supabase awake? (the number one cause of "it broke while I was away")

Supabase free tier pauses the database after about a week of no activity. The daily crons normally keep it awake on their own, but if the crons stopped (see step 2) the database can pause, and then everything fails at once.

```
source .env.local; curl -s -o /dev/null -w "Supabase HTTP: %{http_code} (200 = awake, 000/500/timeout = likely PAUSED)\n" --max-time 15 "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/jobs_cache?select=id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

- **HTTP 200** → awake, carry on.
- **000 / timeout / 500** → almost certainly paused.

**To unpause:** open https://supabase.com/dashboard/project/vclhyzpvxipkhptwlnkj , and if it shows "Project paused" click **Restore project** / **Resume**. It takes 1-3 minutes. Then re-run the command above until you get 200. Nothing else in this checklist will pass until this does.

---

## 2. Did the crons actually run AND insert rows? (not just "did they fire")

A cron can run, return 200, and insert nothing. This checks the real data: the newest job in the cache per source. You want to see timestamps from **within the last 24-30 hours**.

```
source .env.local; curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/jobs_cache?select=source,cached_at&order=cached_at.desc&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"; echo; echo "Now: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

Compare the `cached_at` to "Now". If the newest job is **more than ~2 days old**, the ingest crons have stopped (adzuna 03:00, gov 04:00, greenhouse/ats 02:00 UTC). Check the Vercel dashboard → Deployments → the project's **Cron Jobs** tab for red/failed runs, and check that the Vercel project is still deployed and not paused.

Total rows in the cache (sanity — should be in the thousands, not zero):

```
source .env.local; curl -s -I "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/jobs_cache?select=id" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Prefer: count=exact" | grep -i content-range
```

`content-range: 0-.../NNNN` — the number after the slash is the row count. A few thousand is healthy. **0 means the feed is silently empty** even if the site looks fine.

---

## 3. Is the live site serving the current deploy?

```
cd ~/Desktop/marker; vercel ls marker 2>/dev/null | head -20
```

Confirms the latest production deployment is **Ready** and recent. To confirm the public URL actually responds:

```
curl -s -o /dev/null -w "Homepage HTTP: %{http_code}\n" https://marker-silk.vercel.app/
```

200 = live. Anything else = the deploy or the domain is broken.

---

## 4. Is the job feed actually non-empty for a real user? (not just the cache)

The cache can be full but the feed still shows nothing if freshness filtering has marked everything Expired (which happens if the crons stopped and every row aged out). These two lines print the exact count of **Fresh** and **Expired** jobs:

```
source .env.local; curl -s -I "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/jobs_cache?select=id&freshness=eq.Fresh" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Prefer: count=exact" | grep -i content-range | sed 's|.*/|Fresh jobs: |'
```

```
source .env.local; curl -s -I "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/jobs_cache?select=id&freshness=eq.Expired" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Prefer: count=exact" | grep -i content-range | sed 's|.*/|Expired jobs: |'
```

You want a healthy `Fresh jobs` count (thousands). If it is near zero and `Expired jobs` is high, the crons have stopped and the feed will look empty or dead to users even though rows exist. Fix the crons (step 2).

---

## 5. Does a pipeline save actually persist? (the bug that hid for the whole project)

The pipeline is the core table. A schema/column drift here fails silently behind an empty catch, so the UI shows "saved" and nothing lands. This writes a throwaway test row with the exact shape the app uses, confirms it persisted, then deletes it. **This one writes and then cleans up after itself.** (The `set -a` at the front exports the keys so the Python one-liner can read them.)

Insert the test row (expect `Insert HTTP: 201`):

```
set -a; source .env.local; set +a; python3 -c "import os,json,urllib.request as u; U=os.environ['NEXT_PUBLIC_SUPABASE_URL']; K=os.environ['SUPABASE_SERVICE_ROLE_KEY']; A={'apikey':K,'Authorization':'Bearer '+K}; row=json.load(u.urlopen(u.Request(U+'/rest/v1/users?select=id,default_account_id&limit=1',headers=A)))[0]; b=json.dumps({'id':'00000000-0000-0000-0000-0000000000ff','user_id':row['id'],'account_id':row['default_account_id'],'status':'watchlist','added_at':'2020-01-01T00:00:00Z'}).encode(); print('Insert HTTP:', u.urlopen(u.Request(U+'/rest/v1/pipeline_items',data=b,headers=dict(A,**{'Content-Type':'application/json','Prefer':'return=minimal'}),method='POST')).status, '(201 = pipeline saves work)')"
```

- **Insert HTTP: 201** → pipeline persistence works.
- **A Python traceback ending in `PGRST204 ... could not find the 'X' column`** → a column has drifted again. That is the exact class of bug from before (the `added_at` one). Do not ship until fixed.

Delete the test row (always run this after):

```
set -a; source .env.local; set +a; python3 -c "import os,urllib.request as u; U=os.environ['NEXT_PUBLIC_SUPABASE_URL']; K=os.environ['SUPABASE_SERVICE_ROLE_KEY']; print('Cleanup HTTP:', u.urlopen(u.Request(U+'/rest/v1/pipeline_items?id=eq.00000000-0000-0000-0000-0000000000ff',headers={'apikey':K,'Authorization':'Bearer '+K},method='DELETE')).status, '(204 = removed)')"
```

---

## 6. Are the paid integrations still alive? (only if you are about to charge people)

These are the things with their own expiry/billing clocks that break independently of your code:

- **Anthropic API key** — if scoring returns "No API key configured" or every AI call errors, the key was rotated or the credit ran out. Check https://console.anthropic.com/ billing and keys.
- **Adzuna** — free tier has a monthly call cap. If the feed stops growing but Supabase and crons are fine, you may have hit the Adzuna cap. Check https://developer.adzuna.com/.
- **Stripe** — test vs live mode, and the webhook secret. The webhook signing secret in Vercel (`STRIPE_WEBHOOK_SECRET`) must match the endpoint in the Stripe dashboard, or subscriptions will silently not activate.
- **Resend** — the sending domain must stay verified or trial emails stop going out. Check https://resend.com/.

Note: your local `.env.local` does **not** contain `CRON_SECRET`, `RESEND_API_KEY`, or the Stripe keys — those live only in Vercel production. That is fine for production, but means you cannot test email/Stripe/cron-auth locally.

---

## If everything above passes

The database is awake, the crons are inserting, the deploy is live, the feed is fresh, and a real write persists. That is the whole "is it actually alive" question answered in about two minutes. Anything that fails points you straight at the cause instead of guessing.
