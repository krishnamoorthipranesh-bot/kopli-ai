# KOPLI AI – Deployment Audit (2026-11-25)

## Current architecture

- **Frontend:** Vite-built React application served through Vercel.
- **Backend:** Express application bundled for the Vercel serverless handler at `api/handler.ts`.
- **Database:** PostgreSQL through Prisma, connected to Supabase.
- **Object storage:** private Supabase Storage bucket `kopli-user-files`.
- **Hosting decision:** Vercel + Supabase. Render is not part of the current production deployment path.

## Routing and build

- `vercel.json` routes `/health` and `/api/*` through the serverless API handler and sends remaining paths to the SPA entry point.
- Build command runs Prisma client generation, TypeScript build checks, server bundling, and Vite build.
- Vercel Preview deployment for the audit branch is **READY** at commit `b31caa29cb93c2c4bc52371fa9e58cede0024292`.
- GitHub CI and dependency-lock verification both passed on that commit. The CI pipeline includes TypeScript, tests, production build, and `npm audit --audit-level=high`.
- Latest build reported 0 npm audit vulnerabilities. It still emitted non-fatal npm configuration/install-script warnings; Prisma client generation and build completed.

## Production status

- The `kopli-ai.vercel.app` alias currently resolves to the existing Production deployment from the `master` branch, not the audit branch.
- Production was not changed by PR #15.
- Production Vercel environment variables include the Supabase URL and database connection, but not `SUPABASE_SERVICE_ROLE_KEY`.
- The private Storage bucket therefore cannot yet be certified as the active durable upload target for Production.
- Three malformed credential-shaped variable names exist in Production and require provider credential rotation and cleanup.
- Runtime log inspection for the recent 30-minute window returned no matching error/fatal entries. This is not a substitute for end-to-end functional tests.

## Cutover checklist

1. Rotate the affected Resend, Cloudflare, and Groq credentials; remove malformed Vercel environment entries and keep only correctly named variables.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel Production as an encrypted server-only variable; configure the same key for an isolated Preview environment if preview upload tests are required.
3. Confirm `DATABASE_URL`, `SUPABASE_URL`, `APP_URL`, `ALLOWED_ORIGINS`, email delivery, and owner settings for the correct environments.
4. Resolve/migrate the 19 legacy StoredFile metadata rows only after locating their original bytes.
5. Run registration → verification → login → logout, chat modes, image generation/preview, file upload/download/delete, conversation history, account isolation, and mobile composer regression tests.
6. Confirm `/health` returns liveness and `/api/health` returns readiness before merging.
7. Merge only after review; verify the Production deployment reaches READY and the `kopli-ai.vercel.app` alias points to the new commit. Run post-deploy smoke tests and monitor errors.

## Release decision

**Production cutover is blocked pending the checklist above.** A READY Preview build is not the same as a live Production update. No production database records or deployment have been modified by this audit branch.
