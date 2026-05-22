-- Migration: schema_catchup_2
--
-- Fixes remaining gaps between schema.prisma and the applied migrations.
-- All statements are idempotent.
--
--   1. pipeline_items.metadata JSONB   — was in schema.prisma but not in any migration
--                                        (caused P2022 in integration tests)
--   2. activity_signals: drop extra event_id FK — eventId is a plain String? field
--                                                 with no @relation directive; the FK
--                                                 was incorrectly added in ambassador_hardening
--   3. content_reports FK ON UPDATE    — inline REFERENCES defaulted to ON UPDATE NO ACTION;
--                                        schema.prisma expects ON UPDATE CASCADE
--   4. outreach_leads.updated_at       — drop DB-level DEFAULT so @updatedAt is fully
--                                        managed by the Prisma client (no DB default)

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. pipeline_items: add missing metadata column
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "pipeline_items"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. activity_signals: drop extra FK (eventId has no @relation in schema.prisma)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "activity_signals"
  DROP CONSTRAINT IF EXISTS "activity_signals_event_id_fkey";

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. content_reports: fix reporter_user_id FK — re-add with ON UPDATE CASCADE
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "content_reports"
  DROP CONSTRAINT IF EXISTS "content_reports_reporter_user_id_fkey";

DO $$ BEGIN
  ALTER TABLE "content_reports"
    ADD CONSTRAINT "content_reports_reporter_user_id_fkey"
    FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. outreach_leads: drop DB-level default on updated_at
--    (Prisma @updatedAt is client-managed; DROP DEFAULT is a no-op if none exists)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "outreach_leads"
  ALTER COLUMN "updated_at" DROP DEFAULT;
