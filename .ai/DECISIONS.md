# Decisions

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
