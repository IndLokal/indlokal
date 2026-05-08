# IndLokal

**Your Indian community, locally — the city-first discovery platform for the Indian diaspora in Germany.**

IndLokal helps Indians in Germany discover the **communities** active in their city, the **events** worth knowing about this week, and the **resources** every Indian in Germany ends up needing — from Anmeldung and EU Blue Card to Indian grocers and English-friendly doctors. Ranked by what's actually alive, not by who paid for a directory listing.

Brand source of truth: [`docs/brand/`](docs/brand/). Marketing copy: [`docs/brand/MARKETING_KIT.md`](docs/brand/MARKETING_KIT.md).

> 🚀 Launch city: **Stuttgart** (metro region including Böblingen, Sindelfingen, Ludwigsburg, Esslingen, Leonberg, Göppingen)

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Web**: Next.js 16 App Router, React 19, Tailwind CSS 4
- **Mobile**: Expo SDK 54, Expo Router, React Native
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Shared contracts**: `@indlokal/shared` with Zod/OpenAPI
- **Deployment**: Vercel + Neon + Expo EAS + GitHub Actions

## Project Structure

```
apps/
├── web/                    # Next.js app + API routes + Prisma schema
│   ├── src/app/            # App Router pages and API endpoints
│   ├── src/modules/        # Domain modules: community, event, discovery, search, scoring
│   └── prisma/             # Database schema and seed data
├── mobile/                 # Expo app for iOS and Android
│   ├── app/                # Expo Router screens
│   ├── components/         # Mobile UI components
│   └── lib/                # Mobile auth, config, cache, notifications
packages/
└── shared/                 # Shared schemas, types, and generated OpenAPI
docs/
├── deployment/             # MVP deployment runbooks
├── specs/                  # PRD, TDD, API, ADR, analytics, notification specs
└── brand/                  # Brand and design guidelines
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL)

### Setup

```bash
# Clone the repo
git clone <repo-url> && cd ind-lokal

# Install dependencies
pnpm install

# Set up local env, database, Prisma, seed data, and test DB
./dev.sh setup

# Start the web app
./dev.sh start
```

Open [http://localhost:3001](http://localhost:3001).

To start the mobile app, run:

```bash
./dev.sh mobile
```

### Docker Commands

| Command                     | Description                     |
| --------------------------- | ------------------------------- |
| `docker compose up -d`      | Start PostgreSQL                |
| `docker compose down`       | Stop PostgreSQL (data persists) |
| `docker compose down -v`    | Stop and **wipe** all data      |
| `docker compose logs -f db` | Tail database logs              |

### Useful Commands

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `./dev.sh setup`        | Bootstrap local web + database development |
| `./dev.sh start`        | Start PostgreSQL and the web app           |
| `./dev.sh mobile`       | Start the Expo mobile app                  |
| `pnpm dev:web`          | Start only the web app                     |
| `pnpm build`            | Production build through Turborepo         |
| `pnpm lint`             | Run ESLint across workspaces               |
| `pnpm format`           | Format with Prettier                       |
| `pnpm typecheck`        | TypeScript type check                      |
| `pnpm check`            | Run typecheck, lint, and format check      |
| `pnpm test`             | Run workspace tests                        |
| `pnpm db:studio`        | Open Prisma Studio                         |
| `pnpm db:seed`          | Seed database                              |
| `pnpm db:migrate`       | Create/run local Prisma migrations         |
| `pnpm openapi:generate` | Regenerate shared OpenAPI contract         |

## Architecture

**Monorepo, single backend.** The web app owns the Next.js API routes and Prisma data model. The mobile app consumes the same backend and shared contracts; it does not get a separate backend for MVP.

**Modular-internal backend.** Each domain module in `apps/web/src/modules/` encapsulates its own queries, types, and business logic. Modules communicate through well-defined exports — ready to extract later if usage justifies it.

**City-first URL structure.** All user-facing routes are scoped under `/:city/` to enable multi-city expansion. Metro-region awareness means events in Böblingen surface under Stuttgart.

**Activity-led scoring.** Communities are ranked by computed activity scores (events in last 90 days + recency decay), not just profile completeness. This is the core differentiator.

**Sparse-content resilience.** When a city has few events this week, the system automatically expands the time window to avoid showing empty pages.

## Deployment

The MVP deployment plan is intentionally small:

- **Vercel** for the Next.js app
- **Expo EAS** for iOS/Android mobile builds
- **Neon** for managed PostgreSQL
- **GitHub Actions** for optional scheduled cron calls
- **Resend / PostHog / custom domain** only when those features are actually needed

See [docs/deployment/](docs/deployment/) for the current deployment runbooks.

## Git Workflow

- `develop` — primary branch for day-to-day work and feature integration
- `main` — deployment branch; merge from `develop` when ready to deploy
- Feature branches: `feat/<description>`
- Bug fixes: `fix/<description>`

GitHub CI runs on pushes and PRs to both `develop` and `main`. Production deployment is tied to `main`.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add community search
fix: correct metro region query
chore: update dependencies
```

## License

Private — All rights reserved.
