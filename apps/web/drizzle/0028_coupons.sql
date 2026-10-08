-- C7: discount codes. A coupon takes money off the food, never off delivery, and the order keeps a
-- snapshot of the code and the amount so editing or deleting the coupon later cannot rewrite it.
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"normalized_code" varchar(40) NOT NULL,
	"title" varchar(150),
	"discount_type" integer NOT NULL,
	"discount_value" numeric(18, 2) NOT NULL,
	"max_discount_amount" numeric(18, 2),
	"min_order_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"usage_limit" integer,
	"per_customer_limit" integer,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "coupons_discount_type_check" CHECK ("coupons"."discount_type" IN (1, 2)),
	CONSTRAINT "coupons_value_check" CHECK ("coupons"."discount_value" > 0 AND ("coupons"."discount_type" <> 1 OR "coupons"."discount_value" <= 100)),
	CONSTRAINT "coupons_limits_check" CHECK (("coupons"."usage_limit" IS NULL OR "coupons"."usage_limit" > 0) AND ("coupons"."per_customer_limit" IS NULL OR "coupons"."per_customer_limit" > 0) AND "coupons"."min_order_amount" >= 0 AND ("coupons"."max_discount_amount" IS NULL OR "coupons"."max_discount_amount" > 0)),
	CONSTRAINT "coupons_dates_check" CHECK ("coupons"."starts_on" IS NULL OR "coupons"."ends_on" IS NULL OR "coupons"."starts_on" <= "coupons"."ends_on")
);--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_normalized_code_uidx" ON "coupons" USING btree ("normalized_code");--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" numeric(18, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coupon_code" varchar(40);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_coupon_idx" ON "orders" USING btree ("coupon_id") WHERE coupon_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_money_check";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_money_check" CHECK ("orders"."subtotal_amount" >= 0 AND "orders"."delivery_fee" >= 0 AND "orders"."discount_amount" >= 0 AND "orders"."discount_amount" <= "orders"."subtotal_amount" AND "orders"."total_amount" = "orders"."subtotal_amount" + "orders"."delivery_fee" - "orders"."discount_amount");
