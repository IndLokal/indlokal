# Community Claim Flow

---

## Why This Flow Exists

LocalPulse solves a supply-side problem: the directory only has value if community listings are **accurate, active, and event-rich**. Platform staff alone cannot keep up with dozens of communities across multiple cities.

The claim flow converts passive listings into **active, organiser-maintained communities** by giving organisers a concrete reason to engage:

- Their events surface in the city feed — driving real attendance
- Their profile reaches people already searching for communities like theirs
- They gain a verified badge that signals legitimacy to new members

This is not just an admin feature. It is the **primary supply-side growth mechanism**. Claim rate is a leading indicator of directory quality.

**Known gap:** If an organiser never claims, the listing stays valid but static. The platform team fills this gap by seeding events and updates via the admin panel. As claim rate grows, the manual burden drops.

**Known future need:** Once organisers are active, the system needs to show them that the platform is working for them — event views, profile clicks, channel sign-ups. Without this feedback loop, claim rate rises but retention falls. The analytics tab (see Future Enhancements) directly addresses this.

---

## 1. What This Document Covers

How an existing community organiser discovers their community is already listed on LocalPulse, requests ownership, gets reviewed by a platform admin, and gains access to the organiser portal.

**This is a one-time flow per community.** Once complete, ongoing community management is covered in [ORGANIZER_ADMIN_FLOW.md](./ORGANIZER_ADMIN_FLOW.md).

For communities that are _not yet listed_, see [COMMUNITY_SUBMISSION_FLOW.md](./COMMUNITY_SUBMISSION_FLOW.md).

---

## 2. Design Principles

### Claim over Creation

Communities are **pre-seeded by the platform team**. Organisers do not create from scratch — they _claim_ an existing listing. This keeps the directory coherent and prevents low-quality duplicates.

### Low Friction First

The claim form requires only: **name, email, relationship, optional message**. No account creation, no password, no upfront verification.

### Manual Approval at MVP Scale

At current scale (< 100 communities), a human operator reviews each claim at `/admin/claims`. This prevents fraudulent takeovers without any engineering overhead.

### Incentive-Driven Adoption

An organiser claims because they get immediate, tangible value:

- Their community appears **verified** to visitors
- They control the description, channels, and events
- Events they post surface in the city feed — driving real attendance

---

## 3. Step-by-Step Flow

### Step 1 — Discovery

On every community detail page (`/[city]/communities/[slug]`), a `ClaimSection` component is rendered at the bottom. Its content adapts to `claimState`:

| `claimState`    | What the visitor sees                                              |
| --------------- | ------------------------------------------------------------------ |
| `UNCLAIMED`     | "Do you manage this community?" + **Claim this community** button  |
| `CLAIM_PENDING` | Amber badge: "Claim pending review — our team will verify shortly" |
| `CLAIMED`       | Green badge: "✓ Claimed — managed by the community organiser"      |

---

### Step 2 — Claim Form

Clicking **Claim this community** expands an inline form — no page navigation. Fields:

| Field                     | Required | Notes                                                         |
| ------------------------- | -------- | ------------------------------------------------------------- |
| Name                      | Yes      | Claimant's full name                                          |
| Email                     | Yes      | Used to find or create a `User` record                        |
| Relationship to community | Yes      | organizer / co-organizer / admin / member                     |
| Message                   | No       | Free text — additional context                                |
| WhatsApp group link       | No       | `chat.whatsapp.com/...` — admin-invite links are strong proof |
| Telegram group link       | No       | `t.me/...`                                                    |
| Website or social profile | No       | If domain matches claimant email → high-confidence signal     |

The three proof-of-connection fields are grouped under a separate **"Proof of connection"** section in the form, clearly marked optional. They lower review friction: the admin clicks a link rather than reading prose.

---

### Step 3 — Server Action

`claimCommunity()` in `src/app/[city]/communities/[slug]/actions.ts`:

1. Validate via Zod `claimCommunitySchema`
2. Confirm community exists _and_ `claimState === 'UNCLAIMED'` — return error otherwise
3. Find or create `User` by email (role defaults to `USER`)
4. Update `Community`:
   - `claimState → CLAIM_PENDING`
   - `claimedByUserId → user.id`
   - `metadata.claimRequest → { relationship, message, whatsappUrl?, telegramUrl?, socialUrl?, requestedAt }`
5. Create `TrustSignal` with `signalType: COMMUNITY_CLAIMED`

Proof URLs are stored as-is — validation is intentionally loose (valid URL format only). The human reviewer verifies legitimacy by clicking the link.

The form is replaced by the "pending review" amber badge immediately — no page refresh.

---

### Step 4 — Platform Admin Review

An operator visits `/admin/claims`. Per pending claim they see:

- Community name, city, slug
- Claimant name, email, relationship, message
- **Evidence badge row** — up to 3 colour-coded clickable links (WhatsApp, Telegram, Website/Social) with an "Evidence (N/3)" count
- Date requested

The admin verifies by clicking a link: an admin-invite WhatsApp link being active is near-conclusive proof. No evidence provided is also fine — the message field covers that case.

**Approve** → `approveClaim()`:

- `Community.claimState → CLAIMED`
- `User.role → COMMUNITY_ADMIN`
- Creates `TrustSignal` with `signalType: ADMIN_VERIFIED`

**Reject** → `rejectClaim()`:

