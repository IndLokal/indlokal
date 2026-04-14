# Organiser Admin Flow

---

## 1. What This Document Covers

The ongoing operational loop for a community organiser who has already **claimed** their community and received `COMMUNITY_ADMIN` role. This covers: logging in, managing community details, managing channels, posting events, and logging out.

For the one-time claim process, see [COMMUNITY_CLAIM_FLOW.md](./COMMUNITY_CLAIM_FLOW.md).

---

## 2. Authentication Model

LocalPulse uses a **sessionless, token-in-cookie** approach — no third-party auth library.

| Concern       | Implementation                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token storage | `User.sessionToken` (32-byte hex), `User.sessionTokenExpiry` (Date) stored in PostgreSQL                                                                  |
| Cookie        | `lp_session` — HTTP-only, SameSite=Lax, 24h max-age                                                                                                       |
| Guard         | `requireSessionUser()` in `src/lib/session.ts` — reads cookie, looks up user + claimed communities, redirects to `/organizer/login` if invalid or expired |
| Logout        | POST to `/organizer/logout` — clears `lp_session` cookie + nulls token in DB                                                                              |

Login trigger: visiting `/organizer/login` → `requestMagicLink()` → verify link displayed on screen → visiting `/organizer/verify?token=…` → cookie set → redirect to `/organizer`.

---

## 3. Dashboard (`/organizer`)

The dashboard is the post-login landing page. It shows:

**Profile Completeness Meter**
Checks 8 fields and shows a percentage bar:

- `name` (always filled)
- `description`, `descriptionLong`, `logoUrl`, `bannerUrl`, `websiteUrl`
- `languages` (non-empty array)
- `memberCountApprox`

**Quick-Action Cards**
Three cards linking to the three management sections: Edit Profile, Manage Channels, Add Event.

**Channel List**
Current channels (type + handle) with a direct link into the Channels editor.

**Public Page Link**
Deeplink to the community's public page on LocalPulse so the organiser can preview what visitors see.

---

## 4. Edit Profile (`/organizer/edit`)

### Fields

| Field                | DB Column           | Validation                                    |
| -------------------- | ------------------- | --------------------------------------------- |
| Community Name       | `name`              | Non-empty string                              |
| Short Description    | `description`       | Optional                                      |
| Full Description     | `descriptionLong`   | Optional                                      |
| Languages            | `languages`         | Array of strings; comma-separated in the form |
| Founded Year         | `foundedYear`       | Optional integer                              |
| Approx. Member Count | `memberCountApprox` | Optional integer                              |

`logoUrl` and `bannerUrl` are intentionally excluded from the self-service form (media upload is a future feature). They can be set by a platform admin.

### Server Action: `editCommunityProfile()`

Located in `src/app/organizer/edit/actions.ts`:

1. `requireSessionUser()` → verify session + ownership
2. Confirm the submitted `communityId` is in `user.claimedCommunities`
3. Update `Community` with validated fields
4. Create `ActivitySignal` with `signalType: PROFILE_UPDATED`
5. Return success state displayed in the form

---

## 5. Channels (`/organizer/channels`)

### Available Channel Types

`WHATSAPP`, `TELEGRAM`, `INSTAGRAM`, `FACEBOOK`, `YOUTUBE`, `LINKEDIN`, `EMAIL`, `WEBSITE`, `OTHER`

### Add Channel: `addChannel()`

Located in `src/app/organizer/channels/actions.ts`:

1. `requireSessionUser()` + ownership check
2. Validate channel type and handle
3. If `isPrimary: true` is requested → unset all existing `isPrimary` flags first (one primary channel per community)
4. Create new `Channel` record
5. Return updated channel list

### Delete Channel: `deleteChannel()`

Located in `src/app/organizer/channels/actions.ts`:

1. `requireSessionUser()` + ownership check
2. Verify the `Channel.communityId` matches the organiser's community (prevents cross-community deletions)
3. Delete channel

---

## 6. Add Event (`/organizer/events/new`)

### Fields

| Field              | Required | Notes                                         |
| ------------------ | -------- | --------------------------------------------- |
| Title              | Yes      | Used as the event name                        |
| City               | Yes      | Dropdown from organiser's claimed communities |
| Start Date & Time  | Yes      | ISO datetime                                  |
| End Date & Time    | No       | Optional                                      |
| Venue / Address    | No       | Free text                                     |
| Is Online?         | No       | Boolean checkbox                              |
| Description        | No       | Long-form text                                |
| Featured Image URL | No       | Direct URL; upload not supported at MVP       |
| RSVP / Ticket URL  | No       | External link                                 |

