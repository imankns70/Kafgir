CREATE TABLE "food_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"icon" varchar(30),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
INSERT INTO "food_categories"
	("title", "slug", "icon", "display_order", "is_active", "created_at", "updated_at")
VALUES
	('برنجی', 'rice', '🍚', 1, true, NOW(), NOW());
--> statement-breakpoint
CREATE TABLE "food_favorites" (
	"food_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "food_favorites_pk" PRIMARY KEY("user_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "food_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"food_id" integer NOT NULL,
	"image_url" varchar(2000) NOT NULL,
	"alt_text" varchar(250) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_likes" (
	"food_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "food_likes_pk" PRIMARY KEY("user_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "food_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"icon" varchar(30),
	"group_name" varchar(40) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_customer_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_to_tags" (
	"food_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "food_to_tags_pk" PRIMARY KEY("food_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "daily_menus" ADD COLUMN "order_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "slug" varchar(180);--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "full_description" text;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "ingredients" text;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "portion_description" varchar(500);--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "allergy_information" varchar(1000);--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "preparation_time_minutes" integer;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "primary_badge_tag_id" integer;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "foods"
SET
	"slug" = 'food-' || "id",
	"category_id" = (SELECT "id" FROM "food_categories" WHERE "slug" = 'rice'),
	"updated_at" = COALESCE("created_at", NOW());
--> statement-breakpoint
ALTER TABLE "foods" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "food_favorites" ADD CONSTRAINT "food_favorites_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_favorites" ADD CONSTRAINT "food_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_images" ADD CONSTRAINT "food_images_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "food_images"
	("food_id", "image_url", "alt_text", "display_order", "is_primary", "created_at")
SELECT "id", "image_url", "name", 0, true, COALESCE("created_at", NOW())
FROM "foods"
WHERE "image_url" IS NOT NULL AND BTRIM("image_url") <> '';
--> statement-breakpoint
ALTER TABLE "food_likes" ADD CONSTRAINT "food_likes_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_likes" ADD CONSTRAINT "food_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_to_tags" ADD CONSTRAINT "food_to_tags_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_to_tags" ADD CONSTRAINT "food_to_tags_tag_id_food_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."food_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_categories_slug_uidx" ON "food_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "food_categories_active_order_idx" ON "food_categories" USING btree ("is_active","display_order");--> statement-breakpoint
CREATE INDEX "food_favorites_food_id_idx" ON "food_favorites" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "food_images_food_order_idx" ON "food_images" USING btree ("food_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "food_images_one_primary_uidx" ON "food_images" USING btree ("food_id") WHERE is_primary = true;--> statement-breakpoint
CREATE INDEX "food_likes_food_id_idx" ON "food_likes" USING btree ("food_id");--> statement-breakpoint
CREATE UNIQUE INDEX "food_tags_slug_uidx" ON "food_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "food_tags_group_order_idx" ON "food_tags" USING btree ("group_name","display_order");--> statement-breakpoint
CREATE INDEX "food_to_tags_tag_id_idx" ON "food_to_tags" USING btree ("tag_id");--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_category_id_food_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."food_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_primary_badge_tag_id_food_tags_id_fk" FOREIGN KEY ("primary_badge_tag_id") REFERENCES "public"."food_tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_slug_uidx" ON "foods" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "foods_category_id_idx" ON "foods" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_preparation_time_check" CHECK ("foods"."preparation_time_minutes" IS NULL OR "foods"."preparation_time_minutes" > 0);
