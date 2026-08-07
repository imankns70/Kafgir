# Project state

- Status: Next.js, Electron, and PostgreSQL implementation complete in the repository; live database migration and Liara deployment remain operator-dependent.
- Brand: Kafgir / کفگیر.
- Canonical visual identity: `branding/logo.png`; generated transparent PNG, favicon/PWA sizes, and Electron ICO are derived from it.
- Customer application and server: `apps/web`.
- Windows admin: `apps/admin`.
- Shared transport contracts: `packages/contracts`; shared transactional/database services: `packages/server-core`.
- Database: PostgreSQL managed through Drizzle.
- Local PostgreSQL at `192.168.70.127:5432` has a migrated and seeded `kafgir` database for development.
- Local integration infrastructure: `infra/postgres.compose.yml`.
- Customer and admin API contracts remain under `/api/...`.
- Electron admin authentication runs in its main process against PostgreSQL and retains only an in-memory principal; compatibility Next.js admin JWT routes remain temporarily for rollback.
- Electron renderer still exposes familiar route-shaped helper names for existing pages, but those calls are translated locally into typed IPC operations and no longer create `/api/admin/*` network traffic.
- Local development admin credentials are defined directly in the seed script and prefilled by the Electron admin login form.
- Telegram customer identity uses signed `initData`.
- Notifications use a durable PostgreSQL outbox and protected processor endpoint.
- Electron uses a sandboxed renderer and an allowlisted typed preload bridge. Only Electron main accesses PostgreSQL, using a three-connection default pool and DPAPI-encrypted configuration in packaged builds.
- New food photos are validated and normalized to WebP by Electron main. Development stores them in `.data/uploads/foods` and references them through `/api/media/foods/...`; production stores them in Liara Object Storage and references public HTTPS URLs.
- Food discovery now includes database categories/tags, one validated primary badge, ordered galleries, customer likes/favorites, readable food-detail routes, related-food suggestions, and server-calculated menu orderability.
- Customer food-detail pages show admin-managed ordered food photos in a carousel with previous/next controls, thumbnails, and a position counter.
- Customer food-detail headers use only the approved top actions: home logo, cart, favorite, and back; the confusing share/forward icon was removed, the cart and back controls were positioned as requested, and the favorite action is hidden until a customer session is authenticated.
- Mini App basket badges count distinct food rows, not total portions; adding more of the same food increases its quantity but keeps the badge at one for that food.
- Customer and order addresses are now one text field only. Migration `0007_mighty_kree.sql` appends legacy address notes into the address text and drops `customer_addresses.description` plus `orders.delivery_address_description`.
- Electron now manages categories, tags, detailed food content, tag/badge assignment, and ordered food-image galleries through the existing secure API bridge.
- The Electron food catalog list and full food editor are separate application pages; create/edit navigation returns to the refreshed list after save or cancellation.
- Food names are now validated as unique by the admin UI and shared food service; the Electron food list shows whether each food has a photo, and the photo upload area is separated from the main food-details form.
- The Electron food photo form is now a dedicated `food-photos` page opened from the food list or existing-food editor; the add/update food page no longer contains upload controls.
- Electron admin labels use `عنوان انگلیسی` for slug fields, and the Daily Menu price field shows comma separators plus live Persian words below the input.
- Daily Menu form controls reserve a consistent helper-text row so food, price, capacity, and submit button stay aligned.
- The Electron Orders page now restores the evolved WPF operational UX: a full-width paginated grid, dedicated detail page, default 10-second auto-refresh, complete valid status actions, customer/order/note sections, and status-history badges.
- The Electron full report now includes all operational columns and combined filters, result counts, reset/search feedback, pagination, and a dedicated read-only order-detail page.
- Local duplicate food rows were cleaned on 2026-07-28 by preserving the menu-used rows, moving useful image data to the kept row, and deleting duplicate unreferenced rows.
- The .NET API, Worker, WPF admin, and old Vite Mini App directories were deleted on 2026-07-28.
- Removed source is recoverable from annotated Git tag `legacy-dotnet-final-2026-07-28` at commit `5ac841f`.
- The one-time SQL Server-to-PostgreSQL importer remains for production data transfer.
- Seed and SQL Server import scripts use explicit async entrypoints compatible with the current Node/tsx toolchain.
- The supplied `branding/logo.png` remains untouched as the identity source; the generator creates runtime derivatives without modifying it.
- The Mini App header composes the square `branding/logo.png` icon with a real Persian `کفگیر` wordmark beside it.
- Electron admin keeps numeric values as ordinary digit text and relies on the bundled Vazir font for rendering; identifiers such as order numbers, phone numbers, and slugs remain isolated LTR.
- Web and Electron Admin form controls explicitly apply the bundled Vazir FD font to typed values, placeholders, autofill, LTR fields, and number inputs without converting stored characters.
- Order API timestamp serialization accepts both PostgreSQL `Date` objects and timestamp strings so manual-order creation and report/detail responses do not crash on driver return-type differences.
- Electron admin strips the IPC wrapper from API errors before showing them in forms.
- Electron manual ordering now follows the evolved WPF operational layout: customer/payment form on the right, menu-item add row and cart table on the left, quick menu shortcuts, and a prominent total bar.
- Electron Orders now uses the WPF-style split operator layout: order grid and filters remain visible while the selected order's details, status actions, items, and history stay open in a side panel.
- Electron manual-order quick menu shortcuts no longer use a dot separator between price and remaining portions.
- Order creation and status updates pass timestamp parameters to PostgreSQL as ISO strings so Next.js dev/runtime bundling does not send raw `Date` objects into prepared query binding.
- Electron food editor labels now use clearer customer-facing wording for portion contents and allergy materials, and the photo gallery actions use explicit primary/previous/next labels instead of ambiguous position words.
- Electron Orders table panels keep the summary, grid, and pagination pinned to normal top-to-bottom rows so sparse results no longer float vertically in the center of a tall panel.
- Electron dev startup now bundles `@kafgir/contracts` into the main process with `@kafgir/server-core`, and main-process runtime configuration is serialized so concurrent initial IPC calls do not close each other's PostgreSQL client.

