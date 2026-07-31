CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(150) NOT NULL,
	"value" varchar(2000) NOT NULL,
	"description" varchar(1000)
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_profile_id" integer NOT NULL,
	"title" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"address_line" varchar(1000) NOT NULL,
	"description" varchar(1000),
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"preferred_name" varchar(150) NOT NULL,
	"default_phone_number" varchar(30) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_order_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"daily_menu_id" integer NOT NULL,
	"food_id" integer NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"capacity_portions" integer NOT NULL,
	"sold_portions" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_menus" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_date" date NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"note" varchar(1000),
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" varchar(1000),
	"default_price" numeric(18, 2) DEFAULT 0 NOT NULL,
	"image_url" varchar(2000),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" integer DEFAULT 1 NOT NULL,
	"type" integer NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"target" varchar(120) NOT NULL,
	"text" varchar(2000) NOT NULL,
	"order_id" integer,
	"order_number" varchar(32),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" varchar(1000)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"daily_menu_item_id" integer NOT NULL,
	"food_name" varchar(150) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"total_price" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_histories" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"from_status" integer NOT NULL,
	"to_status" integer NOT NULL,
	"note" varchar(1000),
	"changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"customer_profile_id" integer NOT NULL,
	"customer_address_id" integer,
	"delivery_full_name" varchar(150) NOT NULL,
	"delivery_phone_number" varchar(30) NOT NULL,
	"delivery_city" varchar(100) NOT NULL,
	"delivery_address_line" varchar(1000) NOT NULL,
	"delivery_address_description" varchar(1000),
	"status" integer NOT NULL,
	"payment_method" integer NOT NULL,
	"delivery_method" integer NOT NULL,
	"subtotal_amount" numeric(18, 2) NOT NULL,
	"delivery_fee" numeric(18, 2) NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"customer_note" varchar(1000),
	"admin_note" varchar(1000),
	"created_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "role_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"claim_type" text,
	"claim_value" text
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"normalized_name" varchar(256),
	"concurrency_stamp" text
);
--> statement-breakpoint
CREATE TABLE "telegram_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"username" varchar(100),
	"first_name" varchar(150),
	"last_name" varchar(150),
	"language_code" varchar(20),
	"allows_write_to_pm" boolean DEFAULT false NOT NULL,
	"chat_id" varchar(120) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"claim_type" text,
	"claim_value" text
);
--> statement-breakpoint
CREATE TABLE "user_logins" (
	"login_provider" varchar(128) NOT NULL,
	"provider_key" varchar(128) NOT NULL,
	"provider_display_name" text,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"user_id" integer NOT NULL,
	"login_provider" varchar(128) NOT NULL,
	"name" varchar(128) NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(256),
	"normalized_username" varchar(256),
	"email" varchar(256),
	"normalized_email" varchar(256),
	"email_confirmed" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"password_hash_scheme" varchar(40) DEFAULT 'aspnet-identity-v3' NOT NULL,
	"security_stamp" text,
	"concurrency_stamp" text,
	"phone_number" varchar(30),
	"phone_number_confirmed" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"lockout_end" timestamp with time zone,
	"lockout_enabled" boolean DEFAULT true NOT NULL,
	"access_failed_count" integer DEFAULT 0 NOT NULL,
	"telegram_user_id" bigint,
	"telegram_first_name" varchar(150),
	"telegram_last_name" varchar(150),
	"telegram_language_code" varchar(20),
	"allows_write_to_pm" boolean DEFAULT false NOT NULL,
	"full_name" varchar(150),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_order_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_daily_menu_id_daily_menus_id_fk" FOREIGN KEY ("daily_menu_id") REFERENCES "public"."daily_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_daily_menu_item_id_daily_menu_items_id_fk" FOREIGN KEY ("daily_menu_item_id") REFERENCES "public"."daily_menu_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_histories" ADD CONSTRAINT "order_status_histories_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_profile_id_customer_profiles_id_fk" FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_address_id_customer_addresses_id_fk" FOREIGN KEY ("customer_address_id") REFERENCES "public"."customer_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_claims" ADD CONSTRAINT "role_claims_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_claims" ADD CONSTRAINT "user_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_logins" ADD CONSTRAINT "user_logins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_settings_key_uidx" ON "app_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "customer_addresses_profile_idx" ON "customer_addresses" USING btree ("customer_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_profiles_user_id_uidx" ON "customer_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_menu_items_menu_food_uidx" ON "daily_menu_items" USING btree ("daily_menu_id","food_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_menus_date_uidx" ON "daily_menus" USING btree ("menu_date");--> statement-breakpoint
CREATE INDEX "notification_messages_pending_idx" ON "notification_messages" USING btree ("status","next_attempt_at","created_at");--> statement-breakpoint
CREATE INDEX "notification_messages_order_idx" ON "notification_messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_histories_order_idx" ON "order_status_histories" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_uidx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_normalized_name_uidx" ON "roles" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_accounts_user_id_uidx" ON "telegram_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_accounts_telegram_user_id_uidx" ON "telegram_accounts" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "telegram_accounts_chat_id_idx" ON "telegram_accounts" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_logins_pk" ON "user_logins" USING btree ("login_provider","provider_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_pk" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tokens_pk" ON "user_tokens" USING btree ("user_id","login_provider","name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_username_uidx" ON "users" USING btree ("normalized_username");--> statement-breakpoint
CREATE INDEX "users_normalized_email_idx" ON "users" USING btree ("normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_user_id_uidx" ON "users" USING btree ("telegram_user_id") WHERE telegram_user_id IS NOT NULL;