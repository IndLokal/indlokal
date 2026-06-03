-- PRD/TDD-0051 / ADR-0010: classify Community nodes by organization type.
-- Additive + nullable; safe by construction.

CREATE TYPE "OrganizationType" AS ENUM (
  'ASSOCIATION',
  'STUDENT_GROUP',
  'TEMPLE_RELIGIOUS',
  'CULTURAL_ORG',
  'PROFESSIONAL_NETWORK',
  'INSTITUTIONAL',
  'INFORMAL_GROUP',
  'BUSINESS',
  'OTHER'
);

ALTER TABLE "communities"
  ADD COLUMN "organization_type" "OrganizationType";

CREATE INDEX "communities_organization_type_idx" ON "communities"("organization_type");
