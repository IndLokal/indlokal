# Analytics Event Catalog

All client-emitted analytics events. Every event MUST be defined here before being emitted in code. Names are `snake_case.dot.namespaced`. Properties listed are required unless marked optional.

Sink: PostHog (mobile + web). Server-side critical events also mirrored to internal logs.

## Conventions

Common properties auto-attached by client:

- `app=mobile|web`, `appVersion`, `platform`, `osVersion`, `locale`, `timezone`
- `userId?` (omit if anonymous), `sessionId`, `citySlug?`

## Catalog

### App lifecycle

| Event               | Properties                     | Notes               |
| ------------------- | ------------------------------ | ------------------- |
| `app.opened`        | `coldStart:boolean`            | first frame painted |
| `app.session.start` | —                              | new session window  |
| `app.session.end`   | `durationMs`                   | client-derived      |
| `app.error`         | `code, message, fatal:boolean` | mirrors Sentry      |

### Auth (PRD-0008)

| Event                  | Properties                  |
| ---------------------- | --------------------------- | ------ | ------ |
| `auth.signin.started`  | `method:apple               | google | magic` |
| `auth.signin.success`  | `method, isNewUser:boolean` |
| `auth.signin.failed`   | `method, reason`            |
| `auth.signout`         | —                           |
| `auth.account.deleted` | —                           |

### Discover (PRD-0003)

| Event                   | Properties  |
| ----------------------- | ----------- | ----------- | ------------------- |
| `discover.feed.viewed`  | `tab:events | communities | resources`          |
| `discover.city.changed` | `from, to`  |
| `discover.card.tapped`  | `type:event | community   | resource, rank, id` |
| `discover.refresh`      | `mode:pull  | background` |

### Event detail (PRD-0005)

| Event                    | Properties            |
| ------------------------ | --------------------- | ------ | --------- | --------- |
| `event.detail.viewed`    | `eventId, source:feed | search | community | deeplink` |
| `event.saved`            | `eventId`             |
| `event.unsaved`          | `eventId`             |
| `event.calendar_added`   | `eventId`             |
| `event.shared`           | `eventId, channel?`   |
| `event.register_clicked` | `eventId`             |

### Community detail (PRD-0006)

| Event                      | Properties                 |
| -------------------------- | -------------------------- |
| `community.detail.viewed`  | `communityId, source`      |
| `community.followed`       | `communityId`              |
| `community.unfollowed`     | `communityId`              |
| `community.channel.tapped` | `communityId, channelType` |

### Search (PRD-0007)

| Event                  | Properties                           |
| ---------------------- | ------------------------------------ |
| `search.query`         | `q, hasResults:boolean, resultCount` |
| `search.result.tapped` | `q, rank, type, id`                  |
| `search.zero_result`   | `q`                                  |

### Submit (PRD-0009)

| Event                             | Properties             |
| --------------------------------- | ---------------------- | --------- | -------- |
| `submit.started`                  | `type:event            | community | suggest` |
| `submit.completed`                | `type, pipelineItemId` |
| `submit.failed`                   | `type, reason`         |
| `submit.image_upload.duration_ms` | `bytes`                |

### Notifications (PRD-0002, PRD-0004)

| Event                       | Properties                     |
| --------------------------- | ------------------------------ | ------ | ------------ |
| `push.preprompt.shown`      | `trigger`                      |
| `push.preprompt.accepted`   | `trigger`                      |
| `push.preprompt.declined`   | `trigger`                      |
| `push.permission.os_result` | `result:granted                | denied | provisional` |
| `notif.prefs.changed`       | `topic, channel, enabled`      |
| `notif.received`            | `topic, channel` (server-side) |
| `notif.opened`              | `topic, channel, deepLink`     |

### Resources / Bookmarks / Report (PRD-0010)

| Event              | Properties         |
| ------------------ | ------------------ | ------------ |
| `resources.viewed` | `type`             |
| `resources.tapped` | `resourceId`       |
| `bookmarks.opened` | `tab:events        | communities` |
| `report.submitted` | `entityType, type` |

### Performance

| Event              | Properties                       |
| ------------------ | -------------------------------- |
| `perf.ttfc_ms`     | `screen` (time-to-first-content) |
| `perf.api.latency` | `path, status, durationMs`       |
