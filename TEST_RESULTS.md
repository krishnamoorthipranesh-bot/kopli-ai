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

## Dependency audit details
The latest verified npm audit reports 0 vulnerabilities across the lockfile. The refreshed lockfile passed npm ci and npm audit --audit-level=high; high/critical findings now fail CI.


## Latest verified CI run
- Head commit: `6f0e40c8309a05db1cf1dcdafbf384c7fc729634`
- GitHub Actions run: [45552436857](https://github.com/krishnamoorthhipranesh-bot/kopli-ai/actions/runs/45552436857)
- Result: PASS; build job completed successfully (lint, TypeScript, tests, production build included by workflow).
- The dependency audit is still informational and reported 7 high-severity findings in the audit inventory.
- A Vercel Preview for this exact head and real visual/mobile QA remain unverified.

## Latest branch verification
- GitHub CI run #119: PASS — dependency install, strict npm audit, lint, TypeScript, 23 tests, and production build.
- Dependency lock refresh workflow run #8: PASS — npm ci, strict audit, TypeScript, 23 tests, and production build; regenerated package-lock.json committed.
- Vercel exact-head Preview remains blocked by the account's daily deployment cap; no visual browser/Android device QA is claimed.

## Production baseline previously inspected
- Vercel production deployment at commit `cb3b8d96fed86c6bb62fb70ba47e9488a989a045` was `READY`.
- Supabase project status was `ACTIVE_HEALTHY`.
- The inspected Vercel runtime error/fatal log window contained no matching entries.
- `SUPABASE_SERVICE_ROLE_KEY` was missing from the inspected Vercel environment-variable names; durable file storage was not verified.
- Full real-provider integration tests, durable file round-trips across serverless instances, browser E2E, and physical Android QA were not performed in that inspection.

## Dependency lockfile
`package.json` and `package-lock.json` are now aligned. CI uses `npm ci --include=dev` and the strict npm audit script.

## Reporting rule
A deployment marked READY proves deployment status only. It does not prove successful authentication, AI streaming, research, file persistence, or email delivery.
