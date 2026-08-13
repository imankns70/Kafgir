# Tasks

## Completed — 2026-08-13 mobile invoice logo

- [x] Replace the overflowing compact invoice lockup with the square Kafgir symbol.
- [x] Add explicit desktop/mobile invoice symbol dimensions and a markup regression assertion.

## Completed — 2026-08-13 cart menu-row remapping

- [x] Reproduce a valid-capacity food being reported absent after its daily-menu row was recreated.
- [x] Add stable food identity to cart storage and cart-snapshot requests/responses.
- [x] Remap stale cart lines to today's menu row and refresh capacity and price.
- [x] Heal legacy carts without `foodId` using their saved unique food name.
- [x] Add regression tests for both new and legacy carts and validate lint/build/tests.

## Completed — 2026-08-13 order and build recovery

- [x] Remove card-to-card from active application choices and operational seed data.
- [x] Redesign the responsive order-success summary.
- [x] Allow order confirmation without opening ingredient inventory while retaining menu-capacity checks.
- [x] Combine matched Persian-rice upgrades with their dish in Web and Admin invoice presentation.
- [x] Put mobile first in manual orders and preload existing customer details and saved addresses.
- [x] Add delivery-method and available delivery-slot selection to manual orders.
- [x] Reproduce the fresh-checkout `@kafgir/contracts` resolution failure affecting Web and Electron.
- [x] Add automatic contracts compilation before independent Web/Admin development and production builds.
- [x] Validate lint, 343 tests, missing-dist Web build, missing-dist Electron build, and diff integrity.
- [x] Merge order-flow PR #11 and build-recovery PR #12 into `main`.

## Complete

- [x] Add migration `0017_social_publishing.sql`, shared contracts and server-core services for
  channels, templates, drafts, posts, targets, attempts, rules, suggestions and settings.
- [x] Add typed Electron IPC and Persian RTL pages for social dashboard, channels, composer,
  templates, rules, suggestions and history without exposing SQL or credentials to renderer.
- [x] Add Telegram, Bale and Eitaa adapters, target-level retries/idempotency, Unknown crash
  recovery, automation throttles and strict public-capacity privacy validation.
- [x] Apply migration 0017 locally and verify real database drafts, seeded templates/rules and the
  default Suggestion configuration with `social:verify`.
- [x] Create npm workspace and shared Zod contracts
- [x] Move the Mini App to Next.js App Router
- [x] Preserve customer and admin `/api/...` contracts
- [x] Model PostgreSQL persistence with Drizzle
- [x] Implement capacity row locks and advisory order-number locking
- [x] Implement ASP.NET Identity V3 compatibility and scrypt upgrade
- [x] Implement Telegram `initData` validation
- [x] Implement durable notification processing
- [x] Implement Electron admin feature coverage and Persian dates
- [x] Secure Electron preload, renderer, in-memory admin session, and remote URL handling
- [x] Implement SQL Server-to-PostgreSQL import and validation
- [x] Add unit/parity and guarded PostgreSQL integration tests
- [x] Build Next.js and Electron
- [x] Package and smoke-launch the Windows x64 NSIS installer
- [x] Create rollback tag `legacy-dotnet-final-2026-07-28`
- [x] Delete the .NET/WPF/Worker and old Vite source structures
- [x] Remove obsolete legacy documentation
- [x] Initialize local PostgreSQL `kafgir` database and run Drizzle migrations
- [x] Seed starter roles, foods, and local admin user
- [x] Replace legacy logo variants with `branding/logo.png` derivatives across Next.js and Electron
- [x] Add secure food-photo upload, WebP normalization, previews, Object Storage integration, and managed cleanup
- [x] Add food categories, tags, validated primary badges, ordered galleries, likes, and favorites
- [x] Add customer food details, database-driven category filters, related foods, and card detail navigation
- [x] Add an admin-photo carousel to the customer food detail page.
- [x] Add Electron category/tag management and expanded food editor
- [x] Move the Electron food editor out of the catalog grid into a dedicated page
- [x] Prevent duplicate food names, clean current local duplicates, add food-photo status to the catalog list, and split photo upload into a separate editor form/card
- [x] Rename admin slug wording to `عنوان انگلیسی` and add Daily Menu price separators plus live Persian price words
- [x] Move food photo upload out of the add/update food page into a dedicated photo-management page
- [x] Restore evolved WPF order/report UX in Electron with dedicated details, pagination, complete columns and filters, status actions, and auto-refresh
- [x] Replace the simple Electron manual-order page with the evolved WPF-style order-entry layout
- [x] Replace the separate Electron order-detail page with the WPF-style split Orders layout
- [x] Fix Electron manual-order shortcut punctuation and Next.js order-create timestamp binding error
- [x] Apply and seed PostgreSQL migration `0002_food_discovery.sql`

