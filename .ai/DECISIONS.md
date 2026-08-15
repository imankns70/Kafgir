# Decisions

## 2026-08-15 — Private asynchronous support instead of public reviews or live chat

- Use durable asynchronous conversations rather than WebSocket/live presence. This fits the current
  single-instance application and lets customers return later without implying an immediate response.
- Keep every conversation customer-owned and private; there is no public review list or cross-customer
  visibility. «همکاری» is deliberately absent from the subject list.
- Model unread state per message and derive each inbox count from unread messages instead of storing a
  second counter that could drift.
- Treat order reviews as a handling queue with New, Seen, and Resolved states. A private Admin reply
  creates/reuses one conversation linked uniquely to that review rather than adding public reply text.
- Expose Admin support only through the existing typed Electron IPC allowlist and role permissions;
  no renderer SQL or generic database operation is introduced.

## 2026-08-15 — Deterministic order status layout and deployment evidence

- In the order-detail hero, keep the current-status label on the visual right, center the order
  creation date/time, and place the status badge on the visual left.
- Use an explicit LTR grid for physical placement and restore RTL direction on Persian content;
  do not depend on browser-specific interpretation of implicit RTL grid order.
- Treat repository delivery and production publication as separate states. A change on `main` is
  only considered published after the Netlify production assets or live behavior confirm it.

## 2026-08-14 — Mobile active orders and customer-owned delivery confirmation

- Treat `PendingConfirmation`, `Confirmed`, `Preparing`, and `Ready` as active customer orders; delivered
  and cancelled orders must disappear from the persistent tracker.
- Keep the tracker mobile-only and global to the customer Web layout, with a compact always-available pill
  and a bottom sheet for detailed progress rather than a large persistent card.
- When several active orders exist, show them as a list and let the customer select the order whose details
  they want to inspect; do not collapse multiple independent orders into one synthetic status.
- Customer receipt confirmation is permitted only for the authenticated owner and only from `Ready`.
  Reuse the shared order-status transition so `Delivered`, `delivered_at`, and history are written through
  one authoritative path. Do not automatically change payment state when physical delivery is confirmed.
- Keep background polling conservative and refresh immediately on foreground/order/authentication events.

## 2026-08-14 — Checkout address and food-detail presentation

- Saved delivery addresses are multi-line content, so checkout uses a custom address picker that can show
  both the address title/default marker and the complete city/address text. A native one-line select is not
  the preferred customer experience for saved addresses.
- `shortDescription` and `fullDescription` are customer-facing editorial content, not form labels. Preserve
  their values but do not display the literal `توضیح کوتاه` or `توضیح کامل` headings on the food page.
- Keep practical scanning labels for portion contents, allergy information, and ingredients; hide optional
  customer-copy blocks entirely when no value exists instead of showing `ثبت نشده`.
- Scope the richer food-detail styling to `.food-detail-shell` in a dedicated UX stylesheet so it cannot
  leak into checkout, profile, order, or other general panels.

## 2026-08-14 — Development-first production releases

- Make `development` the normal integration branch and move `main` only when a tested release is ready.
- Keep Netlify production deployment bound to `main`; use monorepo ignore rules to skip Web builds for
  unrelated paths rather than adding a second deployment mechanism.

## 2026-08-14 — Keep compact metadata controls with their content

- Render the cart detail link in the food heading rather than the quantity/remove action row. In RTL,
  heading space distribution places the food name at the right and the secondary detail action at the
  visual upper-left without absolute positioning.
- Let the order-address text size to its content beside the location icon instead of occupying a
  full-width grid track, which prevents a misleading visual gap on mobile while preserving wrapping.

## 2026-08-14 — Separate code validation from Netlify deployment

- GitHub Actions owns repository validation only: clean install, lint, unit tests, and build on pull
  requests and `main` pushes.
- Build the contracts workspace immediately after `npm ci` and before lint. Its package exports
  generated `dist` types, so downstream workspaces cannot type-check on a clean runner until that
  artifact exists; relying on a locally retained `dist` directory would hide the dependency order.
- Netlify's native Git integration remains the only production deploy trigger. Do not add a Netlify
  CLI deploy or build-hook call to GitHub Actions, because that would duplicate the existing `main`
  deploy and require broader long-lived secrets.
- Grant the CI workflow only `contents: read`; no write, package, deployment, or environment permission
  is needed for validation.

## 2026-08-13 — Customer navigation and async action feedback

- Call the authenticated customer destination `حساب من`; reserve profile wording for descriptive
  copy rather than the primary navigation label.
- Use the phone receiver for customer contact navigation. The headset icon implies live support and
  should not represent a page that primarily exposes telephone links.
- Persist the food slug on cart lines and refresh it during reconciliation so cart detail links use
  the same canonical `/foods/[slug]?menuItemId=...` route as menu cards.
- Long-running address/order mutations must disable the initiating controls, expose a live Persian
  status, and use the restrained spatula-in-plate animation shared by Web and Electron.

## 2026-08-13 — Invoice branding

- Use the full/compact Kafgir lockup in application navigation, but use only the square symbol in
  dense invoice headers so branding never competes with the order number and status.

## 2026-08-13 — Stable cart identity

- A cart line must not use `daily_menu_items.id` as its only identity because Admin can recreate a
  daily-menu row while the catalog food and capacity remain valid.
