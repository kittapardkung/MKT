-- MKT Content Manager — เพิ่ม agent ใหม่ "TIKTOK" (TikTok Content Pipeline: ปัน · Susan · AI ตัดต่อ)
-- รันใน SQL Editor หลังจาก migrate_ads_agent.sql แล้วเท่านั้น
-- ไม่มีการ drop table ใดๆ ในไฟล์นี้ — ปลอดภัยที่จะรันซ้ำ (idempotent)

alter table agent_reports drop constraint if exists agent_reports_agent_check;
alter table agent_reports add constraint agent_reports_agent_check
  check (agent in ('SCOUT', 'COMPASS', 'SPARK', 'ADS', 'ALMANAC', 'TIKTOK'));