## Remaining operational work

- [ ] Add real channel credentials, run each channel connection test and perform one manual test
  publication per platform before enabling any rule.
- [ ] Review rule hours, quiet hours, daily caps and destination channels, then enable rules one by
  one. Keep Suggestion mode until actual platform deliveries have been reviewed.
- [ ] Package Electron on the secured Windows account and verify DPAPI tokens remain readable after
  app restart. Never copy ciphertext as a portable credential backup.
- [x] Run guarded PostgreSQL integration tests against disposable `kafgir_food_discovery_test`
- [ ] Review the default `rice` assignment for four pre-existing foods (`food-1` through `food-4`)
- [ ] Rehearse the SQL Server import against staging PostgreSQL
- [ ] Rotate and configure production database, JWT, Telegram, and processor secrets
- [ ] Deploy Next.js and PostgreSQL on Liara
- [ ] Create the public Liara Object Storage bucket, configure bucket-scoped credentials, and include it in the production backup plan
- [ ] Save the production PostgreSQL TLS URL and Object Storage settings through the packaged Electron first-run setup
- [ ] Run production order, admin, report, and notification smoke tests
- [ ] Upgrade Next.js when a stable release resolves the inherited PostCSS/Sharp advisories
- [x] Add Kafgir 1.5 PostgreSQL schema and idempotent reference-data seed.
- [x] Add v1.5 shared Zod contracts for ingredients, purchasing, inventory, recipes and finance.
- [x] Add transactional purchase confirmation/reversal and immutable inventory movements.
- [x] Connect order confirmation/cancellation to recipe consumption/reversal.
- [x] Add ingredient, supplier, purchase, inventory, recipe and finance Electron admin screens.
- [x] Separate cash, POS, card-to-card and online methods in customer/admin payment UI.
- [x] Add shopping requirements/list, payment verification/refund and managerial report APIs.
- [x] Add centralized Pino logging, sensitive-field redaction, and the Admin log viewer.
- [x] Replace the flat Electron sidebar with a tested single-open grouped navigation accordion.
- [x] Add full sidebar collapse/expand behavior and reduce excessive navigation corner radii.
- [x] Split food tag assignment into a dedicated Admin `تگ‌ها` form opened from the Foods page.
- [x] Add shared Electron Admin toast notifications for mutating form operations.
- [x] Remove seed-created duplicate foods and add a database-level normalized food-name uniqueness guard.
- [x] Replace the Mini App home hero's single static photo with a responsive carousel containing the static hero plus daily-menu food photos.
- [x] Clarify Electron food editor/photo labels and keep sparse Orders grids pinned to the top of their panels.
- [x] Add unified Telegram/mobile OTP customer authentication with HttpOnly sessions.
- [x] Add customer profile editing, saved-address management, personal order history, and protected order details.
- [x] Add the Mini App `تماس با ما` page and navigation entry with two customer phone links.
- [x] Add SMS.ir verification delivery, OTP rate limits/digests, phone normalization, and customer identity merging.
- [x] Extract the framework-independent PostgreSQL schema and transactional admin services into `packages/server-core`.
- [x] Replace Electron admin HTTP traffic with allowlisted typed IPC and direct PostgreSQL access confined to Electron main.
- [x] Add DPAPI-encrypted first-run database/Object Storage configuration and direct Liara S3 food-photo uploads.
- [x] Add the restricted Electron PostgreSQL role script and legacy disk-to-Object-Storage migration utility.
- [x] Fix `npm run dev` Electron startup by bundling shared contracts into Electron main and serializing database runtime configuration.
- [x] Standardize visible numeric output on Latin `0-9` digits in Web and Electron Admin, with formatter regression tests.
- [x] Switch both application UIs to Vazir's Farsi-digits build without changing underlying ASCII number characters.
- [x] Force Vazir FD rendering inside Web/Admin typed inputs, placeholders, autofill, LTR fields, and number controls.
- [x] Restore Persian labels beneath the Mini App bottom-navigation icons.
- [x] Restore Electron's local development food-photo adapter when Liara Object Storage is not configured.
- [x] Align the Mini App food-detail desktop cart badge with the existing mobile badge treatment.
- [x] Center one-column Mini App food cards on mobile widths.
- [x] Remove the confusing share/forward icon from the Mini App food-detail header and keep the top back action clear.
- [x] Swap the Mini App food-detail header basket and back control positions while preserving each icon.
- [x] Hide the Mini App food-detail favorite header icon until the customer is logged in.
- [x] Change Mini App basket badges to count distinct foods instead of summed portions.
- [x] Swap the `ادامه خرید` basket-page button text/icon order for the RTL layout.
- [x] Remove separate address-description fields from Web/Admin/contracts/database and keep one address textarea.
- [x] Show labeled short/full description, portion contents, and allergy sections on the Mini App food-detail page.
- [x] Keep the food-detail purchase controls under the photo on desktop without moving the mobile sticky bar structure.
- [x] Animate the Mini App serving-dish mark only during menu and food-detail loading states.
- [x] Enforce Vazir Farsi-digit rendering for typed values in all Electron Admin form controls.
- [x] Add a token-safe rotating Pinggy helper and runbook for private Telegram Mini App testing.
- [ ] Create the Telegram bot through BotFather, add its token to the ignored local environment,
  configure the current Pinggy menu URL, and pin the stable bot link in the Telegram channel.