- Persist `foods.id` as the stable cart identity and keep the menu-item id as today's order target.
- During reconciliation, remap stale rows by `foodId`; use the saved food name only as a one-time
  compatibility fallback for carts written before `foodId` was introduced.
- After a successful remap, replace the stored menu-item id and refresh all current commercial data.

## 2026-08-13 — Orders, invoices, and workspace build dependencies

- Keep Persian-rice upgrades as separate persisted order items for capacity and inventory, but
  combine matched rice and dish items into one customer-facing/Admin invoice row.
- Treat daily-menu capacity as the order sales constraint. Missing opening ingredient inventory
  must not prevent order confirmation; inventory consumption can surface a negative balance for
  later operational reconciliation.
- Start Admin manual orders with normalized Iranian mobile lookup. Reuse the canonical customer and
  a selected saved address when found, while still allowing a new delivery address.
- Require a currently available delivery time slot for manually entered delivery orders; pickup
  orders do not require a slot.
- Card-to-card is not an active application payment method until payment methods receive their own
  managed base-data table. Do not offer or seed it in the current flow.
- `@kafgir/contracts` remains a compiled workspace package. Every independently runnable Web or
  Electron `dev`/`build` command must compile it first instead of relying on stale or pre-existing
  ignored `dist` files.

## Product and brand

- Kafgir serves homemade Persian food in Andimeshk and sells by portion.
- `ka-2.png` defines atmosphere; `final-de.png` defines practical brand implementation.
- `branding/logo.png` is the sole visual-identity source; all web and Electron logo/icon files are generated from it.
- The Mini App header may compose the square icon with a real Persian wordmark so the brand reads clearly without modifying the canonical raster.
- The supplied mark contains a flat four-slot cooking spatula and must never be replaced by a ladle or spoon.
- Vazir Regular, Medium, and Bold are the bundled Persian font weights.

## Architecture

- Use an npm workspace containing `apps/web`, `apps/admin`, `packages/contracts`, and `packages/server-core`.
- Next.js App Router owns the customer Mini App and HTTP API.
- Netlify is the active customer Web deployment platform; repository files for older hosting targets do not identify the live deployment.
- PostgreSQL and Drizzle own persistence.
- Electron is Windows x64 and online-only. Under the approved single-owner/single-PC threat model, only its main process may access PostgreSQL directly through the shared server core.
- Shared transport schemas and numeric enums live in `packages/contracts`.
- Preserve camel-case JSON, numeric enum values, ISO UTC timestamps, and `/api/...` routes.
- Store food-photo files outside PostgreSQL. Development uses `.data/uploads/foods` with `/api/media/foods/...` URLs; production uses Liara Object Storage with public HTTPS references in `foods.image_url`.
- Normalize admin uploads to metadata-free WebP with UUID filenames, a 5 MB input limit, and a 1600px maximum edge.
- Treat food display names as unique operational identifiers in admin workflows; duplicate-name prevention lives in the shared food service and is mirrored in the Electron editor for immediate feedback.
- Model categories, tags, galleries, likes, and favorites as normalized PostgreSQL tables. Keep daily price/capacity/deadline on menu items/menus.
- Represent the compact card badge through `foods.primary_badge_tag_id`; it must reference an assigned food tag, avoiding a parallel badge model.
- Preserve existing foods during discovery migration by assigning them to `rice` before making `foods.category_id` required; administrators must review that temporary classification.

## Security

- Electron uses `contextIsolation`, a sandboxed renderer, disabled Node integration, and an allowlisted typed preload bridge. The renderer receives neither SQL access nor retrievable saved credentials.
- Electron main uses a restricted TLS PostgreSQL role. Development secrets may use environment variables; packaged configuration is encrypted through Windows DPAPI with Electron `safeStorage`.
- Public food photos are readable without authentication; uploading, cleanup, replacement, and removal require an authenticated admin.
- Telegram identity is trusted only after `initData` HMAC and freshness validation.
- Migrated ASP.NET Identity V3 hashes are accepted and transparently upgraded to scrypt.
- The local development admin credential is code-defined and prefilled in the Electron admin app for a simpler local workflow; production credentials still require explicit secret handling.

## Orders and notifications

- Menus default closed and orders default pending.
- Submission does not reserve capacity.
- Confirmation and cancellation use PostgreSQL transactions and row locks.
- Order numbers use the Persian business year and a transaction advisory lock.
- Order/customer/item delivery values remain immutable snapshots.
- Customer and order addresses use one text field only. Separate address-note columns are not part of the current model; legacy note text is folded into the address line during migration.
- Preserve the evolved WPF order-management UX in Electron: order and report grids remain full-width, details open as dedicated pages, polling preserves current context, and the renderer exposes only transitions allowed by the shared server rules.
- Electron keeps business numbers as ordinary numeric text and lets the bundled Vazir font control glyph rendering; identifiers, phone numbers, slugs, and other code-like fields stay LTR.
- Server DTO mappers must tolerate PostgreSQL timestamp values returned either as `Date` objects or strings, because driver behavior can differ across runtime paths.
- Electron renderer API helpers should show server messages without Electron IPC wrapper text.
- Server writes pass timestamps to PostgreSQL as ISO strings instead of raw `Date` objects to avoid Next.js bundled `postgres` prepared-query binding errors.
- Manual ordering in Electron should preserve the efficient WPF-style operator flow: customer details remain beside the order builder, while menu selection, item quantities, order grid, and total stay visible together.
- The primary Electron Orders workflow uses a split view rather than a separate detail page, so operators can scan the list and act on the selected order without losing context.
- Telegram notifications use a durable database outbox with leased `SKIP LOCKED` claims and exponential retries.

