# KOPLI AI – Current Audit Findings and Remaining Work

Last reviewed against repository branch `master`, Vercel project configuration, and Supabase project state on 2026-11-25.

## Verified baseline
- Production Vercel deployment for commit `cb3b8d96fed86c6bb62fb70ba47e9488a989a045` was reported `READY`.
- Production stack is Vercel + Supabase PostgreSQL + Prisma, with Groq, Cloudflare Workers AI, and Tavily integrations configured.
- Supabase project is `ACTIVE_HEALTHY`.
- Recent Vercel runtime error scan returned no matching error/fatal logs in the inspected 30-minute window.
- Prior source changes added Supabase Storage support, route-specific rate limits, CORS tightening, and mobile layout fixes.

## Critical blockers
1. **Supabase Storage credential missing from Vercel.** `SUPABASE_SERVICE_ROLE_KEY` was not present in the inspected Production or Preview environment-variable names. Persistent storage code therefore cannot be considered operational. Add the service-role key directly in Vercel as an encrypted server-only variable; never share it in chat.
2. **Legacy file records point to ephemeral paths.** Existing metadata includes records whose paths point to `/tmp` and other local filesystem locations. These records have not been migrated or deleted. Files that disappeared after a serverless restart cannot be reconstructed from metadata alone.

## Additional findings / verification gaps
- `package.json` and `package-lock.json` are inconsistent (including `pdf-parse` and TypeScript declarations); CI currently uses `npm install` rather than deterministic `npm ci`. Regenerate and review the lockfile with a network-enabled build environment before switching to `npm ci`.
- Several dependencies are declared as `latest`; pin reviewed versions to reduce supply-chain drift.
- Resend sender verification and real password-recovery delivery have not been re-verified. Signup does not require email verification.
- Android physical-device visual QA and a full desktop/mobile browser E2E suite have not been completed in this audit.
- RLS is enabled on the existing public tables; no policies were present in the previous advisor review. The application uses server-side Prisma access. Do not add broad policies without reviewing the actual Data API exposure and access model.
- No complete external penetration test or production load test has been performed.

## Work in progress
- Branch `audit/production-cleanup-hardening` removes stale Render production references, removes the Render keep-awake workflow, removes unnecessary `GH_PAT` use from CI, and makes file-generation/upload endpoints fail closed when persistent storage is not configured.
- These branch changes are not production-complete until CI, Preview, and Production verification pass.
