-- Rice moves from a per-food modifier framework onto standalone rice foods. Order matters here:
-- the new flags must exist and be backfilled from the old configuration before it is dropped.
ALTER TABLE "foods" ADD COLUMN "requires_rice_selection" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "rice_addon_type" integer;--> statement-breakpoint

-- Every dish that had an active rice configuration keeps its mandatory rice choice.
UPDATE "foods" SET "requires_rice_selection" = TRUE
WHERE "id" IN (SELECT "food_id" FROM "food_rice_options" WHERE "is_active");--> statement-breakpoint

CREATE UNIQUE INDEX "foods_rice_addon_type_uidx" ON "foods" USING btree ("rice_addon_type") WHERE "foods"."rice_addon_type" IS NOT NULL AND "foods"."is_active";--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_rice_addon_type_check" CHECK ("foods"."rice_addon_type" IS NULL OR "foods"."rice_addon_type" BETWEEN 1 AND 2);--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_rice_role_check" CHECK (NOT ("foods"."rice_addon_type" IS NOT NULL AND "foods"."requires_rice_selection"));--> statement-breakpoint

-- Rice is now an ordinary order line, so the snapshot columns are gone. `original_unit_price` stays:
-- it snapshots the discount original price, not rice.
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_money_check";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_rice_option_id_daily_menu_item_rice_options_id_fk";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "rice_option_id";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "rice_option_title";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "rice_price_adjustment";--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_money_check" CHECK ("order_items"."unit_price" >= 0 AND ("order_items"."original_unit_price" IS NULL OR "order_items"."original_unit_price" >= "order_items"."unit_price") AND "order_items"."total_price" = "order_items"."unit_price" * "order_items"."quantity");--> statement-breakpoint

DROP TABLE "daily_menu_item_rice_options" CASCADE;--> statement-breakpoint
DROP TABLE "food_rice_options" CASCADE;
