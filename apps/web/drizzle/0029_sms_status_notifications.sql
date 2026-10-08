-- C8: order status updates by SMS for customers who have no Telegram chat.
ALTER TABLE "notification_messages" DROP CONSTRAINT "notification_messages_channel_check";--> statement-breakpoint
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_channel_check" CHECK ("notification_messages"."channel" IN (1, 2));
