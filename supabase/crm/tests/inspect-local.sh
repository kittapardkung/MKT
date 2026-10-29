#!/usr/bin/env bash
# โหลดข้อมูลนำเข้าลง Postgres ชั่วคราวแล้วรัน SQL ตรวจสอบจากไฟล์ที่ระบุ:  bash tests/inspect-local.sh <โฟลเดอร์นำเข้า> <ไฟล์.sql> [<ไฟล์.sql> ...]  (ไฟล์ที่ 2+ รันหลังนำเข้า)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; SRC="$(cd "$1" && pwd)"; shift
PGBIN=/usr/lib/postgresql/16/bin; DIR="$(mktemp -d)"; PORT=54333; chown postgres "$DIR" 2>/dev/null || true
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
mkdir -p "$DIR/src" && cp "$SRC"/*.sql "$DIR/src/"; for f in "$@"; do cp "$f" "$DIR/src/zz_$(basename $f)"; done; chmod -R a+rX "$DIR" "$HERE" 2>/dev/null || true
run "$PGBIN/initdb -D $DIR/data -A trust >/dev/null"; run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true' EXIT
P="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
run "$P -d postgres -c 'create database t'"
for f in tests/00_supabase_stub.sql install_all.sql; do run "$P -d t -f $HERE/$f" >/dev/null 2>&1; done
run "$P -d t -c \"insert into crm.sales_team(user_id, code, display_name, role) values ('10000000-0000-0000-0000-000000000001','AD0001','เจ้าของ','admin'),('10000000-0000-0000-0000-0000000000a1','SA0001','วิ','sales'),('10000000-0000-0000-0000-0000000000a2','SA0002','โอ๋','sales')\""
for f in $(ls "$DIR"/src/[1-3]*.sql | sort); do run "$P -d t -f $f" >/dev/null; done
for f in $(ls "$DIR"/src/zz_*.sql 2>/dev/null | sort); do echo "--- $(basename $f)"; run "$P -d t -A -F ' | ' -f $f"; done
