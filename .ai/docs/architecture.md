# Architecture

```text
Telegram Mini App ── HTTPS ─> Next.js customer routes ─┐
                                                       ├─ shared server core ─> PostgreSQL
Electron renderer ── typed IPC ─> Electron main ───────┘
                                      │
                                      └─ food-photo storage
```

## Workspace boundaries

- `apps/web`: Next.js App Router customer application, customer/public Route Handlers, cookie authentication, Telegram/SMS integration, and notification processing.
- `apps/admin`: Windows Electron admin. Its sandboxed renderer uses allowlisted typed IPC; only the main process opens a small TLS PostgreSQL pool and retains the authenticated principal.
- `packages/contracts`: shared Zod schemas, inferred TypeScript DTOs, and numeric public enums.
- `packages/server-core`: shared PostgreSQL schema/client factory, authentication primitives, transactions, domain rules, audit logging, and admin/customer order services.
- `infra`: local disposable PostgreSQL integration-test infrastructure.
- `branding` and `scripts`: canonical Kafgir brand assets and reproducible icon generation.

Next Route Handlers and Electron main both invoke the same services. The browser and Electron renderer never receive database credentials, a database client, or arbitrary SQL capability.

Electron main validates the existing contract payloads again before invoking a service. The compatibility Next.js admin routes remain temporarily during cutover, then are removed after packaged-app acceptance.

## Authentication

Electron main authenticates `Owner`, `KitchenAdmin`, and `OrderManager` accounts directly through the shared service and keeps only the resulting principal in memory. No Electron admin JWT is required. Migrated ASP.NET Identity V3 hashes remain compatible and upgrade to scrypt after login.

Packaged Electron stores its PostgreSQL and Liara Object Storage connection configuration encrypted with Windows DPAPI through `safeStorage`. Development may use environment variables for PostgreSQL and writes food photos to `.data/uploads/foods` when Liara storage is absent. PostgreSQL uses a dedicated non-owner role and TLS.

Telegram customer identity comes from HMAC-validated `initData`. Raw Telegram identifiers are accepted only when `TELEGRAM_REQUIRE_INIT_DATA=false` for local development.

## Notifications

Order events insert durable outbox records in the same transaction as the business change. The protected notification processor claims eligible work with `FOR UPDATE SKIP LOCKED`, applies a lease, sends through Telegram, and records success, exponential retry, or terminal failure.

## Removed implementation

The .NET API, Worker, WPF admin, and old Vite Mini App directories were removed on 2026-07-28. Their final committed source is recoverable from annotated Git tag `legacy-dotnet-final-2026-07-28`.
