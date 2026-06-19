DELETE FROM "keyword_suggestions";

ALTER TABLE "keyword_suggestions"
ADD COLUMN "lane" TEXT NOT NULL;

CREATE INDEX "keyword_suggestions_status_lane_idx"
ON "keyword_suggestions"("status", "lane");