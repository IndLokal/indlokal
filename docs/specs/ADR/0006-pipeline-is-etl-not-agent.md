# ADR-0006: Pipeline is a deterministic ETL, not an AI agent

- **Date:** 2026-05-26
- **Status:** Accepted

## Context

The data ingestion system in `apps/web/src/modules/pipeline/*` is referred to as an "AI Agent" in product-facing docs (`docs/AI_PIPELINE_ARCHITECTURE.md`, `docs/AI_PIPELINE_PRODUCT.md`) and in some inline comments. The actual implementation contains:

- No tool-calling loop, no planner LLM, no reflection, no agentic memory.
- Two LLM calls per item, both pure functions: relevance filter (Stage 1) and structured extraction (Stage 2).
- One additional ad-hoc LLM call for semantic community dedup.
- Hard-coded orchestration DAG (`orchestrator.ts`) and hard-coded planning policy (`source-plan.ts`).
- Output flows through a Postgres staging table (`PipelineItem`) for human review.

The architectural review in [docs/architecture-review/AI_PIPELINE_ARCHITECTURE_REVIEW.md](../../architecture-review/AI_PIPELINE_ARCHITECTURE_REVIEW.md) §3.6 flags this as a doc/code drift risk: a future engineer reading "Agent" docs may invent agentic loops that the system was deliberately designed not to have.

## Decision

We classify the ingestion system as a **deterministic ETL pipeline that uses LLMs as bounded extraction functions**, not as an agent.

Concretely:

1. The canonical name in technical docs is **"content ingestion pipeline"** (or "pipeline" for short). The term **"AI agent"** is reserved for future agentic surfaces (e.g. an admin-facing assistant) and **must not** be applied to `apps/web/src/modules/pipeline/*`.
2. Any new LLM call added to the pipeline must remain a single-turn, schema-constrained function. No tool calling, no multi-turn reasoning, no autonomous loops inside cron-path code.
3. Product docs were renamed `docs/AI_AGENT_*.md` → `docs/AI_PIPELINE_*.md` on 2026-05-26 (the marketing framing inside them is left in place; only the architectural label is corrected). All in-repo backlinks updated in the same commit.
4. The notification outbox (`apps/web/src/modules/notifications/outbox.ts`) is an unrelated cross-cutting concern owned by TDD-0002 and is out of scope for this ADR. Its lack of a processor is tracked separately as R15 - currently dormant (zero producer callers, zero outbox row growth in production).

## Consequences

- **Positive:** Future engineers reason about the pipeline as ETL - they reach for queues, retries, idempotency, and observability rather than agentic frameworks. Cost and latency budgets stay sane.
- **Positive:** Allows us to introduce a genuine agentic product later (admin assistant, reviewer copilot) under a distinct module name without conflict.
- **Negative:** External bookmarks to `docs/AI_AGENT_*.md` (if any) now 404. Considered acceptable: there are no public links and the in-repo rename eliminates the daily mislabel cost.
- **Neutral:** No application code changes mandated by this ADR. Behavioural improvements are scoped to PRD-0026, PRD-0027, and PRD-0028.

## Alternatives considered

- **Leave `AI_AGENT_*.md` filenames in place.** Rejected on 2026-05-26 after re-review: the daily cost of every reader having to mentally translate "agent" → "ETL" outweighed the one-time link-update cost. In-repo backlinks updated atomically.
- **Build an actual agentic layer to match the docs.** Rejected: solves no current product problem, inflates cost 5-10×, increases failure-mode surface.
- **Leave the ambiguity in place.** Rejected: actively misled at least one architectural review and has already caused scope confusion.
