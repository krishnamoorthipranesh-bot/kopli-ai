# FRIDAY AI

FRIDAY AI is a responsive AI assistant created and owned by Pranesh KK.

## Production architecture

- **Frontend and API:** Vercel. All browser API requests use same-origin `/api/*` routes handled by `api/handler.ts`.
- **Database:** Supabase PostgreSQL through the server-only `DATABASE_URL`.
- **Persistent files:** Supabase Storage through server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- **AI and integrations:** Groq, Tavily, Stability AI, and Resend from server-side environment variables.
- **Render is not part of the production architecture.** Do not add Render URLs, wake-up jobs, or Render deployment configuration.

## Run locally

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add server-side values.
4. Run `npm run dev`.
5. Open `http://localhost:5173`. The local Express API listens on port 8787.

## Vercel deployment

Connect this repository to the Vercel project `kopli-ai`, deploy the `master` branch, and configure the production and preview environment variables documented in [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md). The Vercel serverless entry point is `api/handler.ts`; `vercel.json` routes API requests to it.

After deployment, verify `/api/health`, sign-in, chat, search, image generation, and private file upload/download. Do not disable the legacy hosting service until those production checks pass.

## Demo mode

Without provider credentials, the app displays clear setup guidance. It does not pretend that external AI, search, or image-provider calls succeeded.
