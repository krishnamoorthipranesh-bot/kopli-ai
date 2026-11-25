# KOPLI AI – Vercel Production Deployment Audit

## Current production architecture
- Vercel: Vite/React frontend and Express serverless API.
- Supabase: PostgreSQL database.
- Prisma: database ORM and schema.
- Supabase Storage: private bucket `kopli-user-files`.
- Groq: AI chat and vision.
- Cloudflare Workers AI: image generation.
- Tavily: web research.
- Resend: optional password-recovery email.

## Observed deployment state
- Vercel project `kopli-ai` is configured for the Vite framework.
- Latest inspected production deployment was `READY` at commit `cb3b8d96fed86c6bb62fb70ba47e9488a989a045`.
- Supabase project status was `ACTIVE_HEALTHY`.
- The inspected Vercel runtime log window contained no error/fatal entries.
- These observations do not replace a real end-to-end production smoke test.

## Production smoke-test finding
A live request to the currently deployed production `/health` and `/api/health` returned HTTP 200 with `ready:true` while the response also reported `fileStorageConfigured:false` and `fileStorage:"temporary"`. The audit branch corrects this by keeping `/health` as liveness-only and making `/api/health` a strict readiness check. This fix is not yet deployed.

## Important readiness blocker
The Vercel environment-variable inventory did not include `SUPABASE_SERVICE_ROLE_KEY`. Supabase Storage persistence therefore remains unverified and the health endpoint should report degraded/unready until configured. The audit branch makes upload and file-generation routes fail closed in this condition.

## Code/configuration findings
- Production routing is defined by `vercel.json` and `api/handler.ts`.
- Prisma database initialization is performed by the serverless handler; automatic migrations are not run on each serverless instance.
- The CI workflow used an unnecessary personal access token for checkout; the audit branch removes it.
- An obsolete workflow pinged Render every five minutes; the audit branch removes it.
- Old Render/Docker files are retained as rollback artifacts only, not used in the production request path.
- Package and lockfile declarations are inconsistent; deterministic `npm ci` is not yet safe until the lockfile is regenerated and reviewed.

## Not yet verified
- Durable upload/download across separate serverless invocations and a new deployment.
- Live Groq, Tavily, Cloudflare image generation, and Resend transactions in this audit session.
- Full browser E2E, Android physical-device layout QA, and load/penetration testing.
