# IndLokal

**Your Indian community, locally — the city-first discovery platform for the Indian diaspora in Germany.**

IndLokal helps Indians in Germany discover the **communities** active in their city, the **events** worth knowing about this week, and the **resources** every Indian in Germany ends up needing — from Anmeldung and EU Blue Card to Indian grocers and English-friendly doctors. Ranked by what's actually alive, not by who paid for a directory listing.

Brand source of truth: [`docs/brand/`](docs/brand/). Marketing copy: [`docs/brand/MARKETING_KIT.md`](docs/brand/MARKETING_KIT.md).

> 🚀 Launch city: **Stuttgart** (metro region including Böblingen, Sindelfingen, Ludwigsburg, Esslingen, Leonberg, Göppingen)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Styling**: Tailwind CSS 4
- **Deployment**: Vercel (planned)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── [city]/             # City-scoped routes
│   │   ├── events/         # Event listing + detail
│   │   ├── communities/    # Community explorer + detail
│   │   ├── search/         # Search page
│   │   ├── [language]-communities/   # SEO: /stuttgart/telugu-communities
│   │   ├── indian-events-this-week/  # SEO: temporal page
│   │   └── consular-services/       # SEO: official resources
│   └── admin/              # Admin dashboard
├── modules/                # Domain modules (monolith-first)
│   ├── community/          # Community queries + types
│   ├── event/              # Event queries + types
│   ├── discovery/          # City feed aggregation
│   ├── search/             # Search queries
│   └── scoring/            # Activity & completeness scoring
└── lib/                    # Shared utilities
    ├── db.ts               # Prisma client singleton
    ├── config.ts           # Site config & constants
    └── utils.ts            # Helpers (cn, timeAgo)
```

## Getting Started

### Prerequisites

- Node.js >= 20
- Docker (for PostgreSQL)

### Setup

```bash
# Clone the repo
git clone <repo-url> && cd ind-lokal

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
cp .env.example .env        # Prisma reads from .env

# Start PostgreSQL via Docker
docker compose up -d

# Set up database
npx prisma db push
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker Commands

| Command                     | Description                     |
| --------------------------- | ------------------------------- |
| `docker compose up -d`      | Start PostgreSQL                |
| `docker compose down`       | Stop PostgreSQL (data persists) |
| `docker compose down -v`    | Stop and **wipe** all data      |
| `docker compose logs -f db` | Tail database logs              |

### Useful Commands

| Command              | Description                            |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Start development server               |
| `npm run build`      | Production build                       |
| `npm run lint`       | Run ESLint                             |
| `npm run format`     | Format with Prettier                   |
| `npm run typecheck`  | TypeScript type check                  |
| `npm run check`      | Run all checks (types + lint + format) |
| `npm run db:studio`  | Open Prisma Studio                     |
| `npm run db:seed`    | Seed database                          |
| `npm run db:migrate` | Run database migrations                |

## Architecture

**Monolith-first, modular-internal.** Each domain module in `src/modules/` encapsulates its own queries, types, and business logic. Modules communicate through well-defined exports — ready to extract into services if needed.

**City-first URL structure.** All user-facing routes are scoped under `/:city/` to enable multi-city expansion. Metro-region awareness means events in Böblingen surface under Stuttgart.

**Activity-led scoring.** Communities are ranked by computed activity scores (events in last 90 days + recency decay), not just profile completeness. This is the core differentiator.

**Sparse-content resilience.** When a city has few events this week, the system automatically expands the time window to avoid showing empty pages.

## Deployment

The recommended production setup is intentionally simple:

- **Vercel** for the Next.js app
- **Managed PostgreSQL** (preferably Neon) for Prisma
- **Resend** for email
- **PostHog Cloud** for analytics
- **Scheduled HTTP cron jobs** for pipeline and scoring tasks

See [docs/DEPLOYMENT_STRATEGY.md](docs/DEPLOYMENT_STRATEGY.md) for the full deployment architecture, environment strategy, cron plan, and rollout sequence.

## Git Workflow

- `main` — production-ready code
- `develop` — integration branch for features
- Feature branches: `feat/<description>`
- Bug fixes: `fix/<description>`

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add community search
fix: correct metro region query
chore: update dependencies
```

## License

Private — All rights reserved.
