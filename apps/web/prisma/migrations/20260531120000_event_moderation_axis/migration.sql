-- ADR-0009: Event moderation axis (orthogonal to lifecycle) + accountable creator + review record.

-- 1. Moderation state enum
CREATE TYPE "EventModerationState" AS ENUM ('PUBLISHED', 'PENDING_REVIEW', 'REJECTED');

-- 2. New columns on events
ALTER TABLE "events"
  ADD COLUMN "moderation_state" "EventModerationState" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "created_by_user_id" TEXT,
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "review_reason" TEXT;

-- 3. Foreign keys (nullable; creator/reviewer are optional)
ALTER TABLE "events"
  ADD CONSTRAINT "events_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "events"
  ADD CONSTRAINT "events_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Indexes
CREATE INDEX "events_moderation_state_idx" ON "events"("moderation_state");
CREATE INDEX "events_moderation_state_starts_at_idx" ON "events"("moderation_state", "starts_at");
CREATE INDEX "events_created_by_user_id_idx" ON "events"("created_by_user_id");

-- 5. Backfill: existing rows are already publicly visible -> keep PUBLISHED (default).
--    Copy the legacy host attribution out of metadata into the first-class column.
UPDATE "events"
SET "created_by_user_id" = "metadata"->>'hostUserId'
WHERE "metadata" ? 'hostUserId'
  AND "metadata"->>'hostUserId' IN (SELECT "id" FROM "users");
