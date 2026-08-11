# Kafgir

**Kafgir (کفگیر)** is a Persian homemade-food ordering and kitchen-management system for Andimeshk.

> کفگیر؛ غذای خونگی، با عشق

## Architecture

The repository uses:

- `apps/web`: Next.js App Router Mini App and same-origin HTTP API
- `apps/admin`: Windows x64 Electron admin application
- `packages/contracts`: shared Zod request/response contracts
- `packages/server-core`: shared PostgreSQL schema, transactions, and business services
- PostgreSQL with Drizzle ORM

## Requirements

- Node.js 24 or newer
- npm 11 or newer
- PostgreSQL 17 for local integration tests
- Windows for packaging the Electron NSIS installer

## Install, verify, and run

```powershell
npm install
npm run lint
npm test
npm run build
```

Copy `apps/web/.env.example` to `apps/web/.env.local` and set local secrets. Never commit production database, JWT, Telegram, or notification-processor secrets.

```powershell
npm run db:migrate
npm run db:seed
npm run db:seed-demo # optional: realistic fictional operations data for local learning
npm run dev:web
```

In a second terminal:

```powershell
npm run dev:admin
```

For private Telegram testing over a changing Pinggy URL, expose only `localhost:3000`, keep
`TELEGRAM_REQUIRE_INIT_DATA=true`, and update the bot menu after each tunnel restart:

```powershell
npm run telegram:configure -- -MiniAppUrl https://your-current-host.pinggy.link
```

See [.ai/docs/telegram-mini-app.md](.ai/docs/telegram-mini-app.md) for the BotFather, channel, and
security checklist. Never expose Electron, PostgreSQL, or pgAdmin through the tunnel.

For development, Electron reads `DATABASE_URL` directly, uses a three-connection pool by default, and stores uploaded food photos in `.data/uploads/foods` through the same `/api/media/foods/...` URLs served by Next.js. Packaged builds test and encrypt PostgreSQL and Liara Object Storage configuration through Windows DPAPI.

## PostgreSQL integration test

Docker Desktop must be running:

```powershell
npm run db:test:up
$env:DATABASE_URL="postgresql://kafgir:kafgir-local-only@localhost:5432/kafgir_test"
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm run db:migrate
npm run test:integration
npm run db:test:down
```

## One-time SQL Server data import

Only run the reset option against a disposable rehearsal database:

```powershell
$env:SQLSERVER_CONNECTION_STRING="<SQL Server backup or source connection>"
$env:DATABASE_URL="<staging PostgreSQL connection>"
npm run db:migrate
npm run migrate:sqlserver -- --reset-target
```

The utility preserves IDs, imports tables in dependency order, resets sequences, and validates counts, totals, order-number uniqueness, and menu capacity. The removed .NET source remains recoverable from Git tag `legacy-dotnet-final-2026-07-28`. See [.ai/docs/next-electron-postgresql.md](.ai/docs/next-electron-postgresql.md) for the operational runbook.

## Production

### Render free trial

The root `render.yaml` creates the Frankfurt `kafgir-web` service and `kafgir-db` PostgreSQL
database on Render's free plans. Render prompts for `ADMIN_SEED_PASSWORD` and
`TELEGRAM_BOT_TOKEN` during the first Blueprint setup; neither value belongs in Git. The web build
excludes Electron, then applies Drizzle migrations and the idempotent reference-data seed.

The free web service has no persistent disk, so local food-image uploads are temporary. Keep image
uploads out of this trial deployment until object storage is configured. The packaged Electron app
uses the database's external TLS URL and should use the restricted database role from
`infra/postgres/create-electron-admin-role.sql`, not the database owner URL.

After the first deploy, verify `/api/health`, confirm the real proxy chain before retaining
`TRUSTED_PROXY_HOPS=1`, and set the resulting HTTPS URL as the Telegram Mini App URL.

The Next.js service uses Liara's private PostgreSQL address. Electron main uses a dedicated restricted PostgreSQL login over TLS; its renderer has no database capability. In production, food photos use a public Liara Object Storage bucket. The notification route is protected by `NOTIFICATION_PROCESSOR_SECRET` and should be invoked once per minute.

Create the restricted login while connected as the database owner:

```powershell
psql "$env:DATABASE_URL" -f infra/postgres/create-electron-admin-role.sql
```

Configure a public Liara S3-compatible bucket for production only. Local development does not need
Liara Object Storage; omit the Liara fields and uploads will be written under `.data/uploads/foods`.
Packaged Electron collects the production bucket settings through its encrypted connection form.

Migrate legacy disk images with a dry run first:

```powershell
npm run migrate:food-images --workspace @kafgir/web
npm run migrate:food-images --workspace @kafgir/web -- --apply
```

Package the Windows admin with:

```powershell
npm run package --workspace @kafgir/admin
```
