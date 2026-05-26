-- Add scope columns for sharded pipeline observability
ALTER TABLE "pipeline_runs"
  ADD COLUMN "scope_region_ids" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "scope_city_slugs" TEXT[] NOT NULL DEFAULT '{}';
