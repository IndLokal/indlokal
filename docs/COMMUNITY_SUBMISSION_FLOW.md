# Community Self-Submission Flow

---

## 1. Overview

The **Community Self-Submission Flow** allows a community organiser whose community is _not yet listed_ on IndLokal to submit it for review. It is distinct from the Claim Flow:

| Flow                | Precondition                             | Use case                             |
| ------------------- | ---------------------------------------- | ------------------------------------ |
| **Self-Submission** | Community does not exist in the platform | Brand new listing request            |
| **Claim**           | Community already exists (pre-seeded)    | Organiser claims an existing listing |

Both flows converge at admin review and result in an approved, organiser-managed community. Neither allows self-publishing without oversight.

If the community already exists on IndLokal, the user should claim it instead. If the listing is missing entirely but should exist, the user should use the suggest flow.

---

## 2. Design Principles

### 2.1 Quality over Volume

A manually reviewed submission pipeline ensures the directory maintains quality. A community with bad data, a dead link, or a duplicate entry degrades trust for all users. Every submission is a gate-kept write to the community graph.

> How submitted sources are classified (strong vs weak vs not-evidence) and what each
> class is allowed to unlock is defined by the
> [Source & Evidence Policy](./SOURCE_AND_EVIDENCE_POLICY.md). "Broad discovery + strict
> verification": weak public sources can still be listed for discovery; only strong
> evidence supports a verified/trusted status.

### 2.2 Minimal Upfront Investment

The form collects the minimum viable profile. The organiser is not asked to write a perfect description or upload a logo on day one. They can complete those via the organiser portal after approval.

### 2.3 Submission ≠ Self-Publishing

Submitting a community does not publish it directly. The user fills a form, submits, and
waits for admin review. What the submitter gets on approval depends on the **relationship
they declare** at submit time, not on a separate reviewer choice:

- **"I am one of the organizers"** → on approval the submitter becomes the **organizer**.
- **"I am sharing a community I know about"** → the community is published but stays **unclaimed and claimable**;
  the submitter keeps no community authority.
- **"I am sharing a community I know about" + suggests an organizer** → published and claimable, and the
  platform **invites the suggested person to claim**. A named third party is never
  auto-granted authority — they must claim and be verified.

### 2.4 Transparent Status

After submission the user sees a clear confirmation: "under review, typically approved within a few days." No dark patterns, no ghost silences.

---

## 3. Entry Points

A visitor can reach the submission form from three places:

1. **City nav bar** - "+ Submit" button (top right, every city page)
2. **Communities listing page** - "Don't see your community? Submit it" callout (future)
3. **Direct URL** - `/submit` (linkable, in sitemap with `changeFrequency: monthly`)

---

## 4. End-to-End Submission Flow

### Step 1 - Form Completion (`/submit`)

The submission page (`src/app/submit/page.tsx`) is a server component that:

- Fetches active cities and all categories from the DB
- Passes them as props to `SubmitForm` (client component)

The form is grouped into four sections:

#### Section A - Community Details

| Field             | Required | Validation                |
| ----------------- | -------- | ------------------------- |
| Community name    | Yes      | 2-200 chars               |
| Short description | Yes      | 10-2 000 chars            |
| City              | Yes      | Dropdown of active cities |

#### Section B - Classification

| Field      | Required  | Notes                                                   |
| ---------- | --------- | ------------------------------------------------------- |
| Categories | Yes (≥ 1) | 11 available: Cultural, Sports, Professional, etc.      |
| Languages  | No        | 13 options: Hindi, Telugu, Tamil, German, English, etc. |

#### Section C - Access Channels

| Field                  | Required | Notes                                                                                              |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| Primary channel type   | Yes      | WHATSAPP / TELEGRAM / WEBSITE / FACEBOOK / INSTAGRAM / EMAIL / MEETUP / YOUTUBE / LINKEDIN / OTHER |
| Primary channel URL    | Yes      | Validated as URL                                                                                   |
| Secondary channel type | No       | Optional second entry point                                                                        |
| Secondary channel URL  | No       | Required if type is supplied                                                                       |

#### Section D - Contact Information & Relationship

| Field                            | Required | Notes                                                                                                                          |
| -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Your name                        | Yes      | Submitter's full name                                                                                                          |
| Your email                       | Yes      | Used as `metadata.submitter.email`                                                                                             |
| Your relationship                | Yes      | "I am one of the organizers" → organizer on approval; "I am sharing a community I know about" → published & claimable          |
| Suggested organizer (name/email) | No       | Only for "I am sharing a community I know about": the platform invites this person to claim — it does not grant them authority |

### Step 2 - Server Action

`submitCommunity()` in `src/app/submit/actions.ts`:

1. Validate full form via Zod `submitCommunitySchema`
2. Resolve city by `citySlug` - return error if not active
3. Run duplicate-name similarity check against active communities in target city (reject if too similar)
4. Generate unique URL slug from community name using `slugify` (timestamp suffix on collision)
5. Resolve category IDs from slugs
6. Create `Community` with:
   - `status: UNVERIFIED`
   - `claimState: UNCLAIMED`
   - `source: COMMUNITY_SUBMITTED`

- `metadata.submitter: { name, email, relationship, suggestedOrganizer?, submittedAt }`

