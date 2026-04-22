# TDD-0009: Submit (camera + gallery)

- **Status:** Draft
- **Linked PRD:** PRD-0009
- **Depends on:** TDD-0001, TDD-0002

## 1. Architecture overview

- Image upload pipeline (new): client requests presigned PUT (S3/R2); on success, POST submission with `imageKey`.
- Server reuses `src/modules/pipeline` to create `PipelineItem`; reuses `src/app/submit/actions.ts` logic refactored to a service.

## 2. Data model changes

- `PipelineItem.imageKey String?` if not present.
- Add `MediaAsset` table (id, key, contentType, sizeBytes, sha256, createdBy, createdAt).

## 3. API surface

| Method | Path                            | Auth   | Request                              | Response                  |
| ------ | ------------------------------- | ------ | ------------------------------------ | ------------------------- |
| POST   | `/api/v1/uploads/presign`       | access | `{ contentType, sizeBytes, sha256 }` | `{ url, key, expiresAt }` |
| POST   | `/api/v1/submissions/event`     | access | `EventSubmission`                    | `PipelineItem`            |
| POST   | `/api/v1/submissions/community` | access | `CommunitySubmission`                | `PipelineItem`            |
| POST   | `/api/v1/submissions/suggest`   | access | `SuggestSubmission`                  | `PipelineItem`            |

## 4. Mobile screens & navigation

```
submit/
  index.tsx              # type picker
  event.tsx
  community.tsx
  suggest.tsx
  success.tsx
```

Local queue via MMKV; uses `expo-image-picker` + `expo-image-manipulator` for compress/crop.

## 5. Push / Email / Inbox triggers

- Status change → `ORGANIZER_SUBMISSION` topic; admin gets internal email.

## 6. Feature flags

- `submit.image_upload.enabled`

## 7. Observability

- `submit.started{type}`, `submit.completed`, `submit.failed{reason}`, `submit.image_upload.duration_ms`.

## 8. Failure modes & fallbacks

- Upload fails → form retains state; retry CTA; queued offline.
- Backend reject (validation) → field-level error mapping from Zod.

## 9. Test plan

- Unit: form reducer, image compression sizing.
- Contract.
- E2E: submit with image; verify PipelineItem created.

## 10. Rollout plan

GA.

## 11. Backout plan

Disable image upload → text-only submissions still work.
