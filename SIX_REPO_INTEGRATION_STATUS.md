# KOPLI AI — Six Repository Feature Integration Status

This document tracks the feature sets being adapted into the existing KOPLI AI application. The six repositories are used as product and architecture references; their source code is not wholesale copied. Existing KOPLI authentication, React/Vite frontend, Express backend, Prisma database, Supabase private storage, and Vercel deployment remain the foundation.

## Feature map

| Reference | Feature set | Current KOPLI status |
|---|---|---|
| Imago | Image prompt builder, style presets, negative prompts, generation history | Existing Cloudflare image generation retained; style presets and negative-prompt guidance added in the upgrade branch. |
| CloneGPT | Streaming chat, conversation history, account sessions, multi-mode assistant | Existing Groq chat, streaming, conversations, and authentication retained; future work is UX polish and additional chat controls. |
| Backblaze AI SaaS Starter | Admin overview, user management, storage visibility, SaaS operations | Owner-only overview endpoint and admin dashboard added; billing/subscriptions are not connected. |
| AI Creative Studio | Multi-tool creative workspace and production workflows | Existing image, document, PDF, presentation, and spreadsheet tools retained; video/audio generation is pending a provider and cost decision. |
| AI Image Editor | Upload-and-edit workflow, image preview, export, advanced canvas tools | Natural-language Cloudflare FLUX Kontext editing endpoint and Explore UI added; canvas layers, masks, brush, lasso, and version history remain future work. |
| Cloudflare Image Generator | Cloudflare Workers AI image generation | Existing FLUX.1 schnell integration retained; Cloudflare Kontext editing added as a separate paid model. |

## First implementation phase

- Add authenticated POST /api/images/edit.
- Accept PNG, JPEG, and WebP input images up to 8 MB.
- Validate file signatures, restrict the Cloudflare model allowlist, prevent redirect-based URL fetching, and cap downloaded output at 16 MB.
- Store generated edits using the existing private Supabase-backed storage flow.
- Add an AI Image Editor tool to Explore with upload, prompt, preview, and download.
- Expand image style presets and add negative-prompt guidance for FLUX.1 schnell.
- Add owner-only admin statistics for users, conversations, files, and stored-file bytes.
- Document Cloudflare image-edit model settings and billing.

## Provider and billing notes

- Groq remains the primary chat/prompt-enhancement provider.
- Cloudflare Workers AI remains the primary image provider.
- The default edit model is black-forest-labs/flux-1-kontext-pro. Cloudflare lists this model at $0.04 per image; black-forest-labs/flux-1-kontext-max is listed at $0.08 per image. Charges and availability depend on the Cloudflare account.
- No unlimited-free usage is promised. Provider quotas, rate limits, and charges apply.
- Stripe billing, paid credits, video generation, and lip-sync are not enabled in this phase.

## Release safety

- Work is isolated on feature/six-repo-upgrade.
- Production branch and production deployment are not modified by this branch.
- No database migration is required for the first phase.
- Merge and production release should happen only after the latest preview build and authenticated image-edit/admin smoke tests pass.