## Verification

- TypeScript lint: passed.
- Current workspace tests: Contracts 11 passed, Server Core 2 passed, Web 71 passed with 14
  guarded PostgreSQL integration cases skipped without `TEST_DATABASE_URL`, and Electron Admin 8 passed.
- Guarded PostgreSQL integration tests: 9/9 passed against disposable database `kafgir_food_discovery_test`.
- Local PostgreSQL migration and seed against `kafgir`: passed.
- Next.js production build: passed.
- Electron production build and Windows x64 NSIS packaging: passed.
- Direct server-core smoke test against configured PostgreSQL: connection, admin authentication, and dashboard query passed without Next.js running.
- Canonical-logo asset generation and legacy-brand reference audit: passed.
- Packaged Electron launch smoke test: passed.
- Mini App responsive checks passed at 320, 360, 390, 430, 768, 1024, and 1440px.
- Food-image validation, normalization, managed-file deletion, and upload authorization tests: passed.
- Duplicate food-name validation and local duplicate cleanup verification: passed.
- Local migration `0002_food_discovery.sql` and the idempotent seven-category/33-tag seed: passed.
- Four pre-existing foods received the safe default `rice` category and require an admin category review.
- Latest stable Next.js currently inherits three production npm advisories from PostCSS/Sharp; upgrade when a fixed stable release is available.
## Kafgir 1.5 kitchen operations (2026-07-29)

- PostgreSQL migration `0003_futuristic_praxagora.sql` adds units, ingredient categories,
  ingredients, suppliers, purchases/items/payments, immutable inventory movements, active
  recipes/items, order inventory consumption links, shopping lists, financial accounts,
  POS terminals, customer payments, expense categories, immutable financial transactions,
  and audit logs. `0004_slim_mystique.sql` adds POS to the existing order payment-method check.
- `packages/contracts/src/v15.ts` owns the typed Zod transport contracts. Inventory quantities
  cross the API as decimal strings; money retains the existing numeric(18,2)/number convention.
