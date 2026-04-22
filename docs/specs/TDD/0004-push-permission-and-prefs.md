# TDD-0004: Push permission + preferences UI

- **Status:** Draft
- **Linked PRD:** PRD-0004
- **Depends on:** TDD-0001, TDD-0002

## 1. Architecture overview

- Mobile-only; backend is TDD-0002.
- Hook `usePushPermission()` in `apps/mobile/lib/notifications.ts`:
  - On `requestPermission()` calls `Notifications.requestPermissionsAsync()`, then `Notifications.getExpoPushTokenAsync()`, then `POST /api/v1/devices`.
- Pre-prompt component shown via Zustand `pushPromptStore` — opens once per install per trigger event, dismiss state persisted.

## 2. Data model changes

None beyond TDD-0002.

## 3. API surface

Reuses TDD-0002 endpoints.

## 4. Mobile screens & navigation

```
settings/
  notifications.tsx       # topic × channel matrix
  notifications/quiet-hours.tsx
inbox/
  index.tsx
```

## 5. Push / Email / Inbox triggers

This TDD only consumes them.

## 6. Feature flags

- `mobile.push.preprompt.enabled`
- `mobile.push.preprompt.triggers` (array: `save_event`, `follow_community`, `rsvp`)

## 7. Observability

- `push.preprompt.shown{trigger}`, `push.preprompt.accepted`, `push.preprompt.declined`.
- `push.permission.os_result{granted|denied|provisional}`.
- `notif.prefs.changed{topic,channel,enabled}`.

## 8. Failure modes & fallbacks

- OS denies permission → mark device with `expoPushToken=null`; show value-led re-ask card in Inbox after 14 days.
- Token registration fails → retry with exponential backoff; cache token locally.

## 9. Test plan

- Unit: prompt eligibility logic.
- E2E (Detox): save → prompt → grant → device row exists.
- Manual: iOS provisional path.

## 10. Rollout plan

- Behind `mobile.push.preprompt.enabled` to 10 % of installs first; measure opt-in delta vs. control.

## 11. Backout plan

- Disable flag; OS prompt then fires lazily on first notification subscription.
