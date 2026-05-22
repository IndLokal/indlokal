-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL DEFAULT 'cron',
    "regions_scanned" INTEGER NOT NULL,
    "sources_processed" INTEGER NOT NULL,
    "items_fetched" INTEGER NOT NULL,
    "items_passed_filter" INTEGER NOT NULL,
    "items_extracted" INTEGER NOT NULL,
    "items_queued" INTEGER NOT NULL,
    "items_skipped_duplicate" INTEGER NOT NULL,
    "items_skipped_no_city" INTEGER NOT NULL,
    "items_skipped_past" INTEGER NOT NULL DEFAULT 0,
    "llm_calls" INTEGER NOT NULL,
    "llm_tokens_estimate" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "errors" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_runs_created_at_idx" ON "pipeline_runs"("created_at");
