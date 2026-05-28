-- PRD/TDD-0034 minimal v1: collaborator access requests for claimed communities.

CREATE TYPE "CollaboratorStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
CREATE TYPE "CollaboratorSource" AS ENUM ('OWNER_INVITE', 'PUBLIC_REQUEST', 'ADMIN_ADD');

CREATE TABLE "community_collaborators" (
  "id"                    TEXT NOT NULL,
  "community_id"          TEXT NOT NULL,
  "user_id"               TEXT NOT NULL,
  "status"                "CollaboratorStatus" NOT NULL DEFAULT 'PENDING',
  "source"                "CollaboratorSource" NOT NULL,
  "requested_by_user_id"  TEXT,
  "requested_email"       TEXT,
  "reviewed_at"           TIMESTAMP(3),
  "reviewed_by_user_id"   TEXT,
  "metadata"              JSONB,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "community_collaborators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_collaborators_community_user_key"
  ON "community_collaborators"("community_id", "user_id");

CREATE INDEX "community_collaborators_community_id_status_idx"
  ON "community_collaborators"("community_id", "status");

CREATE INDEX "community_collaborators_requested_email_status_idx"
  ON "community_collaborators"("requested_email", "status");

CREATE INDEX "community_collaborators_user_id_status_idx"
  ON "community_collaborators"("user_id", "status");

ALTER TABLE "community_collaborators"
  ADD CONSTRAINT "community_collaborators_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_collaborators"
  ADD CONSTRAINT "community_collaborators_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_collaborators"
  ADD CONSTRAINT "community_collaborators_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_collaborators"
  ADD CONSTRAINT "community_collaborators_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
