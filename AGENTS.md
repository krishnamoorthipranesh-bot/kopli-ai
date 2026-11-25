# KOPLI AI project workflow

## Project identity
- Official repository: `krishnamoorthipranesh-bot/kopli-ai`.
- Production branch: `master`.
- Production site: `https://kopli-ai.vercel.app`.
- Hosting: Vercel frontend and serverless API; Supabase PostgreSQL and private Storage.
- Render is retired from the target architecture. Never add Render URLs, workflows, or deployment configuration.

## Change workflow
1. Inspect current source, branch, Vercel deployment config, required environment variables, and relevant tests.
2. Preserve branding, authentication, stored data, and working features unless explicitly requested.
3. Keep all credentials in server-side environment variables. Never commit or expose secrets.
4. Run tests, lint, TypeScript, production build, and `git diff --check`; fix failures and rerun.
5. Review changes and open a pull request to `master`.
6. Deploy to Vercel Preview, verify API health and core flows, then promote to Production only when safe.
7. Verify the Production deployment commit SHA and live routes before reporting success.

## Database and hosting safety
- Supabase is the production source of truth. Do not change database providers, migrate records, or delete data without a verified recovery path.
- Do not stop any legacy service until Vercel Production API, authentication, chat, AI providers, and persistent Storage are verified.
- Do not enable paid plans or services without explicit approval.
- Do not ask users to paste secrets into chat.

## Reporting
- Distinguish code changes, CI, Preview deployment, Production deployment, and live-provider tests.
- Never claim deployment or verification without evidence.
