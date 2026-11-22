# KOPLI AI – Project Architecture Report

## 1. Executive Summary

**KOPLI AI** is an autonomous, full-featured AI workspace and intelligent assistant application created and owned by **Pranesh KK**. It provides conversational AI, multi-mode reasoning, real-time web search, AI image generation, automated document creation (Word `.docx`, PowerPoint `.pptx`, PDF reports, and Excel spreadsheets), document text extraction/analysis, private cross-chat user memory, and an administrative control suite.

---

## 2. Technology Stack & Framework Inventory

| Layer | Technology | Details / Versions |
|---|---|---|
| **Frontend Framework** | React 19 (`react`, `react-dom`) | Single Page Application (SPA), React hooks, strict typing |
| **Build & Dev Tooling** | Vite 8, TypeScript 5.x | Bundler with `@vitejs/plugin-react`, ESM module resolution |
| **Icons & UI Styling** | Lucide React, Custom CSS | Modern responsive design system, dark/light themes, animations |
| **Markdown Rendering** | `react-markdown`, `remark-gfm` | Streaming token rendering, GitHub Flavored Markdown |
| **Backend Runtime** | Node.js 22 (Debian Bookworm), `tsx` | ESM native (`type: module`), TypeScript execution |
| **Backend Framework** | Express 5 | REST API, Server-Sent Events (SSE) streaming |
| **Database & ORM** | PostgreSQL, Prisma ORM 6.19 | Declarative schema, relational cascade models, migrations |
| **Authentication** | Custom HMAC-SHA256 Session | Signed HTTP-only cookies (`kopli_session`), `bcryptjs` password hashing |
| **AI LLM Engine** | Groq SDK (`groq-sdk`) | Model `openai/gpt-oss-120b` (or Llama 3.3 models) |
| **Web Search Engine** | Tavily Search Core (`@tavily/core`) | Advanced search depth with favicon & snippet extraction |
| **Image Generation** | Stability AI REST API v2beta | Stable Diffusion core engine, prompt enhancement via Groq |
| **Document Generation**| `docx`, `pdfkit`, `pptxgenjs`, `xlsx` | Multi-format academic & business document generation |
| **File Extraction** | `pdf-parse`, `mammoth`, `xlsx` | In-memory text parsing for PDF, Word, spreadsheets, text |
| **Audio & Speech** | Web Speech API | Browser-native `SpeechRecognition` and `speechSynthesis` |
| **Deployment** | Docker & Render Blueprint | Multi-stage Docker build, zero-downtime deployment |

---

## 3. Architecture Diagrams

### System Architecture Flow

```
+-------------------------------------------------------------+
|                      Client Browser                         |
|   (React 19 SPA: Dashboard, Chat, Search, Explore, Library) |
+------------------------------+------------------------------+
                               | HTTPS / SSE (Same-Origin)
                               v
+-------------------------------------------------------------+
|               Express 5 Production Server                   |
|  - Helmet CSP, HSTS, XSS, Sniff Protection                  |
|  - Rate Limiting (120 req/min per IP)                       |
|  - CORS & Same-Origin Mutation Protection                   |
|  - Signed HTTP-Only Cookie Session Manager                  |
|  - Static Asset Provider (/dist)                            |
+-------+---------------+----------------+--------------------+
        |               |                |
        v               v                v
+---------------+ +-------------+ +---------------------------+
| PostgreSQL DB | | Groq AI LLM | | External Search & Media   |
| (Prisma ORM)  | | (Streaming) | | - Tavily Search API       |
| - Users       | +-------------+ | - Stability AI REST API   |
| - Sessions    |                 +---------------------------+
| - Chats       |
| - Memories    |
| - Files       |
+---------------+
```

---

## 4. Frontend Architecture

