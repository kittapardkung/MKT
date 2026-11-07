-- รายงานรายสัปดาห์ในแอป: n8n (service_role) บันทึกผลลง report_snapshots ทุกครั้งที่สร้างรายงาน
-- แอปอ่านได้เฉพาะ ผู้จัดการ/ผู้บริหาร/แอดมิน (เซลล์มองไม่เห็น เพราะมีข้อเสนอการโค้ช)
create table if not exists crm.report_snapshots (
  id            bigserial primary key,
  period_days   int not null,
  generated_at  timestamptz not null default now(),
  report        jsonb not null,            -- ผล crm.weekly_report (ไม่มีชื่อ/เบอร์ลูกค้า)
  overview_text text,                      -- บทวิเคราะห์ภาพรวมจาก AI
  person_texts  jsonb not null default '{}'::jsonb   -- { "SA0001": "บทวิเคราะห์รายคน", ... }
);
create index if not exists report_snapshots_gen_idx on crm.report_snapshots(generated_at desc);

alter table crm.report_snapshots enable row level security;
drop policy if exists p_report_snapshots_sel on crm.report_snapshots;
create policy p_report_snapshots_sel on crm.report_snapshots for select to authenticated using ((select crm.is_leadership()));

revoke all on crm.report_snapshots from public, anon, authenticated;
grant select on crm.report_snapshots to authenticated;
grant all on crm.report_snapshots to service_role;
grant usage, select on sequence crm.report_snapshots_id_seq to service_role;

-- ตัวเลขสดตอนเปิดหน้ารายงาน (ผู้บริหารเท่านั้น); ครอบ weekly_report ที่จำกัดสิทธิ์ service_role
create or replace function crm.get_weekly_report(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = crm, pg_temp as $$
begin
  if not coalesce(crm.is_leadership(), false) then raise exception 'forbidden'; end if;
  return crm.weekly_report(p_days);
end $$;
revoke all on function crm.get_weekly_report(int) from public, anon;
grant execute on function crm.get_weekly_report(int) to authenticated, service_role;
