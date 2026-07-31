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
