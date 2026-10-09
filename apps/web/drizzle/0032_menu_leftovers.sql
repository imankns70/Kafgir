-- D2: portions of a dish left unsold at the end of the day, recorded by the kitchen.
ALTER TABLE "daily_menu_items" ADD COLUMN "leftover_portions" integer;--> statement-breakpoint
ALTER TABLE "daily_menu_items" ADD COLUMN "leftover_recorded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_leftover_check" CHECK ("daily_menu_items"."leftover_portions" IS NULL OR "daily_menu_items"."leftover_portions" >= 0);
