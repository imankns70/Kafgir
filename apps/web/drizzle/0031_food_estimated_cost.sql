-- D1: what one portion of a dish roughly costs to make, so reports can show an estimated margin.
ALTER TABLE "foods" ADD COLUMN "estimated_cost_per_portion" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_estimated_cost_check" CHECK ("foods"."estimated_cost_per_portion" IS NULL OR "foods"."estimated_cost_per_portion" >= 0);
