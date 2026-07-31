DROP INDEX "user_logins_pk";--> statement-breakpoint
DROP INDEX "user_roles_pk";--> statement-breakpoint
DROP INDEX "user_tokens_pk";--> statement-breakpoint
ALTER TABLE "user_logins" ADD CONSTRAINT "user_logins_pk" PRIMARY KEY("login_provider","provider_key");--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_pk" PRIMARY KEY("user_id","role_id");--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_pk" PRIMARY KEY("user_id","login_provider","name");--> statement-breakpoint
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_capacity_check" CHECK ("daily_menu_items"."capacity_portions" >= 0);--> statement-breakpoint
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_sold_check" CHECK ("daily_menu_items"."sold_portions" >= 0 AND "daily_menu_items"."sold_portions" <= "daily_menu_items"."capacity_portions");--> statement-breakpoint
ALTER TABLE "daily_menu_items" ADD CONSTRAINT "daily_menu_items_price_check" CHECK ("daily_menu_items"."price" >= 0);--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_channel_check" CHECK ("notification_messages"."channel" = 1);--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_status_check" CHECK ("notification_messages"."status" BETWEEN 1 AND 3);--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_retry_check" CHECK ("notification_messages"."retry_count" >= 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_money_check" CHECK ("order_items"."unit_price" >= 0 AND "order_items"."total_price" = "order_items"."unit_price" * "order_items"."quantity");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("orders"."status" BETWEEN 1 AND 6);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_method_check" CHECK ("orders"."payment_method" BETWEEN 1 AND 3);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_method_check" CHECK ("orders"."delivery_method" BETWEEN 1 AND 2);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_money_check" CHECK ("orders"."subtotal_amount" >= 0 AND "orders"."delivery_fee" >= 0 AND "orders"."total_amount" = "orders"."subtotal_amount" + "orders"."delivery_fee");