# Working Model: One Line, Two Layers

This project has two documentation layers, but only one active working line.

## 1) Active Working Line (daily execution)

Use only `_bmad-output` for active work:

- Planning: `_bmad-output/planning-artifacts`
- Sprint execution and QA: `_bmad-output/implementation-artifacts`

If a document is being actively edited during the sprint, it belongs here.

## 2) Promotion Layer (milestone snapshots)

Use `docs/specs` only to publish stable snapshots at milestone boundaries:

- Scope approved
- Implementation complete
- Sprint closeout

Do not run live planning/execution in `docs/specs`.

## 3) Weekly Operating Rhythm

1. Monday: update `_bmad-output/implementation-artifacts/resources-sprint-execution-board.md`.
2. During sprint: update story files and QA checklists in `_bmad-output/implementation-artifacts`.
3. At milestone: promote only final decisions/acceptance to `docs/specs`.
4. After promotion: keep execution edits in `_bmad-output` only.

## 4) Promotion Checklist (before updating docs/specs)

- Decision is accepted by owner.
- QA evidence exists in sprint checklist.
- Story status is final (done/deferred/accepted risk).
- Promotion note links back to source artifact in `_bmad-output`.

## 5) What Not To Do

- Do not maintain two active versions of the same thing.
- Do not add new sprint tasks directly in `docs/specs`.
- Do not use `docs/specs` as a live board.

## 6) Current Canonical Files

- Active board: `_bmad-output/implementation-artifacts/resources-sprint-execution-board.md`
- Active QA: `_bmad-output/implementation-artifacts/sprint-1-qa-validation-checklist.md`
- Active QA: `_bmad-output/implementation-artifacts/sprint-2-qa-validation-checklist.md`
- Promotion index: `docs/specs/README.md`
