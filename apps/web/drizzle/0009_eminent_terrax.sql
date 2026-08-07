ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_amount_check";--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_sign_check" CHECK (
    ("financial_transactions"."transaction_type" IN (1, 3, 5) AND "financial_transactions"."amount" > 0) OR
    ("financial_transactions"."transaction_type" IN (2, 4, 6, 7) AND "financial_transactions"."amount" < 0) OR
    "financial_transactions"."transaction_type" = 8);--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_sign_check" CHECK ((
    ("inventory_transactions"."transaction_type" IN (1, 4, 8) AND "inventory_transactions"."quantity_in_base_unit" > 0) OR
    ("inventory_transactions"."transaction_type" IN (2, 3, 5, 7) AND "inventory_transactions"."quantity_in_base_unit" < 0) OR
    ("inventory_transactions"."transaction_type" = 6 AND "inventory_transactions"."quantity_in_base_unit" <> 0)
  ) AND "inventory_transactions"."unit_cost" >= 0 AND "inventory_transactions"."quantity_in_base_unit" * "inventory_transactions"."total_cost" >= 0);--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_amount_check" CHECK ("purchase_items"."unit_price" >= 0 AND "purchase_items"."line_discount_amount" >= 0 AND "purchase_items"."line_total_amount" = ROUND("purchase_items"."quantity" * "purchase_items"."unit_price" - "purchase_items"."line_discount_amount", 2) AND "purchase_items"."line_total_amount" >= 0);