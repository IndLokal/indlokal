# IndLokal

**Your Indian community, locally - helping Indians in Germany navigate life in their city.**

IndLokal helps Indians in Germany navigate life in their new city: discover the communities active around them, the events worth knowing about this week, and the resources every Indian in Germany ends up needing - from Anmeldung and EU Blue Card to Indian grocers and English-friendly doctors.

City-first discovery (communities, events, resources) is the live foundation today. The longer arc is documented in [docs/PRODUCT_DOCUMENT.md](docs/PRODUCT_DOCUMENT.md).

Brand source of truth: [docs/brand/](docs/brand/)

## Tech Stack

- Monorepo: pnpm workspaces + Turborepo
- Web: Next.js 16 App Router, React 19, Tailwind CSS 4
- Mobile: Expo SDK 54, Expo Router, React Native
- Language: TypeScript
- Database: PostgreSQL + Prisma ORM
- Shared contracts: `@indlokal/shared` (Zod + generated OpenAPI)
- Testing: Vitest (web), Node test runner (mobile lib tests)

## Project Structure

```text
.
├── apps/
│   ├── web/                     # Next.js app + API routes + Prisma
│   │   ├── src/app/             # App Router pages and API endpoints
│   │   ├── src/modules/         # Domain modules (community/event/search/pipeline/...)
│   │   ├── prisma/              # schema, migrations, seeds, bootstrap scripts
│   │   └── scripts/             # deployment/ops helper scripts
│   └── mobile/                  # Expo app
│       ├── app/                 # Expo Router screens
│       ├── components/          # Mobile UI components
│       └── lib/                 # Mobile client libraries and tests
├── packages/
│   └── shared/                  # Shared contracts/types + generated openapi.yaml
├── docs/                        # Product, architecture, deployment, audits, specs
│   ├── deployment/
│   ├── brand/
│   └── specs/
├── decks/                       # Deck generation scripts and output artifacts
│   ├── scripts/
│   └── output/
├── docker/
│   └── init-test-db.sql
├── dev.sh                       # Local development workflow helper
├── docker-compose.yml           # Postgres + Mailpit services
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL + Mailpit)

### Setup

```bash
# Clone the repo
git clone <repo-url> && cd ind-lokal

# Install dependencies
pnpm install

# Set up env files, start DB, push Prisma schema, seed data, and prepare test DB
./dev.sh setup

# Start web app + required local services
./dev.sh start
```

Local defaults:

- Web: http://localhost:3001
- Postgres (Docker): localhost:5434
- Mailpit UI: http://localhost:8026

To start mobile development:

```bash
./dev.sh mobile
```

## Dev Script Commands

`dev.sh` is the canonical local workflow entrypoint.

| Command                  | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `./dev.sh setup`         | Install deps, create env files, start DB, push schema, seed, set up test DB |
| `./dev.sh start`         | Start DB/services and run web dev server                                    |
| `./dev.sh stop`          | Stop Docker services                                                        |
| `./dev.sh db:start`      | Start PostgreSQL container                                                  |
| `./dev.sh db:stop`       | Stop PostgreSQL container                                                   |
| `./dev.sh db:reset`      | Wipe DB volume, recreate schema, re-seed                                    |
| `./dev.sh db:studio`     | Open Prisma Studio                                                          |
| `./dev.sh mailbox`       | Open Mailpit UI                                                             |
| `./dev.sh test:setup`    | Create/push schema for test DB                                              |
| `./dev.sh test`          | Run tests                                                                   |
| `./dev.sh test:watch`    | Run tests in watch mode                                                     |
| `./dev.sh test:coverage` | Run tests with coverage (web)                                               |
| `./dev.sh mobile`        | Start Expo app                                                              |
| `./dev.sh check`         | Run typecheck + lint + format check                                         |
| `./dev.sh clean`         | Remove node_modules/.next/.turbo and Docker volume                          |
| `./dev.sh help`          | Show command help                                                           |

## Workspace Commands

| Command                  | Description                               |
| ------------------------ | ----------------------------------------- |
| `pnpm dev`               | Run workspace dev tasks via Turbo         |
| `pnpm dev:web`           | Start only web app                        |
| `pnpm build`             | Build all workspace packages/apps         |
| `pnpm lint`              | Lint across workspaces                    |
| `pnpm typecheck`         | Typecheck across workspaces               |
| `pnpm test`              | Run workspace tests                       |
| `pnpm check`             | `typecheck + lint + format:check`         |
| `pnpm openapi:generate`  | Regenerate shared OpenAPI contract        |
| `pnpm db:migrate`        | Run local Prisma dev migration flow (web) |
| `pnpm db:migrate:deploy` | Apply Prisma deploy migrations (web)      |
| `pnpm db:seed`           | Seed DB (web)                             |
| `pnpm db:studio`         | Open Prisma Studio (web)                  |

## Pipeline Source Config

Pipeline source config is DB-managed with JSON defaults.

- Canonical defaults: `apps/web/prisma/data/pipeline-source-defaults.json`
- Bootstrap/sync script: `apps/web/prisma/pipeline-source-config.ts`
- Runtime reader: `apps/web/src/modules/pipeline/runtime-config.ts`

Runtime behavior:

- Primary path reads `pipeline_source_configs` from DB.
- If the table is missing or empty, runtime falls back to JSON defaults.

Useful commands:

1. `pnpm --filter web db:migrate:deploy`
2. `pnpm --filter web db:bootstrap`
3. `pnpm --filter web pipeline:sources:sync`
4. `pnpm --filter web pipeline:sources:sync:prune` (optional)

## Architecture

- Monorepo, single backend: `apps/web` owns API routes and Prisma model; `apps/mobile` consumes shared APIs/contracts.
- Modular backend internals: domain modules live in `apps/web/src/modules/`.
- City-first URL model: user-facing routes are city scoped (`/:city/...`) with metro-region awareness.

## Deployment

Current deployment runbooks live in [docs/deployment/](docs/deployment/).

MVP posture:

- Web: Vercel
- Database: Neon PostgreSQL
- Mobile builds: Expo EAS
- Optional scheduled jobs: GitHub Actions

## Git Workflow

- Long-lived branches: `develop` and `main`
- Feature branches: `feat/<description>`
- Bug fix branches: `fix/<description>`
- Commit convention: [Conventional Commits](https://www.conventionalcommits.org/)

```text
feat: add community search
fix: correct metro region query
chore: update dependencies
```

## License

Private - All rights reserved.
