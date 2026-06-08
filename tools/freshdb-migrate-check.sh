#!/usr/bin/env bash
# Fresh-DB migration validation (no Supabase CLI / no docker required).
# Spins up an ephemeral PostgreSQL 16 cluster (run as the unprivileged
# `postgres` OS user), applies the Supabase bootstrap scaffold, then applies
# EVERY migration in lexicographic order with ON_ERROR_STOP=1. Reports the
# first failing migration (or success).
#
# The only test-time transform: strip `CREATE EXTENSION ... (supabase_vault|
# pg_net|pg_cron)` lines, since those Supabase-managed extensions are not
# installable in a vanilla cluster (the scaffold provides equivalent stubs).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | tail -1)"
WORK="$(mktemp -d /tmp/pgfresh.XXXXXX)"
DATADIR="$WORK/data"; SOCKDIR="$WORK/sock"; mkdir -p "$DATADIR" "$SOCKDIR"
PORT=54399
chown -R postgres:postgres "$WORK"
# Migrations must be readable by postgres user.
cp "$ROOT/tools/_freshdb_scaffold.sql" "$WORK/scaffold.sql"
cp "$ROOT"/supabase/migrations/*.sql "$WORK/" 2>/dev/null
chown -R postgres:postgres "$WORK"

PSQL="$PGBIN/psql -h $SOCKDIR -p $PORT -U postgres -d postgres"

aspg() { runuser -u postgres -- "$@"; }

cleanup() {
  aspg "$PGBIN/pg_ctl" -D "$DATADIR" -mfast stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "PG: $($PGBIN/postgres --version)"
aspg "$PGBIN/initdb" -U postgres -D "$DATADIR" --auth=trust >/dev/null 2>&1 || { echo "initdb FAILED"; exit 2; }
aspg "$PGBIN/pg_ctl" -D "$DATADIR" -o "-k $SOCKDIR -p $PORT -c listen_addresses=''" -w start >/dev/null 2>&1 \
  || { echo "pg_ctl start FAILED"; exit 2; }

echo "== applying scaffold =="
if ! aspg $PSQL -v ON_ERROR_STOP=1 -q -f "$WORK/scaffold.sql" >"$WORK/scaffold.log" 2>&1; then
  echo "SCAFFOLD FAILED:"; cat "$WORK/scaffold.log"; exit 2
fi

echo "== applying migrations in order =="
count=0
for f in $(ls "$WORK"/*.sql | sort); do
  base="$(basename "$f")"
  [ "$base" = "scaffold.sql" ] && continue
  stripped="$WORK/_cur.sql"
  grep -vEi 'CREATE +EXTENSION +IF +NOT +EXISTS +(supabase_vault|pg_net|pg_cron)' "$f" > "$stripped"
  chown postgres:postgres "$stripped"
  if aspg $PSQL -v ON_ERROR_STOP=1 -q -f "$stripped" >"$WORK/mig.log" 2>&1; then
    count=$((count+1))
  else
    echo ""
    echo "MIGRATION FAILED: $base"
    echo "----------------------------------------"
    tail -25 "$WORK/mig.log"
    echo ""
    echo "Applied OK before failure: $count"
    exit 1
  fi
done

echo ""
echo "ALL $count MIGRATIONS APPLIED CLEANLY FROM ZERO"

echo "== object existence check =="
aspg $PSQL -q -At -c "
SELECT 'support_ticket=' || to_regclass('public.support_ticket')::text
UNION ALL SELECT 'articles=' || to_regclass('public.articles')::text
UNION ALL SELECT 'company_course_departments=' || to_regclass('public.company_course_departments')::text
UNION ALL SELECT 'company_subdomains=' || to_regclass('public.company_subdomains')::text
UNION ALL SELECT 'tenant_companies(view)=' || to_regclass('public.tenant_companies')::text
UNION ALL SELECT 'certificates(view)=' || to_regclass('public.certificates')::text
UNION ALL SELECT 'rpc increment_article_view_count=' || COALESCE((SELECT proname FROM pg_proc WHERE proname='increment_article_view_count' LIMIT 1),'MISSING')
UNION ALL SELECT 'phishing_campaigns.quota_consumed_at=' || COALESCE((SELECT column_name FROM information_schema.columns WHERE table_name='phishing_campaigns' AND column_name='quota_consumed_at'),'MISSING');
"
