# KOPLI AI project workflow

## Project identity

- This repository is the official KOPLI AI project: `krishnamoorthipranesh-bot/kopli-ai`.
- The deployment branch is `master`; verify the repository's current default branch before changing it.
- The primary live site is `https://kopli-ai-1.onrender.com`.
- The primary Render service is `kopli-ai-1`. Check the Render workspace and service before using them.
- Do not confuse this project with another KOPLI-branded application.

## When the user requests a code or feature update

1. Inspect the current source, repository status, branch, deployment configuration, and relevant tests before editing.
2. Modify the existing application. Preserve KOPLI branding, current navigation, authentication, stored data, and working features unless the user asks otherwise.
3. Keep secrets in server-side environment variables. Never put credentials in source, examples, logs, commits, or chat. If a credential appears in a pasted prompt or code, treat it as exposed and recommend rotation.
4. Run the repository's test command and production build after code changes. Fix failures and rerun them. Also run `git diff --check`.
5. Commit the reviewed changes locally after verification.
6. Recheck GitHub write and push permissions. Push to `master` only when authorized write access is available; do not try to bypass a read-only connection. If blocked, keep the verified local commit and tell the user the exact permission needed.
7. When a push succeeds, wait for the primary Render service to finish deploying that commit. Verify the deploy status and commit SHA, then check `/health`, `/api/status`, and the live site at the URL above. Report only results observed from those checks.

## Database and deployment safety

- Preserve the user's selected production database. Do not switch providers, migrate records, delete data, or change production database URLs until the current source of truth and recovery path are verified.
- Do not apply Render Blueprint changes or production environment changes as a substitute for inspecting their actual effect.
- Check service branch, Auto-Deploy, current deployment, and required environment variable names before reporting deployment readiness.
- If a provider integration hides credentials or cannot link a database directly, explain that limitation and provide the supported secure connection path. Do not ask the user to paste a secret into chat.
- Do not enable paid plans or services without the user's explicit approval.

## Reporting

- State separately whether GitHub read, write, commit, and push are available.
- State Render access, Auto-Deploy, and live verification separately.
- Distinguish local tests/build from live-provider tests and production checks.
- Never report a push, deployment, API connection, or live verification without evidence.