## Legacy removal

- The .NET API, Worker, WPF admin, and old Vite Mini App were removed after the user explicitly requested deletion.
- Annotated Git tag `legacy-dotnet-final-2026-07-28` preserves the last committed legacy source.
- The SQL Server import utility remains until production data has been transferred and validated.
## 2026-07-29 — Version 1.5 operational architecture

- Inventory is movement-led. `inventory_transactions` is the audit source; current stock is a sum,
  not a manually editable column.
- Exact measurable quantities use PostgreSQL `numeric(20,6)` and decimal strings at API boundaries.
- The current project money convention (`numeric(18,2)`, TypeScript number) remains unchanged.
- Weighted average ingredient cost uses confirmed purchase-in and purchase-reversal movements.
- Orders consume recipes exactly once when moving to Confirmed, the existing atomic capacity
  reservation point. Cancellation reverses original movements rather than deleting them.
- Existing admin JWT roles are reused. No parallel permission framework or backend was introduced.
- POS was added as payment method value 4 to preserve existing Cash=1, CardToCard=2, Online=3 data.
- Transfers create paired TransferOut/TransferIn records and do not affect income or expense.

## 2026-07-29 — Structured logging

- Use Pino for both Node-based runtimes; Serilog remains out of scope because no .NET runtime exists.
- Liara consumes JSON stdout. A bounded local JSONL copy supports the protected Admin viewer.
- Electron renderer has read-only access to parsed desktop logs through trusted IPC and never
  receives log paths or filesystem access.
- Do not log request bodies, passwords, tokens, Telegram init data, database URLs, customer
  addresses, uploaded bytes, or receipt contents.

## 2026-07-29 — Grouped Electron navigation

- Keep Dashboard outside the accordion and allow exactly one operational group to be expanded.
- Automatically open the category containing the current page; food editor and photo subpages
  retain Foods as the active destination.
- Preserve readable 36–42px navigation targets and use overflow only as a short-window fallback
  instead of shrinking all destinations to fit.
- Allow the entire sidebar to collapse without persisting the preference; keep a recognizable
  brand rail and restore the existing accordion state on expansion. Avoid pill-shaped navigation.
- Keep food create/edit focused on core catalog fields. Assign customer-facing tags and the primary
  card badge through a separate `تگ‌ها` food subpage, reusing the existing food update contract.
- Surface Electron admin save/update/delete results through one shared toast event and viewport
  at the API helper layer, while keeping page-level validation messages in place.
- Seed demo foods only when the foods table is empty. Migrated/live catalog rows are authoritative,
  and PostgreSQL enforces unique normalized food display names with `foods_name_normalized_uidx`.
- Source the customer home carousel from the approved static hero photo and current daily-menu
  food images. Keep the static hero as the first slide and as the safe error fallback.
- Prefer explicit admin photo-gallery actions (`عکس اصلی`, `انتقال به قبل`, `انتقال به بعد`)
  over short positional labels when the action affects customer-facing image order.

## 2026-07-30 — Customer authentication and history

- Treat Telegram user ID and verified mobile as separate credentials that can map to one customer;
  Telegram usernames are mutable metadata and are never compared with phone numbers.
- Browser login is passwordless through SMS.ir verification templates. OTP digests and rate-limit
  records stay in PostgreSQL; plain OTP values are never persisted or written to structured logs.
- Store the 30-day customer session only in a secure HttpOnly same-origin cookie with a customer
  JWT audience separate from Electron admin authorization.
- The same-origin check compares the `Origin` header's host with the `Host` header, plus the scheme
  reported by `x-forwarded-proto` when a proxy sets one. It must not compare against
  `new URL(request.url).origin`: Next derives that from the address the server is BOUND to, so
  `next dev --hostname 0.0.0.0` reported `http://0.0.0.0:3000` against a browser `Origin` of
  `http://localhost:3000` and rejected every same-origin POST in local development. `Host` is
  caller-supplied but so is `Origin`, and a browser will not let a cross-site script forge either,
  so the pairing is what carries the guarantee.
- Authorize personal orders by the authenticated user's `customer_profile_id`, never by a phone,
  Telegram username, or customer identifier supplied by the client.
- Merge matching phone-only customer records only after successful OTP proof. Prefer the currently
  authenticated Telegram profile, preserve order snapshots/history, and skip conflicting second
  Telegram identities for manual review.

## 2026-07-31 — Numeric typography

- Keep numeric values as ASCII `0-9` characters in both applications, while using Vazir's local
  Farsi-digits build to render Persian-shaped glyphs. Do not manually replace number characters.
  Keep `en-US` grouping for monetary values and `fa-IR-u-nu-latn` for Persian-calendar dates so
  APIs, copy/paste, validation, and storage continue receiving ASCII digits.
- Continue accepting Persian and Arabic digits in user input by normalizing them at validation
  boundaries; input compatibility does not determine display formatting.
