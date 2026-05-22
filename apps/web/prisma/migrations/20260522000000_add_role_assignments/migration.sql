-- Migration: add_role_assignments
-- ADR-0005 / PRD-0014
-- Expands UserRole enum with 6 new operator roles and adds the
-- RoleAssignment table for scoped, auditable role grants.
--
-- This migration is purely additive:
--   • Existing 'USER', 'COMMUNITY_ADMIN', 'PLATFORM_ADMIN' values are untouched.
--   • User.role column keeps its default value of 'USER'.
--   • No existing rows are altered.

-- ─────────────────────────────────────────────────
-- 1. Expand UserRole enum
-- ─────────────────────────────────────────────────

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EVENT_HOST';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARTNER_ORG_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CITY_AMBASSADOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CONTENT_EDITOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OPS_LEAD';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARTNERSHIPS_LEAD';

-- ─────────────────────────────────────────────────
-- 2. Create RoleAssignment table
-- ─────────────────────────────────────────────────

CREATE TABLE "role_assignments" (
    "id"          TEXT        NOT NULL,
    "user_id"     TEXT        NOT NULL,
    "role"        "UserRole"  NOT NULL,
    "city_id"     TEXT,
    "org_id"      TEXT,
    "granted_by"  TEXT        NOT NULL,
    "granted_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at"  TIMESTAMP(3),

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────────────────

CREATE INDEX "role_assignments_user_id_idx"    ON "role_assignments"("user_id");
CREATE INDEX "role_assignments_role_city_idx"  ON "role_assignments"("role", "city_id");

-- ─────────────────────────────────────────────────
-- 4. Foreign key: role_assignments → users
-- ─────────────────────────────────────────────────

ALTER TABLE "role_assignments"
    ADD CONSTRAINT "role_assignments_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
