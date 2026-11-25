# KOPLI AI

KOPLI AI is a responsive AI assistant and workspace.

## Production architecture

- **Frontend and backend API:** Vercel (Vite/React + Express serverless handler)
- **Database:** Supabase PostgreSQL through Prisma
- **Persistent files:** private Supabase Storage bucket `kopli-user-files`
- **AI chat and vision:** Groq
- **Image generation:** Cloudflare Workers AI
- **Web research:** Tavily
- **Email:** Resend, optional and dependent on a verified sender

Render-specific files are retained only as historical rollback artifacts. They are not part of the production request path.

## Run locally

1. Install Node.js 22 or newer.
2. Install dependencies with `npm install --include=dev`.
3. Copy `.env.example` to `.env` and configure local/server-only values.
4. Start the app with `npm run dev`.
5. Open http://localhost:5173. The Express API runs on http://localhost:8787.

## Environment variables

Required for the complete production experience:
- `DATABASE_URL`: Supabase PostgreSQL connection string for Prisma.
- `GROQ_API_KEY`: Groq chat and vision requests.
- `GROQ_MODEL`, `GROQ_VISION_MODEL`: optional model overrides.
- `SESSION_SECRET`: random server-side session signing secret.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: server-side Supabase Storage access.
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`: Cloudflare Workers AI image generation.
- `TAVILY_API_KEY`: optional live web research.

Optional:
- `SUPABASE_STORAGE_BUCKET`: defaults to `kopli-user-files`.
- `RESEND_API_KEY` and `EMAIL_FROM` (or `RESEND_FROM_EMAIL`): password recovery email delivery. Resend must accept the configured sender.
- `APP_URL`: defaults to https://kopli-ai.vercel.app/.
- `ALLOWED_ORIGINS`: comma-separated additional browser origins.
- `KOPLI_OWNER_EMAIL`, `KOPLI_ADMIN_SECRET`: owner/admin configuration.
- `PORT`: local Express port, defaults to 8787.

Never use a `VITE_` prefix for server secrets. Never put service-role keys, database URLs, API tokens, or session secrets in browser code.

## File persistence behavior

Vercel's local filesystem is temporary. Uploads and generated files must be stored in the private Supabase Storage bucket with metadata in PostgreSQL. If the Storage service credential is absent, file uploads and file generation return an explicit unavailable response instead of pretending a temporary file is durable.

## Verification

Run:
```bash
npm test
npx tsc --noEmit
npm run build
```
