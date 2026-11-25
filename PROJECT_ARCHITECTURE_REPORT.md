# KOPLI AI – Current Architecture

## Production stack

| Layer | Platform / technology |
|---|---|
| Frontend | React + Vite, deployed on Vercel |
| Backend API | Express serverless handler on Vercel |
| Database | Supabase PostgreSQL |
| ORM | Existing Prisma schema/client |
| File storage | Private Supabase Storage bucket `kopli-user-files` |
| Chat / vision inference | Groq |
| Image generation | Cloudflare Workers AI |
| Web research | Tavily |
| Email | Resend, optional and sender-dependent |
| Voice input | Browser Speech Recognition / Groq transcription endpoint |

## Request path

1. Browser loads the Vite SPA from Vercel.
2. `vercel.json` rewrites `/api/*` to `api/handler.ts`.
3. The handler imports the bundled Express app and initializes Prisma's database connection.
4. Authenticated account data, conversations, messages, settings, and file metadata are stored in Supabase PostgreSQL.
5. Permanent uploads and generated assets are stored in the private Supabase Storage bucket; the service-role key is server-only.
6. AI requests call Groq, Cloudflare Workers AI, or Tavily from the backend.

## Runtime and persistence notes

- Vercel serverless instances are ephemeral. Local `/tmp` is allowed only for temporary processing.
- Durable files require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- The current Vercel environment inventory did not include `SUPABASE_SERVICE_ROLE_KEY`; file persistence remains blocked until it is configured and verified.
- The backend does not run Prisma migrations automatically on every serverless cold start. Schema changes must use reviewed, safe migrations.
- Guest chat may use browser storage; authenticated conversation history uses PostgreSQL.
- Render Blueprint and Docker files are retained only as rollback artifacts, not as the production request path.

## Main source locations

- `src/main.tsx`: React application, chat state, navigation, API client.
- `src/styles.css`, `src/theme.css`, `src/chat-theme.css`: responsive styles and themes.
- `server/index.ts`: Express API, authentication, AI integrations, file handling, streaming.
- `server/config.ts`: provider and security configuration.
- `api/handler.ts`: Vercel serverless entry point.
- `vercel.json`: SPA and API rewrites.
- `prisma/schema.prisma`, `prisma/migrations/`: database schema and migration history.

## Verification limits

A READY Vercel deployment and a healthy Supabase project do not prove every feature works end-to-end. Durable file upload/download, live provider calls, full browser E2E, Android physical-device QA, and load/penetration testing must be reported separately.
