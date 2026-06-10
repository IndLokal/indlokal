# BMAD Output Consolidation

Primary entrypoint: [WORKING_MODEL.md](WORKING_MODEL.md)

This folder contains BMAD working artifacts and sprint execution documents.

Single source of truth policy:

- `_bmad-output` is the authoritative live track for planning, sprint execution, and QA evidence.
- `docs/specs` is promotion-only documentation (approved/finalized snapshots), not the active working board.

How to use both without drift:

1. Start from planning artifacts in [planning-artifacts](planning-artifacts).
2. Execute and track all active work in [implementation-artifacts](implementation-artifacts).
3. Only after a decision is accepted/closed, promote a concise snapshot into [docs/specs](../docs/specs).
4. Do not run parallel active workflows in both locations.

Current mapping (resources trust/supply stream):

- [planning-artifacts/resources-improvement-prd-one-pager.md](planning-artifacts/resources-improvement-prd-one-pager.md) -> active planning baseline
- [planning-artifacts/resources-improvement-technical-architecture.md](planning-artifacts/resources-improvement-technical-architecture.md) -> active technical planning input
- [planning-artifacts/resources-improvement-two-sprint-plan.md](planning-artifacts/resources-improvement-two-sprint-plan.md) -> sprint sequencing input
- [implementation-artifacts/resources-sprint-execution-board.md](implementation-artifacts/resources-sprint-execution-board.md) -> execution status mirror
- [implementation-artifacts/sprint-1-qa-validation-checklist.md](implementation-artifacts/sprint-1-qa-validation-checklist.md) -> QA evidence log
- [implementation-artifacts/sprint-2-qa-validation-checklist.md](implementation-artifacts/sprint-2-qa-validation-checklist.md) -> QA evidence log

Rule going forward:

- No new active initiative should be managed in `docs/specs` while it is still being worked.
- `docs/specs` updates happen at milestone boundaries (approved scope, implementation complete, closeout).
