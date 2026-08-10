CREATE TABLE "delivery_time_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(100) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"order_cutoff_minutes_before_start" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "delivery_time_slots_range_check" CHECK ("delivery_time_slots"."start_time" < "delivery_time_slots"."end_time"),
	CONSTRAINT "delivery_time_slots_cutoff_check" CHECK ("delivery_time_slots"."order_cutoff_minutes_before_start" >= 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_time_slot_availabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_date" date NOT NULL,
	"delivery_time_slot_id" integer NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"capacity_orders" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "delivery_slot_availability_capacity_check" CHECK ("delivery_time_slot_availabilities"."capacity_orders" IS NULL OR "delivery_time_slot_availabilities"."capacity_orders" >= 0)
);
--> statement-breakpoint
ALTER TABLE "delivery_time_slot_availabilities" ADD CONSTRAINT "delivery_slot_availability_slot_fk" FOREIGN KEY ("delivery_time_slot_id") REFERENCES "public"."delivery_time_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_time_slots_active_sort_idx" ON "delivery_time_slots" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_slot_availability_date_slot_uidx" ON "delivery_time_slot_availabilities" USING btree ("delivery_date","delivery_time_slot_id");--> statement-breakpoint
CREATE INDEX "delivery_slot_availability_date_idx" ON "delivery_time_slot_availabilities" USING btree ("delivery_date");--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_date" date;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_time_slot_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_time_slot_title" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_start_time" time;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_end_time" time;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_time_slot_id_delivery_time_slots_id_fk" FOREIGN KEY ("delivery_time_slot_id") REFERENCES "public"."delivery_time_slots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_delivery_date_slot_idx" ON "orders" USING btree ("delivery_date","delivery_time_slot_id");
