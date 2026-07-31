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
