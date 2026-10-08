-- Order and payment integrity for the Admin review.
--
-- 1. Who changed an order's status. The history already said what changed and when; the operator
--    lived only in the server log.
-- 2. Refunds. A refund used to flip a payment to «Refunded» for its whole amount and record nothing
--    else. It now carries how much went back, why, when and by whom; a partial refund leaves the
--    payment «Paid» with the refunded part recorded, a full one also sets «Refunded».
-- 3. An order's service date — the day it is cooked and delivered — is its delivery date, or the
--    Tehran day it was placed when it has none (pickup and older orders). Kitchen, dashboard and
--    month reports all group by it, so it gets an index.

ALTER TABLE "order_status_histories" ADD COLUMN "changed_by_user_id" integer
  REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_amount" numeric(18, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_reason" varchar(500);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_by_user_id" integer
  REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
UPDATE "payments" SET "refunded_amount" = "amount", "refunded_at" = "updated_at" WHERE "status" = 7;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_amount_check"
  CHECK ("refunded_amount" >= 0 AND "refunded_amount" <= "amount");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_service_date_idx" ON "orders"
  ((COALESCE("delivery_date", ("created_at" AT TIME ZONE 'Asia/Tehran')::date)));
