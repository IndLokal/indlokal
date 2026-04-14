# Community Self-Submission Flow

---

## 1. Overview

The **Community Self-Submission Flow** allows a community organiser whose community is _not yet listed_ on LocalPulse to submit it for review. It is distinct from the Claim Flow:

| Flow                | Precondition                             | Use case                                      |
| ------------------- | ---------------------------------------- | --------------------------------------------- |
| **Self-Submission** | Community does not exist in the platform | Brand new listing request                     |
| **Claim**           | Community already exists (pre-seeded)    | Organiser takes ownership of existing listing |

Both flows converge at admin review and result in an approved, organiser-managed community. Neither allows self-publishing without oversight.

---

## 2. Design Principles

### 2.1 Quality over Volume

A manually reviewed submission pipeline ensures the directory maintains quality. A community with bad data, a dead link, or a duplicate entry degrades trust for all users. Every submission is a gate-kept write to the community graph.

### 2.2 Minimal Upfront Investment

The form collects the minimum viable profile. The organiser is not asked to write a perfect description or upload a logo on day one. They can complete those via the organiser portal after approval.

### 2.3 Submission ≠ Account

Submitting a community does not create an organiser account. The user fills a form, submits, and waits. When the platform approves the submission, the submitter's email is automatically upgraded to `COMMUNITY_ADMIN`. This avoids "empty account" accumulation from submissions that never get approved.

### 2.4 Transparent Status

After submission the user sees a clear confirmation: "under review, typically approved within a few days." No dark patterns, no ghost silences.

---

## 3. Entry Points

A visitor can reach the submission form from three places:

1. **City nav bar** — "+ Submit" button (top right, every city page)
2. **Communities listing page** — "Don't see your community? Submit it" callout (future)
3. **Direct URL** — `/submit` (linkable, in sitemap with `changeFrequency: monthly`)

---

## 4. End-to-End Submission Flow

### Step 1 — Form Completion (`/submit`)

The submission page (`src/app/submit/page.tsx`) is a server component that:

- Fetches active cities and all categories from the DB
- Passes them as props to `SubmitForm` (client component)

The form is grouped into four sections:

#### Section A — Community Details

| Field             | Required | Validation                |
| ----------------- | -------- | ------------------------- |
| Community name    | Yes      | 2–200 chars               |
| Short description | Yes      | 10–2 000 chars            |
| City              | Yes      | Dropdown of active cities |

#### Section B — Classification

| Field      | Required  | Notes                                                   |
| ---------- | --------- | ------------------------------------------------------- |
| Categories | Yes (≥ 1) | 11 available: Cultural, Sports, Professional, etc.      |
| Languages  | No        | 13 options: Hindi, Telugu, Tamil, German, English, etc. |

#### Section C — Access Channels

| Field                  | Required | Notes                                                                                              |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| Primary channel type   | Yes      | WHATSAPP / TELEGRAM / WEBSITE / FACEBOOK / INSTAGRAM / EMAIL / MEETUP / YOUTUBE / LINKEDIN / OTHER |
| Primary channel URL    | Yes      | Validated as URL                                                                                   |
| Secondary channel type | No       | Optional second entry point                                                                        |
| Secondary channel URL  | No       | Required if type is supplied                                                                       |

#### Section D — Contact Information

| Field      | Required | Notes                                                                        |
| ---------- | -------- | ---------------------------------------------------------------------------- |
| Your name  | Yes      | Submitter's full name                                                        |
| Your email | Yes      | Used as `metadata.submitter.email`; later linked to user account on approval |

### Step 2 — Server Action

`submitCommunity()` in `src/app/submit/actions.ts`:

1. Validate full form via Zod `submitCommunitySchema`
2. Resolve city by `citySlug` — return error if not active
3. Generate unique URL slug from community name using `slugify` (timestamp suffix on collision)
4. Resolve category IDs from slugs
5. Create `Community` with:
   - `status: UNVERIFIED`
   - `claimState: UNCLAIMED`
   - `source: COMMUNITY_SUBMITTED`
   - `metadata.submitter: { name, email, submittedAt }`
6. Create `AccessChannel` rows (primary + optional secondary)

On success, the form is replaced with a confirmation message: community name is shown, and the user is told to expect review within a few days.

### Step 3 — Platform Admin Review

An operator visits `/admin/submissions`. For each `UNVERIFIED` community they see:

- Community name, city, submission date
- Submitter name and email
- Short description
- Category tags
- Access channel links (clickable to verify they work)

**Approve** → `approveSubmission()`:

- `Community.status → ACTIVE`
- Creates `TrustSignal` with `signalType: ADMIN_VERIFIED`
- Revalidates `/admin/submissions`