- Preserve the local filesystem adapter for development food photos. Electron and Next.js share
  `.data/uploads/foods` and application-relative media URLs locally. Packaged Electron remains
  fail-closed unless Liara Object Storage is configured.
- Keep Persian text labels in the Mini App bottom navigation; icon-only navigation is not the
  approved accessibility or usability treatment.
- Share the same `nav-count` badge positioning rules between mobile navigation and the food-detail
  header cart action so cart quantities do not render as free-standing text on desktop.
- Override desktop food-card start alignment on mobile. Single-column card grids should center
  cards within the viewport while keeping the desktop RTL grid behavior unchanged.
- Animate branded dish marks only when a view is actively loading. Keep empty, warning, and error
  states static, and rely on the global reduced-motion rule for customers who disable animation.
- Apply the bundled Vazir Farsi-digits family explicitly at the Electron form-control boundary,
  including native date-edit subfields; preserve ASCII input values and existing normalization.

## 2026-08-01 — Private Telegram tunnel testing

- Use Pinggy only as a temporary private-testing bridge to Next.js port `3000`; never expose the
  Electron renderer, PostgreSQL, pgAdmin, files, or logs.
- Require signed Telegram `initData` even during tunnel testing. The BotFather token stays in the
  ignored local environment and is never committed or printed.
- Use the Telegram bot as the stable channel entry point. Update its default Web App menu button
  after each free Pinggy hostname change instead of publishing the raw tunnel URL.
- Use stable Liara HTTPS hosting rather than Pinggy for the public customer launch.

## 2026-08-01 — Kitchen, inventory, and finance integrity

- Keep inventory and finance ledgers append-only. Corrections use typed reversal movements or
  explicit status transitions; operational screens never update ledger rows directly.
- Treat recipe waste and preparation loss as yield loss: required gross input is divided by the
  remaining yield, not increased by simply adding the percentages.
- `is_inventory_tracked=false` excludes an ingredient from stock movements, stock enforcement,
  low-stock alerts, and shopping requirements while allowing it to remain recipe/purchase metadata.
- Use the established order payment-method numbers everywhere: cash `1`, card-to-card `2`, online
  `3`, and POS `4`. Purchase-payment methods remain a separate enum.
- Derive sales, refunds, expenses, and daily finance indicators from immutable financial
  transactions using Tehran date boundaries; do not infer settled cash from order creation.
- Serialize balance-reducing operations on financial-account rows and reject operations that would
  overdraw an account. Only Owner can mutate general finance; kitchen roles may read accounts only
  to register authorized purchase payments.

## 2026-08-01 — In-context operational guidance

- Keep workflow documentation next to the operation it explains instead of relying only on an
  external manual. Each guide is a native expandable `details` panel and remains keyboard operable.
- Every guide must describe the actual transactional boundary. In particular, a purchase draft
  does not change stock, purchase confirmation does, payment verification creates sales income,
  and a shopping-list snapshot changes neither inventory nor finance.
- Use one shared data-panel treatment for the v1.5 operational grids: visible section title,
  purpose, row count, intentional empty state, aligned header/body cells, and local overflow.

## 2026-08-01 — Cart availability reconciliation

- Never silently delete a cart line or silently lower its quantity when menu availability changes.
  Keep the customer's intent visible and attach a client-only availability state and Persian reason.
- Exclude invalid lines from the displayed orderable total and block checkout until the customer
  removes the line or reduces its quantity to the current remaining capacity.
- Reconcile price, availability, and remaining capacity when the cart opens and after a failed order
  attempt. PostgreSQL row locking in order creation remains the final concurrency safeguard.

## 2026-08-01 — Guest cart with authentication at checkout

- Do not require customer authentication for browsing or cart operations; the guest cart remains a
  local client concern and must survive the login transition.
- Require a valid customer cookie or cryptographically validated Telegram identity at the order API
  boundary, including development. Development Telegram fallback must never create a customer order.
- In a normal browser, request mobile OTP only after the customer has completed the order and pressed
  the final action. After verification, load the canonical phone/profile/addresses and let the customer
  review the delivery information once more before creating the order.
- Keep Telegram Mini App authentication silent and separate from the browser OTP presentation.

## 2026-08-01 — Customer identity-linking boundary

- Treat a cryptographically validated Telegram user ID and an OTP-verified normalized mobile as
  login credentials that may point to one canonical `users.id`. Telegram username is mutable display
  metadata and is never an authorization or merge key.
- Never expose Telegram orders or saved addresses merely because a delivery-contact phone matches.
  Without an active signed Telegram session, OTP may claim only an existing verified mapping or a
  phone-only historical customer profile.
- While authenticated through Telegram, successful mobile OTP may merge phone-only history and
  addresses into the current Telegram profile. Keep the resulting session method as `telegram` and
  present both linked credentials to the customer.
- Reject rather than reassign a verified mobile that belongs to another Telegram identity. Serialize
  the decision with a transaction-level advisory lock keyed by normalized phone.
- Keep verified login phone separate from per-order delivery contact: Telegram customers may provide
  a contact number for an order, but doing so must not silently change their verified login identity.

## 2026-08-01 — Quiet cart validation and consistent return actions

- Treat successful cart reconciliation and automatic price refresh as background behavior; do not
  show technical success banners during a normal checkout flow.