- `packages/server-core/src/services/v15-service.ts` owns v1.5 calculations and transactions.
  Electron main and Next.js share it; renderer code never accesses PostgreSQL.
- Order confirmation is the inventory-consumption point. Missing recipes produce an auditable
  warning link without fake stock transactions; eligible cancellation creates immutable reversals.
- Electron has connected Persian RTL pages for ingredients, inventory, suppliers, purchases,
  recipes/costing, and basic finance. Dashboard includes v1.5 operational alerts.
- Migrations and idempotent seed were applied successfully to the configured PostgreSQL database.
- Pino structured logging is centralized for Next.js and Electron. The authenticated Admin log
  viewer combines protected server JSON logs with trusted-IPC desktop logs and filters by source,
  severity, and text. Sensitive credentials and binary payloads are redacted.
- Electron navigation is grouped into a single-open Persian accordion: Orders, Products,
  Kitchen/Inventory, Finance, and System. Dashboard remains permanently visible, nested food
  editor/photo pages map back to Products/Foods, and the supported 680px window height no longer
  requires the normal sidebar scrollbar.
- The complete sidebar can also collapse to a 64px brand rail through an accessible edge toggle.
  Accordion state is retained while collapsed, and navigation corners use a restrained 5–7px radius.
- Food tag assignment is now separated from the add/edit food form. Foods list rows expose a
  `تگ‌ها` action that opens a dedicated tag/badge form while preserving the existing food payload.
- Food tag assignment only offers active tags; inactive tags remain visible in tag management so
  administrators can reactivate or edit them.
- Electron admin mutating API operations emit shared toast notifications for success and failure,
  giving all save/update/delete/status forms consistent immediate feedback.
- Duplicate food rows caused by post-migration demo food seeding were removed on 2026-07-30.
  The seed now creates demo foods only for an empty foods table, and PostgreSQL enforces
  `foods_name_normalized_uidx` on `lower(btrim(name))` so duplicate display names cannot return.
- The Mini App home hero now cycles through the existing static hero image plus the current daily
  menu's uploaded food photos, with accessible controls, automatic pause during interaction,
  responsive overlays, and a safe fallback to the same static hero image.
- Customer accounts now support silent validated Telegram login and browser mobile login through
  SMS.ir OTP. A 30-day HttpOnly customer cookie protects profile, saved-address, order-list, and
  order-detail APIs without exposing customer tokens to React.
- Verified Iranian mobile numbers are canonicalized to `09xxxxxxxxx`. Phone identities and the
  matching Telegram customer profile merge transactionally only after OTP verification; submitted
  but unverified checkout phone values do not grant access to order history.
- The Mini App has responsive customer login/profile navigation, editable preferred name and
  addresses, paginated personal order history, and authorized status/detail timelines.
- The Mini App exposes a customer `تماس با ما` page from desktop header actions and mobile
  navigation, with tap-to-call links for `09166450262` and `09163442440`.
- PostgreSQL migration `0006_old_punisher.sql` adds verified customer-phone mappings and bounded
  OTP challenges. It also normalizes valid existing Iranian customer phone formats.
- Both customer web and Electron admin use the bundled Vazir Farsi-digits font build. Application
  values remain ordinary ASCII `0-9` characters, but Vazir renders their visible glyphs in its
  Persian style; no character-by-character Persian-digit conversion is performed. Persian/Arabic
  keyboard digits remain accepted and normalized at numeric input boundaries.
- The Mini App mobile bottom navigation again shows its Persian labels under the five icons.
- Electron food-photo uploads use the shared `.data/uploads/foods` filesystem during development.
  The returned `/api/media/foods/...` URL is served by Next.js; packaged production builds still
  require configured Liara Object Storage.
- Electron main now reasserts the development local food-photo adapter before each upload, so
  repeated photo additions cannot fall through to the production Object Storage requirement.
- The Mini App food-detail header cart badge now uses the same positioned badge treatment as the
  mobile navigation instead of letting the count render as a separate line inside the desktop icon.
- The Mini App mobile menu grid centers its one-column food cards instead of inheriting the
  desktop start alignment.
