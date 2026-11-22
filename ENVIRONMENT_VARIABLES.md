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
| `STABILITY_API_KEY` | Optional (Activates image gen) | `sk-...` | API key from Stability AI to generate Stable Diffusion visual content in Explore mode. |
| `DATABASE_URL` | Optional (Activates cloud DB) | `postgresql://user:pass@host:5432/db` | PostgreSQL connection string for user accounts, chat persistence, memory, and file metadata. |
| `KOPLI_OWNER_EMAIL` | Recommended | `owner@example.com` | Email address designated as the administrator and project owner. Accounts matching this email receive the `owner` role automatically upon registration or login. |
| `KOPLI_ADMIN_SECRET` | Recommended | 32+ char random hex string | Random secret key used for administrative verification and fallback session signing. Automatically generated in Render via `render.yaml`. |
| `SESSION_SECRET` | Recommended | 32+ char random hex string | Cryptographic secret key used to sign and verify HMAC-SHA256 session cookies (`kopli_session`). Automatically generated in Render via `render.yaml`. |
| `PORT` | Optional | `8787` (local), `10000` (Render) | HTTP port on which the Express server listens. Render automatically injects this value. |
| `RENDER_EXTERNAL_URL` | Optional | `https://kopli-ai.onrender.com` | Automatically supplied by Render to denote the public HTTPS URL for CORS and origin validation. |
| `ALLOWED_ORIGINS` | Optional | `https://customdomain.com` | Comma-separated list of additional allowed cross-origin domains (e.g. for custom domain mappings). |
| `NODE_ENV` | Optional | `production` | Node environment identifier. Enables production cookie security flags (`Secure`, `SameSite=Lax`). |

---

## 2. Default Fallback Behavior ("Demo Mode")

KOPLI AI is designed with an active fallback layer:
- If `GROQ_API_KEY` is omitted: The server answers with helpful setup guidance and identifies creator **Pranesh KK**.
- If `DATABASE_URL` is omitted: Guest conversations persist in browser `localStorage`.
- If `TAVILY_API_KEY` is omitted: The search endpoint returns an informative 503 notification explaining demo status without crashing.
- If `STABILITY_API_KEY` is omitted: The image generator returns a friendly notice to configure the key in the backend.
- Document creation (Word `.docx`, PowerPoint `.pptx`, PDF reports, Excel `.xlsx`) continues to function using rich built-in academic and professional templates even in demo mode!
