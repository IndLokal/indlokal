-- B2: resource reverification queue + SLA workflow

CREATE TYPE "ResourceReverificationStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'DISMISSED');

CREATE TYPE "ResourceReverificationResolutionAction" AS ENUM (
  'VERIFIED',
  'CORRECTED',
  'HIDDEN',
  'ARCHIVED',
  'DISMISSED'
);

CREATE TABLE "resource_reverification_queue" (
  "id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "status" "ResourceReverificationStatus" NOT NULL DEFAULT 'OPEN',
  "state_bucket" TEXT NOT NULL,
  "priority_score" INTEGER NOT NULL DEFAULT 0,
  "risk_score" INTEGER NOT NULL DEFAULT 0,
  "traffic_score" INTEGER NOT NULL DEFAULT 0,
  "staleness_score" INTEGER NOT NULL DEFAULT 0,
  "criticality_score" INTEGER NOT NULL DEFAULT 0,
  "owner_user_id" TEXT,
  "sla_due_at" TIMESTAMP(3),
  "resolution_action" "ResourceReverificationResolutionAction",
  "resolution_notes" TEXT,
  "first_queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_state_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "resource_reverification_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resource_reverification_queue_resource_id_key"
  ON "resource_reverification_queue"("resource_id");

CREATE INDEX "resource_reverification_queue_status_priority_idx"
  ON "resource_reverification_queue"("status", "priority_score");

CREATE INDEX "resource_reverification_queue_owner_status_idx"
  ON "resource_reverification_queue"("owner_user_id", "status");

CREATE INDEX "resource_reverification_queue_sla_status_idx"
  ON "resource_reverification_queue"("sla_due_at", "status");

ALTER TABLE "resource_reverification_queue"
  ADD CONSTRAINT "resource_reverification_queue_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resource_reverification_queue"
  ADD CONSTRAINT "resource_reverification_queue_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
