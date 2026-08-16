CREATE TABLE "food_tag_groups" (
	"code" varchar(40) PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "food_tag_groups_active_order_idx" ON "food_tag_groups" USING btree ("is_active","display_order");
--> statement-breakpoint
INSERT INTO "food_tag_groups" ("code", "title", "display_order", "is_active", "is_system", "created_at", "updated_at") VALUES
	('status', 'وضعیت', 10, true, true, NOW(), NOW()),
	('protein', 'پروتئین', 20, true, true, NOW(), NOW()),
	('diet', 'رژیم', 30, true, true, NOW(), NOW()),
	('taste', 'طعم', 40, true, true, NOW(), NOW()),
	('serving', 'سرو', 50, true, true, NOW(), NOW()),
	('service', 'خدمت', 60, true, true, NOW(), NOW()),
	('style', 'سبک', 70, true, true, NOW(), NOW()),
	('marketing', 'بازاریابی', 80, true, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "food_tag_groups" ("code", "title", "display_order", "is_active", "is_system", "created_at", "updated_at")
SELECT DISTINCT "group_name", "group_name", 1000, true, false, NOW(), NOW()
FROM "food_tags"
WHERE "group_name" IS NOT NULL
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "food_tags" ADD CONSTRAINT "food_tags_group_name_food_tag_groups_code_fk" FOREIGN KEY ("group_name") REFERENCES "public"."food_tag_groups"("code") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
CREATE TABLE "support_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"system_key" varchar(50),
	"title" varchar(120) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "support_subjects_system_key_uidx" ON "support_subjects" USING btree ("system_key") WHERE "support_subjects"."system_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "support_subjects_active_order_idx" ON "support_subjects" USING btree ("is_active","display_order");
--> statement-breakpoint
INSERT INTO "support_subjects" ("id", "system_key", "title", "display_order", "is_active", "is_system", "created_at", "updated_at") VALUES
	(1, 'order-follow-up', 'پیگیری سفارش', 10, true, true, NOW(), NOW()),
	(2, 'payment', 'پرداخت', 20, true, true, NOW(), NOW()),
	(3, 'delivery', 'ارسال و تحویل', 30, true, true, NOW(), NOW()),
	(4, 'food-quality', 'کیفیت غذا', 40, true, true, NOW(), NOW()),
	(5, 'suggestion-complaint', 'پیشنهاد یا انتقاد', 50, true, true, NOW(), NOW()),
	(6, 'other', 'سایر موارد', 60, true, true, NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET "system_key" = EXCLUDED."system_key", "title" = EXCLUDED."title", "display_order" = EXCLUDED."display_order", "is_system" = true, "updated_at" = NOW();
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('support_subjects', 'id'), COALESCE((SELECT MAX("id") FROM "support_subjects"), 1), true);
--> statement-breakpoint
ALTER TABLE "support_conversations" DROP CONSTRAINT IF EXISTS "support_conversations_subject_check";
--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_subject_support_subjects_id_fk" FOREIGN KEY ("subject") REFERENCES "public"."support_subjects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "payment_method_settings" (
	"method" integer PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" varchar(500),
	"is_customer_enabled" boolean DEFAULT true NOT NULL,
	"is_manual_enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_method_settings_method_check" CHECK ("payment_method_settings"."method" IN (1, 2, 3, 4))
);
--> statement-breakpoint
CREATE INDEX "payment_method_settings_order_idx" ON "payment_method_settings" USING btree ("display_order");
--> statement-breakpoint
INSERT INTO "payment_method_settings" ("method", "title", "description", "is_customer_enabled", "is_manual_enabled", "display_order", "updated_at") VALUES
	(1, 'نقدی', 'پرداخت نقدی هنگام تحویل سفارش', true, true, 10, NOW()),
	(2, 'کارت‌به‌کارت', 'واریز مستقیم به حساب یا کارت مجموعه', false, true, 20, NOW()),
	(3, 'پرداخت آنلاین', 'پرداخت اینترنتی از درگاه امن', true, true, 30, NOW()),
	(4, 'کارت‌خوان', 'پرداخت با دستگاه کارت‌خوان هنگام تحویل', true, true, 40, NOW())
ON CONFLICT ("method") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "delivery_method_settings" (
	"method" integer PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"description" varchar(500),
	"is_customer_enabled" boolean DEFAULT true NOT NULL,
	"is_manual_enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"delivery_fee" numeric(18, 2) DEFAULT 0 NOT NULL,
	"minimum_order_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "delivery_method_settings_method_check" CHECK ("delivery_method_settings"."method" IN (1, 2)),
	CONSTRAINT "delivery_method_settings_amounts_check" CHECK ("delivery_method_settings"."delivery_fee" >= 0 AND "delivery_method_settings"."minimum_order_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX "delivery_method_settings_order_idx" ON "delivery_method_settings" USING btree ("display_order");
--> statement-breakpoint
INSERT INTO "delivery_method_settings" ("method", "title", "description", "is_customer_enabled", "is_manual_enabled", "display_order", "delivery_fee", "minimum_order_amount", "updated_at") VALUES
	(1, 'تحویل حضوری', 'دریافت سفارش از محل آشپزخانه', true, true, 20, 0, 0, NOW()),
	(2, 'ارسال', 'ارسال سفارش به نشانی مشتری', true, true, 10, 0, 0, NOW())
ON CONFLICT ("method") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_payment_method_check";
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_method_check" CHECK ("orders"."payment_method" IN (1, 2, 3, 4));
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_method_check";
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_method_check" CHECK ("payments"."payment_method" IN (1, 2, 3, 4));
--> statement-breakpoint
ALTER TABLE "notification_messages" DROP CONSTRAINT IF EXISTS "notification_messages_type_check";
--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_type_check" CHECK ("notification_messages"."type" BETWEEN 1 AND 3);
