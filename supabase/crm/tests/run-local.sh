#!/usr/bin/env bash
# รัน schema + test บน PostgreSQL ชั่วคราว (ไม่ต้องมี Supabase)  ใช้: bash supabase/crm/tests/run-local.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
DIR="$(mktemp -d)"; PORT=54329
chown postgres "$DIR" 2>/dev/null || true
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
run "$PGBIN/initdb -D $DIR/data -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true' EXIT
P="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
run "$P -d postgres -c 'create database t'"
for f in tests/00_supabase_stub.sql 001_schema.sql 002_functions.sql 003_views_rls.sql 004_rls_grants.sql 005_sales_reply.sql tests/test_crm.sql tests/test_reply.sql tests/test_features.sql; do
  echo "== $f"; run "$P -d t -f $HERE/$f"
done
echo "ALL TESTS PASSED"
