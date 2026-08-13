# Bugs

## Resolved

### 2026-08-13 — Web `OrderInvoice.tsx:1:1` build failure and Electron startup failure

- **Symptoms:** Next.js reported a module-resolution error at the first import of
  `apps/web/src/client/features/orders/OrderInvoice.tsx`; Electron Admin did not start.
- **Root cause:** `@kafgir/contracts` exports runtime code from `packages/contracts/dist`, which is
  intentionally ignored. Direct workspace commands assumed that output already existed. The new
  `buildInvoiceOrderLines` import made stale/missing contract output visible in both consumers.
- **Reproduction:** Fresh `main` checkout, remove `packages/contracts/dist`, then run the Web build.
  Next.js reports unresolved `@kafgir/contracts`, including `OrderInvoice.tsx:1:1`. Electron has the
  same dependency boundary.
- **Fix:** Add `predev` and `prebuild` hooks to both Web and Admin packages so contracts compile
  before either workspace starts or builds independently.
- **Verification:** Both independent builds passed from a missing-dist state; lint and all 343 unit
  tests passed.
- **Delivery:** PR #12, squash commit `cd540350cb36972e6bf295f6c50190ec24863321`.

### 2026-08-12 — Order confirmation blocked by absent opening inventory

- **Symptoms:** Admin could not confirm an order when ingredient opening stock had not been entered.
- **Root cause:** Inventory enforcement was acting as a hard sales gate in addition to daily-menu
  capacity.
- **Fix:** Keep menu capacity as the sales guard and record consumption even when it exposes a
  negative inventory balance for later reconciliation.
- **Delivery:** PR #11, squash commit `ea24d3ddbb9957bf086eb645aac0e6276deab0dd`.

### 2026-08-12 — Persian rice displayed as a separate invoice row

- **Symptoms:** A dish ordered with Persian rice appeared as two customer/Admin invoice records.
- **Root cause:** The invoice rendered technical stored order items directly.
- **Fix:** Build presentation-only invoice lines that match rice quantities to eligible dishes and
  show one combined row while preserving separate database items.
- **Delivery:** PR #11, squash commit `ea24d3ddbb9957bf086eb645aac0e6276deab0dd`.
