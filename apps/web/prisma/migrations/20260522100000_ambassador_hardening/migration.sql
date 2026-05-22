-- Migration: ambassador_hardening
-- Hardens the ambassador feature surface (quality pass post PRD-0015):
--
--   1. ActivitySignal: unique index on (created_by, event_id, signal_type)
--      prevents duplicate ambassador check-ins for the same event.
--      Postgres does not consider NULL equal to NULL in unique indexes, so
--      system signals with created_by/event_id = NULL are unaffected — the
--      same semantic as a partial WHERE IS NOT NULL index, without the
--      inconsistency that Prisma @@unique validation flags.
--
--   2. ContentReport: add reporter_user_id FK column so ambassador feedback
--      stats can be queried by userId rather than the fragile reporter_email string.
--      Nullable and additive — existing rows remain valid.
--
-- This file is written to be fully idempotent so it can be safely re-run
-- after a previously-failed attempt.

-- ─────────────────────────────────────────────────
-- 1. Deduplicate ambassador check-ins
-- ─────────────────────────────────────────────────

-- Drop any partial version left by a prior failed attempt before recreating.
DROP INDEX IF EXISTS "activity_signals_checkin_dedup";

CREATE UNIQUE INDEX "activity_signals_checkin_dedup"
  ON "activity_signals" ("created_by", "event_id", "signal_type");

-- ─────────────────────────────────────────────────
-- 2. Add reporter_user_id to content_reports
-- ─────────────────────────────────────────────────

ALTER TABLE "content_reports"
  ADD COLUMN IF NOT EXISTS "reporter_user_id" TEXT
    REFERENCES "users"("id") ON DELETE SET NULL;

DROP INDEX IF EXISTS "content_reports_reporter_user_id_idx";

CREATE INDEX "content_reports_reporter_user_id_idx"
  ON "content_reports" ("reporter_user_id");

