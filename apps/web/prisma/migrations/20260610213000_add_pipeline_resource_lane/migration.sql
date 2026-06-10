-- Add RESOURCE as a first-class lane in pipeline review queue
ALTER TYPE "PipelineEntityType" ADD VALUE IF NOT EXISTS 'RESOURCE';
