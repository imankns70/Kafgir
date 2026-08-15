ALTER TABLE "order_reviews" ADD COLUMN "handling_status" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_reviews" ADD COLUMN "admin_seen_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "order_reviews" ADD COLUMN "resolved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "order_reviews" ADD COLUMN "resolved_by_user_id" integer;
--> statement-breakpoint
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_resolved_by_user_id_users_id_fk"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_reviews" ADD CONSTRAINT "order_reviews_handling_status_check"
  CHECK ("order_reviews"."handling_status" BETWEEN 1 AND 3);
--> statement-breakpoint
CREATE INDEX "order_reviews_handling_created_idx" ON "order_reviews" USING btree ("handling_status", "created_at");
--> statement-breakpoint

CREATE TABLE "support_conversations" (
  "id" serial PRIMARY KEY NOT NULL,
  "customer_profile_id" integer NOT NULL,
  "order_id" integer,
  "review_id" integer,
  "subject" integer NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "last_message_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "closed_at" timestamp with time zone,
  CONSTRAINT "support_conversations_subject_check" CHECK ("support_conversations"."subject" BETWEEN 1 AND 6),
  CONSTRAINT "support_conversations_status_check" CHECK ("support_conversations"."status" BETWEEN 1 AND 3)
);
--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_customer_profile_id_customer_profiles_id_fk"
  FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_review_id_order_reviews_id_fk"
  FOREIGN KEY ("review_id") REFERENCES "public"."order_reviews"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "support_conversations_customer_last_idx" ON "support_conversations" USING btree ("customer_profile_id", "last_message_at");
--> statement-breakpoint
CREATE INDEX "support_conversations_status_last_idx" ON "support_conversations" USING btree ("status", "last_message_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "support_conversations_review_uidx" ON "support_conversations" USING btree ("review_id") WHERE "review_id" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE "support_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "conversation_id" integer NOT NULL,
  "sender_type" integer NOT NULL,
  "customer_profile_id" integer,
  "admin_user_id" integer,
  "message" varchar(2000) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "read_at" timestamp with time zone,
  CONSTRAINT "support_messages_sender_type_check" CHECK ("support_messages"."sender_type" BETWEEN 1 AND 2),
  CONSTRAINT "support_messages_sender_identity_check" CHECK (
    ("support_messages"."sender_type" = 1 AND "support_messages"."customer_profile_id" IS NOT NULL AND "support_messages"."admin_user_id" IS NULL)
    OR ("support_messages"."sender_type" = 2 AND "support_messages"."admin_user_id" IS NOT NULL AND "support_messages"."customer_profile_id" IS NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_support_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "public"."support_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_customer_profile_id_customer_profiles_id_fk"
  FOREIGN KEY ("customer_profile_id") REFERENCES "public"."customer_profiles"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_admin_user_id_users_id_fk"
  FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "support_messages_conversation_created_idx" ON "support_messages" USING btree ("conversation_id", "created_at");
