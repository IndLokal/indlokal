-- CreateEnum
CREATE TYPE "EventCostType" AS ENUM ('FREE', 'PAID', 'UNCLEAR');

-- CreateEnum
CREATE TYPE "EventAccessType" AS ENUM ('OPEN_ENTRY', 'REGISTRATION_REQUIRED', 'APPROVAL_REQUIRED', 'INVITE_ONLY', 'MEMBERS_ONLY', 'UNCLEAR');

-- AlterTable: add structured pricing/access columns
ALTER TABLE "events" ADD COLUMN "cost_type" "EventCostType" NOT NULL DEFAULT 'UNCLEAR';
ALTER TABLE "events" ADD COLUMN "price_amount" DOUBLE PRECISION;
ALTER TABLE "events" ADD COLUMN "price_currency" VARCHAR(3);
ALTER TABLE "events" ADD COLUMN "cost_note" TEXT;
ALTER TABLE "events" ADD COLUMN "access_type" "EventAccessType" NOT NULL DEFAULT 'UNCLEAR';
ALTER TABLE "events" ADD COLUMN "requires_registration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "requires_approval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "entry_note" TEXT;

-- Backfill: migrate legacy cost values to structured fields.
-- Rule: cost = 'free' → costType = FREE, accessType = UNCLEAR (never infer OPEN_ENTRY from FREE)
-- Rule: cost = 'paid' or numeric amount → costType = PAID
-- Rule: cost = 'unclear' or null → costType = UNCLEAR
UPDATE "events" SET "cost_type" = 'FREE' WHERE LOWER(TRIM("cost")) = 'free';
UPDATE "events" SET "cost_type" = 'PAID' WHERE LOWER(TRIM("cost")) = 'paid';
UPDATE "events" SET "cost_type" = 'PAID' WHERE "cost" ~ '^\s*[€$£]?\s*\d+' AND LOWER(TRIM("cost")) != 'free';

-- Set requires_registration = true where registration_url is present
UPDATE "events" SET "requires_registration" = true WHERE "registration_url" IS NOT NULL AND "registration_url" != '';
