# LocalPulse

**Activity-led community discovery platform for the Indian diaspora in Germany.**

LocalPulse helps Indian expats in Germany discover active communities, events, and resources — ranked by real activity signals rather than stale directory listings.

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
- PostgreSQL (local or Docker)

### Setup

```bash
# Clone the repo
git clone <repo-url> && cd local-pulse

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL

# Set up database
npx prisma generate
npx prisma db push
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
