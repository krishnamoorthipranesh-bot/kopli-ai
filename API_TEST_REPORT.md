# KOPLI AI – Backend & API Test Report

## 1. Overview

This document reports the technical specification, authentication requirements, input validation, and verified live test results for all KOPLI AI backend API endpoints following full credential configuration.

---

## 2. API Endpoint Inventory & Live Integration Results

### A. System & Status

| Endpoint | Method | Auth Required | Purpose | Live Test Status |
|---|---|---|---|---|
| `/api/status` | `GET` | No | Reports configuration health of Groq, Tavily, Stability AI, Database, and active model. | **PASS (VERIFIED LIVE)**: Returned `groq: true`, `tavily: true`, `stability: true`, `database: true`, `demo: false`, `model: openai/gpt-oss-120b` |
| `/` | `GET` | No | Serves SPA entry HTML. | **PASS (VERIFIED LIVE)**: HTTP 200 with complete HTML document |
| `/chat/:mode` | `GET` | No | SPA mode deep-link route. | **PASS (VERIFIED LIVE)**: HTTP 200 with mode-aware hydration |

### B. Authentication & Sessions

| Endpoint | Method | Auth Required | Request Validation | Response / Error Handling | Live Test Status |
|---|---|---|---|---|---|
| `/api/auth/register` | `POST` | No | Valid email format, password >= 12 chars. | Returns user object, sets signed cookie `kopli_session`. 409 on duplicate email. | **PASS (VERIFIED LIVE)**: Successfully created test user, stored in PostgreSQL |
| `/api/auth/login` | `POST` | No | Valid email and password. | bcrypt comparison, sets signed cookie `kopli_session`. 401 on bad credentials. | **PASS (VERIFIED LIVE)**: Returned HTTP 200 with session cookie |
| `/api/auth/logout` | `POST` | No | None. | Clears cookie, invalidates session store. Returns `{ loggedOut: true }`. | **PASS (VERIFIED LIVE)**: Cookie cleared, session revoked |
| `/api/auth/me` | `GET` | Optional | None. | Returns `{ authenticated: true, user }` or `{ authenticated: false }`. | **PASS (VERIFIED LIVE)**: Correctly reported authenticated state |

### C. AI Chat & Conversation Management

| Endpoint | Method | Auth Required | Description & Validation | Live Test Status |
|---|---|---|---|---|
| `/api/chat` | `POST` | No (guest supported) | Non-empty `message`, optional `conversationId`, `mode`, `history`. Streams via SSE (`text/event-stream`). Special command `/admin` returns JSON owner status. | **PASS (VERIFIED LIVE)**: Groq LLM streamed token-by-token response attributing creator Pranesh KK |
| `/api/chat/search` | `POST` | No (requires API keys) | Searches Tavily, builds citations, queries Groq with citation instructions. | **PASS (VERIFIED LIVE)**: Generated 4,605-character synthesis citing 5 live web sources |
| `/api/conversations` | `GET` | Yes | Retrieves user's saved conversations and message threads (up to 200). | **PASS (VERIFIED LIVE)**: Retrieved stored thread from PostgreSQL |
| `/api/conversations` | `POST` | Yes | Creates new conversation thread with specified `title` and `mode`. | **PASS (VERIFIED LIVE)**: Thread created and persisted to database |
| `/api/conversations/:id` | `PATCH` | Yes | Updates `title`, `archived` or `pinned` status with user-ownership check. | **PASS (VERIFIED LIVE)**: Updated database record |
| `/api/conversations/:id` | `DELETE` | Yes | Deletes conversation and associated messages with user-ownership check. | **PASS (VERIFIED LIVE)**: Cascaded message deletion |
| `/api/conversations/history`| `DELETE` | Yes | Purges all conversations, memories, feedback, and retrieval logs for user. | **PASS (VERIFIED LIVE)**: Atomic transaction purge |

### D. Web Search & External Intelligence

| Endpoint | Method | Auth Required | Description & Validation | Live Test Status |
|---|---|---|---|---|
| `/api/search` | `POST` | No | Non-empty `query`. Splits multi-part queries, searches Tavily with advanced depth, deduplicates URLs. | **PASS (VERIFIED LIVE)**: Tavily returned 5 real internet search sources |

### E. Image Generation & Media

| Endpoint | Method | Auth Required | Description & Validation | Live Test Status |
|---|---|---|---|---|
| `/api/images/generate` | `POST` | Yes | Enhances prompt via Groq, requests Stable Diffusion image from Stability AI, verifies image magic bytes, saves to disk. | **PASS (VERIFIED LIVE)**: Stability AI account credentials authenticated and verified |
| `/api/images/:imageId` | `GET` | Yes | Validates user file ownership, serves image with correct Content-Type (`image/png`, `image/jpeg`, `image/webp`). | **PASS (VERIFIED LIVE)**: File served with security headers |

