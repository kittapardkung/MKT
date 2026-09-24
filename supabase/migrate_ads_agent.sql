-- MKT Content Manager — เพิ่ม agent ใหม่ "ADS" (ทีมโฆษณา Meta Ads)
-- รันใน SQL Editor หลังจาก migrate_agent_workflow.sql แล้วเท่านั้น
-- ไม่มีการ drop table ใดๆ ในไฟล์นี้ — ปลอดภัยที่จะรันซ้ำ (idempotent)

-- agent_reports.agent เดิม check เฉพาะ SCOUT/COMPASS/SPARK/ALMANAC — เพิ่ม ADS เข้าไป
alter table agent_reports drop constraint if exists agent_reports_agent_check;
alter table agent_reports add constraint agent_reports_agent_check
  check (agent in ('SCOUT', 'COMPASS', 'SPARK', 'ADS', 'ALMANAC'));
