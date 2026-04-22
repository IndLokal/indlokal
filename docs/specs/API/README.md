# API Contracts

Per [ADR-0002](../ADR/0002-zod-as-contract.md), Zod is the source of truth.

## Layout (in `packages/shared`)

```
packages/shared/src/
  contracts/
    auth.ts           # PRD/TDD-0001, PRD/TDD-0008
    device.ts         # PRD/TDD-0002, PRD/TDD-0004
    notification.ts   # PRD/TDD-0002, PRD/TDD-0004
    discovery.ts      # PRD/TDD-0003
    event.ts          # PRD/TDD-0005
    community.ts      # PRD/TDD-0006
    search.ts         # PRD/TDD-0007
    submit.ts         # PRD/TDD-0009
    resource.ts       # PRD/TDD-0010
    me.ts             # PRD/TDD-0010
    report.ts         # PRD/TDD-0010
    track.ts          # analytics ingest
    common.ts         # Cursor, Page<T>, Ack, Error
  client/
    index.ts          # generated typed REST client
  openapi.yaml        # generated from contracts/* via CI
```

## Endpoint inventory (v1)

Authoritative table — every endpoint in TDDs above appears here.

### Auth

- `POST /api/v1/auth/magic-link/request`
- `POST /api/v1/auth/magic-link/verify`
- `POST /api/v1/auth/google`
- `POST /api/v1/auth/apple`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET  /api/v1/me`
- `DELETE /api/v1/me`

### Devices & Notifications

- `POST   /api/v1/devices`
- `PATCH  /api/v1/devices/:installationId`
- `DELETE /api/v1/devices/:installationId`
- `GET    /api/v1/notifications/preferences`
- `PUT    /api/v1/notifications/preferences`
- `GET    /api/v1/notifications/inbox?cursor`
- `POST   /api/v1/notifications/inbox/read`

### Cities & Discovery

- `GET /api/v1/cities`
- `GET /api/v1/cities/:slug`
- `GET /api/v1/discovery/:citySlug/events`
- `GET /api/v1/discovery/:citySlug/communities`
- `GET /api/v1/discovery/:citySlug/trending`
- `GET /api/v1/cities/:slug/resources`

### Events

- `GET    /api/v1/events/:slug`
- `POST   /api/v1/events/:slug/save`
- `DELETE /api/v1/events/:slug/save`

### Communities

- `GET    /api/v1/communities/:slug`
- `POST   /api/v1/communities/:slug/follow`
- `DELETE /api/v1/communities/:slug/follow`
- `GET    /api/v1/communities/:slug/events`
- `GET    /api/v1/communities/:slug/related`

### Search

- `GET /api/v1/search`
- `GET /api/v1/search/suggest`
- `GET /api/v1/search/trending`

### Me / Bookmarks

- `GET /api/v1/me/saves/events`
- `GET /api/v1/me/saves/communities`

### Submissions & Uploads

- `POST /api/v1/uploads/presign`
- `POST /api/v1/submissions/event`
- `POST /api/v1/submissions/community`
- `POST /api/v1/submissions/suggest`

### Reports & Tracking

- `POST /api/v1/reports`
- `POST /api/v1/track`

## Error model

```ts
// contracts/common.ts
export const ApiError = z.object({
  code: z.string(), // e.g. AUTH_REFRESH_REUSED
  message: z.string(),
  fields: z.record(z.string()).optional(),
  requestId: z.string().optional(),
});
```

All non-2xx responses return `ApiError`. Codes are documented in this file as they're added.

## Versioning

- Additive changes inside `v1` (new optional fields, new endpoints) — allowed.
- Breaking changes — new path `/api/v2/...` + ADR + deprecation header on `v1` for ≥ 90 days.
