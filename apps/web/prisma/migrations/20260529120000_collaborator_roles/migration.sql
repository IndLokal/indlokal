-- ADR-0008 / TDD-0036: CommunityCollaborator is the authoritative, role-bearing
-- community membership with exactly two roles
-- (COMMUNITY_ADMIN = organizer, COLLABORATOR).
-- Also add REMOVED status and Community.created_by_user_id.

-- 0. Extend CollaboratorStatus for soft-removal workflows.
ALTER TYPE "CollaboratorStatus" ADD VALUE IF NOT EXISTS 'REMOVED';

-- 0.1 Rename collaborator invite source to match role terminology.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'CollaboratorSource'
      AND e.enumlabel = 'OWNER_INVITE'
  ) THEN
    ALTER TYPE "CollaboratorSource" RENAME VALUE 'OWNER_INVITE' TO 'COMMUNITY_ADMIN_INVITE';
  END IF;
END $$;

-- 0.2 Ensure a single collaborator row per community/user pair.
CREATE UNIQUE INDEX IF NOT EXISTS "community_collaborators_community_user_key"
  ON "community_collaborators"("community_id", "user_id");

-- 1. Role enum (two roles only).
CREATE TYPE "CollaboratorRole" AS ENUM ('COMMUNITY_ADMIN', 'COLLABORATOR');

-- 2. Role column (existing rows default to COLLABORATOR) + index.
ALTER TABLE "community_collaborators"
  ADD COLUMN "role" "CollaboratorRole" NOT NULL DEFAULT 'COLLABORATOR';

CREATE INDEX "community_collaborators_community_id_role_idx"
  ON "community_collaborators"("community_id", "role");

-- 3. Backfill exactly one COMMUNITY_ADMIN row per claimed community, mirroring
--    Community.claimedByUserId. Idempotent via the (community_id, user_id) key.
INSERT INTO "community_collaborators" (
  "id", "community_id", "user_id", "status", "role", "source",
  "metadata", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  c."claimed_by_user_id",
  'ACTIVE'::"CollaboratorStatus",
  'COMMUNITY_ADMIN'::"CollaboratorRole",
  'ADMIN_ADD'::"CollaboratorSource",
  jsonb_build_object('backfill', true),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "communities" c
WHERE c."claimed_by_user_id" IS NOT NULL
  AND c."claim_state" = 'CLAIMED'
ON CONFLICT ("community_id", "user_id") DO UPDATE
  SET "role" = 'COMMUNITY_ADMIN'::"CollaboratorRole",
      "status" = 'ACTIVE'::"CollaboratorStatus",
      "updated_at" = CURRENT_TIMESTAMP;

-- 4. Community creator pointer kept separate from claim ownership.
ALTER TABLE "communities"
  ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;

ALTER TABLE "communities"
  ADD CONSTRAINT "communities_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "communities_created_by_user_id_idx"
  ON "communities"("created_by_user_id");

-- 5. Best-effort retroactive audit trail for every active membership (owners
--    just backfilled + pre-existing active collaborators).
INSERT INTO "content_logs" (
  "id", "entity_type", "entity_id", "action", "source",
  "changed_by", "metadata", "created_at"
)
SELECT
  gen_random_uuid()::text,
  'community',
  cc."community_id",
  'ROLE_GRANTED'::"ContentLogAction",
  'ADMIN_SEED'::"ContentSource",
  'system',
  jsonb_build_object('backfill', true, 'role', cc."role"::text, 'targetUserId', cc."user_id"),
  CURRENT_TIMESTAMP
FROM "community_collaborators" cc
WHERE cc."status" = 'ACTIVE';