- Show a cart-level message only when customer action is required. Keep the affected line and its
  Persian reason visible, disable checkout, and preserve server-side transactional validation as the
  final concurrency safeguard.
- Use one branded page-level return-action style for «ادامه خرید», «منوی امروز», and «بازگشت» while
  preserving each action's destination and accessible label.

## 2026-08-01 — Per-menu immediate food discounts

- Store discounts on `daily_menu_items`, not on the reusable food catalog record. A discount therefore
  applies only to the selected day's offering and cannot accidentally alter future menus.
- Keep `daily_menu_items.price` as the auditable regular price and store an optional
  `discount_price` constrained to be positive and lower than the regular price. Expose the effective
  price plus the optional original price/percentage through presentation DTOs.
- Treat `COALESCE(discount_price, price)` as the authoritative order price inside the transactional
  order service. Persist that effective amount in the existing immutable order-item snapshot.
- Refresh open customer menu/detail screens every 15 seconds and on window focus. Avoid WebSockets or
  another realtime service for this operational scale; PostgreSQL validation remains authoritative.

## 2026-08-01 — Customer and Admin order invoices

- Generate invoices from the immutable order and order-item snapshots already returned by
  `OrderDto`; do not add a mutable invoice table or recompute historical prices from today's menu.
- Show the completed invoice immediately after checkout and retain it in authenticated customer
  order history. Use print-specific CSS for browser/Electron print and PDF output rather than adding
  a PDF-generation dependency.
- Queue Telegram invoices transactionally in the existing database outbox only when the order was
  created from a validated Telegram identity/session. Send them asynchronously through the existing
  retry processor so external Telegram availability cannot determine whether an order is accepted.
- Keep Telegram invoice messages below 4,000 characters and store notification bodies as PostgreSQL
  `text`. The Telegram Bot API's direct message is a delivery copy; PostgreSQL order snapshots remain
  the authoritative invoice data.

## 2026-08-01 — Operational learning dataset

- Use realistic fictional restaurant data for local training instead of presenting private or
  invented supplier information as belonging to a named real restaurant.
- Seed operational state through the same server-core services used by Electron so purchases,
  inventory movements, account balances, payment statuses and audit logs demonstrate real rules.
- Keep the demo seed idempotent and production-gated. A saved shopping list remains a planning
  snapshot and is shown in Admin, but never mutates inventory or finance by itself.

## 2026-08-01 — Independently orderable extras

- Model rice, stew and protein-only portions as ordinary foods in the `افزودنی و تک‌پرس`
  category. This gives every choice its own daily price, discount, capacity, cart line and invoice
  snapshot without introducing a second modifier contract prematurely.
- Give each extra an active recipe so order confirmation consumes inventory just like a main dish.
  The food remains in the catalog between days, while Admin explicitly selects its availability and
  capacity for each daily menu.

## 2026-08-01 — Food-first search for today's menu

- Return foods as search results; tags are searchable metadata and never become a separate result
  type in the first release.
- Search only the orderable menu for the current business day. Execute normalized token matching in
  PostgreSQL across food name, short description, category and active customer-visible tags.
- Normalize Persian/Arabic letter variants, diacritics, elongation and half-space before matching.
  Require every query token to match somewhere across the food name, short description, category or
  visible tag set, and combine the query with the selected category.
- Debounce client input for 300ms and wait for two meaningful characters before requesting. Return
  cursor pages of 12 items, load the next page near the viewport, and keep a manual accessible
  fallback. Use an ID-scoped cart snapshot rather than loading the full menu for reconciliation.
- Defer typo-tolerant `pg_trgm` ranking until catalog size or observed customer behavior requires it.

## 2026-08-02 — Native Electron invoice printing

- Invoke printing from Electron main after trusted-sender and authenticated-principal checks instead
  of relying on renderer `window.print()`. Keep the bridge allowlisted and expose no generic Electron
  capability to the renderer.
- Use the operating-system print dialog with background printing so the same A4 preview can be sent
  to a physical printer or saved as PDF without adding a PDF-generation dependency.

## 2026-08-03 — Last cart-item confirmation

- Confirm only actions that would make the cart completely empty. Do not interrupt ordinary
  decrements or removing one food while another remains.
- Use an accessible inline Kafgir-styled confirmation instead of the browser's native confirm box;
  focus the safe action first and support Escape to cancel.

## 2026-08-03 — Compact search and discount showcase

- Keep food search directly below the home hero, but reduce it to one 44–46px pill input; show result
  feedback only while the customer has entered a query.
- Return up to eight discounted, orderable foods in `discountItems` on the unfiltered first menu
  response. Keep those foods in the regular menu grid and hide the showcase while filtering.
- Use a dependency-free horizontal, scroll-snapped showcase with desktop controls and touch scrolling
  on mobile.

## 2026-08-03 — Explicit rice selection for rice-based dishes

- Keep one catalog/menu card per food and model only the two approved options (`Iranian=1`,
  `Foreign=2`) instead of introducing a generic modifier framework.
- Require an explicit selection with no default. A cart line is identified by
  `dailyMenuItemId + riceOptionId`; two rice choices for one dish remain separate order lines.
- Apply discounts to the base daily-menu price only. The selected rice surcharge is added afterward
  and snapshotted on the order line together with its label and original effective price.
