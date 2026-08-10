CREATE TABLE "order_reviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "customer_profile_id" integer NOT NULL,
  "rating" integer NOT NULL,
  "comment" varchar(1000),
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone,
  CONSTRAINT "order_reviews_rating_check" CHECK ("order_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_customer_profile_id_customer_profiles_id_fk"
  FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "order_reviews_order_uidx" ON "order_reviews" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "order_reviews_customer_created_idx" ON "order_reviews" USING btree ("customer_profile_id", "created_at");
