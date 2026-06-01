# TDD-0040: Mobile v1.0 Member-parity close-out

- **Status:** Implemented
- **Owner:** Mobile Eng
- **Linked:** PRD-0040, [MOBILE_WEB_INTEGRATION.md](../../MOBILE_WEB_INTEGRATION.md)

## 1. Architecture overview

All five gaps are **client-side on mobile** except the event-report `eventId` field, which is
a small additive backend change. No new endpoints are introduced for profile, image upload,
consular, or this-week — they reuse the existing `/api/v1` contract:

| Gap               | Endpoint reused                                                 | Backend change                            |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------- |
| Editable profile  | `PATCH /api/v1/me/onboarding`                                   | none                                      |
| Image upload      | `POST /api/v1/uploads/presign` + `PUT <url>` + submit endpoints | none (contracts already carry `imageKey`) |
| Consular services | `GET /api/v1/cities/:slug/resources` (client filter)            | none                                      |
| This week         | `GET /api/v1/discovery/:slug/events?from&to`                    | none                                      |
| Event report      | `POST /api/v1/reports`                                          | **add `eventId` to `ContentReport`**      |
| Offline cache     | (any GET)                                                       | none                                      |
| Analytics         | `POST /api/v1/track`                                            | none                                      |

**Testability rule (repo convention):** pure logic lives in `.ts` modules unit-tested with
`node --test`; Expo/RN-only code lives in thin `.expo.ts` wrappers and screens. New pure
modules: `lib/uploads/upload.ts`, `lib/analytics/events.ts`, `lib/profile/profile-form.ts`,
`lib/cache/persistent-cache.ts`, `lib/discovery/this-week.ts`, `lib/resources/consular.ts`.

## 2. Data model changes (Prisma diff)

```prisma
model ContentReport {
  // ...existing...
  eventId String? @map("event_id")
  event   Event?  @relation("EventReports", fields: [eventId], references: [id])
  @@index([eventId])
}

model Event {
  // ...existing...
  reports ContentReport[] @relation("EventReports")
}
```

Migration `20260601120000_content_report_event_id`: add nullable column + FK + index.
Existing rows remain valid (column nullable). `ReportType` enum unchanged (STALE_INFO /
BROKEN_LINK / INCORRECT_DETAILS / OTHER apply to events too).

## 3. API surface

- **Contract (`packages/shared/contracts/resources.ts`):** add `eventId: Cuid.optional()` to
  `ContentReportInput`. One of `communityId` / `eventId` / suggestion fields is provided.
- **Service (`apps/web/src/modules/report/service.ts`):** accept `eventId`, validate the
  event exists, persist it, include in the admin notification email.
- **Route (`apps/web/src/app/api/v1/reports/route.ts`):** unchanged (delegates to contract +
  service); now maps `EVENT_NOT_FOUND` → 404.
- All other endpoints are consumed as-is.

### Upload flow (client)

1. Pick image (camera/gallery) → `{ uri, mimeType, sizeBytes }`.
2. Read bytes, compute SHA-256 (hex).
3. `POST /uploads/presign { contentType, sizeBytes, sha256 }` → `{ url, key }`.
4. `PUT url` with body = bytes, headers `Content-Type`, `x-amz-checksum-sha256: base64(sha256)`.
5. Submit with `imageKey = key`.

`lib/uploads/upload.ts` orchestrates steps 3–5 given an injected client + `fetch`, so it is
unit-testable without Expo. `lib/uploads/image-upload.expo.ts` provides steps 1–2 via
`expo-image-picker`, `expo-file-system`, `expo-crypto`.

## 4. Mobile screens & navigation

- `app/me/edit.tsx` — editable profile; linked from `me/profile.tsx` and the `Me` tab.
- `app/submit/event.tsx`, `app/submit/community.tsx` — add an image-picker row.
- `app/resources/consular.tsx` — consular services; linked from `resources/index.tsx`.
- `app/events/this-week.tsx` — this-week feed; linked from the Discover tab.
- `app/report/event/[id].tsx` — event report sheet; linked from `events/[slug].tsx`.

## 5. Push / Email / Inbox triggers

- Event report reuses the existing admin notification email (now includes `eventId`).
- No new push/inbox triggers.

## 6. Feature flag(s)

- Reports remain gated by the existing server `FEATURE_REPORT` flag (event reports inherit it).
- No new flags; v1.0 close-out is parity work shipped on.

## 7. Observability

- New analytics events via `/api/v1/track` (names already recognized server-side):
  `discover.feed.viewed`, `discover.card.tapped`, `event.detail.viewed`, `event.saved`,
  `event.shared`, `event.calendar_added`, `event.register_clicked`. Additional client-only
  pings (`profile_updated`, `consular.viewed`, `this_week.viewed`, `submission.image_added`)
  are sent best-effort and ignored server-side if not entity-bound.
- Upload failures and presign errors are surfaced to the user and logged to console.

## 8. Failure modes & fallbacks

- **Offline:** GETs fall back to the persistent cache; mutations show a retry alert.
- **Upload fails:** submission can proceed without an image (image optional).
- **Presign rejects (size/type):** user-facing validation message, no submit.
- **Track fails:** swallowed; never blocks UX.

## 9. Test plan

- **Unit (`node --test`, mobile):**
  - `upload.ts` — presign+PUT+key orchestration, checksum header, error paths.
  - `events.ts` — track payload builder, event-name catalog.
  - `profile-form.ts` — diff/validation building the `OnboardingUpdate` payload.
  - `persistent-cache.ts` — write/read/expiry/eviction over an injected storage.
  - `this-week.ts` — window computation (now → +7d; expand to +30d when empty).
  - `consular.ts` — filtering resources to the consular type set + grouping.
- **Unit (vitest, web):** report service with `eventId` (validate, persist, not-found).
- **Manual/E2E:** edit profile, image submit, consular, this-week, event report happy paths
  on iOS + Android.

## 10. Rollout plan

- Ship behind the existing app release train (TestFlight + Play Internal). Backend report
  change deploys first (additive, backward compatible), then the app build.

## 11. Backout plan

- Mobile: revert the app build (screens are additive).
- Backend: the `eventId` column is nullable and unused by old clients; safe to leave in place
  even if the mobile surface is rolled back.
