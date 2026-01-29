# Repository Guidelines

## Workspace Defaults
- Also follow the shared workspace rules in `../AGENTS.md`.

## Project Structure & Module Organization
- Google Apps Script project; entrypoints in `src/Code.js` (`doPost` for ezyVet webhooks, `doGet` for sheet reads).
- Shared configuration and token helpers live in `src/Config.js`, cache handling in `src/Cache.js`, constants in `src/CONSTANTS.js`.
- Domain logic is split by concern: webhook handlers in `src/Webhook-Actions/`, cron jobs in `src/Cron-Jobs/` (with `TomorrowsAppts/` submodules), and shared utilities in `src/Helpers/`.
- `src/appsscript.json` defines script metadata; keep it in sync with Apps Script when pushing/pulling.

## Build, Deploy, and Development Commands
- Install and auth clasp once per machine: `npm install -g @google/clasp` then `clasp login`.
- Pull the latest script from Apps Script if collaborators edit in the cloud: `clasp pull --root src`.
- Push local changes to the bound project: `clasp push --root src` (check that triggers and scopes remain correct).
- Use the Apps Script editor’s “Deploy” to promote versions; mirror any trigger changes in source so `clasp push` stays authoritative.
- NDA cron triggers: schedule `executeNdaJobDt` and `executeNdaJobCh` as separate time-based triggers, staggered overnight, so each has a full 6-minute window and avoids ezyVet rate pressure.

## Coding Style & Naming Conventions
- JavaScript, 2-space indent, prefer `const`/`let` over implicit globals; camelCase for functions/vars; UPPER_SNAKE_CASE for constants.
- Keep functions small and pure where possible; centralize API calls in `Helpers/Fetch.js` to reuse retry/token logic.
- Log sparingly (`console.log`/`console.error`) and avoid printing client data; clean up debug statements before pushing.

## Testing & Verification
- No automated test harness; validate via a staging sheet or test script version.
- For webhooks, replay recent payloads against `doPost` using a temporary endpoint and confirm `Webhook-Actions/*` paths behave as expected.
- For cron paths, run functions manually in the Apps Script editor and inspect the target sheets (`Cron-Jobs/*` modules).
- Watch execution logs for 401/429 handling and caching behavior before promoting to prod.

## Commit & Pull Request Guidelines
- Use short, imperative commits (e.g., “handle nda dev”) consistent with existing history; group related changes logically.
- PRs should state scope, risk, and how to validate (sheet name, webhook event, or cron job touched); include screenshots of sheet changes when UI-visible.
- Link to any tracking issue/task; call out config or trigger updates so deployers can mirror them post-merge.

## Security & Configuration Tips
- Secrets are pulled from Secret Manager via script properties (`gcp_id`, `secret_name`, `secret_version`); never commit raw tokens or sheet IDs.
- Keep cached tokens isolated in `CacheService` and avoid logging payload contents containing PHI; rotate credentials promptly after incidents.