- The Mini App food-detail page now always presents four labeled information sections on desktop
  and mobile: short description, full description, portion contents, and allergy information.
- The Mini App food-detail purchase controls use separate placement wrappers: desktop renders
  below the photo gallery, while mobile keeps the original sticky bottom purchase bar outside the
  detail layout.
- Mini App loading cards animate the serving-dish icon with a restrained settling motion and
  terracotta steam strokes; empty, warning, and error states remain static.
- Electron Admin form controls explicitly use the bundled Vazir Farsi-digits family, including
  Chromium's date-input editing fields, so typed ASCII numeric values use the same visible glyphs
  as read-only Admin content without changing their underlying characters.
- Private Telegram testing is supported through a Pinggy HTTPS tunnel targeting only Next.js port
  `3000`. Signed Telegram `initData` is required locally, and a token-safe PowerShell helper checks
  Kafgir health and updates the bot's rotating default Mini App menu URL.
- Kitchen/inventory and finance were audited and repaired on 2026-08-01. PostgreSQL migrations
  `0008_square_tinkerer.sql` and `0009_eminent_terrax.sql` align customer payment-method values,
  add enum/value/sign constraints, and protect purchase-line arithmetic.
- Inventory mutations now serialize on ingredient rows, reject insufficient tracked stock, skip
  untracked ingredients, correctly treat waste/preparation percentages as yield losses, and avoid
  zero-value stock-count movements. Purchase confirmation allocates header discounts/additional
  costs into inventory valuation and is idempotent.
- Electron Admin now exposes multi-line purchasing and recipes, stock counting, purchase payments,
  account transfers, expense categories, editable financial accounts/POS terminals, customer
  payment creation/verification/refunds, and complete finance/inventory report tables.
- Financial mutations serialize on account rows, enforce active accounts and sufficient balances,
  keep payment verification/refund ledger entries consistent, and report Tehran business-day
  boundaries from financial transaction dates. Per-operation Owner/KitchenAdmin/OrderManager
  authorization is enforced in Electron main.
- The seven operational Admin pages for Ingredients, Inventory, Purchases, Suppliers, Shopping,
  Finance, and Payments now include an initially expanded, keyboard-accessible Persian guide with
  workflow steps, a concrete example, and page-specific safeguards against duplicate ledger work.
- Those pages now use consistent titled data panels with record counts and empty states. Table
  action cells remain real table cells, forms align to their card tops, and wide grids scroll inside
  their own panels without detaching headers from row values.
- The customer cart no longer silently removes sold-out/unavailable foods or reduces requested
  quantities when capacity changes. It retains and labels invalid lines, excludes them from the
  orderable total, blocks checkout until resolved, and refreshes menu capacity on cart entry and
  after a rejected order attempt.
- Order-capacity and availability errors returned by the shared transactional order service are
  now Persian and name the affected food/remaining portions where available.
- The Ingredients form presents inventory tracking as a compact «ثبت گردش انبار» option and labels
  preferred stock as an optional planning target, explicitly noting that it does not currently drive
  shopping-list calculations.
- Direct-browser customers can browse, open food details, and build a persistent guest cart without
  authentication. Checkout requests mobile OTP only after the completed order form is submitted;
  the cart and delivery fields remain intact throughout login. Valid Telegram Mini App users still
  authenticate silently, and the order route now rejects anonymous development fallback as well as
  anonymous production requests.
- Checkout and Profile now show the signed Telegram identity (username when present plus numeric
  Telegram user ID), verified-phone state, and an explicit `اتصال موبایل و بازیابی آدرس‌ها` action.
  A successful OTP link keeps the Telegram session active and immediately reloads the canonical
  profile, saved addresses, and order history.
- Customer identity linking now serializes per normalized phone and rejects reassignment when that
  verified phone already belongs to a different Telegram account. A phone value used only as an
  unverified Telegram delivery contact can no longer be used from a browser to claim that Telegram
  account; only phone-only historical profiles may be claimed after OTP proof.
- Verified login phones are no longer overwritten by alternate delivery-contact numbers submitted
  with Telegram orders. Customer profile reads prefer the verified login mapping over stale contact
  defaults.
