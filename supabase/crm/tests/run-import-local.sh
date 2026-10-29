#!/usr/bin/env bash
# ทดสอบนำเข้าบน Postgres ชั่วคราว:  bash tests/run-import-local.sh <โฟลเดอร์ที่มีไฟล์ .sql จาก import-legacy.mjs>
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; SRC="$(cd "$1" && pwd)"
PGBIN=/usr/lib/postgresql/16/bin; DIR="$(mktemp -d)"; PORT=54331; chown postgres "$DIR" 2>/dev/null || true
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
run "$PGBIN/initdb -D $DIR/data -A trust >/dev/null"; run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
mkdir -p "$DIR/src" && cp "$SRC"/*.sql "$DIR/src/" && chmod -R a+rX "$DIR" "$HERE" 2>/dev/null || true; SRC="$DIR/src"
trap 'run "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true' EXIT
P="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
run "$P -d postgres -c 'create database t'"
for f in tests/00_supabase_stub.sql install_all.sql; do run "$P -d t -f $HERE/$f" >/dev/null 2>&1; done
run "$P -d t -c \"insert into crm.sales_team(code, display_name, role) values ('SA0001','วิ','sales'),('SA0002','โอ๋','sales')\""
for round in 1 2; do
  echo "== import round $round"
  for f in $(ls "$SRC"/[1-3]*.sql | sort); do run "$P -d t -f $f" >/dev/null; done
done
run "$P -d t -A -F ' | ' -t -f $SRC/99_verify.sql"
