-- Version 1.5 originally assigned different numeric values than the established order payment enum.
-- Remap existing v1.5 payment rows before enforcing the shared Cash=1/Card=2/Online=3/POS=4 meaning.
UPDATE "payments" SET "payment_method" = CASE "payment_method"
  WHEN 2 THEN 4
  WHEN 3 THEN 2
  WHEN 4 THEN 3
  ELSE "payment_method"
END;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_type_check" CHECK ("financial_accounts"."type" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_opening_balance_check" CHECK ("financial_accounts"."opening_balance" >= 0);--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_type_check" CHECK ("financial_transactions"."transaction_type" BETWEEN 1 AND 8);--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_amount_check" CHECK ("financial_transactions"."amount" <> 0);--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_stock_levels_check" CHECK ("ingredients"."minimum_stock_level" >= 0 AND ("ingredients"."preferred_stock_level" IS NULL OR "ingredients"."preferred_stock_level" >= 0));--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_type_check" CHECK ("inventory_transactions"."transaction_type" BETWEEN 1 AND 8);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("payments"."status" BETWEEN 1 AND 7);--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_amount_check" CHECK ("purchase_items"."unit_price" >= 0 AND "purchase_items"."line_discount_amount" >= 0 AND "purchase_items"."line_total_amount" = ROUND("purchase_items"."quantity" * "purchase_items"."unit_price" - "purchase_items"."line_discount_amount", 2) AND "purchase_items"."line_total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_amount_check" CHECK ("purchase_payments"."amount" > 0);--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_method_check" CHECK ("purchase_payments"."payment_method" BETWEEN 1 AND 4);--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_payment_status_check" CHECK ("purchases"."payment_status" BETWEEN 1 AND 3);--> statement-breakpoint
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_waste_check" CHECK ("recipe_items"."waste_percent" IS NULL OR ("recipe_items"."waste_percent" >= 0 AND "recipe_items"."waste_percent" < 100));--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_values_check" CHECK ("recipes"."overhead_per_portion" >= 0 AND ("recipes"."preparation_loss_percent" IS NULL OR ("recipes"."preparation_loss_percent" >= 0 AND "recipes"."preparation_loss_percent" < 100)));--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_quantities_check" CHECK ("shopping_list_items"."required_quantity" > 0 AND "shopping_list_items"."current_stock_snapshot" >= 0 AND "shopping_list_items"."suggested_purchase_quantity" >= 0 AND "shopping_list_items"."estimated_unit_cost" >= 0);--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_status_check" CHECK ("shopping_lists"."status" BETWEEN 1 AND 4);