- Preserve overall dish capacity as the final ceiling while also locking and enforcing independent
  per-rice capacity. Consume the selected rice ingredient separately from the base recipe, and reject
  recipe configurations that would consume the same rice ingredient twice.

## 2026-08-03 — Customer payment monitoring

- Keep customer payment outcomes in the existing payment ledger and expose status-focused Admin
  views instead of duplicating successful and failed records in new tables.
- Treat `Paid` as successful; `Failed`, `Rejected` and `Cancelled` as failed; pending and awaiting
  verification as actionable; and refunded payments as a separate financial outcome.

## 2026-08-03 — Admin-owned rice linking

- Seed scripts may prepare the independent rice ingredients, but they must not automatically attach
  rice options to foods or daily-menu items. The owner decides which foods require Iranian/foreign
  rice selection from the Admin `تنظیم برنج` page.
- Daily-menu rice surcharge, per-rice capacity and availability are still configured only after the
  food-level rice links exist.
- Rice-option ingredients use grams as the base inventory unit, and Admin records per-portion
  consumption as whole grams to avoid decimal kilogram input such as `0.18`.

## 2026-08-05 — Rice capacity is part of published availability

- Because rice selection is mandatory once a food exposes rice options, the portions a customer can
  order are `min(dish remaining, sum of available rice remaining)`. Publishing raw dish capacity
  overstated availability whenever an operator left rice capacity behind the dish capacity.
- The rule lives in `packages/contracts/src/rice.ts` so the Next.js server, the Electron renderer and
  the customer client all apply one definition rather than three approximations.
- Admin keeps the operator's freedom to cap one rice type below the dish capacity deliberately, so the
  stranded capacity is surfaced as a warning rather than rejected. Only a rice capacity that exceeds
  the dish capacity is refused.
- Card price for a rice-based food is always the base price plus the cheapest *orderable* surcharge,
  labelled «از», so the advertised figure stays reachable.

## 2026-08-05 — Rice becomes standalone foods

- The rice modifier framework duplicated machinery that foods already had. Rice is now two ordinary
  foods carrying `rice_addon_type`, so price, capacity, discount, photos, recipe, inventory and
  reporting all come from the existing food and daily-menu paths.
- One column (`rice_addon_type`) rather than two booleans: it answers both "is this a rice add-on"
  and "which rice is it", and makes the partial unique index expressible.
- Selection stays mandatory for a flagged dish, but the rice becomes its own order line. The client
  sends only `riceMenuItemId` per dish and the server expands and prices it, so the client can never
  invent a rice price or bypass the requirement.
- Rice capacity is now one shared menu-wide pool rather than a per-dish split. This matches the
  kitchen — there is one rice pot — and it still bounds each rice-requiring dish's published count.
- Dish prices must exclude rice. This cannot be derived, so repricing the affected dishes is an
  explicit owner step rather than a migration guess.
- Rice add-on foods are hidden from the customer grid so the menu keeps showing meals, not components.

## 2026-08-05 — Rice becomes one optional Persian upgrade

- Foreign rice is not a purchasable thing: it is what every dish is served with and is already inside
  the dish price. Only Persian rice is sold, as an upgrade, so the two-option model and its mandatory
  selection were removed.
- Because the upgrade is optional, it must never limit the dish: a dish whose Persian rice has sold
  out is still fully orderable at its normal price. That removed the shared-pool capacity cap and let
  `rice.ts` be deleted entirely.
- With one option, the client sends `withPersianRice: true|false` rather than naming a menu item. The
  server resolves and prices it, so a client cannot invent a rice price or point at another food.
- The upgrade still becomes its own order line, which keeps the kitchen count exact and needs no
  special inventory path — the Persian rice food consumes its own ingredient through a normal recipe.
- The Persian rice menu price is the upgrade DIFFERENCE, not a full portion, because the dish price
  already covers rice. Charging a full portion would bill the customer for two rices.
- Dish prices therefore stay rice-inclusive and need no repricing, unlike the previous design.

## 2026-08-08 — Confirming the Persian rice upgrade

- Turning the upgrade on changes what every later add costs, so it is confirmed against an explicit
  price breakdown. Turning it off only lowers the price and applies immediately; confirming a
  cheaper outcome would be friction without a purpose.
- The dialog states the resulting per-portion price on the confirm button itself, so the figure the
  customer agrees to is the figure they press.
- It must say that the amount is the difference and not a full rice portion. That is the one thing
  the pricing model makes counter-intuitive, and the checkbox label alone cannot carry it.
- Mobile and desktop share one component and one markup; only CSS differs (bottom sheet under 640px,
  centred modal above). A JS media query would risk a server/client render disagreement and would
  need resize handling to stay correct.
- The dialog is portalled to `document.body` because menu cards carry transforms that would otherwise
  become the containing block for `position: fixed`.

## 2026-08-08 — Customer-selected delivery windows

- Delivery windows are master data plus an optional per-date override, not a row per day. Requiring
  operators to populate a calendar before ordinary days work would guarantee days with no windows.
  Absent override means "follow the master flag, no order limit".
- The delivery date is the menu date of the basket, not client input. `daily_menus.menu_date` already
  models the day; a second date model would let today's food be paired with tomorrow's delivery. A
  basket spanning two menus is rejected — previously the rice lookup merely assumed it could not.
- `daily_menus.order_deadline` is kept and still gates the menu as a whole. It cannot express a lead
  time per window, so `order_cutoff_minutes_before_start` was added to the slot and both gates apply.
