ALTER TABLE "pipeline_runs"
ADD COLUMN "lane_breakdown" JSONB;

ALTER TABLE "pipeline_llm_calls"
ADD COLUMN "lane" TEXT;

CREATE INDEX "pipeline_llm_calls_run_id_lane_idx"
ON "pipeline_llm_calls" ("run_id", "lane");