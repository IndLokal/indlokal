ALTER TABLE "resources"
ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hidden_reason" TEXT,
ADD COLUMN "last_reviewed_at" TIMESTAMP(3),
ADD COLUMN "review_cadence_days" INTEGER NOT NULL DEFAULT 180;

CREATE INDEX "resources_is_hidden_idx" ON "resources"("is_hidden");