- `Community.claimState → UNCLAIMED`
- `Community.claimedByUserId → null`

No automated email at MVP — operators contact claimants manually if needed.

---

### Step 5 — Organiser Login

Once approved, the organiser logs in at `/organizer/login`:

1. Enter email → `requestMagicLink()` checks `User.role === 'COMMUNITY_ADMIN'`
   - Intentionally vague error if not found (prevents email enumeration)
2. A 24-hour session token is generated and stored: `User.sessionToken`, `User.sessionTokenExpiry`
3. An access link (`/organizer/verify?token=…`) is shown on-screen
   - **MVP:** displayed on screen, copy/share manually
   - **Production:** delivered by email via Resend or similar
4. Visiting the verify route: validates token → sets `lp_session` HTTP-only cookie → redirects to `/organizer`

---

## 4. State Machine

```
          claim submitted
UNCLAIMED ─────────────────► CLAIM_PENDING
    ▲                               │
    │           rejected            │  approved
    └───────────────────────────────┘
                                    ▼
                                CLAIMED
```

- `CLAIMED` does not revert automatically
- Disputed or fraudulent claims require manual admin action
- Only one pending claim is allowed per community at a time

---

## 5. Data Written

```
Community {
  claimState:       CLAIM_PENDING → CLAIMED
  claimedByUserId:  → User.id
  metadata: {
    claimRequest: {
      relationship, message,
      whatsappUrl?,   // optional — stored if provided
      telegramUrl?,   // optional
      socialUrl?,     // optional
      requestedAt
    }
  }
}

User {
  email (unique)
  role: USER → COMMUNITY_ADMIN  (on approval)
  sessionToken:       <32-byte hex, nullable>
  sessionTokenExpiry: <Date, 24h from login>
}

TrustSignal {
  signalType:  COMMUNITY_CLAIMED  (on submit)
               ADMIN_VERIFIED     (on approval)
  communityId: → Community
  createdBy:   → User.id
}
```

---

## 6. Edge Cases

| Scenario                                            | Behaviour                                                                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Second organiser submits claim while one is pending | Server action blocks with a clear error. Rejected claim resets state to `UNCLAIMED`, freeing the community for a new claim.                                                 |
| Fraudster claims before the real admin              | Admin rejects the fraudulent claim → state resets → real admin re-submits. At < 100 communities with a human reviewer, this is the right resolution. No code change needed. |
| Organiser loses email access                        | 24h tokens expire naturally; organiser contacts platform team to update email via admin interface                                                                           |
| Community never gets claimed                        | Platform team continues seeding events and updates via `/admin`. Listing stays live and accurate. This is expected for some communities indefinitely.                       |
| Community goes inactive after being claimed         | `activityScore` decays (future); `CLAIMED` status is not affected — inactivity affects visibility, not ownership                                                            |

---

## 7. Routes & Files

| Route / Action                     | File                                                 | Purpose                                         |
| ---------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| `GET /[city]/communities/[slug]`   | `src/app/[city]/communities/[slug]/page.tsx`         | Renders `ClaimSection`                          |
| `ClaimSection` component           | `src/app/[city]/communities/[slug]/ClaimSection.tsx` | Inline expand/collapse claim form               |
| `claimCommunity()`                 | `src/app/[city]/communities/[slug]/actions.ts`       | Server Action — submits claim                   |
| `GET /admin/claims`                | `src/app/admin/claims/page.tsx`                      | Platform admin review queue                     |
| `approveClaim()` / `rejectClaim()` | `src/app/admin/actions.ts`                           | Server Actions — approve or reject              |
| `GET /organizer/login`             | `src/app/organizer/login/page.tsx`                   | Magic link login form                           |
| `requestMagicLink()`               | `src/app/organizer/login/actions.ts`                 | Server Action — generate token                  |
| `GET /organizer/verify`            | `src/app/organizer/verify/route.ts`                  | Route handler — validate token, set cookie      |
| Session helper                     | `src/lib/session.ts`                                 | Token generation, cookie read/write, auth guard |
| Zod schema                         | `src/lib/validation.ts`                              | `claimCommunitySchema`                          |

---

## 8. Non-Goals (MVP)

- Email delivery of magic links
- Co-admin / multi-admin management
- Ownership dispute automation
- KYC or identity verification

---

## 9. Future Enhancements

### High priority

- **Email delivery** — magic link + claim status notifications via Resend. Until then, token-on-screen is the correct MVP approach (no friction for the dev, clear "in production this would be emailed" signal).
- **Organiser analytics** — event views, profile clicks, channel sign-up counts surfaced in the organiser dashboard. This is the single most important retention driver: organisers need to see that the platform is growing their community, or they stop engaging. Already listed in `ORGANIZER_ADMIN_FLOW.md` roadmap.

### Medium priority

- **Auto-fast-track** — auto-approve when: (a) claimant email domain matches `socialUrl` domain, or (b) no rival claim exists and all 3 proof links are provided
- **Domain-match confidence signal** — flag claims where `socialUrl` domain === email domain as `HIGH_CONFIDENCE` in the review queue

### Defer

- **Co-admins** — primary admin invites a secondary organiser. Worth building once base claim rate is healthy.
- **Rival claim workflow** — allow multiple simultaneous pending claims with admin arbitration. Only needed if fraudulent-first-claim scenarios become common enough to justify the schema migration. Current reject → re-submit loop is adequate at MVP scale.
