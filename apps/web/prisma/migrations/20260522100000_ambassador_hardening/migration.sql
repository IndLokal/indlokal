-- Migration: ambassador_hardening (comprehensive schema catch-up)
--
-- The baseline init migration pre-dates PRD-0015 through PRD-0018.
-- This migration adds every schema change from those PRDs that was missing:
--
--   PRD-0015 (City Ambassador Console):
--     · activity_signals.created_by / event_id columns + FK + index
--     · ActivitySignalType.EVENT_VERIFIED_ATTENDED enum value
--
--   PRD-0016 (Outreach CRM):
--     · OutreachStage enum
--     · outreach_leads table
--     · outreach_notes table
--
--   PRD-0018 (Audit Log Viewer):
--     · ContentLogAction.ROLE_GRANTED / ROLE_REVOKED enum values
--     · content_logs (changed_by, created_at) composite index
--
--   Ambassador hardening (quality pass):
--     · activity_signals unique index on (created_by, event_id, signal_type)
--       to prevent duplicate check-ins
--     · content_reports.reporter_user_id FK column + index
--
-- Every statement is idempotent so the migration is safe to re-run after
-- a prior failed attempt.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. activity_signals: add created_by + event_id columns (PRD-0015)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "activity_signals"
  ADD COLUMN IF NOT EXISTS "created_by" TEXT,
  ADD COLUMN IF NOT EXISTS "event_id"   TEXT;

-- FK: event_id → events(id) ON DELETE CASCADE
DO $$ BEGIN
  ALTER TABLE "activity_signals"
    ADD CONSTRAINT "activity_signals_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index on created_by for per-ambassador queries
CREATE INDEX IF NOT EXISTS "activity_signals_created_by_idx"
  ON "activity_signals" ("created_by");

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ActivitySignalType: add EVENT_VERIFIED_ATTENDED (PRD-0015)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE "ActivitySignalType" ADD VALUE IF NOT EXISTS 'EVENT_VERIFIED_ATTENDED';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ContentLogAction: add ROLE_GRANTED + ROLE_REVOKED (PRD-0018)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE "ContentLogAction" ADD VALUE IF NOT EXISTS 'ROLE_GRANTED';
ALTER TYPE "ContentLogAction" ADD VALUE IF NOT EXISTS 'ROLE_REVOKED';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. content_logs: (changed_by, created_at) composite index (PRD-0018)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "content_logs_changed_by_created_at_idx"
  ON "content_logs" ("changed_by", "created_at");

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. OutreachStage enum (PRD-0016)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "OutreachStage" AS ENUM (
    'NEW', 'RESEARCHING', 'CONTACTED', 'IN_CONVERSATION',
    'ONBOARDED', 'DECLINED', 'DORMANT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. outreach_leads table (PRD-0016)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "outreach_leads" (
  "id"              TEXT            NOT NULL,
  "city_id"         TEXT            NOT NULL,
  "community_id"    TEXT,
  "suggested_name"  TEXT,
  "channel_hint"    TEXT,
  "owner_user_id"   TEXT            NOT NULL,
  "source"          TEXT            NOT NULL,
  "stage"           "OutreachStage" NOT NULL DEFAULT 'NEW',
  "next_action_at"  TIMESTAMP(3),
  "metadata"        JSONB,
  "created_at"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "outreach_leads_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "outreach_leads"
    ADD CONSTRAINT "outreach_leads_city_id_fkey"
    FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "outreach_leads"
    ADD CONSTRAINT "outreach_leads_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "outreach_leads_city_id_stage_idx"
  ON "outreach_leads" ("city_id", "stage");

CREATE INDEX IF NOT EXISTS "outreach_leads_owner_user_id_stage_idx"
  ON "outreach_leads" ("owner_user_id", "stage");

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. outreach_notes table (PRD-0016)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "outreach_notes" (
  "id"         TEXT         NOT NULL,
  "lead_id"    TEXT         NOT NULL,
  "author_id"  TEXT         NOT NULL,
  "body"       TEXT         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "outreach_notes_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "outreach_notes"
    ADD CONSTRAINT "outreach_notes_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "outreach_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "outreach_notes_lead_id_created_at_idx"
  ON "outreach_notes" ("lead_id", "created_at");

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. activity_signals: unique index to prevent duplicate ambassador check-ins
--    NULL values are non-matching in Postgres unique indexes, so system signals
--    (created_by / event_id = NULL) are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS "activity_signals_checkin_dedup";

CREATE UNIQUE INDEX "activity_signals_checkin_dedup"
  ON "activity_signals" ("created_by", "event_id", "signal_type");

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. content_reports: reporter_user_id FK column + index
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "content_reports"
  ADD COLUMN IF NOT EXISTS "reporter_user_id" TEXT
    REFERENCES "users"("id") ON DELETE SET NULL;

DROP INDEX IF EXISTS "content_reports_reporter_user_id_idx";

CREATE INDEX "content_reports_reporter_user_id_idx"
  ON "content_reports" ("reporter_user_id");
