# KOPLI AI – Environment Variables Specification

This document lists all environment variables utilized by the **KOPLI AI** backend.

> **CRITICAL SECURITY NOTE**: All API keys, secrets, and database credentials must remain on the server. Never commit `.env` files to git, and never expose private keys in frontend bundles.

---

## 1. Environment Variable Reference

| Variable Name | Required? | Default / Example | Purpose |
|---|---|---|---|
| `GROQ_API_KEY` | Optional (Activates live AI) | `gsk_...` | API key from Groq to power high-speed LLM reasoning, code generation, and chat completions. |
| `GROQ_MODEL` | Optional | `openai/gpt-oss-120b` | Groq model identifier (alternatives: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`). |
| `TAVILY_API_KEY` | Optional (Activates live search) | `tvly-...` | API key from Tavily to enable real-time internet search and citation retrieval. |
| `CLOUDFLARE_ACCOUNT_ID` | Optional (Activates image AI) | Cloudflare account ID | Account used by Workers AI image generation and editing. |
| `CLOUDFLARE_API_TOKEN` | Optional (Activates image AI) | Server-only token | Workers AI API token. Keep it server-side with Workers AI permissions. |
| `CLOUDFLARE_IMAGE_EDIT_MODEL` | Optional | `black-forest-labs/flux-1-kontext-pro` | Allowed values: `black-forest-labs/flux-1-kontext-pro` or `black-forest-labs/flux-1-kontext-max`. Kontext Pro is billed at $0.04 per image; Kontext Max is billed at $0.08 per image according to Cloudflare model pricing. |
| `DATABASE_URL` | Optional (Activates cloud DB) | `postgresql://user:pass@host:5432/db` | PostgreSQL connection string for user accounts, chat persistence, memory, and file metadata. |
| `SUPABASE_URL` | Required for persistent file storage | `https://project-ref.supabase.co` | Supabase project URL used by the server-side Storage adapter. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for persistent file storage | Server-only secret | Server-side Storage access. Never expose this key in frontend code, browser storage, public logs or Git. |
| `SUPABASE_STORAGE_BUCKET` | Optional | `kopli-user-files` | Existing private bucket for user uploads and generated files. |
| `KOPLI_OWNER_EMAIL` | Recommended | `owner@example.com` | Email address designated as the administrator and project owner. Accounts matching this email receive the `owner` role automatically upon registration or login. |
| `KOPLI_ADMIN_SECRET` | Recommended | 32+ char random hex string | Random secret key used for administrative verification and fallback session signing. Generate a strong random secret and configure it in Vercel. |
| `SESSION_SECRET` | Recommended | 32+ char random hex string | Cryptographic secret key used to sign and verify HMAC-SHA256 session cookies (`kopli_session`). Configure a strong random value in Vercel. |
| `PORT` | Optional | `8787` (local) | Local Express server port. Vercel manages production function ports. |
| `ALLOWED_ORIGINS` | Optional | `https://customdomain.com` | Comma-separated list of additional allowed cross-origin domains (e.g. for custom domain mappings). |
| `NODE_ENV` | Optional | `production` | Node environment identifier. Enables production cookie security flags (`Secure`, `SameSite=Lax`). |

---

## 2. Persistent file storage

The Vercel deployment must have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured as server-only Production and Preview environment variables. The existing `kopli-user-files` bucket is private. Without the service-role key, Vercel can only use temporary `/tmp` storage; the `/api/health` endpoint reports this as `fileStorageConfigured: false`. Never add the service-role key to a `VITE_` or `NEXT_PUBLIC_` variable.

## 3. Default Fallback Behavior ("Demo Mode")

KOPLI AI is designed with an active fallback layer:
- If `GROQ_API_KEY` is omitted: The server answers with helpful setup guidance and identifies creator **Pranesh KK**.
- If `DATABASE_URL` is omitted: Guest conversations persist in browser `localStorage`.
- If `TAVILY_API_KEY` is omitted: The search endpoint returns an informative 503 notification explaining demo status without crashing.
- If Cloudflare credentials are omitted: image generation and image editing show a friendly provider setup notice. Image editing uses a paid FLUX Kontext model and is subject to Cloudflare billing and account limits.
- Document creation (Word `.docx`, PowerPoint `.pptx`, PDF reports, Excel `.xlsx`) continues to function using rich built-in academic and professional templates even in demo mode!
