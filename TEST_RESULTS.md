# KOPLI AI – Test and Verification Record

## Current audit branch
Branch: `audit/production-cleanup-hardening`

The branch changes include:
- Removed stale Render runtime references from the API.
- Removed the obsolete Render keep-awake workflow.
- Removed unnecessary `GH_PAT` use from GitHub Actions checkout and limited workflow permissions to repository read.
- Made Vercel file upload and file generation fail closed when Supabase Storage is not configured.
- Made the health endpoint return an unready status when required persistent file storage is missing.
- Updated deployment, environment, architecture, and security documentation to reflect Vercel + Supabase.

## Checks available in repository CI
The CI workflow runs:
- dependency audit report
- ESLint if a lint script exists
- TypeScript type-check
- Vitest test suite
- production build (Prisma client generation, TypeScript build, server bundle, Vite build)

## Not yet verified for this branch
No passing CI run or Vercel Preview deployment is claimed until GitHub Actions and Vercel report success for this exact branch commit.

## Production baseline previously inspected
- Vercel production deployment at commit `cb3b8d96fed86c6bb62fb70ba47e9488a989a045` was `READY`.
- Supabase project status was `ACTIVE_HEALTHY`.
- The inspected Vercel runtime error/fatal log window contained no matching entries.
- `SUPABASE_SERVICE_ROLE_KEY` was missing from the inspected Vercel environment-variable names; durable file storage was not verified.
- Full real-provider integration tests, durable file round-trips across serverless instances, browser E2E, and physical Android QA were not performed in that inspection.

## Important dependency note
`package.json` and `package-lock.json` currently disagree on package declarations (including `pdf-parse` and TypeScript). CI uses `npm install --include=dev` to reconcile the working install. Do not switch to `npm ci` until a network-enabled lockfile regeneration has been reviewed and committed.

## Reporting rule
A deployment marked READY proves deployment status only. It does not prove successful authentication, AI streaming, research, file persistence, or email delivery.
