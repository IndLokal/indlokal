#!/usr/bin/env bash
set -euo pipefail

# ─── IndLokal Dev Script (monorepo) ───
# Usage: ./dev.sh <command>
#
# Layout:
#   apps/web/      Next.js app (owns .env, prisma/, .next/)
#   apps/mobile/   Expo app (placeholder)
#   packages/shared/  Zod contracts + generated OpenAPI

WEB_DIR="apps/web"
MOBILE_DIR="apps/mobile"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
  echo -e "\n${CYAN}━━━ IndLokal ━━━${NC}"
  echo ""
}

print_success() { echo -e "${GREEN}✔${NC} $1"; }
print_warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✖${NC} $1"; }

ensure_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    if command -v corepack >/dev/null 2>&1; then
      corepack enable >/dev/null 2>&1 || true
      corepack prepare pnpm@9.12.3 --activate >/dev/null 2>&1 || true
    fi
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    print_error "pnpm not found. Install via: npm i -g pnpm"
    exit 1
  fi
}

ensure_database_exists() {
  local db_name="$1"

  if docker compose exec -T db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -q 1; then
    print_success "Database '$db_name' exists"
  else
    docker compose exec -T db psql -U postgres -c "CREATE DATABASE \"$db_name\";" >/dev/null
    print_success "Created database '$db_name'"
  fi
}

# Run a command inside apps/web with pnpm
web() { (cd "$WEB_DIR" && "$@"); }

# ─── Commands ───

cmd_setup() {
  print_header
  echo "Setting up IndLokal monorepo for local development..."
  echo ""

  ensure_pnpm

  # Dependencies (workspace install at root)
  if [ ! -d "node_modules" ] || [ ! -d "$WEB_DIR/node_modules" ]; then
    echo "Installing dependencies (pnpm workspace)..."
    pnpm install
  else
    print_success "Dependencies already installed"
  fi

  # Env files (live in apps/web/)
  if [ ! -f "$WEB_DIR/.env.local" ]; then
    cp "$WEB_DIR/.env.example" "$WEB_DIR/.env.local"
    print_success "Created $WEB_DIR/.env.local from .env.example"
  else
    print_success "$WEB_DIR/.env.local exists"
  fi

  if [ ! -f "$WEB_DIR/.env" ]; then
    cp "$WEB_DIR/.env.example" "$WEB_DIR/.env"
    print_success "Created $WEB_DIR/.env for Prisma"
  else
    print_success "$WEB_DIR/.env exists"
  fi

  # Docker Postgres
  cmd_db_start

  echo ""
  ensure_database_exists "indlokal"

  # Prisma
  echo ""
  echo "Pushing schema to database..."
  web pnpm exec prisma db push --skip-generate
  web pnpm exec prisma generate
  print_success "Database schema in sync"

  # Seed
  echo ""
  echo "Seeding database..."
  pnpm db:seed
  print_success "Database seeded"

  # Test DB
  echo ""
  echo "Setting up test database..."
  ensure_database_exists "indlokal_test"
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/indlokal_test?schema=public}" \
    web pnpm exec prisma db push --skip-generate >/dev/null 2>&1
  print_success "Test database ready"

  echo ""
  print_success "Setup complete! Run ${CYAN}./dev.sh start${NC} to launch."
}

cmd_start() {
  print_header
  echo "Starting IndLokal..."
  echo ""

  ensure_pnpm

  # Clear Next.js cache to ensure fresh build
  if [ -d "$WEB_DIR/.next" ]; then
    rm -rf "$WEB_DIR/.next"
    print_success "Cleared $WEB_DIR/.next cache"
  fi

  # Ensure DB + Mailpit are running
  if ! docker compose ps --status running 2>/dev/null | grep -q "indlokal-db"; then
    cmd_db_start
  fi

  ensure_database_exists "indlokal"

  echo ""
  print_success "Mailbox UI → ${CYAN}http://localhost:8026${NC}"
  print_success "Starting Next.js dev server..."
  echo ""
  pnpm dev:web
}

cmd_stop() {
  print_header
  echo "Stopping everything..."
  docker compose down 2>/dev/null || true
  print_success "PostgreSQL stopped"
  echo ""
  echo "Dev server must be stopped manually (Ctrl+C)."
}

cmd_db_start() {
  if docker compose ps --status running 2>/dev/null | grep -q "indlokal-db"; then
    print_success "PostgreSQL already running"
  else
    echo "Starting PostgreSQL (Docker)..."
    docker compose up -d --wait
    print_success "PostgreSQL running on localhost:5432"
  fi
}

cmd_db_stop() {
  docker compose down
  print_success "PostgreSQL stopped (data preserved in Docker volume)"
}

cmd_db_reset() {
  print_header
  print_warn "This will DELETE all data and re-seed."
  echo ""
  read -p "Are you sure? (y/N) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    ensure_pnpm
    echo "Resetting database..."
    docker compose down -v
    docker compose up -d --wait
    ensure_database_exists "indlokal"
    web pnpm exec prisma db push --skip-generate
    pnpm db:seed
    print_success "Database reset and re-seeded"
  else
    echo "Cancelled."
  fi
}

cmd_db_studio() {
  ensure_pnpm
  if ! docker compose ps --status running 2>/dev/null | grep -q "indlokal-db"; then
    cmd_db_start
  fi
  ensure_database_exists "indlokal"
  web pnpm exec prisma studio
}

cmd_mailbox() {
  print_header
  if ! docker compose ps --status running 2>/dev/null | grep -q "indlokal-mailpit"; then
    echo "Starting Mailpit..."
    docker compose up -d mailpit
  fi
  print_success "Mailbox UI → ${CYAN}http://localhost:8026${NC}"
  open "http://localhost:8026" 2>/dev/null || true
}

