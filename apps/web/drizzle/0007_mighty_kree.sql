UPDATE "customer_addresses"
SET "address_line" = LEFT("address_line" || E'\n' || "description", 1000)
WHERE NULLIF(BTRIM("description"), '') IS NOT NULL
  AND POSITION("description" IN "address_line") = 0;--> statement-breakpoint
UPDATE "orders"
SET "delivery_address_line" = LEFT("delivery_address_line" || E'\n' || "delivery_address_description", 1000)
WHERE NULLIF(BTRIM("delivery_address_description"), '') IS NOT NULL
  AND POSITION("delivery_address_description" IN "delivery_address_line") = 0;--> statement-breakpoint
ALTER TABLE "customer_addresses" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "delivery_address_description";
