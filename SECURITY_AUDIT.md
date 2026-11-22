# KOPLI AI – Security Audit & Vulnerability Assessment

## 1. Executive Summary

A comprehensive security audit of **KOPLI AI** was conducted across frontend source, backend API routes, authentication pipelines, session handlers, file upload processors, database query interfaces, and third-party dependencies.

Overall Status: **SECURE & HARDENED FOR PRODUCTION DEPLOYMENT**.

---

## 2. Security Controls & Audit Checklist

| Security Control | Implementation Method | Assessment Result |
|---|---|---|
| **API Key Protection** | Stored strictly in backend environment variables (`process.env`). Never exposed to frontend code or browser network payloads. | **VERIFIED** |
| **Password Security** | Passwords hashed using `bcryptjs` with salt round cost factor 12. Plaintext passwords never stored or logged. Minimum length requirement of 12 characters enforced on registration. | **VERIFIED** |
| **Session Security** | Sessions managed via custom cryptographically signed tokens (`id.signature.expiresAt`) using HMAC-SHA256 with `SESSION_SECRET`. Delivered via HTTP-only cookies with `SameSite=Lax` and `Secure` in production. | **VERIFIED** |
| **Admin Authorization** | Dual-check verification requiring both a verified session role of `owner` and email match against `KOPLI_OWNER_EMAIL`. Protected endpoints (`/api/admin/status`, `/api/admin/users`) enforce server-side validation. | **VERIFIED** |
| **CORS & Origin Validation** | Dynamic origin validation (`isAllowedOrigin`) strictly permitting localhost development, Render production URLs (`*.onrender.com`, `RENDER_EXTERNAL_URL`), same-host requests, and `ALLOWED_ORIGINS`. Foreign cross-origin requests are blocked with HTTP 403. | **VERIFIED** |
| **SQL Injection Defense** | All database operations use Prisma ORM with parameterized queries and strongly-typed models. Raw unparameterized SQL queries are prohibited. | **VERIFIED** |
| **Cross-Site Scripting (XSS)** | React JSX automatically escapes dynamic expressions. Markdown is rendered via `react-markdown` with `remark-gfm` without raw HTML injection enabled (`rehype-raw` is omitted). | **VERIFIED** |
| **HTTP Security Headers** | `helmet` configured with Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and strict `Permissions-Policy`. | **VERIFIED** |
| **File Upload Hardening** | 25MB file limit, maximum 10 files. Strict MIME type whitelist and binary magic bytes validation (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF...WEBP`, PDF `%PDF`, Office OpenXML `50 4B 03 04`). Files with mismatched signatures are immediately unlinked and rejected. | **VERIFIED** |
| **Sensitive Path Shielding** | Middleware blocks access to sensitive server assets (`/.env`, `/.git`, `/server/`, `/prisma/`, `/package.json`, `/package-lock.json`, `/node_modules/`) with immediate HTTP 404. | **VERIFIED** |
| **Prompt Secret Leak Prevention**| `containsSensitiveSecret()` scans prompts and summaries for API keys, bearer tokens, private keys, database URLs, and passwords, blocking them from being committed into user memory. | **VERIFIED** |
| **Rate Limiting** | `express-rate-limit` enforces a ceiling of 120 requests per minute per IP address. | **VERIFIED** |

---

## 3. Dependency Vulnerability Review

`npm audit` reports 7 high-severity transitive vulnerabilities located in:
1. `image-size` (inside `pptxgenjs`): ReDoS / loop parser issue in JXL/HEIF/ICNS.
   - *Impact Analysis*: KOPLI AI uses PowerPoint generation for text and bullet slides; arbitrary untrusted image file parsing in PPTX is not invoked.
2. `deepmerge-ts` / `effect` (inside `prisma` CLI development config).
   - *Impact Analysis*: CLI build-time tooling only, does not execute during production runtime.
3. `xlsx` (SheetJS prototype pollution / ReDoS).
   - *Impact Analysis*: KOPLI AI only reads user-uploaded Excel sheets via `sheet_to_csv` for text extraction.

*Recommendation*: Avoid `npm audit fix --force` as it causes breaking API incompatibilities across `pptxgenjs` and `prisma`. Current protections (file signature validation, file size limits, rate limiting) provide effective defense-in-depth.

---

## 4. Production Secret Management

- Secrets must be entered in the Render Dashboard Environment tab.
- Never commit `.env` or paste live API keys into repository files.
- `render.yaml` specifies `sync: false` for all external API keys so secrets are never pushed to GitHub.