cmd_test() {
  print_header
  ensure_pnpm
  if ! docker compose ps --status running 2>/dev/null | grep -q "indlokal-db"; then
    cmd_db_start
  fi

  ensure_database_exists "indlokal_test"
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/indlokal_test?schema=public}" \
    web pnpm exec prisma db push --skip-generate >/dev/null 2>&1

  echo "Running unit + component tests..."
  echo ""
  pnpm test
}

cmd_test_watch() {
  ensure_pnpm
  if ! docker compose ps --status running 2>/dev/null | grep -q "indlokal-db"; then
    cmd_db_start
  fi
  ensure_database_exists "indlokal_test"
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/indlokal_test?schema=public}" \
    web pnpm exec prisma db push --skip-generate >/dev/null 2>&1
  pnpm -F web test:watch
}

cmd_test_setup() {
  print_header
  ensure_pnpm
  echo "Setting up test database..."

  if ! docker compose ps --status running 2>/dev/null | grep -q "indlokal-db"; then
    cmd_db_start
  fi

  ensure_database_exists "indlokal_test"

  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/indlokal_test?schema=public}" \
    web pnpm exec prisma db push --skip-generate

  print_success "Test database ready"
}

cmd_test_coverage() {
  print_header
  ensure_pnpm
  if ! docker compose ps --status running 2>/dev/null | grep -q "indlokal-db"; then
    cmd_db_start
  fi
  ensure_database_exists "indlokal_test"
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/indlokal_test?schema=public}" \
    web pnpm exec prisma db push --skip-generate >/dev/null 2>&1
  echo "Running tests with coverage..."
  echo ""
  pnpm -F web test:coverage
  echo ""
  print_success "Coverage report saved to apps/web/coverage/"
}

cmd_mobile() {
  print_header
  ensure_pnpm

  # Create .env if missing (points at local web server)
  if [ ! -f "$MOBILE_DIR/.env" ]; then
    echo "EXPO_PUBLIC_API_BASE_URL=http://localhost:3001" > "$MOBILE_DIR/.env"
    print_success "Created $MOBILE_DIR/.env → http://localhost:3001"
  else
    print_success "$MOBILE_DIR/.env exists"
  fi

  # Ensure web server + DB are running
  if ! docker compose ps --status running 2>/dev/null | grep -q "indlokal-db"; then
    cmd_db_start
  fi
  ensure_database_exists "indlokal"

  print_success "Starting Expo (press i for iOS Simulator, a for Android)..."
  echo ""
  (cd "$MOBILE_DIR" && pnpm start)
}

cmd_check() {
  print_header
  ensure_pnpm
  echo "Running all checks (turbo)..."
  echo ""
  pnpm check
}

cmd_clean() {
  print_header
  print_warn "This will remove:"
  echo "  • node_modules/ (root + workspaces)"
  echo "  • apps/web/.next/"
  echo "  • .turbo/"
  echo "  • Docker volume (all DB data)"
  echo ""
  read -p "Are you sure? (y/N) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose down -v 2>/dev/null || true
    rm -rf node_modules apps/*/node_modules packages/*/node_modules
    rm -rf apps/web/.next
    rm -rf .turbo apps/*/.turbo packages/*/.turbo
    print_success "Cleaned. Run ${CYAN}./dev.sh setup${NC} to start fresh."
  else
    echo "Cancelled."
  fi
}

cmd_help() {
  print_header
  echo "Usage: ./dev.sh <command>"
  echo ""
  echo -e "${CYAN}Getting Started${NC}"
  echo "  setup          Install deps, start DB, push schema, seed"
  echo "  start          Start DB + Next.js dev server"
  echo "  stop           Stop DB container"
  echo ""
  echo -e "${CYAN}Database${NC}"
  echo "  db:start       Start PostgreSQL container"
  echo "  db:stop        Stop PostgreSQL container (data kept)"
  echo "  db:reset       Wipe DB, recreate, and re-seed"
  echo "  db:studio      Open Prisma Studio (browser UI)"
  echo ""
  echo -e "${CYAN}Email${NC}"
  echo "  mailbox        Open Mailpit web UI (catches all dev emails)"
  echo ""
  echo -e "${CYAN}Testing${NC}"
  echo "  test:setup     Create test DB + push schema (run once)"
  echo "  test           Run all unit + component tests"
  echo "  test:watch     Run tests in watch mode"
  echo "  test:coverage  Run tests with coverage report"
  echo ""
  echo -e "${CYAN}Mobile${NC}"
  echo "  mobile         Start Expo + Metro (iOS/Android simulator)"
  echo ""
  echo -e "${CYAN}Quality${NC}"
  echo "  check          Run typecheck + lint + format check (turbo)"
  echo ""
  echo -e "${CYAN}Cleanup${NC}"
  echo "  clean          Remove node_modules, .next, .turbo, DB volume"
  echo ""
  echo -e "${CYAN}Help${NC}"
  echo "  help           Show this message"
}

# ─── Router ───

case "${1:-help}" in
  setup)         cmd_setup ;;
  start)         cmd_start ;;
  stop)          cmd_stop ;;
  db:start)      cmd_db_start ;;
  db:stop)       cmd_db_stop ;;
  db:reset)      cmd_db_reset ;;
  db:studio)     cmd_db_studio ;;
  mailbox)       cmd_mailbox ;;
  test)          cmd_test ;;
  test:watch)    cmd_test_watch ;;
  test:setup)    cmd_test_setup ;;
  test:coverage) cmd_test_coverage ;;
  mobile)        cmd_mobile ;;
  check)         cmd_check ;;
  clean)         cmd_clean ;;
  help|--help|-h) cmd_help ;;
  *)
    print_error "Unknown command: $1"
    cmd_help
    exit 1
    ;;
esac