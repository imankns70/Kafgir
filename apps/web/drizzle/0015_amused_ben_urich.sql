ALTER TABLE "foods" DROP CONSTRAINT "foods_rice_addon_type_check";--> statement-breakpoint
ALTER TABLE "foods" DROP CONSTRAINT "foods_rice_role_check";--> statement-breakpoint
DROP INDEX "foods_rice_addon_type_uidx";--> statement-breakpoint
ALTER TABLE "foods" DROP COLUMN "requires_rice_selection";--> statement-breakpoint
ALTER TABLE "foods" DROP COLUMN "rice_addon_type";