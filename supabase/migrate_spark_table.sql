-- MKT Content Manager — SPARK table view + สนใจ/ไม่สนใจ migration
-- รันใน Supabase SQL Editor "หลังจาก" schema.sql + migrate_agent_workflow.sql แล้วเท่านั้น
--
-- เพิ่มคอลัมน์ให้ ideas รองรับ:
--   - ตาราง SPARK แบบโครงสร้าง (code / product / type / formula) แทนการพาร์สจาก category/note
--   - สถานะ "สนใจ / ไม่สนใจ" ต่อไอเดีย (interest) ที่ทีมกดเลือกเองในหน้า SPARK
--
-- ไม่มีการ drop table ใดๆ ในไฟล์นี้ — ปลอดภัยที่จะรันซ้ำ (idempotent)

alter table ideas add column if not exists code text;
alter table ideas add column if not exists product text default '';
alter table ideas add column if not exists type text;
alter table ideas add column if not exists formula text;
alter table ideas add column if not exists interest text not null default 'pending'
  check (interest in ('pending', 'interested', 'not_interested'));

create index if not exists ideas_interest_idx on ideas (interest);
