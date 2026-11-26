# KOPLI AI – Vercel Production Deployment

## Production architecture

KOPLI AI runs on Vercel. The Vite frontend is served from the Vercel deployment and all `/api/*` requests are routed to the Express serverless entry point in `api/handler.ts`. Supabase provides PostgreSQL and private file storage. Render is not used.

## Required Vercel configuration

Set the variables in Vercel Project Settings → Environment Variables for **Production** and **Preview** as appropriate. Keep all credentials server-only (never use `VITE_` prefixes for secrets).

- `DATABASE_URL`: Supabase PostgreSQL connection string.
- `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_VISION_MODEL`: AI chat and vision.
- `TAVILY_API_KEY`: web search.
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`: image generation and editing through Workers AI.
- `CLOUDFLARE_IMAGE_EDIT_MODEL=black-forest-labs/flux-1-kontext-pro` (optional; defaults to this model). Cloudflare currently lists Kontext Pro at $0.04 per image and Kontext Max at $0.08 per image; usage is billed by Cloudflare.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (or legacy `EMAIL_FROM`): verification and recovery email.
- `SESSION_SECRET`, `KOPLI_ADMIN_SECRET`, `KOPLI_OWNER_EMAIL`: sessions and owner access.
- `APP_URL=https://kopli-ai.vercel.app`.
- `ALLOWED_ORIGINS=https://kopli-ai.vercel.app`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=kopli-user-files`: persistent private file storage.

## Deployment checks

1. Deploy the exact intended commit to the Vercel Production target.
2. Open `https://kopli-ai.vercel.app/api/health`; expect HTTP 200 and `ready: true`. For persistent files, expect `fileStorage: "persistent"` and `fileStorageConfigured: true`.
3. Test account registration/sign-in and session persistence.
4. Test chat, web search, image generation, image editing (with a small PNG/JPEG/WebP), and document generation.
5. Upload a file, retrieve it, rename it, and delete it; verify private access.
6. Inspect Vercel function logs for errors and verify mobile UI.
7. If an older hosting service is still running, shut it down separately after the Vercel production deployment has passed all checks.

## Rollback

Vercel retains prior deployments. If a release fails, use Vercel Deployments to promote the last known-good Production deployment while correcting the issue.
