-- PRD/TDD-0040: Event reports — add first-class eventId to content_reports (orthogonal to community_id).

ALTER TABLE "content_reports"
  ADD COLUMN "event_id" TEXT;

ALTER TABLE "content_reports"
  ADD CONSTRAINT "content_reports_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "content_reports_event_id_idx" ON "content_reports"("event_id");
