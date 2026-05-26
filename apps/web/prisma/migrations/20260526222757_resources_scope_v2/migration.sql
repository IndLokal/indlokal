-- CreateEnum
CREATE TYPE "ResourceScope" AS ENUM ('GLOBAL', 'COUNTRY', 'STATE', 'METRO', 'CITY', 'DISTRICT');

-- CreateEnum
CREATE TYPE "ResourceAudience" AS ENUM ('NEWCOMER', 'FAMILY', 'FOUNDER', 'EMPLOYEE', 'STUDENT', 'STUDENT_VISA', 'SENIOR', 'RETURNEE');

-- CreateEnum
CREATE TYPE "ResourceStage" AS ENUM ('PRE_ARRIVAL', 'FIRST_30_DAYS', 'FIRST_90_DAYS', 'SETTLED', 'ANYTIME');

-- DropForeignKey
ALTER TABLE "resources" DROP CONSTRAINT "resources_city_id_fkey";

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "audiences" "ResourceAudience"[] DEFAULT ARRAY[]::"ResourceAudience"[],
ADD COLUMN     "is_essential" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lifecycle_stage" "ResourceStage"[] DEFAULT ARRAY[]::"ResourceStage"[],
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "scope" "ResourceScope" NOT NULL DEFAULT 'CITY',
ADD COLUMN     "scope_region" TEXT,
ALTER COLUMN "city_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "resources_is_essential_idx" ON "resources"("is_essential");

-- CreateIndex
CREATE INDEX "resources_scope_scope_region_idx" ON "resources"("scope", "scope_region");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill (TDD-0030 §2): every existing row is implicitly CITY-scoped to its city.
UPDATE "resources" r
SET    "scope" = 'CITY',
       "scope_region" = c."slug"
FROM   "cities" c
WHERE  r."city_id" = c."id"
  AND  r."scope_region" IS NULL;
