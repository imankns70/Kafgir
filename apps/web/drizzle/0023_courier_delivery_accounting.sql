CREATE TABLE "couriers" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"mobile" varchar(30) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" varchar(1000),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "courier_delivery_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_date" date NOT NULL,
	"courier_id" integer NOT NULL,
	"customer_delivery_fee" numeric(18, 2) NOT NULL,
	"courier_payable_per_order" numeric(18, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "courier_delivery_days_amounts_check" CHECK ("courier_delivery_days"."customer_delivery_fee" >= 0 AND "courier_delivery_days"."courier_payable_per_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "courier_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"settled_at" timestamp with time zone NOT NULL,
	"note" varchar(1000),
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "courier_settlements_amount_check" CHECK ("courier_settlements"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "courier_delivery_days" ADD CONSTRAINT "courier_delivery_days_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlements" ADD CONSTRAINT "courier_settlements_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "couriers_mobile_uidx" ON "couriers" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX "couriers_active_name_idx" ON "couriers" USING btree ("is_active","full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_delivery_days_active_date_uidx" ON "courier_delivery_days" USING btree ("delivery_date") WHERE is_active;--> statement-breakpoint
CREATE INDEX "courier_delivery_days_date_idx" ON "courier_delivery_days" USING btree ("delivery_date");--> statement-breakpoint
CREATE INDEX "courier_settlements_courier_settled_idx" ON "courier_settlements" USING btree ("courier_id","settled_at");--> statement-breakpoint
ALTER TABLE "delivery_method_settings" ADD COLUMN "requires_courier" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "courier_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "courier_name_snapshot" varchar(150);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "courier_delivery_day_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "courier_payable_amount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_courier_delivery_day_id_courier_delivery_days_id_fk" FOREIGN KEY ("courier_delivery_day_id") REFERENCES "public"."courier_delivery_days"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_courier_status_idx" ON "orders" USING btree ("courier_id","status") WHERE courier_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_courier_payable_check" CHECK ("orders"."courier_payable_amount" IS NULL OR "orders"."courier_payable_amount" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_courier_snapshot_check" CHECK (("orders"."courier_id" IS NULL AND "orders"."courier_payable_amount" IS NULL)
        OR ("orders"."courier_id" IS NOT NULL AND "orders"."courier_payable_amount" IS NOT NULL));--> statement-breakpoint
-- Existing orders keep their recorded delivery fee untouched and gain no courier and no payable:
-- the information did not exist when they were placed, and inventing it would fabricate debt.
-- Only the courier method is marked as needing a courier; تحویل حضوری keeps its own fee column.
UPDATE "delivery_method_settings" SET "requires_courier" = true WHERE "method" = 2;
