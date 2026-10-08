-- C6: what the business knows about a customer beyond their orders — a private note, free-form tags
-- and a block that stops them ordering from the customer app (manual orders stay possible).
ALTER TABLE "customer_profiles" ADD COLUMN "admin_note" varchar(2000);--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD COLUMN "blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD COLUMN "blocked_reason" varchar(500);--> statement-breakpoint
CREATE INDEX "customer_profiles_tags_idx" ON "customer_profiles" USING gin ("tags");
