# KOPLI AI – Environment Variable Specification

All secrets must remain server-side. Never use `VITE_` prefixes for credentials, commit secret values, print them in logs, or paste them into chat.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Required for accounts/history | Supabase PostgreSQL connection for Prisma |
| `GROQ_API_KEY` | Required for AI chat | Groq inference |
| `GROQ_MODEL` | Optional | Text model override |
| `GROQ_VISION_MODEL` | Optional | Vision model override |
| `SUPABASE_URL` | Required for persistent files | Supabase project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for persistent files | Server-only Storage access; never expose to browser |
| `SUPABASE_STORAGE_BUCKET` | Optional | Defaults to private bucket `kopli-user-files` |
| `CLOUDFLARE_ACCOUNT_ID` | Required for image generation | Cloudflare account identifier |
| `CLOUDFLARE_API_TOKEN` | Required for image generation | Workers AI token; server-only |
| `TAVILY_API_KEY` | Optional | Live web research |
| `RESEND_API_KEY` | Optional | Account recovery email |
| `RESEND_FROM_EMAIL` / `EMAIL_FROM` | Optional | Accepted Resend sender identity |
| `SESSION_SECRET` | Required for secure sessions | Random server-side HMAC/session secret |
| `KOPLI_ADMIN_SECRET` | Optional | Admin verification / fallback secret |
| `KOPLI_OWNER_EMAIL` | Recommended | Owner account email |
| `APP_URL` | Recommended | Defaults to https://kopli-ai.vercel.app |
| `ALLOWED_ORIGINS` | Optional | Comma-separated additional origins |
| `PORT` | Local only | Defaults to 8787 |

## Vercel configuration

Set Production and Preview variables in Vercel Project → Settings → Environment Variables. Use encrypted/secret visibility for all credentials. The service-role key must be a server-only variable and must not be exposed in any client bundle.

## Persistent file storage

The Vercel deployment requires both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The existing `kopli-user-files` bucket must remain private. Without these settings, file upload and file-generation endpoints must return an explicit 503; Vercel `/tmp` is temporary and must never be represented as durable storage.

## Email behavior

Signup is intentionally allowed without email verification. Password recovery requires a working Resend API key and a sender accepted by Resend. If the sender is not configured/verified, recovery must report the failure rather than claim an email was sent.

## Legacy deployment artifacts

`render.yaml` and Docker configuration are retained only for rollback reference. They are not the production deployment path.
