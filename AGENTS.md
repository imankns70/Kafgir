# Instructions for coding agents

- Use `development` for normal implementation work. Do not push iterative feature/fix commits directly to `main`; promote tested work to `main` only as a deliberate release merge/squash.
- Keep the architecture simple and avoid over-engineering.
- Respect npm workspace and application boundaries.
- `packages/contracts` owns shared transport schemas and must not depend on either application.
- `packages/server-core` owns framework-independent PostgreSQL access, domain rules, and transactional services shared by server runtimes.
- `apps/web` owns the customer UI, customer/public HTTP routes, cookies, Telegram/SMS integration, and notification processing.
- `apps/admin` may access PostgreSQL only from the Electron main process through `packages/server-core`; renderer and preload code must never receive a SQL client or arbitrary-query capability.
- Keep Electron `contextIsolation` enabled, `nodeIntegration` disabled, and production credentials encrypted with Windows `safeStorage` or supplied through environment variables—never hard-coded in the package.
- Add packages only when a concrete requirement needs them.
- Update `.ai/PROJECT_STATE.md`, `.ai/DECISIONS.md`, and `.ai/TASKS.md` after meaningful changes.
- Keep production secrets in environment variables and never commit them.
- Add database migrations only for approved data-model changes.