**Reject** → `rejectSubmission()`:

- `Community.status → INACTIVE`
- Revalidates `/admin/submissions`

Community remains in the DB in either state. `INACTIVE` communities are not visible in discovery. A platform admin can manually reactivate if context changes.

### Step 4 — Organiser Account Activation (Post-Approval)

After the submission is approved, the submitter's email is not automatically promoted — they still need to **claim** the community they submitted. This is intentional:

1. The newly approved `ACTIVE` community has `claimState: UNCLAIMED`
2. The submitter visits their community page, sees the ClaimSection, and submits a claim
3. Because their email was the original submitter, the admin can cross-reference and fast-approve
4. On claim approval: `User.role → COMMUNITY_ADMIN`
5. The organiser can now log in to the organiser portal

_Future:_ auto-approve claim for the original submitter email, shortcutting the manual step.

---

## 5. Data Created on Submission

```
Community {
  name: "HSS Stuttgart"
  slug: "hss-stuttgart"
  cityId: <Stuttgart city ID>
  status: UNVERIFIED
  claimState: UNCLAIMED
  source: COMMUNITY_SUBMITTED
  metadata: {
    submitter: { name: "Rahul Sharma", email: "rahul@example.com", submittedAt: "..." }
  }
}

CommunityCategory[] — one row per selected category

AccessChannel {
  channelType: WHATSAPP
  url: "https://chat.whatsapp.com/..."
  isPrimary: true
}
```

---

## 6. Validation Rules

All validation lives in `src/lib/validation.ts` as the `submitCommunitySchema` Zod schema.

| Rule                  | Detail                                                                     |
| --------------------- | -------------------------------------------------------------------------- |
| Name uniqueness       | Not enforced at schema level; admin reviewer spot-checks for duplicates    |
| Channel URL validity  | Validated as URL by Zod; channel reachability is not tested at submit time |
| Duplicate submission  | No hard block; admin reviewer merges/deduplicates manually at MVP          |
| City must be active   | Server-side check; returns field error if city slug is inactive            |
| Categories must exist | Server-side resolution; invalid slugs are silently dropped                 |

---

## 7. Status Lifecycle

```
Form submitted
      ↓
UNVERIFIED ──────────► ACTIVE   (approved by admin)
                │
                └──────► INACTIVE  (rejected by admin)
                │
                └──────► ACTIVE   (admin manually un-rejects later)
```

`UNVERIFIED` communities are not visible in any discovery feed or search results. They only appear in `/admin/submissions`.

---

## 8. Submission vs. Claim — Decision Guide

Use this to help an organiser choose the right path:

```
Is your community already listed on LocalPulse?
│
├─ YES → Use the Claim Flow
│        (Claim button on the community detail page)
│
└─ NO  → Use the Self-Submission Flow
         (/submit or "+ Submit" in the nav)
```

---

## 9. Routes & Files Reference

| Route                    | File                                 | Purpose                                         |
| ------------------------ | ------------------------------------ | ----------------------------------------------- |
| `GET /submit`            | `src/app/submit/page.tsx`            | Server wrapper — fetches cities + categories    |
| Client form              | `src/app/submit/SubmitForm.tsx`      | Multi-section submission form                   |
| `Server Action`          | `src/app/submit/actions.ts`          | `submitCommunity()`                             |
| `GET /admin/submissions` | `src/app/admin/submissions/page.tsx` | Platform review queue                           |
| `Server Actions`         | `src/app/admin/actions.ts`           | `approveSubmission()`, `rejectSubmission()`     |
| Validation schemas       | `src/lib/validation.ts`              | `submitCommunitySchema`, `claimCommunitySchema` |

---

## 10. Non-Goals (MVP)

- Duplicate detection or fuzzy-match prevention (handled manually by admin reviewer)
- Auto-approval for trusted submitters
- Bulk submission (one community per form)
- Image / logo upload at submission time
- Email notifications to submitter on approval or rejection
- Auto-claim for the original submitter

---

## 11. Future Enhancements

- **Auto-claim on approval** — first-time submitter is automatically promoted to `COMMUNITY_ADMIN` when their submission is approved, bypassing the separate claim step
- **Email notifications** — notify submitter when approved/rejected once email delivery is integrated
- **Duplicate prevention** — fuzzy name matching against existing communities during submission to surface likely duplicates
- **Logo upload** — image upload at submission time, stored in object storage
- **Submission queue prioritisation** — rank submissions by city activity, completeness, and submitter engagement for faster high-value approvals
- **Bulk seeding interface** — admin form for adding multiple communities from a spreadsheet
