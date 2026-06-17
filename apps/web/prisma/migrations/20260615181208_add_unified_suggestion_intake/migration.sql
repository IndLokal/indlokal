-- CreateEnum
CREATE TYPE "EventRejectionReason" AS ENUM ('POLICY_VIOLATION', 'UNVERIFIABLE', 'DUPLICATE', 'SPAM', 'OUTSIDE_COVERAGE');

-- AlterEnum
ALTER TYPE "PipelineSourceType" ADD VALUE 'EVENT_SUGGESTION';

-- AlterEnum
ALTER TYPE "ReportType" ADD VALUE 'SUGGEST_EVENT';

-- AlterTable
ALTER TABLE "community_collaborators" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "rejection_reason" "EventRejectionReason",
ALTER COLUMN "price_currency" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "journey_gap_backlog" ALTER COLUMN "updated_at" DROP DEFAULT;
