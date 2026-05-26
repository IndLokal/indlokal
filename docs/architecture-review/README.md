# AI Pipeline Architecture Review

Principal-architect-level review of the IndLokal AI/data pipeline, conducted 2026-05-26.

- **[AI_PIPELINE_ARCHITECTURE_REVIEW.md](AI_PIPELINE_ARCHITECTURE_REVIEW.md)** — full critique: structure, verdict per dimension, ranked issues, what's well-designed, scalability ceiling.
- **[RISK_REGISTER.md](RISK_REGISTER.md)** — 20 risks with severity × likelihood and top-5 to fix this quarter.
- **[IMPROVEMENT_ROADMAP.md](IMPROVEMENT_ROADMAP.md)** — phased plan (Phase 0 stop-the-bleeding → Phase 5 optional agent surface).

## Headline findings

1. **It's not an agent.** It's a clean, deterministic ETL pipeline with two LLM calls. Rename the docs.
2. **Filter fails open.** On any LLM error, every item is marked relevant. Fix this week.
3. **There is no queue.** `PipelineItem` is a review table. The Vercel HTTP function _is_ the worker. This is the architectural ceiling.
4. **Observability is too thin to operate.** No per-LLM-call audit row, no structured logs, no cost dashboard.
5. **Cost control is genuinely tight.** Cheapest model, batching, prefilter, opt-in DDG, scope sharding. Don't break this.

See the main document for grade-per-dimension and concrete fixes.