- [ ] Set the SMS.ir key and template `495934` plus a fresh 32-character `CUSTOMER_OTP_SECRET` and the
  public origin in the Liara production environment, and switch that environment to `SMS_PROVIDER=smsir`.
  Local `.env.local` already holds the credentials but deliberately stays on the console adapter.
- [ ] Create the production `kafgir_electron_admin` role, save its TLS URL through first-run setup, and rotate it after the acceptance test.
- [ ] Create the public Liara food-image bucket, migrate legacy disk URLs with the dry-run utility, and verify public URLs before removing the legacy media route.
- [ ] Remove compatibility `/api/admin/*` and admin-login Next.js routes after packaged Electron acceptance.
- [x] Expand Electron operations with multi-line purchase/recipe editors, stock count, purchase
  payments, account transfers, editable POS/accounts, payment verification/refund, and full reports.
- [ ] Add receipt and purchase-attachment upload to the existing Object Storage workflow.
- [x] Add isolated PostgreSQL integration coverage for purchase valuation, concurrent stock
  decrements, zero stock-count adjustments, and purchase-payment ledgers.
- [x] Execute the gated v1.5 PostgreSQL integration suite against a migrated, uniquely named
  temporary PostgreSQL database and remove that database after the run.
- [x] Add practical in-page Persian guides with examples to Ingredients, Inventory, Purchases,
  Suppliers, Shopping, Finance, and Payments.
- [x] Standardize the target forms and data grids with aligned cards, table headers/actions,
  record counts, empty states, and panel-local overflow.
- [x] Retain and clearly label sold-out/unavailable cart foods instead of silently removing them.
- [x] Block checkout for stale cart quantities, add explicit refresh/removal controls, and translate
  order availability/capacity failures to Persian.
- [x] Clarify the optional ingredient stock target and compact the inventory/activity controls.
- [x] Preserve an unauthenticated browser cart and require inline mobile OTP only at final checkout.
- [x] Reject anonymous order creation even when local Telegram development fallback is enabled.
- [x] Show Telegram identity and verified-phone linkage clearly in checkout/profile and reload linked
  addresses after successful OTP verification.
- [x] Prevent verified-phone reassignment across Telegram accounts and prevent unverified delivery
  phone matches from exposing Telegram order/address history.
- [x] Preserve verified login phones when Telegram orders use a different delivery-contact number.
- [x] Reflow the Ingredients editor into an aligned responsive two-row form.
- [x] Remove guest/success cart banners, surface only actionable inventory conflicts, and keep checkout
  blocked until every cart line is valid.
- [x] Standardize Web page-level menu/back actions with the cart's themed «ادامه خرید» control.
- [x] Add per-daily-menu immediate discounts with database constraints and effective-price order logic.
- [x] Add the Admin discount editor/grid treatment and shared Web discount presentation for menu,
  food detail, related foods, and cart, including background refresh.
