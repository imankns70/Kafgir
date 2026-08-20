# Bugs

## Open

### 2026-08-15 — Netlify production is behind `main`

- **Symptoms:** The live customer site does not expose the mobile active-order tracker and still
  serves the old order-detail header layout even though both changes exist on `main`.
- **Evidence:** A cache-busted production inspection found no `active-order-tracker-root` CSS and no
  `grid-template-areas: "badge date label"` rule in the loaded Netlify assets.
- **Impact:** Customers cannot use the Snapp-like persistent active-order experience in production,
  and recent Web fixes must not be reported as published merely because their commits reached GitHub.
- **Likely boundary:** Netlify production deployment/Git integration is stale or did not run for the
  latest `main` updates; the source implementation itself is present in the repository.
- **Required verification:** Trigger or repair the production deploy, then inspect live assets and
  test the authenticated mobile tracker plus the updated order-detail header.

## Resolved

### 2026-08-20 — Daily courier pricing and similar Admin pages required excessive vertical scrolling

- **Symptoms:** The courier-day screen stacked an expanded guide, date control, editor, repeated
  selected-day details and history grid. Similar newly added courier/delivery screens used several
  uncoordinated panels, forcing operators to scroll before reaching the grid.
- **Root cause:** These pages hand-built layout classes instead of using the established Admin page,
  form and grid primitives; several of those class names had no shared styling at all.
- **Fix:** Reduce quick-entry pages to a shallow form plus a viewport-bounded grid, fold selected-day
  state into the form, reuse shared messages/status pills, and show courier settlement details in a
  bounded dialog.
- **Verification:** Electron TypeScript validation, all 113 Admin tests and the production Electron
  build pass.

### 2026-08-15 — Customer reviews had no private Admin handling path

- **Symptoms:** Customers could submit a delivered-order rating/comment, but Admin had no dedicated
  queue to mark it reviewed or send a private response.
- **Root cause:** `order_reviews` stored customer input only and had no handling state or conversation
  relationship.
- **Fix:** Add New/Seen/Resolved metadata and a unique private support conversation link. Electron Admin
  can now review and respond, while the customer receives the answer in their private inbox.
- **Migration:** `0020_private_customer_communication.sql` was applied and verified on the primary Neon
  database on 2026-08-15.
- **Verification:** Contract/type checks, Web/Admin/server unit suites, and both production builds passed.

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