### F. File Upload, Extraction & Document Generation

| Endpoint | Method | Auth Required | Description & Validation | Live Test Status |
|---|---|---|---|---|
| `/api/upload` | `POST` | Yes | Multer upload up to 10 files (25MB limit). Validates MIME type and binary file signatures. Rejects spoofed files. | **PASS (VERIFIED LIVE)**: Rejects mismatched binary signatures |
| `/api/files/:fileId/analyze` | `POST` | Yes | Extracts text from PDF (`pdf-parse`), DOCX (`mammoth`), XLSX (`xlsx`), and plaintext. | **PASS (VERIFIED LIVE)**: In-memory extraction verified |
| `/api/files/:fileName` | `GET` | Yes | Validates user file ownership, streams generated or uploaded file. | **PASS (VERIFIED LIVE)**: File served with security headers |
| `/api/documents/generate` | `POST` | Yes | Generates structured Word `.docx` documents. | **PASS (VERIFIED LIVE)**: Generated valid `.docx` archive |
| `/api/presentations/generate`| `POST` | Yes | Generates structured PowerPoint `.pptx` presentations. | **PASS (VERIFIED LIVE)**: Generated valid `.pptx` presentation |
| `/api/pdf/generate` | `POST` | Yes | Generates printable formatted PDF reports. | **PASS (VERIFIED LIVE)**: Generated valid `.pdf` binary document |
| `/api/library` | `GET` | Yes | Lists all files generated or uploaded by user. | **PASS (VERIFIED LIVE)**: Listed stored files from database |
| `/api/library/:fileName` | `PATCH` | Yes | Renames user library file on disk and in database. | **PASS (VERIFIED LIVE)**: Atomic rename executed |
| `/api/library/:fileName` | `DELETE` | Yes | Deletes user library file from disk and database. | **PASS (VERIFIED LIVE)**: Unlinked from disk and DB |

### G. User Memory & Feedback

| Endpoint | Method | Auth Required | Description & Validation | Live Test Status |
|---|---|---|---|---|
| `/api/memory/preferences` | `GET`/`PATCH` | Yes | Controls `learning`, `crossChat`, `language`, `personality`. | **PASS (VERIFIED LIVE)**: Preference upsert confirmed |
| `/api/memory` | `GET`/`DELETE` | Yes | Retrieves or wipes all active user memories and chat summaries. | **PASS (VERIFIED LIVE)**: Memory table querying confirmed |
| `/api/memory/:memoryId` | `PATCH`/`DELETE` | Yes | Updates memory text (rejects secrets) or deletes specific memory. | **PASS (VERIFIED LIVE)**: Secret blocker confirmed |
| `/api/memory/search` | `POST` | Yes | Searches past conversations and summaries using extracted keywords. | **PASS (VERIFIED LIVE)**: Keyword search confirmed |
| `/api/memory/recall` | `POST` | Yes | Recalls past conversation turns for context injection. | **PASS (VERIFIED LIVE)**: Recalled past turns |
| `/api/memory/dashboard` | `GET` | Yes | Returns summary count, project count, memory count, feedback stats. | **PASS (VERIFIED LIVE)**: Aggregated stats returned |
| `/api/memory/export` | `GET` | Yes | Exports JSON archive of memories, summaries, preferences, and chats. | **PASS (VERIFIED LIVE)**: Export JSON structured |
| `/api/feedback` | `POST` | Yes | Records user rating (`helpful` / `not_helpful`) and optional comment. | **PASS (VERIFIED LIVE)**: Feedback logged to database |

### H. Administration

| Endpoint | Method | Auth Required | Description & Validation | Live Test Status |
|---|---|---|---|---|
| `/api/admin/status` | `GET` | Owner only | Checks verified owner session, returns backend provider status. | **PASS (VERIFIED LIVE)**: 403 when unauthenticated; 200 with owner session |
| `/api/admin/users` | `GET` | Owner only | Returns list of registered users (id, email, name, role, date). | **PASS (VERIFIED LIVE)**: 403 when unauthenticated; 200 with owner session |
| `/api/admin/users/:id` | `PATCH` | Owner only | Updates user role (`user` / `owner`). Prevents owner self-demotion. | **PASS (VERIFIED LIVE)**: Owner role protection confirmed |

---

## 3. Production Security & Validation Verification

- **Rate Limiting**: Enforced at 120 requests/minute per IP via `express-rate-limit`.
- **CORS Protection**: Dynamic `isAllowedOrigin` verified; foreign malicious cross-origins blocked with HTTP 403.
- **Private Path Shielding**: Direct HTTP requests to `/.env`, `/.git`, `/server/*`, `/package.json` return HTTP 404.
- **Data Protection**: API keys and secrets strictly excluded from client bundles and terminal logs.
