# KOPLI AI project workflow

## Project identity and production architecture
- Official repository: `krishnamoorthipranesh-bot/kopli-ai`.
- Production branch: `master`; verify the current default branch before changes.
- Production site: https://kopli-ai.vercel.app/
- Production stack: Vercel (React/Vite frontend + Express serverless API), Supabase PostgreSQL, Prisma, Supabase Storage, Groq, Cloudflare Workers AI, Tavily, and optional Resend.
- Do not deploy production to Render or add a Render runtime dependency. Legacy `render.yaml` / Docker files may remain only as a rollback archive; do not wake, modify, or deploy them unless explicitly requested.
- Do not confuse this project with another KOPLI-branded application.

## Safe implementation workflow
1. Inspect current branch, working tree, source, configuration, environment-variable names, and tests before editing.
2. Preserve existing users, database rows, stored objects, auth sessions, and working features. Never run destructive migrations or data cleanup without explicit approval.
3. Keep all credentials server-side. Never print, copy into source, commit, or ask the user to paste secrets into chat. If a credential is exposed, recommend rotation.
4. Implement real behavior; do not add decorative controls, fake provider responses, fake streaming, or placeholder success states.
5. Run the repository test suite, TypeScript checks, production build, and security review after changes. Report exactly what ran and what did not.
6. Review the complete diff and verify no secrets or unrelated changes are included.
7. Use a feature branch and pull request where possible. Merge/deploy only after CI and preview checks pass and the target project/commit are verified.
8. Verify the resulting Vercel deployment state and production endpoints before reporting success.

## Database and file-storage safety
- Supabase PostgreSQL is the production database; Prisma schema and migrations are the source of truth.
- Supabase Storage bucket `kopli-user-files` is private. The service-role key must be server-only.
- On Vercel, never persist permanent files in `/tmp`. If persistent storage is unavailable, fail closed with a clear 503 rather than reporting a successful upload.
- Existing records referencing `/tmp` may be unrecoverable after an instance restart; never delete or rewrite their metadata without verifying file bytes and user ownership.
- Do not add broad RLS policies without understanding the server-side Prisma access model. Review Supabase advisors after any policy/schema changes.
- Never migrate production data between providers without a verified backup and explicit approval.

## Environment and deployment
- Check variable names and target environments without decrypting or displaying secret values.
- Never create fake credentials or overwrite working production variables.
- Production deploy target is Vercel project `kopli-ai`, domain https://kopli-ai.vercel.app/.
- Do not enable paid plans or services without explicit approval.
- If required credentials or permissions are missing, state the exact blocker and continue with all independent work.

## Reporting
- Distinguish source changes, CI tests, Preview deployment, Production deployment, and live functional tests.
- Distinguish completed/verified, implemented/unverified, blocked, and not implemented.
- Never claim a feature, test, integration, or deployment is verified without direct evidence.
