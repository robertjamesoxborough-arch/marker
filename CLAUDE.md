# Requite (repo folder: `marker`)

Working notes for Claude Code sessions in this repo. Read `REQUITE-MASTER-BRIEF.md` and `PROGRESS.md` at the start of a session; PROGRESS.md carries the stage log and its own pre-flight checklist.

## Deployment

**This Vercel project has NO GitHub integration.** Confirmed via the Vercel API: `"link": null`. `git push` NEVER triggers a deploy, and never has.

Every session that changes code must end with an explicit deploy, not just commit and push:

```
vercel --prod --yes
```

run from `~/dev/marker`.

**Before reporting any work as shipped or live, verify the deployment actually succeeded and is READY in production. Do not assume push equals deployed.**

Check with:

```
vercel ls marker --yes
```

Compare the newest deployment's age against the last commit. On 2026-08-20 production was found running a build from 13 August, seven days stale, missing five stages of work that had all been committed, pushed, and reported as shipped.

Connecting the GitHub repo in the Vercel dashboard would fix this permanently. It cannot be done from the CLI.
