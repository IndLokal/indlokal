-- C1: Journey-gap backlog persistence (city x persona x stage)

CREATE TYPE "JourneyGapBacklogStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

CREATE TABLE "journey_gap_backlog" (
  "id" TEXT NOT NULL,
  "city_id" TEXT NOT NULL,
  "persona_slug" TEXT NOT NULL,
  "persona_label" TEXT NOT NULL,
  "stage" "ResourceStage" NOT NULL,
  "status" "JourneyGapBacklogStatus" NOT NULL DEFAULT 'OPEN',
  "priority_score" INTEGER NOT NULL DEFAULT 0,
  "traffic_score" INTEGER NOT NULL DEFAULT 0,
  "severity_score" INTEGER NOT NULL DEFAULT 0,
  "stage_criticality_score" INTEGER NOT NULL DEFAULT 0,
  "trust_gap_score" INTEGER NOT NULL DEFAULT 0,
  "owner_user_id" TEXT,
  "sla_due_at" TIMESTAMP(3),
  "gap_summary" TEXT NOT NULL,
  "notes" TEXT,
  "first_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "journey_gap_backlog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "journey_gap_backlog_city_persona_stage_key"
  ON "journey_gap_backlog"("city_id", "persona_slug", "stage");

CREATE INDEX "journey_gap_backlog_status_priority_idx"
  ON "journey_gap_backlog"("status", "priority_score");

CREATE INDEX "journey_gap_backlog_owner_status_idx"
  ON "journey_gap_backlog"("owner_user_id", "status");

CREATE INDEX "journey_gap_backlog_sla_status_idx"
  ON "journey_gap_backlog"("sla_due_at", "status");

ALTER TABLE "journey_gap_backlog"
  ADD CONSTRAINT "journey_gap_backlog_city_id_fkey"
  FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journey_gap_backlog"
  ADD CONSTRAINT "journey_gap_backlog_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
