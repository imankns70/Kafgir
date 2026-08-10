CREATE TABLE "social_channels" (
  "id" serial PRIMARY KEY NOT NULL,
  "platform" varchar(30) NOT NULL,
  "title" varchar(150) NOT NULL,
  "external_channel_id" varchar(200) NOT NULL,
  "username" varchar(150),
  "credential_ciphertext" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "connection_status" varchar(20) DEFAULT 'Unknown' NOT NULL,
  "last_successful_publication_at" timestamp with time zone,
  "last_publication_error" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "social_channels_platform_check" CHECK ("platform" IN ('Telegram', 'Bale', 'Eitaa')),
  CONSTRAINT "social_channels_connection_check" CHECK ("connection_status" IN ('Unknown', 'Connected', 'Failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "social_channels_platform_external_uidx" ON "social_channels" USING btree ("platform", "external_channel_id");
CREATE INDEX "social_channels_active_platform_idx" ON "social_channels" USING btree ("is_active", "platform");
--> statement-breakpoint
CREATE TABLE "social_post_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "template_type" varchar(40) NOT NULL,
  "title" varchar(150) NOT NULL,
  "pattern" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "social_post_templates_type_check" CHECK ("template_type" IN ('DailyMenu', 'FoodPromotion', 'Discount', 'LimitedAvailability', 'Custom'))
);
CREATE UNIQUE INDEX "social_post_templates_type_uidx" ON "social_post_templates" USING btree ("template_type");
--> statement-breakpoint
CREATE TABLE "social_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "template_type" varchar(40) NOT NULL,
  "title" varchar(200),
  "source_type" varchar(50),
  "source_id" integer,
  "default_text" text NOT NULL,
  "media_url" varchar(2000),
  "destination_url" varchar(2000),
  "status" varchar(30) DEFAULT 'Draft' NOT NULL,
  "origin" varchar(20) DEFAULT 'Manual' NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "published_at" timestamp with time zone,
  CONSTRAINT "social_posts_template_check" CHECK ("template_type" IN ('DailyMenu', 'FoodPromotion', 'Discount', 'LimitedAvailability', 'Custom')),
  CONSTRAINT "social_posts_status_check" CHECK ("status" IN ('Draft', 'Publishing', 'Published', 'PartiallyFailed', 'Failed')),
  CONSTRAINT "social_posts_origin_check" CHECK ("origin" IN ('Manual', 'Suggestion', 'Automation'))
);
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict;
CREATE INDEX "social_posts_created_idx" ON "social_posts" USING btree ("created_at");
CREATE INDEX "social_posts_source_idx" ON "social_posts" USING btree ("source_type", "source_id", "created_at");
CREATE INDEX "social_posts_status_idx" ON "social_posts" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE TABLE "social_post_targets" (
  "id" serial PRIMARY KEY NOT NULL,
  "social_post_id" integer NOT NULL,
  "social_channel_id" integer NOT NULL,
  "text_override" text,
  "media_override" varchar(2000),
  "destination_url_override" varchar(2000),
  "status" varchar(20) DEFAULT 'Pending' NOT NULL,
  "idempotency_key" varchar(100) NOT NULL,
  "external_message_id" varchar(200),
  "published_at" timestamp with time zone,
  "last_error" text,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "social_post_targets_status_check" CHECK ("status" IN ('Pending', 'Publishing', 'Published', 'Failed', 'Unknown')),
  CONSTRAINT "social_post_targets_retry_check" CHECK ("retry_count" BETWEEN 0 AND 5)
);
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_post_fk" FOREIGN KEY ("social_post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade;
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_channel_fk" FOREIGN KEY ("social_channel_id") REFERENCES "public"."social_channels"("id") ON DELETE restrict;
CREATE UNIQUE INDEX "social_post_targets_post_channel_uidx" ON "social_post_targets" USING btree ("social_post_id", "social_channel_id");
CREATE UNIQUE INDEX "social_post_targets_idempotency_uidx" ON "social_post_targets" USING btree ("idempotency_key");
CREATE INDEX "social_post_targets_status_idx" ON "social_post_targets" USING btree ("status", "updated_at");
--> statement-breakpoint
CREATE TABLE "social_automation_rules" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" varchar(150) NOT NULL,
  "template_type" varchar(40) NOT NULL,
  "trigger_type" varchar(40) NOT NULL,
  "is_enabled" boolean DEFAULT false NOT NULL,
  "execution_mode" varchar(20) DEFAULT 'Suggestion' NOT NULL,
  "start_time" time,
  "end_time" time,
  "threshold_percentage" integer,
  "cooldown_minutes" integer,
  "max_executions_per_day" integer,
  "max_executions_per_food_per_day" integer,
  "priority" integer DEFAULT 100 NOT NULL,
  "last_evaluated_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "social_rules_mode_check" CHECK ("execution_mode" IN ('Manual', 'Suggestion', 'AutoPublish')),
  CONSTRAINT "social_rules_trigger_check" CHECK ("trigger_type" IN ('DailyMenu', 'FoodPromotion', 'Discount', 'LimitedAvailability')),
  CONSTRAINT "social_rules_threshold_check" CHECK ("threshold_percentage" IS NULL OR "threshold_percentage" BETWEEN 1 AND 99),
  CONSTRAINT "social_rules_limits_check" CHECK (("cooldown_minutes" IS NULL OR "cooldown_minutes" >= 0) AND ("max_executions_per_day" IS NULL OR "max_executions_per_day" > 0) AND ("max_executions_per_food_per_day" IS NULL OR "max_executions_per_food_per_day" > 0))
);
CREATE INDEX "social_rules_enabled_priority_idx" ON "social_automation_rules" USING btree ("is_enabled", "priority");
--> statement-breakpoint
CREATE TABLE "social_automation_rule_targets" (
  "rule_id" integer NOT NULL,
  "social_channel_id" integer NOT NULL,
  CONSTRAINT "social_automation_rule_targets_pk" PRIMARY KEY("rule_id", "social_channel_id")
);
ALTER TABLE "social_automation_rule_targets" ADD CONSTRAINT "social_rule_targets_rule_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."social_automation_rules"("id") ON DELETE cascade;
ALTER TABLE "social_automation_rule_targets" ADD CONSTRAINT "social_rule_targets_channel_fk" FOREIGN KEY ("social_channel_id") REFERENCES "public"."social_channels"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE TABLE "social_suggestions" (
  "id" serial PRIMARY KEY NOT NULL,
  "rule_id" integer NOT NULL,
  "template_type" varchar(40) NOT NULL,
  "source_type" varchar(50) NOT NULL,
  "source_id" integer,
  "source_title" varchar(200),
  "logical_date" date NOT NULL,
  "status" varchar(20) DEFAULT 'Pending' NOT NULL,
  "reason" text NOT NULL,
  "draft_title" varchar(200) NOT NULL,
  "draft_text" text NOT NULL,
  "draft_media_url" varchar(2000),
  "draft_destination_url" varchar(2000),
  "dismissed_by_user_id" integer,
  "dismissed_at" timestamp with time zone,
  "published_post_id" integer,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "social_suggestions_status_check" CHECK ("status" IN ('Pending', 'Published', 'Dismissed', 'Expired'))
);
ALTER TABLE "social_suggestions" ADD CONSTRAINT "social_suggestions_rule_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."social_automation_rules"("id") ON DELETE cascade;
ALTER TABLE "social_suggestions" ADD CONSTRAINT "social_suggestions_dismissed_by_fk" FOREIGN KEY ("dismissed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict;
ALTER TABLE "social_suggestions" ADD CONSTRAINT "social_suggestions_published_post_fk" FOREIGN KEY ("published_post_id") REFERENCES "public"."social_posts"("id") ON DELETE set null;
CREATE UNIQUE INDEX "social_suggestions_logical_uidx" ON "social_suggestions" USING btree ("rule_id", "source_type", COALESCE("source_id", 0), "logical_date");
CREATE INDEX "social_suggestions_status_date_idx" ON "social_suggestions" USING btree ("status", "logical_date", "created_at");
--> statement-breakpoint
CREATE TABLE "social_publication_attempts" (
  "id" serial PRIMARY KEY NOT NULL,
  "social_post_target_id" integer NOT NULL,
  "attempt_number" integer NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "result" varchar(20) DEFAULT 'Started' NOT NULL,
  "error_code" varchar(100),
  "error_message" text,
  CONSTRAINT "social_attempts_result_check" CHECK ("result" IN ('Started', 'Succeeded', 'Failed', 'Unknown'))
);
ALTER TABLE "social_publication_attempts" ADD CONSTRAINT "social_attempts_target_fk" FOREIGN KEY ("social_post_target_id") REFERENCES "public"."social_post_targets"("id") ON DELETE cascade;
CREATE UNIQUE INDEX "social_attempts_target_number_uidx" ON "social_publication_attempts" USING btree ("social_post_target_id", "attempt_number");
CREATE INDEX "social_attempts_target_started_idx" ON "social_publication_attempts" USING btree ("social_post_target_id", "started_at");
--> statement-breakpoint
CREATE TABLE "social_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "singleton_key" boolean DEFAULT true NOT NULL,
  "minimum_interval_minutes" integer DEFAULT 90 NOT NULL,
  "maximum_posts_per_day" integer DEFAULT 5 NOT NULL,
  "maximum_food_promotion_per_food_per_day" integer DEFAULT 1 NOT NULL,
  "maximum_limited_availability_per_food_per_day" integer DEFAULT 1 NOT NULL,
  "quiet_hours_start" time,
  "quiet_hours_end" time,
  "default_execution_mode" varchar(20) DEFAULT 'Suggestion' NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "social_settings_singleton_check" CHECK ("singleton_key"),
  CONSTRAINT "social_settings_values_check" CHECK ("minimum_interval_minutes" >= 0 AND "maximum_posts_per_day" > 0 AND "maximum_food_promotion_per_food_per_day" > 0 AND "maximum_limited_availability_per_food_per_day" > 0),
  CONSTRAINT "social_settings_mode_check" CHECK ("default_execution_mode" IN ('Manual', 'Suggestion', 'AutoPublish'))
);
CREATE UNIQUE INDEX "social_settings_singleton_uidx" ON "social_settings" USING btree ("singleton_key");
--> statement-breakpoint
CREATE TABLE "social_settings_default_targets" (
  "settings_id" integer NOT NULL,
  "social_channel_id" integer NOT NULL,
  CONSTRAINT "social_settings_default_targets_pk" PRIMARY KEY("settings_id", "social_channel_id")
);
ALTER TABLE "social_settings_default_targets" ADD CONSTRAINT "social_settings_targets_settings_fk" FOREIGN KEY ("settings_id") REFERENCES "public"."social_settings"("id") ON DELETE cascade;
ALTER TABLE "social_settings_default_targets" ADD CONSTRAINT "social_settings_targets_channel_fk" FOREIGN KEY ("social_channel_id") REFERENCES "public"."social_channels"("id") ON DELETE cascade;
--> statement-breakpoint
INSERT INTO "social_settings" ("singleton_key", "updated_at") VALUES (true, now()) ON CONFLICT ("singleton_key") DO NOTHING;
INSERT INTO "social_post_templates" ("template_type", "title", "pattern", "is_active", "created_at", "updated_at") VALUES
('DailyMenu', 'منوی امروز', '🍽 منوی امروز کفگیر\n\n{{menuItems}}\n\nغذای خونگی، تازه و خوشمزه ❤️\n\n🛒 مشاهده منو و ثبت سفارش\n{{orderUrl}}', true, now(), now()),
('FoodPromotion', 'تبلیغ غذا', '🍲 {{foodName}} کفگیر\n\n{{description}}\n\n💰 {{price}}\n\n🛒 سفارش آنلاین\n{{orderUrl}}', true, now(), now()),
('Discount', 'تخفیف', '🔥 تخفیف امروز کفگیر\n\n{{foodName}}\nقیمت قبل: {{originalPrice}}\nقیمت امروز: {{discountPrice}}\n\n🛒 سفارش آنلاین\n{{orderUrl}}', true, now(), now()),
('LimitedAvailability', 'ظرفیت محدود', '🔥 {{foodName}} امروز حسابی طرفدار داشته!\n\nاگر انتخابت این غذاست، سفارشت رو دیر ننداز 😋\n\n🛒 سفارش آنلاین\n{{orderUrl}}', true, now(), now()),
('Custom', 'پیام آزاد', '{{customText}}', true, now(), now())
ON CONFLICT ("template_type") DO NOTHING;
INSERT INTO "social_automation_rules" ("title", "template_type", "trigger_type", "is_enabled", "execution_mode", "start_time", "end_time", "threshold_percentage", "cooldown_minutes", "max_executions_per_day", "max_executions_per_food_per_day", "priority", "created_at", "updated_at") VALUES
('انتشار منوی صبح', 'DailyMenu', 'DailyMenu', false, 'Suggestion', '08:00', '09:30', NULL, 90, 1, NULL, 10, now(), now()),
('پیشنهاد تخفیف فعال', 'Discount', 'Discount', false, 'Suggestion', '09:00', '20:00', NULL, 90, 2, 1, 20, now(), now()),
('هشدار ظرفیت محدود', 'LimitedAvailability', 'LimitedAvailability', false, 'Suggestion', '10:00', '20:00', 35, 90, 2, 1, 30, now(), now()),
('معرفی غذای امروز', 'FoodPromotion', 'FoodPromotion', false, 'Suggestion', '10:00', '12:00', NULL, 90, 2, 1, 40, now(), now());
