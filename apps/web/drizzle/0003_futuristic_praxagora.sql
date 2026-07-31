CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" integer,
	"user_id" integer NOT NULL,
	"details" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"type" integer NOT NULL,
	"bank_name" varchar(100),
	"card_number_masked" varchar(30),
	"account_number_masked" varchar(40),
	"iban_masked" varchar(40),
	"opening_balance" numeric(18, 2) DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_type" integer NOT NULL,
	"financial_account_id" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"category_id" integer,
	"reference_type" varchar(50) NOT NULL,
	"reference_id" integer,
	"transaction_group" varchar(80),
	"description" text NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"reversed_transaction_id" integer,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(50),
	"category_id" integer,
	"base_unit_id" integer NOT NULL,
	"minimum_stock_level" numeric(20, 6) DEFAULT '0' NOT NULL,
	"preferred_stock_level" numeric(20, 6),
	"is_inventory_tracked" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ingredient_id" integer NOT NULL,
	"transaction_type" integer NOT NULL,
	"quantity_in_base_unit" numeric(20, 6) NOT NULL,
	"unit_cost" numeric(18, 2) DEFAULT 0 NOT NULL,
	"total_cost" numeric(18, 2) DEFAULT 0 NOT NULL,
	"reference_type" varchar(50) NOT NULL,
	"reference_id" integer,
	"transaction_group" varchar(80),
	"transaction_date" timestamp with time zone NOT NULL,
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"reversed_transaction_id" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "inventory_transactions_quantity_check" CHECK ("inventory_transactions"."quantity_in_base_unit" <> 0)
);
--> statement-breakpoint
CREATE TABLE "order_inventory_consumptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"food_id" integer NOT NULL,
	"recipe_id" integer,
	"quantity_produced" integer NOT NULL,
	"transaction_group" varchar(80),
	"recipe_missing" boolean DEFAULT false NOT NULL,
	"consumed_at" timestamp with time zone NOT NULL,
	"reversed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"payment_method" integer NOT NULL,
	"financial_account_id" integer NOT NULL,
	"pos_terminal_id" integer,
	"amount" numeric(18, 2) NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"tracking_number" varchar(100),
	"reference_number" varchar(100),
	"receipt_image_url" varchar(2000),
	"paid_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_user_id" integer,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_method_check" CHECK ("payments"."payment_method" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "pos_terminals" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(150) NOT NULL,
	"terminal_number" varchar(100) NOT NULL,
	"merchant_number" varchar(100),
	"financial_account_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"purchase_unit_id" integer NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"conversion_factor_to_base_unit" numeric(20, 6) NOT NULL,
	"base_unit_quantity" numeric(20, 6) NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"line_discount_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"line_total_amount" numeric(18, 2) NOT NULL,
	"expiration_date" date,
	"batch_number" varchar(100),
	"notes" text,
	CONSTRAINT "purchase_items_quantity_check" CHECK ("purchase_items"."quantity" > 0 AND "purchase_items"."conversion_factor_to_base_unit" > 0 AND "purchase_items"."base_unit_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"financial_account_id" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"payment_method" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"tracking_number" varchar(100),
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_number" varchar(50) NOT NULL,
	"supplier_id" integer,
	"invoice_number" varchar(100),
	"purchase_date" date NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"subtotal_amount" numeric(18, 2) NOT NULL,
	"discount_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"additional_cost_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"paid_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"payment_status" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"attachment_url" varchar(2000),
	"created_by_user_id" integer NOT NULL,
	"confirmed_by_user_id" integer,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "purchases_status_check" CHECK ("purchases"."status" BETWEEN 1 AND 3),
	CONSTRAINT "purchases_amounts_check" CHECK ("purchases"."subtotal_amount" >= 0 AND "purchases"."discount_amount" >= 0 AND "purchases"."additional_cost_amount" >= 0 AND "purchases"."total_amount" = "purchases"."subtotal_amount" - "purchases"."discount_amount" + "purchases"."additional_cost_amount" AND "purchases"."paid_amount" >= 0 AND "purchases"."paid_amount" <= "purchases"."total_amount")
);
--> statement-breakpoint
CREATE TABLE "recipe_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"quantity_in_base_unit" numeric(20, 6) NOT NULL,
	"waste_percent" numeric(5, 2),
	"notes" text,
	CONSTRAINT "recipe_items_quantity_check" CHECK ("recipe_items"."quantity_in_base_unit" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"food_id" integer NOT NULL,
	"yield_quantity" integer NOT NULL,
	"preparation_loss_percent" numeric(5, 2),
	"overhead_per_portion" numeric(18, 2) DEFAULT 0 NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "recipes_yield_check" CHECK ("recipes"."yield_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopping_list_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"required_quantity" numeric(20, 6) NOT NULL,
	"current_stock_snapshot" numeric(20, 6) NOT NULL,
	"suggested_purchase_quantity" numeric(20, 6) NOT NULL,
	"estimated_unit_cost" numeric(18, 2) DEFAULT 0 NOT NULL,
	"notes" text,
	"is_purchased" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"target_date" date NOT NULL,
	"status" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"contact_name" varchar(150),
	"mobile" varchar(30),
	"phone" varchar(30),
	"address" varchar(1000),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_category_id_ingredient_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ingredient_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_base_unit_id_units_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_inventory_consumptions" ADD CONSTRAINT "order_inventory_consumptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_inventory_consumptions" ADD CONSTRAINT "order_inventory_consumptions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_inventory_consumptions" ADD CONSTRAINT "order_inventory_consumptions_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_inventory_consumptions" ADD CONSTRAINT "order_inventory_consumptions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_pos_terminal_id_pos_terminals_id_fk" FOREIGN KEY ("pos_terminal_id") REFERENCES "public"."pos_terminals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_terminals" ADD CONSTRAINT "pos_terminals_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_unit_id_units_id_fk" FOREIGN KEY ("purchase_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_financial_account_id_financial_accounts_id_fk" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_shopping_lists_id_fk" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_name_uidx" ON "expense_categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_accounts_name_uidx" ON "financial_accounts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "financial_transactions_account_date_idx" ON "financial_transactions" USING btree ("financial_account_id","transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_transactions_reference_uidx" ON "financial_transactions" USING btree ("transaction_type","reference_type","reference_id") WHERE "financial_transactions"."reference_id" IS NOT NULL AND "financial_transactions"."transaction_type" IN (1, 2, 7, 8);--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_categories_name_uidx" ON "ingredient_categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_name_uidx" ON "ingredients" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_code_uidx" ON "ingredients" USING btree ("code") WHERE "ingredients"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ingredients_category_idx" ON "ingredients" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "inventory_transactions_ingredient_date_idx" ON "inventory_transactions" USING btree ("ingredient_id","transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_transactions_reversal_uidx" ON "inventory_transactions" USING btree ("reversed_transaction_id") WHERE "inventory_transactions"."reversed_transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "inventory_transactions_reference_idx" ON "inventory_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_inventory_consumptions_item_uidx" ON "order_inventory_consumptions" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_inventory_consumptions_order_idx" ON "order_inventory_consumptions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_order_status_idx" ON "payments" USING btree ("order_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_terminals_number_uidx" ON "pos_terminals" USING btree ("terminal_number");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_items_ingredient_idx" ON "purchase_items" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "purchase_payments_purchase_idx" ON "purchase_payments" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_number_uidx" ON "purchases" USING btree ("purchase_number");--> statement-breakpoint
CREATE INDEX "purchases_date_status_idx" ON "purchases" USING btree ("purchase_date","status");--> statement-breakpoint
CREATE INDEX "purchases_supplier_idx" ON "purchases" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_items_recipe_ingredient_uidx" ON "recipe_items" USING btree ("recipe_id","ingredient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_active_food_uidx" ON "recipes" USING btree ("food_id") WHERE "recipes"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_list_items_list_ingredient_uidx" ON "shopping_list_items" USING btree ("shopping_list_id","ingredient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_name_uidx" ON "suppliers" USING btree (lower(trim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "units_name_uidx" ON "units" USING btree ("name");