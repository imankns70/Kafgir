CREATE TABLE "daily_menu_item_rice_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"daily_menu_item_id" integer NOT NULL,
	"food_rice_option_id" integer NOT NULL,
	"price_adjustment" numeric(18, 2) DEFAULT 0 NOT NULL,
	"capacity_portions" integer NOT NULL,
	"sold_portions" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "daily_menu_item_rice_options_price_check" CHECK ("daily_menu_item_rice_options"."price_adjustment" >= 0),
	CONSTRAINT "daily_menu_item_rice_options_capacity_check" CHECK ("daily_menu_item_rice_options"."capacity_portions" >= 0),
	CONSTRAINT "daily_menu_item_rice_options_sold_check" CHECK ("daily_menu_item_rice_options"."sold_portions" >= 0 AND "daily_menu_item_rice_options"."sold_portions" <= "daily_menu_item_rice_options"."capacity_portions")
);
--> statement-breakpoint
CREATE TABLE "food_rice_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"food_id" integer NOT NULL,
	"rice_type" integer NOT NULL,
	"title" varchar(80) NOT NULL,
	"ingredient_id" integer NOT NULL,
	"quantity_per_portion" numeric(20, 6) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "food_rice_options_type_check" CHECK ("food_rice_options"."rice_type" BETWEEN 1 AND 2),
	CONSTRAINT "food_rice_options_quantity_check" CHECK ("food_rice_options"."quantity_per_portion" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_money_check";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "rice_option_id" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "rice_option_title" varchar(80);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "rice_price_adjustment" numeric(18, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "original_unit_price" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "daily_menu_item_rice_options" ADD CONSTRAINT "daily_menu_item_rice_options_daily_menu_item_id_daily_menu_items_id_fk" FOREIGN KEY ("daily_menu_item_id") REFERENCES "public"."daily_menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_menu_item_rice_options" ADD CONSTRAINT "daily_menu_item_rice_options_food_rice_option_id_food_rice_options_id_fk" FOREIGN KEY ("food_rice_option_id") REFERENCES "public"."food_rice_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_rice_options" ADD CONSTRAINT "food_rice_options_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_rice_options" ADD CONSTRAINT "food_rice_options_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_menu_item_rice_options_item_food_option_uidx" ON "daily_menu_item_rice_options" USING btree ("daily_menu_item_id","food_rice_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "food_rice_options_food_type_uidx" ON "food_rice_options" USING btree ("food_id","rice_type");--> statement-breakpoint
CREATE UNIQUE INDEX "food_rice_options_food_ingredient_uidx" ON "food_rice_options" USING btree ("food_id","ingredient_id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_rice_option_id_daily_menu_item_rice_options_id_fk" FOREIGN KEY ("rice_option_id") REFERENCES "public"."daily_menu_item_rice_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_money_check" CHECK ("order_items"."unit_price" >= 0 AND "order_items"."rice_price_adjustment" >= 0 AND ("order_items"."original_unit_price" IS NULL OR "order_items"."original_unit_price" >= "order_items"."unit_price") AND "order_items"."total_price" = "order_items"."unit_price" * "order_items"."quantity");