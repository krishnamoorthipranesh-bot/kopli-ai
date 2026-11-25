# KOPLI AI – Vercel + Supabase Production Deployment

This is the production deployment path. Do not deploy the production application to Render.

## Architecture
- Vercel serves the Vite/React frontend and the Express API through `api/handler.ts`.
- Supabase PostgreSQL is accessed through Prisma using `DATABASE_URL`.
- Private Supabase Storage bucket: `kopli-user-files`.
- Groq handles chat/vision, Cloudflare Workers AI handles image generation, and Tavily handles web research.
- Resend is optional and requires a sender address/domain accepted by Resend.

## Vercel environment variables

Set values in Vercel Project → Settings → Environment Variables. Keep secrets encrypted and server-only.

| Variable | Requirement | Notes |
|---|---|---|
| `DATABASE_URL` | Required | Supabase PostgreSQL connection URL; use the appropriate Supabase pooler/direct endpoint for Prisma |
| `GROQ_API_KEY` | Required for AI chat | Server-only |
| `GROQ_MODEL` | Optional | Defaults in server config |
| `GROQ_VISION_MODEL` | Optional | Defaults in server config |
| `SESSION_SECRET` | Required for secure sessions | Use a long random secret |
| `SUPABASE_URL` | Required for persistent files | Project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for persistent files | Server-only; never use a public/publishable key here |
| `SUPABASE_STORAGE_BUCKET` | Optional | Defaults to `kopli-user-files`; bucket must remain private |
| `CLOUDFLARE_ACCOUNT_ID` | Required for image generation | Server-only configuration |
| `CLOUDFLARE_API_TOKEN` | Required for image generation | Workers AI permissions; server-only |
| `TAVILY_API_KEY` | Optional | Enables live web research |
| `RESEND_API_KEY` | Optional | Password recovery email |
| `EMAIL_FROM` or `RESEND_FROM_EMAIL` | Optional | Sender must be accepted/verified by Resend |
| `APP_URL` | Recommended | https://kopli-ai.vercel.app |
| `ALLOWED_ORIGINS` | Optional | Comma-separated allowed browser origins |
| `KOPLI_OWNER_EMAIL` | Recommended | Owner account email |
| `KOPLI_ADMIN_SECRET` | Optional | Server-side admin secret |

Set the correct targets (Production and Preview) before deploying. Do not paste credentials into chat or commit them to GitHub.

## Deployment and verification

1. Confirm the Vercel project is connected to this repository and production branch `master`.
2. Confirm all required environment-variable names exist for the intended target; inspect names only, never decrypt secrets for a report.
3. Confirm the Supabase project is active and the private `kopli-user-files` bucket exists.
4. Push reviewed code through the repository's normal Git/Vercel integration.
5. Wait for Vercel deployment state `READY` and verify the commit SHA.
6. Check `/`, `/health`, `/api/health`, `/api/status`, auth, chat, streaming, and file upload/download using a test account.
7. Verify uploaded bytes can be retrieved after a separate serverless invocation and after a new deployment.

## Readiness rules

- `/api/health` must report database and persistent file storage ready. A missing Supabase service-role key is a blocker, not a successful deployment.
- Do not rely on `/tmp` for permanent files.
- Do not claim email recovery works until a real Resend send succeeds with an accepted sender.
- Do not apply destructive migrations or change production database URLs without a verified backup and explicit approval.

Legacy `render.yaml` and Docker files are retained only as rollback artifacts and are not used by the production architecture.
