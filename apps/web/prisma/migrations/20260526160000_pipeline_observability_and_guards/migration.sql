-- Pipeline observability & cost guards — consolidated migration for
-- PRD/TDD-0026 (reliability counters), PRD/TDD-0027 (per-LLM-call audit),
-- and PRD/TDD-0028 (cost guard flags). Single migration because the three
-- specs ship as one atomic change.

-- ─── PRD-0026: reliability counters on pipeline_runs ─────────────────
-- ─── PRD-0028: cost guard flags on pipeline_runs ─────────────────────
ALTER TABLE "pipeline_runs"
  ADD COLUMN "filter_failures"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "extract_retries_exhausted" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "items_dropped_bad_index"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "budget_exceeded"           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "circuit_breaker_tripped"   BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── PRD-0027: per-LLM-call audit table ──────────────────────────────
CREATE TYPE "PipelineLlmStage" AS ENUM ('filter', 'extract', 'dedup', 'enrich', 'keyword');

CREATE TABLE "pipeline_llm_calls" (
  "id"                TEXT NOT NULL,
  "run_id"            TEXT NOT NULL,
  "stage"             "PipelineLlmStage" NOT NULL,
  "model"             TEXT NOT NULL,
  "prompt_tokens"     INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens"      INTEGER NOT NULL DEFAULT 0,
  "duration_ms"       INTEGER NOT NULL,
  "ok"                BOOLEAN NOT NULL,
  "error_code"        TEXT,
  "batch_size"        INTEGER,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pipeline_llm_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pipeline_llm_calls_run_id_idx" ON "pipeline_llm_calls"("run_id");
CREATE INDEX "pipeline_llm_calls_created_at_stage_idx" ON "pipeline_llm_calls"("created_at", "stage");

ALTER TABLE "pipeline_llm_calls"
  ADD CONSTRAINT "pipeline_llm_calls_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
