CREATE TABLE "customer_login_phones" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"normalized_phone_number" varchar(11) NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_otp_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"normalized_phone_number" varchar(11) NOT NULL,
	"code_digest" varchar(128) NOT NULL,
	"request_ip_digest" varchar(128) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "customer_otp_attempts_check" CHECK ("customer_otp_challenges"."attempts" >= 0 AND "customer_otp_challenges"."attempts" <= 5)
);
--> statement-breakpoint
ALTER TABLE "customer_login_phones" ADD CONSTRAINT "customer_login_phones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_login_phones_user_id_uidx" ON "customer_login_phones" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_login_phones_phone_uidx" ON "customer_login_phones" USING btree ("normalized_phone_number");--> statement-breakpoint
CREATE INDEX "customer_otp_phone_created_idx" ON "customer_otp_challenges" USING btree ("normalized_phone_number","created_at");--> statement-breakpoint
CREATE INDEX "customer_otp_ip_created_idx" ON "customer_otp_challenges" USING btree ("request_ip_digest","created_at");
--> statement-breakpoint
WITH source AS (
  SELECT id,
    regexp_replace(
      translate(default_phone_number, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'),
      '[^0-9]', '', 'g'
    ) AS digits
  FROM customer_profiles
), normalized AS (
  SELECT id,
    CASE
      WHEN digits ~ '^09[0-9]{9}$' THEN digits
      WHEN digits ~ '^989[0-9]{9}$' THEN '0' || substring(digits FROM 3)
      WHEN digits ~ '^00989[0-9]{9}$' THEN '0' || substring(digits FROM 5)
      ELSE NULL
    END AS phone
  FROM source
)
UPDATE customer_profiles p
SET default_phone_number = n.phone
FROM normalized n
WHERE p.id = n.id AND n.phone IS NOT NULL;
--> statement-breakpoint
WITH source AS (
  SELECT id,
    regexp_replace(
      translate(phone_number, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'),
      '[^0-9]', '', 'g'
    ) AS digits
  FROM users
  WHERE phone_number IS NOT NULL
), normalized AS (
  SELECT id,
    CASE
      WHEN digits ~ '^09[0-9]{9}$' THEN digits
      WHEN digits ~ '^989[0-9]{9}$' THEN '0' || substring(digits FROM 3)
      WHEN digits ~ '^00989[0-9]{9}$' THEN '0' || substring(digits FROM 5)
      ELSE NULL
    END AS phone
  FROM source
)
UPDATE users u
SET phone_number = n.phone
FROM normalized n
WHERE u.id = n.id AND n.phone IS NOT NULL;
