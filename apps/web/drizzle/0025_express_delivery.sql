-- Express delivery as an add-on to an existing delivery method.
--
-- Express is not a third delivery method: it is the same courier to the same address, served as soon
-- as possible instead of inside a booked window. So the configuration hangs off the method, and an
-- express order simply carries no delivery window.
--
-- The surcharge is written into `orders.delivery_fee` along with the ordinary charge, which is why
-- `orders_money_check` still balances untouched; `orders.express_fee` records how much of that
-- charge was the surcharge, for reporting.

ALTER TABLE "delivery_method_settings" ADD COLUMN "supports_express" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "delivery_method_settings" ADD COLUMN "express_fee" numeric(18, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "delivery_method_settings" ADD COLUMN "express_estimated_minutes" integer;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_express" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "express_fee" numeric(18, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "delivery_method_settings" DROP CONSTRAINT IF EXISTS "delivery_method_settings_amounts_check";
--> statement-breakpoint
ALTER TABLE "delivery_method_settings" ADD CONSTRAINT "delivery_method_settings_amounts_check"
  CHECK ("delivery_method_settings"."delivery_fee" >= 0
    AND "delivery_method_settings"."minimum_order_amount" >= 0
    AND "delivery_method_settings"."express_fee" >= 0);
--> statement-breakpoint
ALTER TABLE "delivery_method_settings" ADD CONSTRAINT "delivery_method_settings_express_check"
  CHECK ("delivery_method_settings"."express_estimated_minutes" IS NULL
    OR "delivery_method_settings"."express_estimated_minutes" > 0);