- The Ingredients editor is a compact two-row responsive grid: identification/stock fields share one
  aligned row, while notes, tracking/activity options, and actions share the second row.
- Cart reconciliation is intentionally quiet when the cart is valid: the guest-cart explanation and
  successful-sync banner are no longer shown. Only actionable availability/capacity failures appear;
  affected rows stay visible and checkout remains disabled until the customer removes the item,
  lowers its quantity, or refreshes inventory successfully.
- Customer-facing page-level «منوی امروز» and «بازگشت» actions now reuse the same themed back-link
  treatment and RTL text/icon order as the cart's «ادامه خرید» action.
- Daily-menu items support an optional immediate discount price through migration
  `0010_sturdy_ego.sql`. The regular daily price remains the reference price, while orders,
  manual orders, carts, food discovery, and finance costing consume the effective discounted price.
- Electron Admin's Today Menu editor provides a dedicated «تخفیف فوری» control with live percentage
  and savings feedback, quick discount actions, and original/final price presentation in the grid.
- The Web menu, food detail, related foods, and cart use a shared discount-aware price display with a
  struck-through original price, semantic discount badge, and emphasized final price. Open menu and
  food-detail views refresh unobtrusively every 15 seconds and on focus so Admin price changes appear
  without a manual reload.
- Successful customer checkout now presents a branded invoice immediately, with a prominent order
  number, immutable item snapshots, delivery/payment details, totals, and browser print/PDF support.
  The same invoice remains available from the customer's authenticated order-history details.
- Electron Admin order details expose a dedicated invoice preview and A4 print/PDF action. Because
  Orders and the full report share `OrderDetails`, both operational flows use the same invoice.
- Orders created from cryptographically validated Telegram `initData` or an existing Telegram
  customer session enqueue a full plain-text invoice to that Telegram chat through the durable
  notification outbox. Delivery remains asynchronous and retryable, so Telegram failure never rolls
  back an otherwise valid customer order.
- PostgreSQL migration `0011_powerful_sleeper.sql` changes notification text storage from the legacy
  2,000-character limit to `text`, allowing complete multi-line invoices within Telegram's safe size.
- Local PostgreSQL now contains a versioned operational learning scenario created by
  `npm run db:seed-demo`: 17 ingredients, 5 suppliers, 6 purchases, 18 inventory movements,
  1 saved shopping list, 3 financial accounts and 3 customer payment examples. The dataset is
  realistic but fictional, is protected from accidental production execution, and reuses shared
  transactional services rather than bypassing business rules.
- Electron Admin's Shopping page now lists saved shopping-list snapshots with their status, item
  count, estimated purchase total and ingredient summary; previously only the shortage calculator
  was visible even though lists were persisted.
- Mini App mobile navigation is flush with the physical top/bottom viewport edges while keeping
  safe-area padding inside the bars. Bottom navigation explicitly centers its two compact rows with
  a 4px icon/label gap; the first label is `خانه`, and the account label changes from `ورود` to
  `کفگیر من` as soon as a phone or Telegram customer session becomes authenticated.
- Operational demo seed version 2 adds an `افزودنی و تک‌پرس` category and five independently
  orderable current-menu items: extra saffron rice, ghormeh-sabzi without rice, gheimeh without
  rice, saffron chicken thigh without rice, and saffron chicken breast without rice. Each has its
  own price, capacity, customer copy and active inventory recipe.
- The Mini App now provides live food-first search below the home carousel. It filters only today's
  orderable menu and combines Persian-normalized matching across food name, short description,
  category and active customer-visible tags; category chips and search terms work together.
- Today's public menu is now delivered as cursor-paginated server results (12 foods per request).
  Search runs in PostgreSQL after a 300ms debounce and requires two meaningful characters; an
  `IntersectionObserver` loads later pages near the viewport, with an accessible manual fallback.
  Cart reconciliation uses a separate ID-scoped snapshot so unloaded foods remain valid and visible.
