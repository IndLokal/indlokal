# TDD-0002: Devices + Notifications outbox

- **Status:** Draft
- **Linked PRD:** PRD-0002

## 1. Architecture overview

```
Producers (event/community/pipeline modules)
   │  enqueue(NotificationOutbox row, idempotencyKey)
   ▼
NotificationOutbox (Postgres)
   │
   ▼
Worker (pg-boss) ── filters by NotificationPreference + frequency cap
   │
   ├──► Expo Push  (APNs/FCM)
   ├──► Email      (Resend + React Email templates)
   └──► InboxItem  (DB)
```

## 2. Data model changes

```prisma
enum DevicePlatform { IOS ANDROID WEB }

model Device {
  id             String   @id @default(cuid())
  userId         String   @map("user_id")
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  installationId String   @map("installation_id")    // stable per app install
  platform       DevicePlatform
  expoPushToken  String?  @map("expo_push_token")
  locale         String   @default("en")
  timezone       String   @default("Europe/Berlin")
  appVersion     String?  @map("app_version")
  lastSeenAt     DateTime @default(now()) @map("last_seen_at")
  createdAt      DateTime @default(now()) @map("created_at")
  @@unique([userId, installationId])
  @@index([expoPushToken])
  @@map("devices")
}

enum NotificationTopic {
  CITY_NEW_EVENT
  COMMUNITY_UPDATE
  SAVED_EVENT_REMINDER
  FESTIVAL
  WEEKLY_DIGEST
  ORGANIZER_RSVP
  ORGANIZER_SUBMISSION
  REENGAGEMENT
}
enum NotificationChannel { PUSH EMAIL INBOX }
enum NotificationStatus  { PENDING SENT FAILED SUPPRESSED }

model NotificationPreference {
  userId   String @map("user_id")
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  topic    NotificationTopic
  channel  NotificationChannel
  enabled  Boolean @default(true)
  @@id([userId, topic, channel])
  @@map("notification_preferences")
}

model QuietHours {
  userId   String @id @map("user_id")
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  startMin Int    @default(1320) @map("start_min")  // 22:00
  endMin   Int    @default(480)  @map("end_min")    // 08:00
  timezone String @default("Europe/Berlin")
  @@map("quiet_hours")
}

model NotificationOutbox {
  id             String   @id @default(cuid())
  idempotencyKey String   @unique @map("idempotency_key")
  userId         String   @map("user_id")
  topic          NotificationTopic
  channel        NotificationChannel
  payload        Json     // { title, body, data, emailTemplateId, ... }
  scoreAtEnqueue Float?   @map("score_at_enqueue")  // from modules/scoring
  notBefore      DateTime? @map("not_before")
  status         NotificationStatus @default(PENDING)
  attempts       Int      @default(0)
  lastError      String?  @map("last_error")
  scheduledAt    DateTime @default(now()) @map("scheduled_at")
  sentAt         DateTime? @map("sent_at")
  @@index([status, scheduledAt])
  @@index([userId])
  @@map("notification_outbox")
}

model InboxItem {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  topic     NotificationTopic
  title     String
  body      String
  deepLink  String?  @map("deep_link")
  readAt    DateTime? @map("read_at")
  createdAt DateTime @default(now()) @map("created_at")
  @@index([userId, createdAt])
  @@map("inbox_items")
}
```

## 3. API surface

| Method | Path                                  | Auth   | Request                         | Response                  |
| ------ | ------------------------------------- | ------ | ------------------------------- | ------------------------- |
| POST   | `/api/v1/devices`                     | access | `DeviceRegister`                | `Device`                  |
| PATCH  | `/api/v1/devices/:installationId`     | access | `DeviceUpdate`                  | `Device`                  |
| DELETE | `/api/v1/devices/:installationId`     | access | —                               | `Ack`                     |
| GET    | `/api/v1/notifications/preferences`   | access | —                               | `NotificationPreferences` |
| PUT    | `/api/v1/notifications/preferences`   | access | `NotificationPreferencesUpdate` | `NotificationPreferences` |
| GET    | `/api/v1/notifications/inbox?cursor=` | access | —                               | `InboxPage`               |
| POST   | `/api/v1/notifications/inbox/read`    | access | `{ ids: string[] }`             | `Ack`                     |

## 4. Mobile screens

- Settings → Notifications (PRD-0004).
- Inbox tab (Phase 2 surface; data ready now).

## 5. Push / Email / Inbox triggers

See `EVENTS/notifications.md` for the full matrix and copy.

## 6. Feature flags

- `notifications.outbox.enabled`
- `notifications.channel.push.enabled`
- `notifications.channel.email.enabled`
- `notifications.channel.inbox.enabled`

## 7. Observability

- Counters: `notif.enqueued{topic,channel}`, `notif.sent`, `notif.suppressed{reason=pref|quiet|cap|score}`, `notif.failed`.
- Histogram: `notif.dispatch_latency_ms`.
- Alert: `notif.failed > 1%` over 15 min.

## 8. Failure modes & fallbacks

- Expo push ticket error → mark device token invalid; user falls back to email if enabled.
- Resend outage → retry with exponential backoff up to 6 h; then drop with log.
- Worker crash → pg-boss redelivers; idempotency key prevents duplicates.

## 9. Test plan

- Unit: preference + quiet-hours + cap evaluator.
- Contract: device + preference endpoints.
- Integration: enqueue → worker → mock Expo/Resend → assert exactly-once.
- Load: 10k enqueue burst; worker drains within SLO.

## 10. Rollout plan

- Ship dark with all channel flags off.
- Enable `inbox` first, then `push` for internal devices, then GA.

## 11. Backout plan

- Flip channel flags to false; outbox accumulates and resumes when re-enabled.
