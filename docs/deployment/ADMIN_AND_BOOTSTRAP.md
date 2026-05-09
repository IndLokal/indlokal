# Admin & Data Bootstrap

The IndLokal database is split into three seed tiers:

| Tier          | Script                           | Contents                                                                                       | Run when                                        |
| ------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Bootstrap** | `pnpm --filter web db:bootstrap` | Cities, Categories, Personas, **Admin user** (required)                                        | Every deploy (idempotent, gated by env flag)    |
| **Directory** | `pnpm --filter web db:directory` | Curated public communities per metro **and** curated public resources (consulates, registries) | Every deploy (create-only idempotent, gated)    |
| **Demo**      | `pnpm --filter web db:seed`      | Sample events + score recompute (calls Bootstrap + Directory first)                            | Local dev / staging only — **never production** |

Resources live in [`apps/web/prisma/resources.ts`](../../apps/web/prisma/resources.ts)
and are orchestrated by `runDirectorySeed()` so the directory tier always
delivers a complete public-content baseline (orgs + resources) per city.

> The single source of truth for cities + taxonomy is
> [`apps/web/src/lib/config/cities.ts`](../../apps/web/src/lib/config/cities.ts).
> Bootstrap and the demo seed both import from there. **Do not** duplicate this
> data anywhere else.

## 1. Bootstrap seed (required reference data)

[`apps/web/prisma/bootstrap.ts`](../../apps/web/prisma/bootstrap.ts)

- Always idempotent (uses `prisma.upsert`).
- Contains only rows the app code structurally depends on.
- Safe to run repeatedly — it never deletes.

### Run manually

```bash
DATABASE_URL="<postgres-url>" pnpm --filter web db:bootstrap
```

### Run automatically on Vercel deploy

The build script
([`apps/web/scripts/maybe-bootstrap.cjs`](../../apps/web/scripts/maybe-bootstrap.cjs)) executes
bootstrap during `build:vercel` only when the env flag is set:

```
RUN_BOOTSTRAP_SEED=true
```

Set it in **Vercel → Project → Settings → Environment Variables** for both
Production and Preview environments. Because bootstrap is idempotent, leaving
the flag enabled permanently is safe and recommended — it self-heals an empty
database after a fresh migration.

If `RUN_BOOTSTRAP_SEED` is not `"true"`, the build skips bootstrap entirely.

### Trigger from the admin UI

Visit `/admin/data` and click **Run bootstrap**. Available to users with
`PLATFORM_ADMIN` role.

## 2. Admin data management

Route group: [`apps/web/src/app/admin/(dashboard)/data/`](<../../apps/web/src/app/admin/(dashboard)/data>)

| Route                       | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `/admin/data`               | Hub: counts, bootstrap trigger, links to all sub-tools |
| `/admin/data/cities`        | List, create, toggle active                            |
| `/admin/data/cities/[slug]` | Full edit form                                         |
| `/admin/data/categories`    | List + inline edit + create (Categories & Personas)    |
| `/admin/data/communities`   | Filter by city/status, change status                   |
| `/admin/data/events`        | Filter, change event status                            |
| `/admin/data/import`        | Bulk CSV/JSON upload with **preview → apply** flow     |
| `/admin/data/health`        | Counts + integrity checks (orphans, missing FKs, etc.) |

All admin pages are protected by `requireAdmin()` (PLATFORM_ADMIN role required).

## 3. Bulk import format

The importer accepts either CSV (header row required) or JSON (`{ resource, rows: [...] }` or
just an array). Resource is selected in the UI; payload is keyed by `slug` for upserts.

See the **Schemas** panel at the bottom of `/admin/data/import` for ready-to-copy examples.

Imports always go through a **preview** step that shows create/update/error counts per row.
**Apply** is disabled until preview returns zero errors. Nothing is ever deleted.

## 4. Recovery playbook — production cities table is empty

