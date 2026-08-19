# Database

Kafgir uses PostgreSQL with Drizzle ORM.

- Canonical schema: `packages/server-core/src/db/schema.ts`
- Generated migrations: `apps/web/drizzle`
- Shared client factory: `packages/server-core/src/db/client.ts`
- Seed utility: `apps/web/scripts/seed.ts`
- One-time SQL Server importer: `apps/web/scripts/migrate-sqlserver.ts`
  (order-number pre-flight rules: `apps/web/scripts/legacy-order-numbers.ts`)

## Model

The schema includes users, roles and Identity compatibility tables, Telegram accounts, customer profiles and addresses, foods, daily menus and menu items, delivery time slots and their per-date availability overrides, orders and immutable order lines, status history, notification outbox messages, application settings, and social-publishing channels/templates/posts/targets/attempts/rules/suggestions/settings.

`order_reviews` (migration `0018_warm_order_reviews.sql`) stores the customer's single review for an
order. `order_id` is unique, rating is constrained to 1–5, comment is nullable and bounded to 1000
characters, and the customer profile FK records ownership. The service also verifies that the review
profile owns the order and that the order is Delivered before inserting or updating.

`analytics_sessions` (migration `0019_lightweight_customer_analytics.sql`) stores only random
first-party visitor/session UUIDs, optional authenticated user association, and session timestamps.
Orders have nullable visitor/session attribution for conversion reporting; this attribution is never
required for order creation. Recent-activity, visitor/day, session-start and attributed-order indexes
serve the one dashboard aggregate without adding a general event stream.

Customer addresses and order delivery snapshots keep a single address text field. Migration `0007_mighty_kree.sql` preserves legacy note text by appending it into the address line before dropping the old `customer_addresses.description` and `orders.delivery_address_description` columns.

Food discovery is normalized through:

- `food_categories`: one required category per food;
- `food_tags` and `food_to_tags`: reusable many-to-many labels;
- `foods.primary_badge_tag_id`: an optional highlighted tag, validated as one of the food's assigned tags;
- `food_images`: ordered image gallery with a partial unique index allowing at most one primary image;
- `food_likes` and `food_favorites`: idempotent customer interactions with composite user/food primary keys.

Migration `0002_food_discovery.sql` introduces these structures without resetting existing data. Existing foods are first assigned to the seeded `rice` category while the new columns are nullable, and only then are the required constraints applied. Legacy image URLs are copied into `food_images`.

Food image binaries are not database data. In local development, new images are normalized by Electron main and stored in `.data/uploads/foods`; PostgreSQL stores application-relative `/api/media/foods/{uuid}.webp` URLs served by Next.js. In production, new images are stored in a public Liara S3-compatible Object Storage bucket and PostgreSQL stores the public HTTPS URL. Existing external URLs remain valid. Local `/api/media/foods/{uuid}.webp` values can be migrated with `npm run migrate:food-images --workspace @kafgir/web -- --apply`; the migration retains local files for rollback.

Electron uses the restricted `kafgir_electron_admin` login created by `infra/postgres/create-electron-admin-role.sql`. It has application DML and sequence privileges but cannot own schemas, create databases/roles, or run migrations.

Migration `0017_social_publishing.sql` owns social publishing persistence. `social_post_targets` keeps
one idempotency key and delivery status per destination, while `social_publication_attempts` records
each provider attempt. Rule/default destination channels use relation tables rather than serialized
IDs. Electron main encrypts channel tokens with Windows DPAPI before writing
`social_channels.credential_ciphertext`; renderer DTOs expose only whether a credential exists.

PostgreSQL preserves:

- integer primary keys and numeric enum values;
- `numeric(18,2)` money columns;
- date-only menu dates;
- UTC timestamp values;
- unique menu dates, unique menu food entries, and unique order numbers;
- foreign keys and snapshot records;
- nonnegative capacity, sold-portion, money, quantity, and retry constraints.

## Transactions

Order submission starts in `PendingConfirmation` and does not reserve capacity. Confirmation locks the order and referenced menu rows before incrementing sold portions. Cancellation restores portions when required. Persian-year order-number generation is serialized with a PostgreSQL transaction advisory lock.

## Order numbers

An order number is `<Persian business year><counter>`, where the counter is `MAX(numeric suffix) + 1`
over every row sharing that year prefix, read under `pg_advisory_xact_lock`. Two properties are
load-bearing and easy to break:

- The suffix is compared **numerically**, not as text. The `::int` cast in the counter query is what
  makes `140510` rank above `14059`; without it the counter stalls and reissues a taken number.
- The lock plus READ COMMITTED is what makes concurrency safe: the waiter re-reads after the holder
  commits. A stricter isolation level would reintroduce duplicates.

`order-number.integration.test.ts` covers both, plus year isolation, non-numeric suffixes, and eight
concurrent checkouts.

The counter casts the suffix to `int`, so a row whose suffix exceeds `2147483647` makes the query
throw and blocks all checkout for that year. The app's own numbering cannot reach that, but imported
data can, so `migrate-sqlserver.ts` runs `inspectLegacyOrderNumbers` before copying anything and
refuses the migration on oversized, over-long, empty, or duplicate values. Large-but-legal suffixes
are warned about instead, because they permanently raise the counter for their year.

Customer order history uses the immutable columns on `orders` and `order_items`; it never reconstructs
historical addresses or prices from current profile/catalog rows. The list query aggregates order items,
the latest payment state, persisted histories and review into one page query. Details enforce
`orders.customer_profile_id` before loading item/history/payment/review records. Customer payment reads
select an explicit safe field allowlist and omit account IDs, receipt images and descriptions.

## Testing

The guarded integration suite requires `TEST_DATABASE_URL` whose database name contains `test`. Local disposable PostgreSQL configuration is in `infra/postgres.compose.yml`.

`drizzle.config.ts` loads the Next.js environment files, so `npm run db:migrate` uses `apps/web/.env.local` during local development. Electron Admin reads its own `apps/admin/.env.local` independently, with no mechanism keeping the two `DATABASE_URL` values in sync — see the `.env.local` warning in `.ai/docs/reference-data.md` for the incident this caused and the runtime guard that now catches it early.
