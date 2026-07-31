# Database

Kafgir uses PostgreSQL with Drizzle ORM.

- Canonical schema: `packages/server-core/src/db/schema.ts`
- Generated migrations: `apps/web/drizzle`
- Shared client factory: `packages/server-core/src/db/client.ts`
- Seed utility: `apps/web/scripts/seed.ts`
- One-time SQL Server importer: `apps/web/scripts/migrate-sqlserver.ts`

## Model

The schema includes users, roles and Identity compatibility tables, Telegram accounts, customer profiles and addresses, foods, daily menus and menu items, orders and immutable order lines, status history, notification outbox messages, and application settings.

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

## Testing

The guarded integration suite requires `TEST_DATABASE_URL` whose database name contains `test`. Local disposable PostgreSQL configuration is in `infra/postgres.compose.yml`.

`drizzle.config.ts` loads the Next.js environment files, so `npm run db:migrate` uses `apps/web/.env.local` during local development.
