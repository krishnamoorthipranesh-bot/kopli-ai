# KOPLI AI – Security Review (Evidence-Based)

## Scope
Source-level review of the Vercel/Express API, authentication/session handling, upload and download paths, Prisma schema, deployment environment-variable names, and existing CI configuration. This is not an external penetration test.

## Controls observed in source
- Passwords are hashed with bcryptjs (cost 12); registration enforces a 12-character minimum.
- Session tokens are generated with cryptographic randomness, stored hashed in PostgreSQL, and sent in HttpOnly cookies with SameSite=Lax and Secure in production.
- Owner-only endpoints check both the session role and configured owner email.
- Prisma is used for parameterized database access.
- Helmet configures CSP and standard security headers; the server also sets nosniff, referrer, permissions, and frame headers.
- Uploads have file-count/size limits, a MIME allowlist, and file-signature checks for supported binary formats.
- File download and library operations scope metadata lookups by the authenticated user.
- API-wide and route-specific rate limits are present.
- Supabase Storage uses server-side credentials and a private bucket path; the service-role key must never be exposed to the browser.

## Findings and limitations
- The production/preview Vercel environment-variable inventory did not contain `SUPABASE_SERVICE_ROLE_KEY`. Persistent file storage was therefore not verified. The current audit branch changes upload and generation paths to fail closed instead of treating Vercel temporary storage as durable.
- Existing file metadata contains local and `/tmp` paths. Some files may no longer exist after serverless instance recycling; no destructive cleanup or migration was performed.
- Supabase public tables retain RLS with no client policies. Existing table, sequence, and function privileges were revoked from anon/authenticated; default privileges for future objects created by postgres were also tightened. Server-side Prisma continues to use the database connection directly.
- CI previously used a personal access token for checkout. The audit branch removes that dependency and requests only repository read permission.
- Follow-up remediation pinned compatible patched transitive packages and replaced vulnerable spreadsheet/image-size packages. The regenerated lockfile now passes `npm ci` and `npm audit --audit-level=high` with 0 vulnerabilities; CI treats high/critical findings as a failure.
- Resend email delivery and sender verification are not currently proven by a live send test.
- No independent penetration test, production load test, or physical Android visual QA is claimed.

## Dependency vulnerability inventory
The latest verified dependency audit reports 0 vulnerabilities (0 high, 0 critical). The lockfile resolves `deepmerge-ts` 8.0.2, `effect` 3.22.5, the patched `@keep-lts/xlsx` 0.18.6 distribution, and `image-size-next` 1.2.2 for PptxGenJS. CI uses a strict audit gate.

## Required operational safeguards
- Store all secrets only in server-side Vercel environment variables.
- Rotate credentials that have been pasted into public logs, repository files, or untrusted channels.
- Keep the Supabase bucket private and enforce ownership checks before every file read/delete.
- Do not use `/tmp` as permanent storage.
- Do not apply blanket RLS policies or destructive database migrations.
