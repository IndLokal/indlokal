# PRD-0016: Outreach CRM module

- **Status:** Draft
- **Owner:** Y (Ops & Community Growth)
- **Reviewers:** JP (Founder), X (Partnerships), Eng Lead
- **Linked:** PRD-0014 (RBAC), PRD-0015 (Ambassador console),
  PRD-0013 (pipeline review)

## 1. Problem

Y's JD makes outreach the core loop: identify Indian communities and student
groups, contact them, onboard them, follow up. Today there is no first-class
"lead" object in the platform. Community contact info lives in a JSON `metadata`
blob, ambassadors track their leads in spreadsheets, and X/Y have no shared
view of "who's been contacted, by whom, last when."

This costs us:

- Duplicate outreach (X and an ambassador both message the same WhatsApp
  group).
- Lost context when an ambassador rotates off.
- No training signal for the AI pipeline (every onboarded community should
  feed back as a positive label).
- No measurable funnel for the success metrics in either JD.

## 2. Users & JTBD

- **Y (Ops Lead)** — owns the master pipeline, runs cadence, reports
  funnel.
- **X (Partnerships Lead)** — owns higher-touch partner orgs (Consulate,
  GTAI, universities); needs a private slice.
- **City Ambassador** — owns local leads; needs a city-scoped lane.
- **JP (Founder)** — wants weekly funnel snapshots without DM threads.

## 3. Success Metrics

- ≥ 50 active leads in CRM by end of month 2 with weekly stage progression.
- Onboarded-community rate (lead → `OutreachStage = ONBOARDED`) ≥ 15 % over
  rolling 90 d.
- 0 % of onboarded communities have no provenance (every onboarded community
  references the lead it came from).
- Analytics events: `outreach.lead.created`, `outreach.lead.stage_changed`,
  `outreach.lead.note_added`, `outreach.lead.onboarded`.

## 4. Scope

New Prisma models:

```prisma
enum OutreachStage {
  NEW
  RESEARCHING
  CONTACTED
  IN_CONVERSATION
  ONBOARDED
  DECLINED
  DORMANT
}

model OutreachLead {
  id            String    @id @default(cuid())
  cityId        String
  city          City      @relation(...)
  communityId   String?   // set when matched/created
  community     Community?
  suggestedName String?
  channelHint   String?   // WA link, IG handle, email
  ownerUserId   String    // assigned operator
  source        String    // 'ambassador' | 'pipeline' | 'manual' | 'partner'
  stage         OutreachStage @default(NEW)
  nextActionAt  DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  notes         OutreachNote[]
  @@index([cityId, stage])
  @@index([ownerUserId, stage])
}

model OutreachNote {
  id        String       @id @default(cuid())
  leadId    String
  lead      OutreachLead @relation(...)
  authorId  String
  body      String
  createdAt DateTime     @default(now())
}
```

Surfaces:

- `/admin/outreach` — kanban (stage columns) + table view, filter by city,
  owner, source. Visible to `OPS_LEAD`, `PARTNERSHIPS_LEAD`, `PLATFORM_ADMIN`.
- `/ambassador/outreach` — same module, scoped to assignment city +
  ambassador's own leads.
- Lead detail drawer: meta · notes timeline · "promote to community" action
  (creates / links a `Community` and stamps `lead.communityId`).
- Pipeline integration: when a `PipelineItem` is APPROVED and creates a
  community, if a matching lead exists (`suggestedName` similarity ≥ 0.7) it
  is auto-linked + advanced to `ONBOARDED`.
- Weekly digest email to Y + JP: per-stage counts, week-over-week.

## 5. Out of Scope

- Email send/receive integration (no inbox, no IMAP). Operators send via
  WhatsApp / personal email; the CRM tracks notes only.
- Bulk import from Notion / Airtable spreadsheets in v1 (manual seed CSV is
  enough — see Risks).
- Sequencing / drip campaigns.
- File attachments on notes (use Markdown links to Drive).

## 6. User Stories

- As **Y**, I open `/admin/outreach`, drag a lead from `CONTACTED` to
  `IN_CONVERSATION`; the change is logged and a `stage_changed` event fires.
- As an **ambassador**, when I submit a community via `/ambassador/submit`,
  I am asked "is this a lead you've been talking to?" — yes prompts me to
  link an existing `OutreachLead` (same city, my ownership) or create one.
- As **X**, I see only leads I own or where `source = 'partner'`.
- As **JP**, the Monday digest tells me how many leads moved stages last
  week and what the onboarded-rate is.

## 7. Acceptance Criteria (Gherkin)

```
Given an ambassador with cityScope=stuttgart
When they open /ambassador/outreach
Then only leads with cityId=stuttgart AND ownerUserId=self are listed

Given an ops lead drags a lead card from CONTACTED to IN_CONVERSATION
Then lead.stage = IN_CONVERSATION
And ContentLog records action=outreach.lead.stage_changed

Given a pipeline item is approved and creates a community
And there is an OutreachLead in the same city with name similarity ≥ 0.7
Then lead.communityId = newCommunity.id
And lead.stage = ONBOARDED
And an outreach.lead.onboarded event is emitted

Given a user without OPS_LEAD/PARTNERSHIPS_LEAD/PLATFORM_ADMIN
When they GET /admin/outreach
Then they receive 403
```

## 8. UX

- Kanban with collapsible columns; row count per column.
- Quick filter chips: city · owner · source · age (>14d, >30d).
- Lead drawer: editable next-action date with calendar picker; notes appended
  newest-first with author avatar.
- Empty state: "No leads yet — import a CSV or add your first lead."

## 9. Risks & Open Questions

- Privacy: lead `channelHint` may be a personal WhatsApp number. We restrict
  visibility to lead `ownerUserId` + `OPS_LEAD` + `PLATFORM_ADMIN`, redact in
  any analytics export.
- Should declined leads auto-revive after 6 months as `DORMANT`? Default:
  yes, via cron, but not v1.
- One-time CSV seed importer: build it as a small admin tool now or leave to
  the operator with a SQL snippet? Default: provide an `npm run
outreach:import` script reading `outreach_seed.csv`, no UI in v1.
- Conflict resolution when two operators edit the same lead (last-write-wins
  v1; consider optimistic locking after first conflict report).