- [x] Show the order number and a complete printable invoice after successful Web checkout.
- [x] Keep the customer invoice available from authenticated order-history details.
- [x] Add shared Electron Admin invoice preview/print support to Orders and the full report.
- [x] Queue a retryable direct Telegram invoice for validated Telegram customer orders.
- [x] Apply PostgreSQL migration `0011_powerful_sleeper.sql` for full invoice notification text.
- [x] Add and execute an idempotent, production-gated operational restaurant learning dataset for
  ingredients, suppliers, purchasing, inventory, shopping lists, finance, and payments.
- [x] Display persisted shopping-list snapshots in Electron Admin instead of showing only the
  date-based shortage calculator.
- [x] Attach the Mini App mobile header/footer surfaces to the viewport edges, normalize icon/title
  spacing, rename the home item, and expose the authenticated account as `کفگیر من`.
- [x] Add independently priced and capacity-controlled rice, stew, chicken-thigh and chicken-breast
  extras to the catalog/current menu with inventory-aware recipes.
- [x] Add live Persian-normalized food search for today's orderable Web menu across names,
  descriptions, categories and customer-visible tags.
- [x] Move Web food search to debounced PostgreSQL queries and add cursor-based infinite scrolling.
- [x] Keep cart reconciliation correct for unloaded menu pages through an item-ID snapshot endpoint.
- [x] Repair Electron invoice printing with a trusted native-print IPC operation and A4-safe styles.
- [x] Confirm before decrementing/removing the final food that would empty the Web cart.
- [x] Compact the Web home search and add a responsive duplicated discount showcase backed by the
  initial public menu response.
- [x] Add explicit Iranian/foreign rice configuration with independent ingredients, daily-menu
  surcharge/capacity, immutable order snapshots and transactional inventory/capacity accounting.
- [x] Add Electron rice configuration, daily-menu controls, manual-order selection, order/invoice
  labels, and Web dialog/bottom-sheet selection with composite cart reconciliation.
- [x] Apply migration `0012_nifty_mandarin.sql` locally and seed two independent rice ingredients;
  food-to-rice linking is now intentionally performed by Admin from the `تنظیم برنج` page.
- [x] Add filterable successful/failed/pending/refunded customer-payment monitoring to Electron Admin
  with customer, order, tracking, account, amount and timestamp details.
- [x] Fix order-number generation, which resolved PostgreSQL's regex `substring` overload and reused
  one counter value for every order in a Persian year.
- [x] Reduce rice to one optional Persian upgrade: `allows_persian_rice` per dish, `is_persian_rice`
  on the single upgrade food, migrations `0014`/`0015`, and removal of the foreign rice food.
- [x] Send `withPersianRice` per dish and let the server resolve, price and expand it into its own
  order line without any mandatory-selection gate.
- [x] Stop capping dish capacity and availability by rice, and delete `rice.ts` with its tests.
- [x] Replace the Web modal picker with one inline «با برنج ایرانی» checkbox, and the Electron rice
  fieldset with two plain checkboxes.
- [x] Seed only «برنج ایرانی» at the upgrade-difference price.
- [x] Migrate all four workspaces to TypeScript `7.0.2`.
- [x] Give the Web cart item information its own full-width row, make removal a filled button, and
  present the chosen rice as a read-only pill instead of an icon-prefixed line.
- [x] Confirm the Persian rice upgrade before it changes the price, with an itemised breakdown shown
  as a mobile bottom sheet and a desktop modal from one CSS-switched component.
- [ ] Operator, once the dev database is reachable: apply migrations `0014`/`0015`, run the rice seed,
  add «برنج ایرانی» to each day's menu with its upgrade price and capacity, and tick
  «امکان افزودن برنج ایرانی» on the dishes that offer it.
- [ ] Decide whether «خورشت … بدون برنج» should keep the flag carried over from the mandatory model.
- [x] Add delivery time-slot master data, per-date availability/capacity override, and migration
  `0016_lively_delivery_windows.sql`.
- [x] Derive the delivery date from the basket's daily menu, reject baskets spanning two menus, and
  snapshot title/start/end onto the order.
- [x] Revalidate the window atomically at order creation under an advisory lock keyed on date+slot,
  with capacity counting every non-Cancelled order.
- [x] Add `GET /api/delivery-slots` and the checkout «زمان تحویل» radio-card section with disabled
  unavailable windows and their Persian reasons.
