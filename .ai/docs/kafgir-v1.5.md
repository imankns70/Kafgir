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
- Ingredient rows are locked before stock changes. Concurrent decrements cannot oversell stock,
  stock counts do not write zero movements, and untracked ingredients do not create stock entries.
- Purchase-level discounts and additional costs are allocated to confirmed item movements so
  inventory valuation reconciles with the final purchase total.
- Weighted average cost is calculated from confirmed purchase and purchase-reversal values.
- One active recipe per food is supported. Recipe quantities are batch quantities and are divided
  by yield for per-portion consumption and costing. Waste and preparation loss divide by remaining
  yield; for example, ten-percent waste requires net quantity divided by `0.90`.
- Confirming an order consumes its active recipe once. Missing recipes are recorded as warnings.
  Cancellation creates linked reversal movements.

## Finance

This is managerial accounting, not double-entry accounting. Financial accounts have calculated
balances from opening balance plus immutable transactions. Customer payments, purchase payments,
manual income/expense, transfers and refunds create separate transactions. Transfers are paired
and do not count as income or expense.

Balance-reducing operations lock their financial accounts and reject insufficient balances.
Payments create sales income only after verification; refunding a paid payment creates one linked
negative ledger entry. Purchase payments preserve their selected purchase-payment method and update
the purchase paid amount/status in the same transaction. Reports use financial transaction dates
and `Asia/Tehran` day boundaries.

Payment methods remain distinct:

- نقدی
- دستگاه پوز
- کارت‌به‌کارت
- پرداخت آنلاین

Uploading or referencing a card-to-card receipt creates an awaiting-verification payment; only an
authorized server-side confirmation creates sales income.

Electron main checks every allowlisted operation against the authenticated roles. Owner has full
finance access; KitchenAdmin can manage kitchen/inventory and read accounts for purchase payments;
OrderManager can manage order payments but cannot refund or mutate general finance.

## Seed data

`npm run db:seed` idempotently creates the approved units, ingredient categories and expense
categories. It does not create purchases, payments, account identifiers or balances.

For a local learning environment, `npm run db:seed-demo` adds an idempotent, realistic but
fictional restaurant operations scenario. It includes ingredients and stock targets, five
suppliers, confirmed/partially paid/unpaid/draft purchases, inventory receipts and corrections,
a saved shopping list, financial accounts, POS, expenses, an internal transfer, and customer
payments in paid/awaiting-verification/rejected states. Version 2 also creates an
`افزودنی و تک‌پرس` customer category with separately priced/capacity-controlled rice, stew,
chicken-thigh and chicken-breast choices. Each extra has an active recipe so confirmed orders
consume the appropriate inventory. The script uses the normal shared services
for transactional operations, records a version marker in `app_settings`, and refuses to run with
`NODE_ENV=production` unless `ALLOW_OPERATIONAL_DEMO_SEED=true` is explicitly supplied.

The Admin Shopping page lists saved shopping lists below the shortage calculator. A saved list is a
planning snapshot only: it does not change inventory, create a purchase, or post a financial entry.

## Operations

Run:

```powershell
npm run db:migrate
npm run db:seed
npm run db:seed-demo
npm test
npm run lint
npm run build
```

Integration tests require `TEST_DATABASE_URL` whose database name contains `test`. The service
suite covers purchase valuation, concurrent stock decrements, no-op stock counts, purchase-payment
ledgers, transfers/overdraft rejection, and customer payment verification/refund idempotency.

## Structured logging

Kafgir uses Pino in the Next.js server and Electron main process. Production server events are
written as JSON to stdout for Liara and to `LOG_ROOT/server.jsonl` for the authenticated Admin
viewer. Set `LOG_ROOT=/data/logs` when server logs should live on the Liara persistent disk.
Electron writes `kafgir-admin.jsonl` under Electron's operating-system log directory.

The Admin navigation item `گزارش رویدادها` combines both sources and supports source, severity,
and text filters. Passwords, JWTs, authorization headers, Telegram init data, database connection
information, binary uploads, and receipts are redacted. Request bodies are not logged.

## In-page operational guides

The Electron pages `مواد اولیه`, `انبار`, `خریدها`, `تأمین‌کنندگان`, `لیست خرید`,
`مدیریت مالی`, and `پرداخت‌ها` open with a collapsible Persian guide. Each guide contains the
recommended sequence, a concrete kitchen example, and safeguards based on the actual domain rules.

The most important workflow boundary is visible in the UI documentation: saving a purchase draft
does not affect inventory; confirming it does. Purchase payment is recorded from the purchase page.
Customer payment becomes financial income only after verification on the payments page. Shopping
requirements are a date-specific planning snapshot and never create stock or financial movements.

Operational grids use a shared title/count/empty-state panel. Headers and body cells retain table
layout, and wide content scrolls within the panel rather than moving the whole administration page.
