# Kafgir 1.5 kitchen operations

## Architecture

Shared Zod schemas live in `packages/contracts`. Framework-independent PostgreSQL schema,
transactions, authentication helpers, and v1.5 business calculations live in
`packages/server-core`. Next.js route handlers and Electron main both validate payloads, authorize
the principal, and call the same shared services. Electron renderer code uses only the typed
preload allowlist; it does not call the Next.js Admin HTTP API and never receives database access.

## Inventory and costing

- Base quantities use `numeric(20,6)` and are serialized as decimal strings.
- Inventory movements are immutable and current stock is their signed sum.
- Confirmed purchases create `PurchaseIn`; safe cancellation creates `PurchaseReversal`.
- Weighted average cost is calculated from confirmed purchase and purchase-reversal values.
- One active recipe per food is supported. Recipe quantities are batch quantities and are divided
  by yield for per-portion consumption and costing.
- Confirming an order consumes its active recipe once. Missing recipes are recorded as warnings.
  Cancellation creates linked reversal movements.

## Finance

This is managerial accounting, not double-entry accounting. Financial accounts have calculated
balances from opening balance plus immutable transactions. Customer payments, purchase payments,
manual income/expense, transfers and refunds create separate transactions. Transfers are paired
and do not count as income or expense.

Payment methods remain distinct:

- نقدی
- دستگاه پوز
- کارت‌به‌کارت
- پرداخت آنلاین

Uploading or referencing a card-to-card receipt creates an awaiting-verification payment; only an
authorized server-side confirmation creates sales income.

## Seed data

`npm run db:seed` idempotently creates the approved units, ingredient categories and expense
categories. It does not create purchases, payments, account identifiers or balances.

## Operations

Run:

```powershell
npm run db:migrate
npm run db:seed
npm test
npm run lint
npm run build
```

Docker-backed integration tests require a running Docker Desktop instance and a
`TEST_DATABASE_URL` whose database name contains `test`.

## Structured logging

Kafgir uses Pino in the Next.js server and Electron main process. Production server events are
written as JSON to stdout for Liara and to `LOG_ROOT/server.jsonl` for the authenticated Admin
viewer. Set `LOG_ROOT=/data/logs` when server logs should live on the Liara persistent disk.
Electron writes `kafgir-admin.jsonl` under Electron's operating-system log directory.

The Admin navigation item `گزارش رویدادها` combines both sources and supports source, severity,
and text filters. Passwords, JWTs, authorization headers, Telegram init data, database connection
information, binary uploads, and receipts are redacted. Request bodies are not logged.
