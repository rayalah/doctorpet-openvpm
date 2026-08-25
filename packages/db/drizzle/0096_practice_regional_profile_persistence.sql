-- Expand-only practice regional profile. These values are persisted
-- configuration only; this migration does not activate regional behavior.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "language" varchar(16) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "format_locale" varchar(35) DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "regulatory_profile" varchar(32) DEFAULT 'UNSPECIFIED' NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "fiscal_provider" varchar(64) DEFAULT 'none' NOT NULL;--> statement-breakpoint
-- Backfill from the legacy country representation without deriving an unknown
-- country to US_DEA. Language stays at the legacy-compatible default (`en`);
-- presentation locale and explicit regulatory profile are independently stored.
UPDATE "practices"
SET
  "language" = 'en',
  "format_locale" = CASE upper("country")
    WHEN 'CA' THEN 'en-CA'
    WHEN 'GB' THEN 'en-GB'
    WHEN 'IE' THEN 'en-IE'
    WHEN 'AU' THEN 'en-AU'
    WHEN 'CR' THEN 'es-CR'
    ELSE 'en-US'
  END,
  "regulatory_profile" = CASE upper("country")
    WHEN 'GB' THEN 'UK_VMD'
    WHEN 'CR' THEN 'CR_NEUTRAL'
    WHEN 'US' THEN 'US_DEA'
    WHEN 'CA' THEN 'US_DEA'
    WHEN 'IE' THEN 'US_DEA'
    WHEN 'AU' THEN 'US_DEA'
    ELSE 'UNSPECIFIED'
  END,
  "fiscal_provider" = 'none';--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_language_check" CHECK ("practices"."language" in ('en', 'es'));--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_format_locale_check" CHECK ("practices"."format_locale" in ('en-US', 'en-CA', 'en-GB', 'en-IE', 'en-AU', 'es-CR'));--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_regulatory_profile_check" CHECK ("practices"."regulatory_profile" in ('US_DEA', 'UK_VMD', 'CR_NEUTRAL', 'UNSPECIFIED'));--> statement-breakpoint
ALTER TABLE "practices" ADD CONSTRAINT "practices_fiscal_provider_check" CHECK ("practices"."fiscal_provider" = 'none');
