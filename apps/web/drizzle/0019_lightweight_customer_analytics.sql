CREATE TABLE "analytics_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "visitor_id" uuid NOT NULL,
  "user_id" integer,
  "started_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "analytics_visitor_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "analytics_session_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_analytics_session_id_analytics_sessions_id_fk"
  FOREIGN KEY ("analytics_session_id") REFERENCES "public"."analytics_sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "analytics_sessions_last_seen_idx" ON "analytics_sessions" USING btree ("last_seen_at");
--> statement-breakpoint
CREATE INDEX "analytics_sessions_started_idx" ON "analytics_sessions" USING btree ("started_at");
--> statement-breakpoint
CREATE INDEX "analytics_sessions_visitor_last_seen_idx" ON "analytics_sessions" USING btree ("visitor_id", "last_seen_at");
--> statement-breakpoint
CREATE INDEX "analytics_sessions_user_last_seen_idx" ON "analytics_sessions" USING btree ("last_seen_at", "user_id") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "orders_analytics_created_visitor_idx" ON "orders" USING btree ("created_at", "analytics_visitor_id") WHERE "analytics_visitor_id" IS NOT NULL;
