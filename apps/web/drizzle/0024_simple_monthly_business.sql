-- Kafgir drops the inventory, procurement and accounting architecture.
--
-- What replaces it is one purchase line per shopping trip, and a monthly comparison derived from the
-- purchase date and the order snapshots. Nothing outside those tables read them, so this is a forward
-- migration rather than a schema reset: orders, customers, menus, couriers, delivery windows and
-- order payments are untouched.
--
-- `purchases` is transformed in place rather than dropped and recreated. A rename-and-recreate would
-- collide on `purchases_pkey`, and a temporary staging table would depend on the whole migration
-- running inside one transaction — which drizzle does today, but which is not worth betting the
-- conversion on. Transforming in place needs neither assumption.
--
-- What converts: the date, the amount actually spent, the supplier's name, the receipt and the note.
-- What does not: item lines, units and conversion factors, batches, expiry, stock movements and
-- payment allocations. There is no honest way to fold those into a single amount, so they are let go
-- rather than approximated. Draft and cancelled purchases are money that was never spent; they are
-- removed instead of being turned into records of spending.

-- Dependants of the old procurement graph go first, so the transform below has no foreign keys left
-- pointing at it.
DROP TABLE IF EXISTS "order_inventory_consumptions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "inventory_transactions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "recipe_items" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "recipes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "shopping_list_items" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "shopping_lists" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "purchase_payments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "purchase_items" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "financial_transactions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "expense_categories" CASCADE;--> statement-breakpoint

-- Order payments survive; their accounting attachments do not. `payment_method` already records that
-- money arrived by POS, which is the only question the terminal registry ever answered at the counter.
ALTER TABLE "payments" DROP COLUMN IF EXISTS "pos_terminal_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "financial_account_id";--> statement-breakpoint
DROP TABLE IF EXISTS "pos_terminals" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "financial_accounts" CASCADE;--> statement-breakpoint

-- Transform `purchases` into the simple record, keeping what is convertible.
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "amount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "title" varchar(200);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "seller_name" varchar(150);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "receipt_image_url" varchar(2000);--> statement-breakpoint

-- Only confirmed purchases were real spending.
DELETE FROM "purchases" WHERE "status" <> 2 OR "total_amount" <= 0;--> statement-breakpoint
-- Scalar subqueries rather than a join: a purchase with no supplier must still convert, and a join
-- would simply drop it.
UPDATE "purchases" p SET
	"amount" = p."total_amount",
	"title" = COALESCE(
		NULLIF(TRIM((SELECT s."name" FROM "suppliers" s WHERE s."id" = p."supplier_id")), ''),
		'خرید ثبت‌شده'),
	"seller_name" = NULLIF(TRIM((SELECT s."name" FROM "suppliers" s WHERE s."id" = p."supplier_id")), ''),
	"receipt_image_url" = p."attachment_url",
	"notes" = NULLIF(TRIM(CONCAT_WS(' — ', NULLIF(TRIM(p."notes"), ''), NULLIF(TRIM(p."invoice_number"), ''))), '');--> statement-breakpoint

-- Old amount rules reference columns that are about to disappear.
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_amounts_check";--> statement-breakpoint
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_status_check";--> statement-breakpoint
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_payment_status_check";--> statement-breakpoint
DROP INDEX IF EXISTS "purchases_number_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "purchases_date_status_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "purchases_supplier_idx";--> statement-breakpoint

ALTER TABLE "purchases" DROP COLUMN IF EXISTS "purchase_number";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "supplier_id";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "invoice_number";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "subtotal_amount";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "discount_amount";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "additional_cost_amount";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "total_amount";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "paid_amount";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "payment_status";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "attachment_url";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "created_by_user_id";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "confirmed_by_user_id";--> statement-breakpoint
ALTER TABLE "purchases" DROP COLUMN IF EXISTS "confirmed_at";--> statement-breakpoint

ALTER TABLE "purchases" ALTER COLUMN "amount" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "notes" TYPE varchar(1000) USING LEFT("notes", 1000);--> statement-breakpoint
-- The old column was NOT NULL and set on every write; the new record only stamps it when edited.
ALTER TABLE "purchases" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_amount_check" CHECK ("purchases"."amount" > 0);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchases_date_idx" ON "purchases" USING btree ("purchase_date");--> statement-breakpoint

-- Suppliers were only ever a foreign key from purchases, which now carries the name it needs.
DROP TABLE IF EXISTS "suppliers" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ingredients" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "ingredient_categories" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "units" CASCADE;
