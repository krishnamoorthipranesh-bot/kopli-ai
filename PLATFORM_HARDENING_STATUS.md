# KOPLI AI Platform Hardening Status

Updated: 2026-11-25

## Implemented in the hardening branch

- Added a server-side Supabase Storage adapter for the existing private `kopli-user-files` bucket.
- Authenticated uploads and generated images/documents are written to user-scoped object paths when `SUPABASE_SERVICE_ROLE_KEY` is configured.
- Guest uploads use random object names and expire through opportunistic cleanup after 24 hours.
- File download, analysis, library listing, rename and delete paths understand Supabase object references while retaining compatibility with older local paths.
- Added endpoint-specific request limits for chat, search, image search/generation, upload and document generation.
- Removed the wildcard Render-origin CORS allowance and reduced JSON request size.
- Health/status endpoints report database and file-storage readiness.
- Increased document draft completeness validation.
- Replaced the vulnerable SheetJS `xlsx` package with ExcelJS for XLSX and CSV workflows. Legacy binary `.xls` analysis now returns a clear conversion message.
- Pinned PptxGenJS to 4.0.0 and overrides vulnerable transitive `image-size` and `uuid` versions.
- Added mobile visual-viewport handling, safe-area spacing, narrow-screen content handling and reduced-motion support.
- CI uses Node 22, runs tests/build, and prints dependency audit findings.

## Required environment configuration

For persistent files on Vercel, set these server-only variables for Production and Preview:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (encrypted/sensitive; never expose to the browser)
- `SUPABASE_STORAGE_BUCKET` (optional; defaults to `kopli-user-files`)

The bucket must remain private. The Express API checks file ownership before returning user files. Do not add a public Storage policy to bypass server-side authorization.

Without the service-role key, Vercel reports file storage as temporary and retains the local fallback.

## Known follow-up work

- Prisma 6.19's build-time toolchain currently has four high-severity npm audit findings involving `@prisma/config`, `deepmerge-ts` and `effect`. The available fix requires Prisma 7.10.1, a major upgrade. Do not run `npm audit fix --force` against Production without a dedicated Prisma migration and database verification.
- The Express rate-limit store is process-local. It is useful as a per-instance guard but is not a global quota across all Vercel serverless instances. Add Vercel Firewall or a shared rate-limit store before exposing expensive endpoints to high traffic.
- Test Tamil PDF glyph rendering with a real generated file and embed a suitable Unicode font if needed.
- Run real-device visual checks at common Android widths and with the software keyboard open.
- Validate persistent upload/download and guest-file expiry after the Storage secret is configured.

## Safety

No database schema migration is required for this storage adapter. Existing database records and storage objects are not deleted by these changes. Old temporary file bytes cannot be reconstructed if their original serverless instance has already discarded them.
