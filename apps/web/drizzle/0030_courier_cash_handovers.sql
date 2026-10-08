-- C10: cash a courier collected at the door and later handed back to the business. Append-only,
-- like courier settlements; what a courier still holds is always derived, never stored.
CREATE TABLE "courier_cash_handovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"courier_id" integer NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"note" varchar(1000),
	"received_by_user_id" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "courier_cash_handovers_amount_check" CHECK ("courier_cash_handovers"."amount" > 0)
);--> statement-breakpoint
ALTER TABLE "courier_cash_handovers" ADD CONSTRAINT "courier_cash_handovers_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_cash_handovers" ADD CONSTRAINT "courier_cash_handovers_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courier_cash_handovers_courier_idx" ON "courier_cash_handovers" USING btree ("courier_id","received_at");
