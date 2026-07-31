# Next.js, Electron, and PostgreSQL architecture

## Architecture

```text
Telegram Mini App ── HTTPS ─> Next.js customer routes ─┐
                                                       ├─ server core ─> PostgreSQL
Electron renderer ── typed IPC ─> Electron main ───────┘
                                      └─ Liara Object Storage
```

- `apps/web` owns the customer UI, customer/public Route Handlers, cookies, notification processor, seeding, and SQL Server import.
- `apps/admin` owns the Windows admin UI. Its renderer uses only allowlisted IPC; Electron main authenticates the operator and calls PostgreSQL services directly.
- `packages/contracts` owns numeric enums and Zod schemas shared by both applications.
- `packages/server-core` owns the shared Drizzle schema, database client factory, domain rules, and transactional services.
- Removed .NET/WPF/Vite source is available from Git tag `legacy-dotnet-final-2026-07-28`.

## Customer HTTP and temporary rollback contracts

- `GET /api/health`
- `GET /api/menus/today`
- `POST /api/orders`
- `POST /api/customers/me`
- `/api/auth/admin/login` and `/api/admin/*` remain only through the Electron acceptance period, then are removed.

Responses remain camel-case JSON with numeric enum values and ISO UTC timestamps. Route Handlers validate with Zod, enforce authorization, call a service, and translate errors without containing business logic.

## Business parity

- A new menu is closed by default.
- A new order is `PendingConfirmation`.
- Submission does not reserve capacity.
- Confirmation locks the order and menu rows, checks all remaining portions, and increments sold portions in one PostgreSQL transaction.
- Cancellation of a confirmed/preparing/ready order restores portions in the same transaction.
- Food name, price, customer, and delivery data are order snapshots.
- Order numbers use the Iran business Persian year. `pg_advisory_xact_lock` serializes yearly counter allocation.
- Report and dashboard date boundaries are calculated with `Asia/Tehran`.
- Admin credentials and roles migrate unchanged. ASP.NET Identity V3 PBKDF2 hashes are accepted once and upgraded to scrypt after successful login.
- Telegram `initData` is verified with HMAC and a maximum age. Raw identity fallback is available only when `TELEGRAM_REQUIRE_INIT_DATA=false`.

## Notification processing

`POST /api/internal/notifications/process` requires:

```http
Authorization: Bearer <NOTIFICATION_PROCESSOR_SECRET>
```

The processor:

1. Selects pending work with `FOR UPDATE SKIP LOCKED`.
2. Applies a five-minute claim lease before releasing row locks.
3. Sends through Telegram Bot API.
4. Marks success as sent.
5. Applies exponential retry delay or a terminal failed state.

Invoke the endpoint once per minute from a scheduler. Liara documents Node cron execution, but an external HTTPS scheduler is safer for a single web instance because the durable lease prevents duplicate work. No second paid application is required.

## Liara deployment

Liara's current documentation supports Node/Next deployments, environment variables, PostgreSQL connections, Drizzle, and private networking. Configure:

- `DATABASE_URL`: Liara private PostgreSQL URI
- `JWT_SIGNING_KEY`: at least 32 random characters
- `JWT_ISSUER=Kafgir`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_REQUIRE_INIT_DATA=true`
- `TELEGRAM_INIT_DATA_MAX_AGE_MINUTES=1440`
- `NOTIFICATION_PROCESSOR_SECRET`
- `NOTIFICATION_MAX_RETRIES=5`
- `NOTIFICATION_INITIAL_RETRY_SECONDS=60`
- `FOOD_MEDIA_PUBLIC_BASE`: public Object Storage base URL

Run `npm run db:migrate` against the target before starting application traffic. Next.js keeps its private URI. Electron uses a separate restricted public TLS URI encrypted with Windows DPAPI.

### Food-photo Object Storage

- Create a public Liara S3-compatible bucket and a bucket-scoped write key.
- Electron main validates and normalizes images to WebP before upload.
- PostgreSQL stores direct public HTTPS URLs, avoiding Next.js media traffic for new files.
- Run the migration utility in dry-run mode before `--apply`; retain the legacy disk for rollback.

References:

- https://liara.ir/landing/هاست-نکست-جی-اس-next/
- https://docs.liara.ir/paas/nodejs/how-tos/connect-to-db/postgresql/
- https://docs.liara.ir/paas/nodejs/how-tos/connect-to-db/drizzle/about/
- https://docs.liara.ir/paas/nodejs/how-tos/set-cron-job/

## Electron security and distribution

- `contextIsolation: true`
- `nodeIntegration: false`
- renderer sandbox enabled
- renderer may invoke only the finite `AdminOperation` allowlist
- authenticated principal lives only in main-process memory
- saved database/Object Storage configuration uses `safeStorage`; decrypted values never cross preload
- Windows x64 NSIS installer
- no automatic updater and no code signing in the first release

Create the restricted role with `infra/postgres/create-electron-admin-role.sql`, then enter its TLS URI in the packaged application's connection screen. Package with:

```powershell
npm run package --workspace @kafgir/admin
```

## Migration rehearsal

1. Provision an empty staging PostgreSQL database.
2. Apply Drizzle migrations.
3. Restore a current SQL Server backup in an isolated environment.
4. Set `SQLSERVER_CONNECTION_STRING` and staging `DATABASE_URL`.
5. Run `npm run migrate:sqlserver -- --reset-target`.
6. Require zero mismatches from all table counts, order/item monetary totals, order-number uniqueness, and menu capacities.
7. Run PostgreSQL integration tests and application smoke tests.

## Production data cutover

1. Announce the maintenance window and stop writes to the old deployment.
2. Back up SQL Server.
3. Run the import without `--reset-target` against an empty production schema.
4. Run validation and representative-record checks.
5. Deploy Next.js and set all Liara environment variables.
6. Point a packaged Electron build at production HTTPS.
7. Smoke-test login, dashboard, menu, order submission, confirmation/cancellation, report filters, and notifications.
8. Reopen ordering.
9. Keep the SQL Server backup and Git tag through the acceptance period.

## Rollback

Close ordering, restore the tagged source into a separate rollback deployment if necessary, restore the pre-cutover SQL Server backup if new production writes occurred, and investigate in staging. Never attempt a partial reverse migration under live traffic.

## Verification status

- Shared and server unit/parity tests run without external services.
- PostgreSQL integration tests require `TEST_DATABASE_URL` whose database name contains `test`; they refuse any other target.
- The SQL Server migration requires both real source and staging target connections.
- Liara production deployment and data cutover remain explicit operator actions.
- As of 2026-07-28, npm reports three production advisories inherited from the latest stable Next.js release (`postcss` and `sharp`). The only automated audit suggestion incorrectly downgrades Next.js to 9, so it must not be applied. Upgrade when a fixed stable Next.js release is available; the remaining reported advisories are build/development dependencies.
