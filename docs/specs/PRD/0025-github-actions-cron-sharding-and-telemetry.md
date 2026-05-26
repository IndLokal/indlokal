# PRD-0025: GitHub Actions cron sharding and telemetry

- **Status:** Draft
- **Owner:** Founders
- **Reviewers:** PM, Eng Lead
- **Linked:** TDD-0025, PRD-0024, docs/deployment/ADMIN_AND_BOOTSTRAP.md

## 1. Problem

A single cron job is not sufficient for stable region-by-region operations as source volume grows.

We need deterministic shard scheduling and shard-level telemetry so operations can isolate failures quickly and maintain predictable throughput.

## 2. Users & JTBD

- **Ops owner:** understand which region shard failed and when.
- **Engineering team:** adjust shard timing without introducing scheduler drift.

## 3. Success Metrics

- Cron schedule runs region shards independently with stable cadence.
- Each shard run emits shard-level telemetry for volume/errors/duration.
- Scheduler source of truth remains GitHub Actions only.

## 4. Scope

- Use GitHub Actions cron as canonical scheduler.
- Define region-sharded workflow jobs.
- Keep secure auth using `CRON_SECRET` bearer token.
- Emit `pipeline_shard_completed` server event with shard/run metrics.

## 5. Out of Scope

- Vercel cron adoption.
- New scheduler platform.
- Alerting platform migration.

## 6. User Stories

- As an operator, I can identify Berlin shard completion and failures independently of other shards.
- As an engineer, I can trigger a shard manually for debugging from workflow dispatch.

## 7. Acceptance Criteria (Gherkin)

```text
Given scheduled workflow jobs per region shard
When cron executes
Then each shard calls /api/cron/pipeline with explicit region scope
And uses CRON_SECRET authorization.

Given a shard run completes
When cron route returns
Then server telemetry emits pipeline_shard_completed with scope + run metrics.

Given an operator runs workflow_dispatch
When shard input is selected
Then only the selected shard endpoint is invoked.
```

## 8. UX

- No end-user UX changes.
- Operations UX improves via easier shard-level run diagnosis.

## 9. Risks & Open Questions

- Too-aggressive scheduling may create overlap pressure; must stagger safely.
- Telemetry cardinality must remain bounded by known region/city scope values.