### Server Action: `addEvent()`

Located in `src/app/organizer/events/new/actions.ts`:

1. `requireSessionUser()` + ownership check on submitted `communityId`
2. Validate all fields via Zod schema
3. Generate URL slug from title + date
4. Create `Event` record:
   - `source: COMMUNITY_SUBMITTED`
   - `status: UPCOMING`
   - `communityId` → organiser's community
5. Create `ActivitySignal` with `signalType: EVENT_CREATED`
6. Redirect to the new event page

---

## 7. Activity Signals

| Signal            | Triggered By             | Purpose                                                         |
| ----------------- | ------------------------ | --------------------------------------------------------------- |
| `PROFILE_UPDATED` | `editCommunityProfile()` | Records that a human organiser actively maintains the profile   |
| `EVENT_CREATED`   | `addEvent()`             | Records community activity; feeds into `activityScore` (future) |

---

## 8. Permission Boundaries

| Action                     | Who can do it                                 | Guard location                                         |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| View organiser portal      | Any `COMMUNITY_ADMIN` with valid session      | `requireSessionUser()`                                 |
| Edit a community's profile | Only the `claimedByUserId` matching organiser | `communityId in user.claimedCommunities` check         |
| Delete a channel           | Only the organiser who owns that community    | `Channel.communityId` cross-check in `deleteChannel()` |
| Post an event              | Only the community's organiser                | `communityId` ownership check                          |
| Approve / reject claims    | Platform admin only                           | Separate `/admin/*` routes, no organiser access        |
| Seed communities           | Platform team only                            | No self-service route                                  |

---

## 9. Routes & Files

| Route / Action                     | File                                            | Purpose                                                              |
| ---------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `GET /organizer/login`             | `src/app/organizer/login/page.tsx`              | Magic link login form                                                |
| `requestMagicLink()`               | `src/app/organizer/login/actions.ts`            | Server Action — generate token                                       |
| `GET /organizer/verify`            | `src/app/organizer/verify/route.ts`             | Route handler — validate token, set cookie                           |
| `POST /organizer/logout`           | `src/app/organizer/logout/route.ts`             | Route handler — clear cookie + null token                            |
| Layout + nav header                | `src/app/organizer/layout.tsx`                  | Auth-aware nav (Overview, Edit Profile, Channels, Add Event)         |
| `GET /organizer`                   | `src/app/organizer/page.tsx`                    | Dashboard — completeness meter, quick-actions, channels, public link |
| `GET /organizer/edit`              | `src/app/organizer/edit/page.tsx`               | Edit profile page                                                    |
| `EditProfileForm`                  | `src/app/organizer/edit/EditProfileForm.tsx`    | Form component (`useActionState`)                                    |
| `editCommunityProfile()`           | `src/app/organizer/edit/actions.ts`             | Server Action — update community fields                              |
| `GET /organizer/channels`          | `src/app/organizer/channels/page.tsx`           | Channels manager page                                                |
| `ChannelsForm`                     | `src/app/organizer/channels/ChannelsForm.tsx`   | Form component — add/delete channels                                 |
| `addChannel()` / `deleteChannel()` | `src/app/organizer/channels/actions.ts`         | Server Actions — channel management                                  |
| `GET /organizer/events/new`        | `src/app/organizer/events/new/page.tsx`         | Add event page                                                       |
| `AddEventForm`                     | `src/app/organizer/events/new/AddEventForm.tsx` | Form component                                                       |
| `addEvent()`                       | `src/app/organizer/events/new/actions.ts`       | Server Action — create event                                         |
| Session helper                     | `src/lib/session.ts`                            | Token generation, cookie read/write, auth guard                      |

---

## 10. Non-Goals (MVP)

- Logo / banner image upload
- Event editing or deletion via the portal
- Recurring events
- Analytics or view/RSVP counts
- Co-admin invitation
- Role-based permissions within a single community (e.g., "event poster only")

---

## 11. Future Enhancements

- **Analytics tab** — views, event RSVPs, channel click-throughs
- **Event editing** — `/organizer/events/[id]/edit`
- **Recurring events** — weekly / monthly cadence with auto-expansion
- **Co-admin invite** — primary admin sends magic link to a secondary manager
- **Media upload** — S3/R2-backed logo and banner upload in the edit form
- **Community transfer** — admin-mediated handover to a new organiser
