-- Rice collapses to a single optional upgrade. Foreign rice is what every dish already includes in
-- its price, so it stops being purchasable; Persian rice becomes the one paid extra.
ALTER TABLE "foods" ADD COLUMN "allows_persian_rice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "is_persian_rice" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Dishes that forced a rice choice now offer the upgrade instead; the Iranian rice food becomes
-- the Persian rice upgrade. 0015 drops the old columns once this has run.
UPDATE "foods" SET "allows_persian_rice" = TRUE WHERE "requires_rice_selection";--> statement-breakpoint
UPDATE "foods" SET "is_persian_rice" = TRUE, "allows_persian_rice" = FALSE WHERE "rice_addon_type" = 1;--> statement-breakpoint

-- Retire the foreign rice food. Delete it outright when nothing ever reached it through an order,
-- otherwise leave the row inactive so existing order history still resolves its name.
DELETE FROM "recipe_items" WHERE "recipe_id" IN (
  SELECT r."id" FROM "recipes" r JOIN "foods" f ON f."id" = r."food_id"
  WHERE f."rice_addon_type" = 2 AND NOT EXISTS (
    SELECT 1 FROM "order_items" oi JOIN "daily_menu_items" d ON d."id" = oi."daily_menu_item_id"
    WHERE d."food_id" = f."id"));--> statement-breakpoint
DELETE FROM "recipes" WHERE "food_id" IN (
  SELECT f."id" FROM "foods" f WHERE f."rice_addon_type" = 2 AND NOT EXISTS (
    SELECT 1 FROM "order_items" oi JOIN "daily_menu_items" d ON d."id" = oi."daily_menu_item_id"
    WHERE d."food_id" = f."id"));--> statement-breakpoint
DELETE FROM "daily_menu_items" WHERE "food_id" IN (
  SELECT f."id" FROM "foods" f WHERE f."rice_addon_type" = 2 AND NOT EXISTS (
    SELECT 1 FROM "order_items" oi JOIN "daily_menu_items" d ON d."id" = oi."daily_menu_item_id"
    WHERE d."food_id" = f."id"));--> statement-breakpoint
UPDATE "foods" SET "is_active" = FALSE WHERE "rice_addon_type" = 2;--> statement-breakpoint
DELETE FROM "foods" f WHERE f."rice_addon_type" = 2
  AND NOT EXISTS (SELECT 1 FROM "daily_menu_items" d WHERE d."food_id" = f."id");--> statement-breakpoint

CREATE UNIQUE INDEX "foods_persian_rice_uidx" ON "foods" USING btree ("is_persian_rice") WHERE "foods"."is_persian_rice" AND "foods"."is_active";--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_persian_rice_role_check" CHECK (NOT ("foods"."is_persian_rice" AND "foods"."allows_persian_rice"));