6. Create `AccessChannel` rows (primary + optional secondary)
7. Send submission-received email (best-effort)

On success, the form is replaced with a confirmation message: community name is shown, and the user is told to expect review within a few days.

### Step 3 - Platform Admin Review

An operator visits `/admin/submissions`. For each `UNVERIFIED` community they see:

- Community name, city, submission date
- Submitter name and email
- Short description
- Category tags
- Access channel links (clickable to verify they work)

**Approve** → `approveSubmission()`:

- `Community.status → ACTIVE`
- Outcome follows the submitter's **declared relationship** (not a separate reviewer grant):
  - **"I am one of the organizers"**: `Community.claimState → CLAIMED`, `claimedByUserId → submitter user`,
    submitter user created/upgraded to organizer access if needed; creates a
    `COMMUNITY_CLAIMED` trust signal.
  - **"I am sharing a community I know about"**: `Community.claimState → UNCLAIMED` — published and claimable.
  - **Suggested organizer provided**: stays `UNCLAIMED`, and the suggested person is invited
    to claim.
- Creates `TrustSignal` with `signalType: ADMIN_VERIFIED`
- Sends approval email (best-effort) with conditional CTA:
  - If submitter became organizer: organizer dashboard link
  - Else: claim-community CTA (sent to the submitter, and to the suggested organizer if named)
- Revalidates admin + public community routes

**Reject** → `rejectSubmission()`:

- `Community.status → INACTIVE`
- Revalidates `/admin/submissions`

Community remains in the DB in either state. `INACTIVE` communities are not visible in discovery. A platform admin can manually reactivate if context changes.

### Step 4 - Organiser Access After Approval

After approval, the outcome follows the relationship the submitter declared on the form:

1. **"I am one of the organizers"**:

- community becomes `ACTIVE + CLAIMED`
- submitter gets organizer access
- submitter can log in to the organizer portal

2. **"I am sharing a community I know about"**:

- community becomes `ACTIVE + UNCLAIMED`
- submitter keeps no authority and can still claim later via the Claim Flow
- if a suggested organizer was named, that person is invited to claim

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
    submitter: {
      name: "Rahul Sharma",
      email: "rahul@example.com",
      relationship: "HELP_RUN" | "JUST_ADDING",  // internal enum values backing the user-facing options
      suggestedOrganizer?: { name, email },  // only for "just adding"
      submittedAt: "..."
    }
  }
}

CommunityCategory[] - one row per selected category

AccessChannel {
  channelType: WHATSAPP
  url: "https://chat.whatsapp.com/..."
  isPrimary: true
}
```

Note: `HELP_RUN` is an internal storage value; in the form, users see the plain-language option "I am one of the organizers."

---

## 6. Validation Rules

All validation lives in `src/lib/validation.ts` as the `submitCommunitySchema` Zod schema.

| Rule                  | Detail                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Name uniqueness       | Not enforced at schema level; server uses similarity guard against likely duplicates     |
| Channel URL validity  | Validated as URL by Zod; channel reachability is not tested at submit time               |
| Duplicate submission  | Hard block when similarity to existing active name in city is above configured threshold |
| City must be active   | Server-side check; returns field error if city slug is inactive                          |
| Categories must exist | Server checks all selected categories resolve; mismatches return field error             |

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

## 8. Submission vs. Claim - Decision Guide

Use this to help an organiser choose the right path:

```
Is your community already listed on IndLokal?
│
├─ YES → Use the Claim Flow
│        (Claim button on the community detail page)
│
└─ NO  → Use the Self-Submission Flow
         (/submit or "+ Submit" in the nav)
```

---

## 9. Routes & Files Reference

| Route                    | File                                             | Purpose                                         |
| ------------------------ | ------------------------------------------------ | ----------------------------------------------- |
| `GET /submit`            | `src/app/submit/page.tsx`                        | Server wrapper - fetches cities + categories    |
| Client form              | `src/app/submit/SubmitForm.tsx`                  | Multi-section submission form                   |
| `Server Action`          | `src/app/submit/actions.ts`                      | `submitCommunity()`                             |
| `GET /admin/submissions` | `src/app/admin/(dashboard)/submissions/page.tsx` | Platform review queue                           |
| `Server Actions`         | `src/app/admin/(dashboard)/actions.ts`           | `approveSubmission()`, `rejectSubmission()`     |
| Validation schemas       | `src/lib/validation.ts`                          | `submitCommunitySchema`, `claimCommunitySchema` |

---

## 10. Non-Goals (MVP)

- Fully automated duplicate resolution (there is already a server-side similarity block + admin review)
- Auto-approval for trusted submitters
- Bulk submission (one community per form)
- Image / logo upload at submission time
- Auto-approval without admin review

---

## 11. Future Enhancements

- **Rejected-submission email** - notify submitter explicitly when a submission is rejected
- **Relationship evidence capture** - require stronger proof when the submitter declares they help run the community
- **Duplicate prevention** - fuzzy name matching against existing communities during submission to surface likely duplicates
- **Logo upload** - image upload at submission time, stored in object storage
- **Submission queue prioritisation** - rank submissions by city activity, completeness, and submitter engagement for faster high-value approvals
- **Bulk seeding interface** - admin form for adding multiple communities from a spreadsheet