1. Go to `/admin/data/health` — confirm 0 active cities.
2. Click **Run bootstrap** on `/admin/data`.
3. Verify [https://indlokal.com/api/v1/cities](https://indlokal.com/api/v1/cities) returns the metro list.
4. Set `RUN_BOOTSTRAP_SEED=true` in Vercel env so this self-heals on next deploy.

## 5. How to log in as admin

Admin auth uses **passwordless magic links** sent by email. There is no password.

1. Bootstrap creates exactly one platform admin user. Its email is whatever
   `ADMIN_EMAIL` env var is set to. **Default: `admin@indlokal.de`**.
   - Change it by setting `ADMIN_EMAIL=you@yourcompany.com` _before_ the first
     bootstrap (or before the next one — it will upsert with role
     `PLATFORM_ADMIN`).
2. Visit `/admin/login` (e.g. <https://indlokal.com/admin/login> or
   <http://localhost:3001/admin/login>).
3. Enter the admin email address. Click **Get access link**.
4. Open the magic link to be signed in. The link is single-use and short-lived.

### Where the magic link arrives

| Environment | Delivery                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| Local dev   | Captured by **Mailpit** at <http://localhost:8026> (no real email sent). |
| Production  | Sent via **Resend** to the admin inbox. Requires `RESEND_API_KEY`.       |

If neither Resend nor Mailpit is reachable in dev, the magic link URL is
**printed to the Next.js server console** as a last-ditch fallback so you can
always get in.

### Promoting another admin

There is no UI for this yet. From a Prisma shell or SQL:

```sql
UPDATE "User" SET role = 'PLATFORM_ADMIN' WHERE email = 'someone@example.com';
```

Or set `ADMIN_EMAIL` to that address and re-run bootstrap (idempotent — it
upserts the role on the existing row).

## 6. Email environment variables

These are the only env vars that influence admin login & outbound mail.

| Variable              | Required in    | Default                          | Purpose                                                    |
| --------------------- | -------------- | -------------------------------- | ---------------------------------------------------------- |
| `ADMIN_EMAIL`         | both           | `admin@indlokal.de`              | Email of the bootstrap-created platform admin user.        |
| `NEXT_PUBLIC_APP_URL` | both           | `http://localhost:3001`          | Base URL used to build magic-link URLs in the email body.  |
| `RESEND_API_KEY`      | **production** | —                                | Resend API key. Without it, prod cannot send admin emails. |
| `RESEND_FROM_EMAIL`   | production     | `IndLokal <noreply@indlokal.de>` | From address. Sender domain must be verified in Resend.    |
| `SMTP_HOST`           | dev only       | `localhost`                      | Mailpit host (Docker compose service `mailpit`).           |
| `SMTP_PORT`           | dev only       | `1026`                           | Mailpit SMTP port (UI is on `8026`).                       |

**Production checklist before going live:**

1. ✅ `ADMIN_EMAIL` set to a real inbox you control.
2. ✅ `RESEND_API_KEY` set (Vercel → Project → Env Vars).
3. ✅ `RESEND_FROM_EMAIL` uses a domain verified in Resend.
4. ✅ `NEXT_PUBLIC_APP_URL=https://indlokal.com`.
5. ✅ `RUN_BOOTSTRAP_SEED=true` so the admin user is created on first deploy.
6. ✅ `RUN_DIRECTORY_SEED=true` so curated public listings are created on first deploy (safe to leave on — it never updates existing rows).
7. ✅ Visit `/admin/login`, request a link, confirm delivery.

## 7. Directory seed — editorial policy

[`apps/web/prisma/directory.ts`](../../apps/web/prisma/directory.ts) holds
curated, publicly-sourced community listings. It runs **after** bootstrap and
before the app build. The goal is simple: **no city page should look dead on
day one.**

### Why it exists

A directory product with zero entries on a city page has near-zero retention.
Pre-populating each metro with 10–25 well-known orgs (then letting real
organisers claim them) is how Eventbrite, Tracxn, Bandsintown, and every other
serious directory bootstraps. We do the same — honestly.

### Hard rules (do not bend)

1. **Public source only.** Org must have a public website / Meetup page /
   Vereinsregister entry / official institutional listing.
2. **Every entry MUST have a `sourceUrl`** stored on the row. This is our
   defence if anyone ever asks "why is my org listed?"
3. **No personal data.** Name + public URL + city + category. Never a
   personal email or phone unless it is already on the org's public website.
4. **NEVER seed events** here. Events go stale within weeks → site looks
   wrong/dead. Worse than empty.
5. **Create-only and idempotent.** The seed NEVER updates an existing row.
   Admin / organiser edits always survive redeploys.

### How a row is created

Every directory entry lands as:

- `status: UNVERIFIED`
- `claimState: UNCLAIMED`
- `source: ADMIN_SEED`
- `metadata.editorialSource = 'directory-seed'`
- `metadata.sourceUrl = '<the public URL>'`
- `metadata.needsReview = true|false`

The first time the real organiser visits `/admin/login` and goes through the
claim flow ([`COMMUNITY_CLAIM_FLOW.md`](../COMMUNITY_CLAIM_FLOW.md)), they
take ownership and edit freely.

### Adding entries (workflow)

For each new metro:

1. **Discovery sprint** (~half a day): list 10–25 orgs from public sources
   (university ISA pages, Vereinsregister, Meetup, consulate cultural-org
   listings, public temple/gurudwara directories, registered Vereine).
2. Add each as a `DirectoryEntry` in the appropriate per-metro array in
   [`apps/web/prisma/directory.ts`](../../apps/web/prisma/directory.ts) with
   a real `sourceUrl`.
3. Commit + deploy. The seed runs automatically (create-only).
4. Reach out to organisers proactively: "Your group is on indlokal.com — claim
   it here." Turns a passive listing into an activated power user.

### What NOT to put here

- ❌ Events (use the events pipeline / admin tools instead). The cron at
  `/api/cron/scores` auto-archives `UPCOMING` events whose `endsAt` (or
  `startsAt + 4h` if no end time) is in the past.
- ❌ Private WhatsApp / Telegram invite links
- ❌ Any unverified / scraped / AI-generated org descriptions
- ❌ Any org you cannot point at a public URL for

## 8. Resources tier

[`apps/web/prisma/resources.ts`](../../apps/web/prisma/resources.ts) holds
curated public reference rows (consulates, university international offices,
government registries, embassy services). It runs as part of
`runDirectorySeed()` — there is no separate cron or env flag to manage.

Same editorial rules as the directory tier:

- Public source only; every row carries a verifiable URL.
- Create-only and idempotent. Existing rows are never overwritten on redeploy.
- No personal contact data unless already public on the source website.

To run only the resources tier locally:

```bash
DATABASE_URL="<postgres-url>" pnpm --filter web db:resources
```

## 9. Cron jobs (production)

Cron is run by **GitHub Actions** ([.github/workflows/cron.yml](../../.github/workflows/cron.yml)),
not Vercel Cron. Each job POSTs to `/api/cron/{name}` with the
`Authorization: Bearer ${CRON_SECRET}` header.

| Schedule (UTC) | Endpoint                  | Purpose                                                                                  |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| every 6 h      | `/api/cron/scores`        | Recompute community scores **and** archive `UPCOMING → PAST` events whose end has passed |
| 03:00 daily    | `/api/cron/pipeline`      | AI content pipeline                                                                      |
| 03:00 daily    | `/api/cron/links`         | Verify community join-link health                                                        |
| 03:00 daily    | `/api/cron/keywords`      | Refresh keyword suggestions                                                              |
| 03:00 daily    | `/api/cron/relationships` | Infer related-community edges                                                            |
| 03:00 daily    | `/api/cron/enrichment`    | Background community enrichment                                                          |

Required secrets (set in **both** Vercel project env and GitHub repo secrets):

- `CRON_SECRET` — shared bearer token. Generate with `openssl rand -hex 32`.
- `APP_URL` — production base URL, e.g. `https://indlokal.de` (GitHub repo
  secret only; Vercel already knows its own URL).
