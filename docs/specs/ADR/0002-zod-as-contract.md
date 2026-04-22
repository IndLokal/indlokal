# ADR-0002: Zod is the API contract; OpenAPI is generated

- **Date:** 2026-04-22
- **Status:** Accepted

## Context

Web (`apps/web`) and mobile (`apps/mobile`) must agree on every request/response shape. Hand-written OpenAPI drifts from code; hand-written TS types drift from runtime validation. The web app already uses Zod (`src/lib/validation.ts`).

## Decision

- All API contracts live as **Zod schemas in `packages/shared/src/contracts/`**, organized per module (`community`, `event`, `discovery`, `search`, `auth`, `device`, `notification`, `submit`, `report`).
- A CI job runs `zod-to-openapi` to emit `openapi.yaml` (OpenAPI 3.1) on every PR; the file is committed and diffed in review.
- A typed API client is generated from the Zod schemas (not from the OpenAPI) and consumed by both apps.
- Route handlers in `apps/web/src/app/api/v1/**` validate input with the Zod schema and type their responses against it. CI runs **contract tests** that POST recorded fixtures against handlers and compare against the schema; mismatch fails the build.
- Breaking changes require a **new path version** (`/api/v2/...`) and an ADR. Additive changes are allowed inside `v1`.

## Consequences

- **Positive:** single source of truth, runtime + compile-time safety, no spec drift, mobile and web evolve together.
- **Negative:** `zod-to-openapi` covers ~95 % of OpenAPI; rare edge cases need manual annotations on the Zod schema.
- **Neutral:** all new endpoints must register their schema; the existing dev-stage `/api/auth/google` routes are migrated directly to `/api/v1/auth/google` and deleted in the same release — no wrapping or deprecation window needed since the web is pre-launch (see TDD-0001).

## Alternatives considered

- **OpenAPI hand-written first, types generated** — drifts from code, slower to iterate.
- **tRPC** — great DX inside TS, but binds mobile tightly to TS server semantics and complicates third-party (potential web-hook / integrations) consumption. Rejected for now.
- **GraphQL** — overkill for current shape; adds a server, schema layer, and client cache to maintain.
