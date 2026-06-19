ALTER TABLE "pipeline_runs"
ADD COLUMN "lane_breakdown" JSONB;

ALTER TABLE "pipeline_llm_calls"
ADD COLUMN "lane" TEXT;

CREATE INDEX "pipeline_llm_calls_run_id_lane_idx"
ON "pipeline_llm_calls" ("run_id", "lane");

ALTER TABLE "keyword_suggestions"
ADD COLUMN "lane" TEXT NOT NULL;

CREATE INDEX "keyword_suggestions_status_lane_idx"
ON "keyword_suggestions"("status", "lane");