- Delivery capacity counts every non-Cancelled order, unlike food capacity which is consumed at
  confirmation. A pending order still needs a courier on that run, so counting only confirmed orders
  would let a window be oversold while the operator works the queue. Cancelling frees the seat.
- Concurrency uses `pg_advisory_xact_lock` keyed on date+slot, matching the existing order-number
  lock. `SELECT ... FOR UPDATE` cannot work here: the capacity is a count of order rows that do not
  exist yet, so there is nothing to lock against a concurrent insert.
- Start and end are PostgreSQL `time`, never display strings, so ordering, cutoff arithmetic and
  kitchen dispatch sorting happen in the database. Persian formatting is built in the client.
- The order carries a title/start/end snapshot. Order details render the snapshot, so re-timing a
  window never rewrites what a customer agreed to. The slot id is kept for grouping only.
- Availability is exposed as available/unavailable plus a reason code. Remaining seat counts are
  operational data and are not customer-facing.
- Unavailable windows are shown disabled with their reason rather than hidden, except windows switched
  off in master data — those are not useful context, only noise.
- Overlapping windows are rejected. Two windows covering the same minute would split capacity the
  kitchen planned as one run, and a customer could not tell them apart.
- Slot selection is optional in the contract so Electron manual phone orders can still be created
  without one. The requirement for customer checkout is enforced in `POST /api/orders`, not only in
  the browser: the contract cannot express "required on this route", and leaving the rule to the
  client meant dropping the field from the request skipped the cutoff and capacity rules entirely.

## 2026-08-08 — Toolchain

- All four workspaces pin TypeScript `7.0.2`, and `npm run lint` is that workspace's `tsc --noEmit`.

## 2026-08-09 — Social publishing belongs to Electron main and shared server-core

- Social publishing is an owner/kitchen workflow, so the UI is in Electron while authoritative
  drafts, rules, persistence and transactions remain framework-independent in `packages/server-core`.
  Next.js receives no Admin publishing API and Electron renderer receives no database capability.
- Channel credentials are encrypted with Windows `safeStorage` in Electron main. The database keeps
  ciphertext and read DTOs expose only `credentialConfigured`; a future worker needs its own secret store.
- Rules are seeded disabled and in Suggestion mode. AutoPublish is opt-in and runs only while an Owner
  session and Electron process exist; no hidden scheduler or new Worker was introduced.
- Publication state is per target. Failure never resends successful targets. A crash after network
  send becomes Unknown and requires explicit retry because blind retry could duplicate an accepted post.
- Capacity thresholds may trigger an internal rule, but exact counts and percentages are prohibited
  in customer-visible templates and drafts. Public output is limited to semantic scarcity language.
- Provider differences stay behind `SocialPublisher`: Telegram and Bale use Bot-style APIs; Eitaa
  degrades media/action features to public URLs when necessary.

## 2026-08-09 — Customer order history uses snapshots and an isolated read model

- Customer order endpoints do not reuse the Admin order DTO. A dedicated customer summary/detail read
  model prevents `adminNote`, financial-account identifiers, receipt URLs and internal payment fields
  from crossing the browser boundary.
- The list query is deliberately summary-shaped and paginated: one count query plus one aggregate query
  for items, latest payment state, actual histories and review. Full items/payments are fetched only when
  one order is opened, using a fixed number of queries rather than one query per list card.
- `orders.created_at` is the persisted event for the initial PendingConfirmation step. All later timeline
  timestamps require an `order_status_histories` row; null history is rendered as missing, not inferred
  from convenience columns or fabricated by the UI.
- The immutable delivery city/address and item prices stored on the order are authoritative for history.
  Current customer addresses and current food prices are never joined into historical order presentation.
- Delivered is the only review-eligible status. Reviews are editable through an upsert and one unique
  `order_id`, so editing is convenient without permitting duplicate reviews. Ownership and eligibility
  are checked transactionally on the server, independently of button visibility.
- Order status and payment status remain independent enums. Cash/POS without a transaction is described
  as payment at delivery instead of displaying empty gateway fields.

## 2026-08-09 — Trusted client IP

- `X-Forwarded-For` is read from the right, never the left. Proxies append, so only the rightmost
  entries are written by our own infrastructure; a caller may prepend anything, and doing so pushes
  the genuine value further left instead of into the position we read.
- The number of proxies is configuration (`TRUSTED_PROXY_HOPS`), not detection. A wrong value is a
  security failure in both directions, so an invalid setting throws rather than falling back.
- A chain shorter than the configured hop count, or no usable header at all, resolves to one shared
  `unknown` value. Callers that cannot be identified must not each receive a private allowance.
- This is the identification layer only; the rate limiting that consumes it is a later phase.

## 2026-08-09 — Lightweight first-party customer analytics

- Visitor identity is a random first-party UUID, not a user record, fingerprint, IP-derived value or
  external analytics identifier. This includes guests while keeping the data intentionally minimal.
- VisitorId survives authentication; the current session gains UserId. Replacing VisitorId at login
  would lose the guest → login → order journey and inflate unique visitor counts.
- A visible-document heartbeat every two minutes plus a 60-second server write throttle is sufficient
  for a five-minute approximate online window without turning browsing into write-heavy telemetry.
