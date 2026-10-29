#!/usr/bin/env bash
# วัดเวลาคำค้นของเว็บบนข้อมูลที่นำเข้าแล้ว (ใช้ RLS จริงด้วยบทบาท authenticated):  bash tests/perf-local.sh <โฟลเดอร์ SQL นำเข้า>
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; SRC="$(cd "$1" && pwd)"
PGBIN=/usr/lib/postgresql/16/bin; DIR="$(mktemp -d)"; PORT=54332; chown postgres "$DIR" 2>/dev/null || true
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
mkdir -p "$DIR/src" && cp "$SRC"/*.sql "$DIR/src/" && chmod -R a+rX "$DIR" "$HERE" 2>/dev/null || true
run "$PGBIN/initdb -D $DIR/data -A trust >/dev/null"; run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true' EXIT
P="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
run "$P -d postgres -c 'create database t'"
for f in tests/00_supabase_stub.sql install_all.sql; do run "$P -d t -f $HERE/$f" >/dev/null 2>&1; done
run "$P -d t -c \"insert into crm.sales_team(user_id, code, display_name, role) values ('10000000-0000-0000-0000-000000000001','AD0001','เจ้าของ','admin'),('10000000-0000-0000-0000-0000000000a1','SA0001','วิ','sales'),('10000000-0000-0000-0000-0000000000a2','SA0002','โอ๋','sales')\""
for f in $(ls "$DIR"/src/[1-3]*.sql | sort); do run "$P -d t -f $f" >/dev/null; done
[ -z "${NOANALYZE:-}" ] && run "$P -d t -c 'analyze'" || true
cat > "$DIR/q.sql" <<'SQL'
\timing on
begin; select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true); set local role authenticated;
\echo == admin (ดึงทุกคอลัมน์ เหมือนเว็บ)
select md5(string_agg(x::text,'')) from crm.v_my_today x;
select md5(string_agg(x::text,'')) from crm.v_lead_control_center x;
select md5(string_agg(x::text,'')) from crm.v_sales_performance x;
select md5(string_agg(x::text,'')) from crm.v_exec_summary x;
select md5(string_agg(x::text,'')) from crm.v_funnel x;
rollback;
begin; select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-0000000000a1',true); set local role authenticated;
\echo == sales SA0001
select md5(string_agg(x::text,'')) from crm.v_my_today x;
select md5(string_agg(x::text,'')) from crm.v_lead_control_center x;
select md5(string_agg(x::text,'')) from crm.v_sales_performance x;
rollback;
SQL
chmod a+r "$DIR/q.sql"
if [ -n "${PLAN:-}" ]; then printf "begin; select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true); set local role authenticated;\n\\\\timing on\nselect count(*) from crm.leads;\nselect count(*) from crm.v_my_today;\nselect count(*) from crm.v_my_today;\nselect count(*) from crm.leads;\nrollback;\n" > "$DIR/p.sql"; chmod a+r "$DIR/p.sql"; run "$P -d t -f $DIR/p.sql" 2>&1 2>&1 | head -60; else run "$P -d t -f $DIR/q.sql" 2>&1 | grep -E "==|Time:"; fi