- [x] Add Electron Admin «بازه‌های ارسال» and «ظرفیت ارسال روزانه», and show the delivery window in
  order details, invoices, and the report grid sorted by delivery date and start time.
- [x] Seed three starting windows only into an empty table.
- [ ] Operator: run migration `0016` and `npm run db:seed` against the live database, then review the
  seeded window hours and cutoffs against real kitchen lead times.
- [ ] Decide whether the checkout day selector should offer tomorrow's menu; the picker and
  `GET /api/delivery-slots?date=` already accept any date, but the basket is single-menu today.
- [ ] Consider a delivery-window filter on the Electron orders screen if operators ask for it; the
  report already sorts by delivery date and start time.
- [x] Replace the customer order-history list with warm responsive cards, active-order priority, actual
  status progress, immutable address/price snapshots, adaptive payment state and pagination.
- [x] Add a dedicated customer order-detail view with item snapshots, delivery data, financial summary,
  safe payment details and full actual-history timeline.
- [x] Add accessible delivered-order rating/comment create and edit with server-side ownership,
  eligibility, range/length validation and a unique review per order.
- [x] Apply migration `0018_warm_order_reviews.sql` to the configured local development database.
- [ ] Run `customer-auth.integration.test.ts` against a migrated disposable database after setting both
  `TEST_DATABASE_URL` and `DATABASE_URL` to the same database whose name contains `test`.
- [x] Rate limiting phase 1: resolve the trusted client IP from `TRUSTED_PROXY_HOPS` instead of the
  leftmost `X-Forwarded-For` entry.
- [x] Rate limiting phase 2: `IRateLimitStore` (async, replaceable) plus a concurrency-safe, bounded,
  auto-expiring in-memory store with fail-closed eviction, and a `withRateLimit` route wrapper.
  V1 is per-process and explicitly not distributed; Redis is deliberately deferred.
- [x] Rate limiting phase 3: reorder OTP to limiter →
  durable reservation → SMS so a blocked send never reaches the provider, keeping delivery failure
  distinguishable from a successful send, with per-phone/per-IP verification protection. No generic
  rate-limit table or migration.
- [x] Rate limiting phase 4: moderate identity and trusted-IP limits on order creation, cart snapshot,
  customer profile/address writes, and food like/favorite mutations; add same-origin protection to
  like/favorite. Health, Admin routes and Electron IPC remain untouched by design.
- [x] Rate limiting phase 5: safe `rate_limit.rejected` observability, final actual-endpoint
  classification, exclusion audit, single-instance limitations and future Redis migration path.
  Admin rate limiting remains intentionally out of scope.
- [x] Add first-party anonymous VisitorId and 30-minute analytics sessions without creating guest users.
- [x] Add visible-only two-minute Web heartbeat with a 60-second PostgreSQL write throttle and
  guest-to-authenticated session association.
- [x] Add optional order visitor/session attribution and the single Tehran-business-day aggregate for
  the eight approved customer analytics metrics.
- [x] Add the separate Electron «آمار کاربران امروز» dashboard section, accessible Persian tooltips,
  non-overlapping visible-only 30-second polling, and temporary-failure stale-value behavior.
- [x] Apply migration `0019_lightweight_customer_analytics.sql` to the configured development database.
- [ ] Run `customer-analytics.integration.test.ts` against a disposable migrated PostgreSQL database
  after setting `TEST_DATABASE_URL`; the local machine currently has no Docker executable.
- [ ] Before production rollout: count the real proxy chain from a deployed request's
  `X-Forwarded-For` and set `TRUSTED_PROXY_HOPS` accordingly. The committed value is an unverified
  placeholder; too low lets a caller choose their own rate-limit bucket.
- [x] Rate limiting phase 2: `IRateLimitStore`, `InMemoryRateLimitStore`, centralized typed policies,
  `withRateLimit`, 429 with `Retry-After`, HMAC keys, and production `TRUSTED_PROXY_HOPS` validation.
  Customer mutation policies are attached explicitly at their route boundaries in Phase 4.
- [x] Rate limiting phase 3: customer OTP send quotas with advisory-locked durable reservation, and
  per-phone/per-IP verify limits with challenge locking. Admin and Telegram login untouched.
- [x] Run `otp-rate-limit.integration.test.ts` against a migrated disposable PostgreSQL database;
  all 18 cases passed, including concurrent per-IP reservation and successful-code reuse rejection.
