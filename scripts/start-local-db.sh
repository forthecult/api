#!/usr/bin/env bash
# Start local Postgres and create ftc DB so "bun dev" can connect.
# Run once from repo root:  ./scripts/start-local-db.sh   (sudo only for start)

set -e

# Start Postgres cluster if down (Debian/Ubuntu)
if command -v pg_lsclusters &>/dev/null; then
  STATUS=$(pg_lsclusters -h | awk '$2=="main" && $3=="5432" {print $4}')
  if [[ "$STATUS" == "down" ]]; then
    echo "Starting PostgreSQL cluster (may ask for sudo)..."
    sudo pg_ctlcluster 17 main start 2>/dev/null || sudo systemctl start postgresql@17-main
  fi
fi

# Create database (peer auth as postgres user, or current user)
if sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw ftc; then
  echo "Database ftc already exists."
else
  echo "Creating database ftc..."
  sudo -u postgres createdb ftc
fi

# Ensure postgres user has password for DATABASE_URL (postgres:postgres@localhost)
sudo -u postgres psql -d ftc -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true

echo "Done. Run:  cd webapp && bun db:push && bun dev"