- Sessions roll over only after more than 30 minutes idle. The boundary is explicit so browser and
  server behavior agree and exactly 30 minutes does not create a duplicate session.
- Orders keep nullable visitor/session attribution rather than requiring an analytics event. Business
  persistence remains authoritative and analytics absence or association failure cannot reject an order.
- Today's eight metrics come from one PostgreSQL aggregate and one typed Electron IPC operation. All
  day-based clauses use the centralized Tehran business date; conversion counts converted visitors,
  never order count.
- Electron Admin is excluded from tracking and polls its aggregate every 30 seconds only while visible.
  No Redis, external analytics service, event stream, chart or historical reporting was introduced.

## 2026-08-09 — Rate-limit storage and boundary

- The store contract is async from day one although the in-memory implementation resolves
  synchronously. Redis is genuinely async, and retrofitting `await` later would touch every caller.
- Fixed windows, not sliding. One counter and one timestamp per key keeps the memory bound trivial
  and expiration deterministic; the cost is that up to twice the limit can pass across a window
  boundary, which is acceptable for these tiers.
- The read-modify-write in `consumeSync` must contain no `await`. Node's single thread makes an
  uninterrupted synchronous run atomic; one `await` between reading and writing the counter would
  let concurrent requests observe the same pre-state and all pass. `consume` wraps the synchronous
  result rather than being async itself.
- Only lapsed windows are ever reclaimed. A live entry is never evicted to make room, because
  evicting one that had reached its limit would hand the caller behind it a fresh budget and turn
  the memory bound into a bypass. When the cap is reached and nothing has lapsed, new keys are
  refused — fail closed, at the cost of refusing genuine new callers during a key flood.
- 429 responses carry `Retry-After` and nothing else. `X-RateLimit-*` headers would tell an attacker
  the exact limit, remaining budget and window so they could pace themselves just under it.
- Policies live in one module and routes name a tier. Endpoints never carry their own numbers, so
  thresholds stay reviewable in a single diff.
- Applied at the API boundary via `withRateLimit`, not in services and not in `middleware.ts`; Next
  middleware runs on the Edge runtime where the Node APIs this depends on are unavailable.

## 2026-08-09 — OTP rate limiting

- OTP send quotas live in `customer_otp_challenges`, not the process store. Every send spends SMS
  credit and in-memory state resets on each deploy, so the durable table — which already records one
  row per send with `created_at` and `request_ip_digest` — remains the authority. No generic counter
  table and no migration.
- The check and the reservation share one transaction behind an advisory lock keyed on the phone
  number, because the quota counts rows the same statement is about to insert. Row locks cannot help
  when the contended rows do not exist yet.
- The challenge row is inserted before the provider call, so a send cannot happen uncounted. The
  earlier order — send, then record — meant a provider outage produced unlimited retries.
- A delivery failure keeps the reservation. Refunding it would let a failing provider be hammered;
  the cost is that a genuine user waits out the cooldown after an outage.
- Verify limits use the process store because a verify attempt has no durable row, and giving one to
  every guess would mean a database write per request.
- Reaching the per-challenge attempt cap consumes the challenge instead of parking it at the cap, so
  the code is dead even if it was guessed on the final attempt.
- Send limits are checked cooldown-first so the reason a legitimate caller most often meets is the
  one reported, and fewer other dimensions are consumed on a refusal.

## 2026-08-09 — Customer mutation rate limiting

- Protect only sensitive customer business mutations in Phase 4; do not add global throttling and do
  not include health, Admin HTTP routes or Electron IPC.
- Use an HMAC-derived authenticated customer bucket as the primary dimension and a separately scoped
  trusted-client-IP bucket as defense in depth. Signed Telegram user ID is the equivalent primary
  identity for Telegram order creation. Anonymous cart reconciliation uses the first-party VisitorId
  and falls back to trusted IP, while retaining a separate IP safety bucket.
- Share one moderate account-write policy across profile and saved-address create/update/delete, and
  one interaction policy across like/favorite toggles. This prevents endpoint hopping from multiplying
  a caller's allowance while keeping ordinary UI use far below the threshold.
- Keep order limiting outside idempotency, capacity and transactional validation. Five attempts per
  minute per identity and twenty per IP permit normal checkout retries without turning throttling into
  a substitute for business correctness.
- Add same-origin validation to like/favorite writes before identity resolution or database work.

## 2026-08-09 — Rate-limit observability and final boundary

- Emit exactly one `rate_limit.rejected` warning for rejected requests and no event for allowed
  requests. Build the payload from an explicit safe-field allowlist: policy, stable operation,
  Retry-After, distribution state and status. Do not attach request or identity data.
- Treat endpoint classification as documentation of actual enforcement, not a reason to attach a
  generic limiter. Public/customer reads remain unrestricted in V1; health, Admin and Electron IPC
  remain outside the feature; the secret-protected notification processor is the sole current
  external processor route.
- Keep the generic store fixed-window, bounded, expiring and per-process for the current single web
  instance. It resets on restart and is not safe as a cluster-wide limit.
- A future multi-instance deployment must supply an atomic Redis-backed `IRateLimitStore` with
  `isDistributed = true`. HMAC key derivation, policies and route integrations remain unchanged.
  Redis is not added in V1, and durable OTP-send reservations remain PostgreSQL-backed.
