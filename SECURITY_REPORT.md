# KOPLI AI Security Report

## Summary

The application now has a baseline production security layer. This report describes implemented controls and remaining limitations; it does not claim the application is completely unhackable.

## Implemented

- Helmet HTTP security headers, including CSP, frame denial, referrer policy and permissions policy.
- Restricted CORS to local development origins.
- Private path blocking for `.env`, `.git`, backend source folders, package manifests and `node_modules`.
- HTTP-only, signed, expiring session cookies.
- bcrypt password hashing support.
- Server-side registration, login, logout and identity status routes.
- Owner-role verification using `KOPLI_OWNER_EMAIL`.
- Protected `/api/admin/status` route.
- `/admin` chat command returns denial unless a verified owner session is present.
- Same-origin mutation checks.
- Request size limits and per-IP rate limiting.
- File MIME allowlist and file-signature validation.
- Randomized upload storage IDs and sanitized frontend filenames.
- Provider keys remain backend-only through environment variables.
- `.env` and private build artifacts are excluded through `.gitignore`.
- Streaming thinking indicator and blinking-free response transition.
- Authenticated user memory preferences and cross-chat retrieval foundations.
- Privacy-safe feedback recording and memory export controls.

## Verified

- Production build completes successfully.
- `/api/status` reports Groq, Tavily, Stability AI and PostgreSQL operational.
- `/chat/coding` and the main homepage return HTTP 200.
- `/\\.env` is blocked with HTTP 404.
- `/api/admin/status` denies unauthenticated requests.
- `/admin` chat command returns "Admin access is restricted." without an owner session.
- Security response headers are present.
- Invalid file-signature test behavior was implemented and validated at build level.

## Remaining Limitations

- A valid `KOPLI_OWNER_EMAIL` and `KOPLI_ADMIN_SECRET` must be configured before owner access can operate in production.
- A real owner login page and password-reset/email flow should be completed before public deployment.
- Current conversations and files are not yet fully associated with authenticated user identities and Row Level Security.
- Supabase RLS is not active because the application uses local PostgreSQL/Prisma persistence.
- `npm audit` reports remaining high-severity transitive vulnerabilities in Prisma dependencies, SheetJS/xlsx and PptxGenJS image-size dependencies. They require dependency upgrades or replacements and are not silently fixed by forced major upgrades.
- Browser speech recognition remains dependent on Chrome/Edge recognition availability and network service support.
- Malware scanning is not available unless an external scanner is installed.
- HTTPS and deployment hosting must enforce TLS outside this local server.
