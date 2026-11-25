# KOPLI AI – Security Audit (2026-11-25)

## Scope and confidence

Reviewed the current Vercel/Supabase code path, authentication handlers, file persistence adapter, CI workflows, dependency lockfile, Supabase database metadata, and Vercel project environment-variable names. This is a source/configuration audit, not an independent penetration test or physical-device QA.

## Verified controls

- **Authentication hardening in PR #15:** new registrations require email verification before sign-in; owner role assignment occurs only after the configured owner email is verified. Existing production accounts/data were not changed by this branch.
- **Sessions:** server-side session records are stored in PostgreSQL; session tokens are random and stored hashed. Cookies are HTTP-only, SameSite=Lax, and Secure in production.
- **Password handling:** passwords are hashed with bcryptjs; plaintext passwords are not stored.
- **Authorization:** protected data routes resolve the authenticated user and use user-scoped Prisma queries in the reviewed paths. Continue regression testing every route before production release.
- **HTTP protections:** Helmet security headers, origin allowlisting, JSON request-size limit, and express-rate-limit are configured.
- **Uploads:** upload size/type checks and archive text extraction protections are present. File content must be persisted to durable storage in serverless production.
- **CI supply-chain controls:** checkout credentials are not persisted and workflows use read-only repository permissions. Dependency audit is a required CI step.
- **Dependency audit:** the current lockfile passes `npm audit --audit-level=high` with **0 reported vulnerabilities** in the latest successful CI run.
- **Supabase database:** RLS is enabled on the 14 public tables. No grants to anon/authenticated/PUBLIC and no public-schema policies were found. Supabase reports 14 informational `rls_enabled_no_policy` notices; this is intentional only while all database access is through the trusted server-side Prisma connection. Do not expose the service database credential to clients.
- **Supabase Storage:** the `kopli-user-files` bucket is private.

## Release blockers / required actions

1. **Durable storage credential missing:** Vercel Production has `SUPABASE_URL` but does not have `SUPABASE_SERVICE_ROLE_KEY`. The branch now fails closed for file writes on Vercel when durable storage is unavailable and exposes `/api/health` readiness separately from `/health` liveness. Add the service-role key directly as an encrypted server-only Vercel variable before enabling file uploads in production. Never put it in client code or Git.
2. **Credential-shaped environment variable names:** three malformed Production variable names contain strings resembling Resend, Cloudflare, and Groq credentials. Treat the corresponding credentials as exposed: rotate them with their providers, create correctly named variables, then remove the malformed Vercel entries. Do not copy their names or values into tickets, logs, or source control.
3. **Preview isolation:** existing Preview secrets are attached to older Git branches. The new audit branch cannot be fully authenticated/AI-smoke-tested until suitable Preview variables are configured.
4. **Legacy file metadata:** 19 existing StoredFile records were identified with local/temporary paths (10 under `/tmp`, 9 other absolute paths). Their original file bytes have not been migrated or deleted. Reconcile each source before cleanup; do not assume those files are recoverable.
5. **Additional assurance:** Android physical-device QA and independent penetration/load testing remain outstanding.

## Release decision

**Do not merge/deploy PR #15 to Production yet.** The code branch and preview build pass automated CI, but the missing storage secret, malformed credential entries, and unverified legacy file records must be addressed first. Production remains on its existing deployment until a controlled cutover is approved and smoke-tested.
