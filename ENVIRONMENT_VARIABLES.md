# KOPLI AI – Environment Variables (Vercel + Supabase)

All credentials belong in server-side Vercel environment variables. Never prefix secrets with `VITE_`, expose them to browser code, commit them to Git, or paste them into logs.

| Variable | Purpose | Required scope |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection used by Prisma for accounts, sessions, conversations, and file metadata | Production + Preview |
| `SUPABASE_URL` | Supabase project URL used by the private Storage adapter | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only credential for private Storage upload/download/delete | Production + Preview when testing durable file storage |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name; defaults to `kopli-user-files` | Optional |
| `GROQ_API_KEY` | Chat, vision, and voice transcription provider | Production + Preview |
| `GROQ_MODEL` | Main chat model identifier | Optional |
| `GROQ_VISION_MODEL` | Vision model identifier | Optional |
| `TAVILY_API_KEY` | Web search provider | Production + Preview |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier for Workers AI image generation and editing | Production + Preview |
| `CLOUDFLARE_API_TOKEN` | Server-only Cloudflare API token with Workers AI Read permission | Production + Preview |
| `RESEND_API_KEY` | Email delivery for verification and password reset | Production + Preview |
| `EMAIL_FROM` | Verified sender identity used by Resend | Production + Preview |
| `APP_URL` | Canonical app URL used to construct verification/reset links | Production + Preview |
| `ALLOWED_ORIGINS` | Comma-separated list of additional allowed browser origins | As needed |
| `SESSION_SECRET` | Server session/configuration secret; keep encrypted | Production + Preview |
| `KOPLI_ADMIN_SECRET` | Administrative secret; keep encrypted | Production + Preview |
| `KOPLI_OWNER_EMAIL` | Email address permitted to receive the owner role after email verification | Production + Preview |


| `PORT` | Local Express development port; Vercel manages production function ports | Local only |
| `NODE_ENV` | Runtime mode used for secure cookie behavior | Platform-managed |

## AI provider routing

- Groq is the primary provider for chat, vision, and voice transcription.
- Cloudflare Workers AI is the primary image provider. FLUX.1 Schnell handles text-to-image generation; FLUX.2 Klein 4B handles reference-image editing.
- Model availability, partner pricing, and free allocations can change. Never promise unlimited or permanently free generation; enforce per-user limits and handle quota exhaustion gracefully.
- The image editor resizes its reference image to 512 × 512 or smaller before sending it to FLUX.2 Klein.

## Persistent file storage

The `kopli-user-files` bucket is private. Vercel Production must have both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured for durable file storage. The service-role key must remain server-only. Without it, the application must not claim that uploads are durably stored; `/api/health` reports degraded readiness and Vercel file writes fail closed.

## Authentication and email

New registrations require email verification before sign-in. Configure `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_URL` so verification and password-reset emails can be delivered and link back to the correct environment. Owner privileges are granted only after the configured owner email has been verified; matching an email address at login alone does not grant owner access.

## Preview isolation

Preview variables should be scoped to the audit branch or another explicitly selected Preview branch and should point to an isolated test database/provider configuration where practical. Do not reuse Production database credentials for preview smoke tests unless the data and operational impact have been explicitly reviewed.

## Safe setup checklist

1. Add secrets directly in Vercel as encrypted/sensitive server-only variables.
2. Rotate any credential that was accidentally stored as an environment-variable name or otherwise exposed.
3. Remove malformed credential-shaped environment-variable entries after rotation.
4. Redeploy Preview and verify `/health` and `/api/health`.
5. Run authentication, chat, image, and private file upload/download tests before Production cutover.
