-- CreateEnum
CREATE TYPE "PipelineSourceConfigType" AS ENUM ('KEYWORD', 'REGION', 'STRATEGY');

-- CreateTable
CREATE TABLE "pipeline_source_configs" (
    "id" TEXT NOT NULL,
    "config_type" "PipelineSourceConfigType" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source_type" "PipelineSourceType",
    "kind" TEXT,
    "payload" JSONB,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_source_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_source_configs_config_type_key_key" ON "pipeline_source_configs"("config_type", "key");

-- CreateIndex
CREATE INDEX "pipeline_source_configs_config_type_enabled_idx" ON "pipeline_source_configs"("config_type", "enabled");
