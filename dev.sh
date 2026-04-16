#!/usr/bin/env bash
set -euo pipefail

# ─── LocalPulse Dev Script ───
# Usage: ./dev.sh <command>

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
  echo -e "\n${CYAN}━━━ LocalPulse ━━━${NC}"
  echo ""
}

print_success() { echo -e "${GREEN}✔${NC} $1"; }
print_warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✖${NC} $1"; }

# ─── Commands ───

cmd_setup() {
  print_header
  echo "Setting up LocalPulse for local development..."
  echo ""

  # Dependencies
  if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
  else
    print_success "Dependencies already installed"
  fi

  # Env files
  if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    print_success "Created .env.local from .env.example"
  else
    print_success ".env.local exists"
  fi

  if [ ! -f ".env" ]; then
    cp .env.example .env
    print_success "Created .env for Prisma"
  else
    print_success ".env exists"
  fi

  # Docker Postgres
  cmd_db_start

  # Prisma
  echo ""
  echo "Pushing schema to database..."
  npx prisma db push --skip-generate
  npx prisma generate
  print_success "Database schema in sync"

  # Seed
  echo ""
  echo "Seeding database..."
  npm run db:seed
  print_success "Database seeded"

  # Test DB
  echo ""
  echo "Setting up test database..."
  docker compose exec -T db psql -U postgres -c "CREATE DATABASE localpulse_test;" 2>/dev/null || true
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/localpulse_test?schema=public}" \
    npx prisma db push --skip-generate >/dev/null 2>&1
  print_success "Test database ready"

  echo ""
  print_success "Setup complete! Run ${CYAN}./dev.sh start${NC} to launch."
}

cmd_start() {
  print_header
  echo "Starting LocalPulse..."
  echo ""

  # Ensure DB is running
  if ! docker compose ps --status running 2>/dev/null | grep -q "localpulse-db"; then
    cmd_db_start
  fi

  echo ""
  print_success "Starting Next.js dev server..."
  echo ""
  npm run dev
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
  if docker compose ps --status running 2>/dev/null | grep -q "localpulse-db"; then
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
    echo "Resetting database..."
    docker compose down -v
    docker compose up -d --wait
    npx prisma db push --skip-generate
    npm run db:seed
    print_success "Database reset and re-seeded"
  else
    echo "Cancelled."
  fi
}

cmd_db_studio() {
  if ! docker compose ps --status running 2>/dev/null | grep -q "localpulse-db"; then
    cmd_db_start
  fi
  npx prisma studio
}

cmd_test() {
  print_header
  if ! docker compose ps --status running 2>/dev/null | grep -q "localpulse-db"; then
    cmd_db_start
  fi

  # Ensure test DB schema is up to date
  docker compose exec -T db psql -U postgres -c "CREATE DATABASE localpulse_test;" 2>/dev/null || true
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/localpulse_test?schema=public}" \
    npx prisma db push --skip-generate >/dev/null 2>&1

  echo "Running unit + component tests..."
  echo ""
  npm run test
}

cmd_test_watch() {
  if ! docker compose ps --status running 2>/dev/null | grep -q "localpulse-db"; then
    cmd_db_start
  fi
  # Ensure test DB schema is up to date
  docker compose exec -T db psql -U postgres -c "CREATE DATABASE localpulse_test;" 2>/dev/null || true
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/localpulse_test?schema=public}" \
    npx prisma db push --skip-generate >/dev/null 2>&1
  npm run test:watch
}

cmd_test_setup() {
  print_header
  echo "Setting up test database..."

  if ! docker compose ps --status running 2>/dev/null | grep -q "localpulse-db"; then
    cmd_db_start
  fi

  # Create test DB if it doesn't exist
  docker compose exec -T db psql -U postgres -c "CREATE DATABASE localpulse_test;" 2>/dev/null || \
    print_warn "localpulse_test already exists — skipping creation"

  # Push schema to test DB
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/localpulse_test?schema=public}" \
    npx prisma db push --skip-generate

  print_success "Test database ready"
}

cmd_test_coverage() {
  print_header
  if ! docker compose ps --status running 2>/dev/null | grep -q "localpulse-db"; then
    cmd_db_start
  fi
  # Ensure test DB schema is up to date
  docker compose exec -T db psql -U postgres -c "CREATE DATABASE localpulse_test;" 2>/dev/null || true
  DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/localpulse_test?schema=public}" \
    npx prisma db push --skip-generate >/dev/null 2>&1
  echo "Running tests with coverage..."
  echo ""
  npm run test:coverage
  echo ""
  print_success "Coverage report saved to coverage/"
}

cmd_check() {
  print_header
  echo "Running all checks..."
  echo ""

  echo "TypeScript..."
  npm run typecheck
  print_success "Types OK"

  echo ""
  echo "ESLint..."
  npm run lint
  print_success "Lint OK"

  echo ""
  echo "Prettier..."
  npm run format:check
  print_success "Format OK"
}

cmd_clean() {
  print_header
  print_warn "This will remove:"
  echo "  • node_modules/"
  echo "  • .next/"
  echo "  • Docker volume (all DB data)"
  echo "  • Generated Prisma client"
  echo ""
  read -p "Are you sure? (y/N) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose down -v 2>/dev/null || true
    rm -rf node_modules .next
    rm -rf node_modules/.prisma
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
  echo -e "${CYAN}Testing${NC}"
  echo "  test:setup     Create test DB + push schema (run once)"
  echo "  test           Run all unit + component tests"
  echo "  test:watch     Run tests in watch mode"
  echo "  test:coverage  Run tests with coverage report"
  echo ""
  echo -e "${CYAN}Quality${NC}"
  echo "  check          Run typecheck + lint + format check"
  echo ""
  echo -e "${CYAN}Cleanup${NC}"
  echo "  clean          Remove node_modules, .next, DB volume"
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
  test)          cmd_test ;;
  test:watch)    cmd_test_watch ;;
  test:setup)    cmd_test_setup ;;
  test:coverage) cmd_test_coverage ;;
  check)         cmd_check ;;
  clean)         cmd_clean ;;
  help|--help|-h) cmd_help ;;
  *)
    print_error "Unknown command: $1"
    cmd_help
    exit 1
    ;;
esac
