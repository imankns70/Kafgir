# Bugs

## Resolved

### 2026-08-13 — Invoice brand wordmark overlapped the order number on mobile

- **Symptoms:** The compact Kafgir logo's wordmark rendered over the invoice order number on narrow
  screens.
- **Root cause:** The invoice constrained the two-part compact lockup to a 72px mobile grid column;
  its wordmark could not fit and overflowed into the title column.
- **Fix:** Use the square brand symbol only inside the invoice and give it an explicit responsive
  width and height. The full lockup remains in the application header.
- **Verification:** Invoice markup regression test, TypeScript lint, and production builds passed.

### 2026-08-13 — Available food reported as absent from today's menu

- **Symptoms:** The customer cart reported that «برنج هندی» was no longer in today's menu even
  though Admin showed the food as available with remaining capacity.
- **Root cause:** Browser cart persistence and reconciliation identified a food only by
  `daily_menu_items.id`. Replacing or recreating today's menu row assigned a new id, so the old cart
  could not recognize the same catalog food.
- **Fix:** Store and request the stable `foods.id`, let the cart snapshot return today's matching
  row, and rewrite the cart line to the current menu-item id. Legacy carts fall back to their saved
  unique food name once and are upgraded automatically.
- **Verification:** Regression tests cover stable-id and legacy-name remapping; full lint, Web test
  suite, Next.js build, Electron build, and diff check passed.
- **Migration:** None.

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