- Electron invoice printing now crosses the preload boundary through an authenticated, trusted-sender
  IPC operation and opens Electron's native print/PDF dialog with background colors enabled. Web and
  Admin invoice print styles preserve table headers and avoid splitting key invoice blocks.
- Removing the final remaining food from the Web cart now requires an inline themed confirmation.
  It applies to decrementing the last single portion and to explicitly removing the only food, while
  ordinary quantity changes and removals from multi-food carts stay uninterrupted.
- The Web home page now uses a compact pill search below the hero and a dedicated `تخفیف‌های امروز`
  showcase. The initial menu response includes up to eight orderable discounted foods while keeping
  the same foods in the normal cursor-paginated menu grid.
- Rice-based foods can now expose a mandatory Iranian/foreign rice choice from one product card.
  Migration `0012_nifty_mandarin.sql` adds food-level rice/inventory configuration, daily-menu price
  and capacity controls, and immutable order-line snapshots. Capacity confirmation/cancellation and
  inventory consumption are transactional for both the base dish and selected rice ingredient.
- Electron Admin now has an isolated `تنظیم برنج` editor, per-menu rice surcharge/capacity controls,
  mandatory rice selection in manual ordering, and rice labels in order details and printed invoices.
  The Web uses a desktop dialog/mobile bottom sheet, composite cart identities, rice-aware stock
  reconciliation, food-detail selection, invoices and Telegram invoice text.
- Local demo data now contains independent `برنج ایرانی` and `برنج خارجی` ingredients through
  `npm run db:seed-rice-options --workspace @kafgir/web`; linking those rice ingredients to foods
  is intentionally handled by the Admin `تنظیم برنج` page. Rice ingredients use `گرم` as their base
  unit, so per-portion rice consumption is entered as whole grams instead of decimal kilograms.
- Electron Admin's customer-payment page now separates successful, failed, pending-review and
  refunded payments into filterable summary cards. The detailed grid includes order number,
  customer identity, method, destination account, tracking/reference number, timestamp and actions.
- The Web development server now runs with `next dev --hostname 0.0.0.0`, so local mobile devices
  and Pinggy tunnels can reach the customer app on port `3000`.
- Order-number generation bound its substring offset untyped, so PostgreSQL resolved the POSIX-regex
  overload `substring(text FROM text)` and every order in a Persian year collapsed to one counter
  value. The offset is now cast to `int`. Local data already showed the damage: `14051` then `14056`,
  with the next order guaranteed to collide.
- Rice is a single optional upgrade. Every dish is served with foreign rice, already priced into the
  dish; Persian rice is one standalone food carrying `foods.is_persian_rice`, sold at the upgrade
  difference and offered only on dishes whose `foods.allows_persian_rice` is set.
- Migrations `0014_marvelous_tony_stark.sql` and `0015_amused_ben_urich.sql` rename
  `requires_rice_selection` to `allows_persian_rice`, replace `rice_addon_type` with
  `is_persian_rice`, retire the «برنج خارجی» food, and drop the old columns. Dish prices are
  unchanged: they still include foreign rice, so nothing needs repricing.
- The client sends `withPersianRice: true|false` per dish; `createOrder` resolves today's Persian rice
  menu item, prices it, aggregates it across dishes and expands it into its own order line. Nothing is
  mandatory, so a dish stays fully orderable when Persian rice sells out.
- `packages/contracts/src/rice.ts` and `RiceOptionPicker.tsx` were deleted. The upgrade is one inline
  checkbox on the menu card and food detail, and one checkbox per food in the Electron food editor
  alongside a second «این غذا خودِ برنج ایرانی است» flag.
- `npm run db:seed-rice-options --workspace @kafgir/web` now prepares only «برنج ایرانی», priced as
  the ۵۵٬۰۰۰ upgrade difference, and still leaves menu placement and dish flags to Admin.
- Order-number generation bound its substring offset untyped, so PostgreSQL resolved the POSIX-regex
  overload `substring(text FROM text)` and every order in a Persian year collapsed to one counter
  value. The offset is now cast to `int`. Local data already showed the damage: `14051` then `14056`,
  with the next order guaranteed to collide.
