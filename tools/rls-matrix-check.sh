#!/usr/bin/env bash
# RLS role-matrix validation. Bootstraps an ephemeral PostgreSQL 16 cluster,
# applies the Supabase scaffold + EVERY migration from zero, then runs
# tools/_rls_matrix_test.sql which seeds two tenants and asserts that each role
# (PLATFORM_ADMIN, COMPANY_ADMIN ×2 tenants, EMPLOYEE, ANON) sees exactly the
# rows its RLS policies permit. Any leak or over-restriction fails the run.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
WORK="$(mktemp -d /tmp/pgrls.XXXXXX)"
DATADIR="$WORK/data"; SOCKDIR="$WORK/sock"; mkdir -p "$DATADIR" "$SOCKDIR"
PORT=54398
cp "$ROOT/tools/_freshdb_scaffold.sql" "$WORK/scaffold.sql"
cp "$ROOT/tools/_rls_matrix_test.sql" "$WORK/rls.sql"
cp "$ROOT"/supabase/migrations/*.sql "$WORK/" 2>/dev/null
chown -R postgres:postgres "$WORK"

PSQL="$PGBIN/psql -h $SOCKDIR -p $PORT -U postgres -d postgres"
aspg() { runuser -u postgres -- "$@"; }

cleanup() {
  aspg "$PGBIN/pg_ctl" -D "$DATADIR" -mfast stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

aspg "$PGBIN/initdb" -U postgres -D "$DATADIR" --auth=trust >/dev/null 2>&1 || { echo "initdb FAILED"; exit 2; }
aspg "$PGBIN/pg_ctl" -D "$DATADIR" -o "-k $SOCKDIR -p $PORT -c listen_addresses=''" -w start >/dev/null 2>&1 \
  || { echo "pg_ctl start FAILED"; exit 2; }

echo "== applying scaffold + migrations =="
aspg $PSQL -v ON_ERROR_STOP=1 -q -f "$WORK/scaffold.sql" >"$WORK/log" 2>&1 || { echo "SCAFFOLD FAILED:"; cat "$WORK/log"; exit 2; }
for f in $(ls "$WORK"/*.sql | sort); do
  base="$(basename "$f")"
  case "$base" in scaffold.sql|rls.sql) continue;; esac
  grep -vEi 'CREATE +EXTENSION +IF +NOT +EXISTS +(supabase_vault|pg_net|pg_cron)' "$f" > "$WORK/_cur.sql"
  chown postgres:postgres "$WORK/_cur.sql"
  if ! aspg $PSQL -v ON_ERROR_STOP=1 -q -f "$WORK/_cur.sql" >"$WORK/log" 2>&1; then
    echo "MIGRATION FAILED: $base"; tail -20 "$WORK/log"; exit 1
  fi
done

echo "== running RLS role-matrix assertions =="
aspg $PSQL -v ON_ERROR_STOP=1 -f "$WORK/rls.sql" >"$WORK/rlslog" 2>&1
rc=$?
grep -E 'RLS (ok|FAIL|MATRIX)|PASSED|ERROR' "$WORK/rlslog" || true
if [ $rc -ne 0 ]; then
  echo ""
  echo "RLS MATRIX: FAILED"
  tail -30 "$WORK/rlslog"
  exit 1
fi
echo ""
echo "RLS MATRIX: ALL ASSERTIONS PASSED"
