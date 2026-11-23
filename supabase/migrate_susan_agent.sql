-- MKT Content Manager — รวม COMPASS (กลยุทธ์) + SPARK (คลัง Hook) เข้าเป็น agent เดียว "SUSAN"
-- (นักกลยุทธ์การตลาดออนไลน์: อ่านผล Meta Ads → วางกลยุทธ์ → คลัง Hook → สั่งทำวิดีโอ)
-- รันใน SQL Editor หลังจาก migrate_tiktok_agent.sql แล้ว และต้องรันก่อน sync susan.json ครั้งแรก
-- ไม่มีการ drop table / ลบแถวใดๆ — ปลอดภัยที่จะรันซ้ำ (idempotent)
-- ค่า COMPASS / SPARK ยังอยู่ใน check เพื่อไม่ให้แถวเก่าผิดเงื่อนไข (แอปไม่แสดงรายงาน COMPASS แล้ว)

alter table agent_reports drop constraint if exists agent_reports_agent_check;
alter table agent_reports add constraint agent_reports_agent_check
  check (agent in ('SCOUT', 'COMPASS', 'SPARK', 'SUSAN', 'ADS', 'ALMANAC', 'TIKTOK'));

alter table ideas drop constraint if exists ideas_agent_check;
alter table ideas add constraint ideas_agent_check
  check (agent in ('SCOUT', 'COMPASS', 'SPARK', 'SUSAN', 'ALMANAC'));

-- ไอเดีย/Hook เดิมของ SPARK ย้ายมาอยู่ในคลังของ SUSAN (สถานะ สนใจ/ไม่สนใจ ที่กดไว้ยังอยู่ครบ)
update ideas set agent = 'SUSAN' where agent = 'SPARK';
alter table ideas alter column agent set default 'SUSAN';