- **Entry Point**: `src/main.tsx` mounted to `index.html`.
- **Styling**: `src/styles.css` containing light/dark mode variables, responsive breakpoints (mobile, desktop, ultra-wide TV), sidebar animations, glowing AI orb, message bubbles, and composer toolbar.
- **State Management**:
  - React `useState` & `useEffect` for session identity, active conversation, streaming message buffers, search results, library files, and system health status.
  - LocalStorage fallbacks for guest mode conversations (`kopli.guest-conversations.v1`) and theme preference (`kopli.theme`).
- **Core Views**:
  - `Dashboard`: Feature grid, quick actions, service health status cards, recent conversations.
  - `Chat`: Multi-mode conversational interface (`fast`, `smart`, `reasoning`, `coding`, `research`, `vision`) with real-time SSE streaming, file attachments, voice toggle, copy, TTS speaker, and helpfulness feedback.
  - `Search`: Web search engine with query expansion and citation cards.
  - `Explore`: Multi-format generator for AI images, DOCX reports, PDF documents, PPTX slide decks, and Excel workbooks.
  - `Library`: Cloud file manager for viewing, downloading, renaming, and deleting generated and uploaded files.
  - `Settings`: Personalization controls (learning toggle, cross-chat recall toggle), theme switcher, memory dashboard, and data export.
  - `Admin`: Protected owner-only dashboard showing real-time provider statuses and registered users.

---

## 5. Backend Architecture & API Layer

- **Server Entry**: `server/index.ts` executed via `tsx server/index.ts`.
- **Configuration**: `server/config.ts` validates environment variables (`GROQ_API_KEY`, `TAVILY_API_KEY`, `STABILITY_API_KEY`, `DATABASE_URL`, `KOPLI_OWNER_EMAIL`, `KOPLI_ADMIN_SECRET`, `SESSION_SECRET`).
- **CORS & Origin Security**: Centralized `isAllowedOrigin()` supporting local development (`localhost`, `127.0.0.1`), Render production origins (`*.onrender.com`, `RENDER_EXTERNAL_URL`), same-host requests, and `ALLOWED_ORIGINS`.
- **Database Lifecycle**: Automated `npx prisma migrate deploy` check upon boot whenever `DATABASE_URL` is configured.
- **Resilience**: Full "Demo Mode" fallback allowing the entire frontend and backend to run safely without crashes even when external API keys or databases are not yet attached.

---

## 6. Database Schema & Persistence

Managed via `prisma/schema.prisma` with baseline migration `prisma/migrations/0_init/migration.sql`:
- **`User`**: Account identity, hashed passwords, roles (`user`, `owner`).
- **`UserSettings`**: Per-user theme, accent, and language preferences.
- **`Conversation`**: Chat threads, mode tagging, pinned/archived states.
- **`Message`**: Chat turn history linked to conversations with cascade deletion.
- **`UserPreference`**: Learning switch, cross-chat recall switch, personality traits.
- **`UserMemory`**: Autonomous user memory extracted from conversations (corrections, preferences, project context).
- **`ConversationSummary`**: Compact summaries and unfinished tasks generated by AI.
- **`FeedbackRecord`**: User ratings (`helpful`, `not_helpful`) and comments.
- **`MemoryRetrievalLog`**: Audit log of cross-chat memory lookups.
- **`StoredFile`**: Uploaded and generated file metadata.

---

## 7. Deployment Architecture (Render & Docker)

- **Container Engine**: Docker multi-stage build:
  1. `build` stage: Installs all dependencies, generates Prisma client, runs TypeScript checks, and builds Vite client assets to `/dist`.
  2. `runtime` stage: Minimal `node:22-bookworm-slim` environment with `openssl` and `ca-certificates`, copies built assets, server code, and prisma schemas.
- **Blueprint Specification**: `render.yaml` declaring a single free-tier web service with automatic health checking at `/api/status`, automatic secret generation for `KOPLI_ADMIN_SECRET` and `SESSION_SECRET`, and port binding through `$PORT`.
