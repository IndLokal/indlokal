-- Migration: ambassador_hardening
-- Hardens the ambassador feature surface (quality pass post PRD-0015):
--
--   1. ActivitySignal: unique constraint on (created_by, event_id, signal_type)
--      prevents duplicate ambassador check-ins for the same event.
--      NULL values are excluded from Postgres unique matching, so system-generated
--      signals (created_by/event_id = NULL) are unaffected.
--
--   2. ContentReport: add reporter_user_id FK column so ambassador feedback
--      stats can be queried by userId rather than the fragile reporter_email string.
--      Nullable and additive — existing rows remain valid.

-- ─────────────────────────────────────────────────
-- 1. Deduplicate ambassador check-ins
-- ─────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "activity_signals_checkin_dedup"
  ON "activity_signals" ("created_by", "event_id", "signal_type")
  WHERE "created_by" IS NOT NULL AND "event_id" IS NOT NULL;

-- ─────────────────────────────────────────────────
-- 2. Add reporter_user_id to content_reports
-- ─────────────────────────────────────────────────

ALTER TABLE "content_reports"
  ADD COLUMN IF NOT EXISTS "reporter_user_id" TEXT
    REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "content_reports_reporter_user_id_idx"
  ON "content_reports" ("reporter_user_id");
