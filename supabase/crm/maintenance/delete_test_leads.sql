-- ลบ "ลีดทดสอบ" ที่สร้างตอนทดสอบระบบรับลีด (ไม่ใช่ข้อมูลเดิมจาก Google Sheet)
-- ปลอดภัย: ลบเฉพาะลีดที่ (1) lead_code อยู่ในรายการด้านล่าง (2) แหล่งที่มาเป็น 'Call Center%' (เจ้าของส่งเข้า)
--          (3) ไม่มีใบจอง/ส่งมอบ — ถ้าข้อใดไม่ตรง สคริปต์จะหยุดโดยไม่ลบอะไรเลย
-- ประวัติการแก้ไข (audit_log) ยังคงเก็บไว้ ; รันซ้ำได้ (ถ้าไม่มีลีดแล้วจะไม่ทำอะไร)

-- ขั้นที่ 1: ดูก่อนว่าจะลบอะไร (อ่านอย่างเดียว) — รันบล็อกนี้ก่อน แล้วตรวจให้ตรงกับที่ต้องการ
-- select lead_code, customer_name, phone_norm, source, stage, created_at from crm.leads
--  where lead_code in ('20261102-000001','20261102-000002');

-- ขั้นที่ 2: ลบ
do $$
declare
  -- แก้รายการได้ที่นี่ (หรือกำหนดผ่าน set crm.delete_codes = 'รหัส1,รหัส2' ก่อนรัน)
  codes text[] := coalesce(string_to_array(nullif(current_setting('crm.delete_codes', true), ''), ','), array['20261102-000001', '20261102-000002']);
  ids uuid[]; n_found int; n_bad int; n_deal int;
begin
  select array_agg(id), count(*) into ids, n_found from crm.leads where lead_code = any(codes);
  if n_found is null or n_found = 0 then raise notice 'ไม่พบลีดตามรายการ — ไม่ได้ลบอะไร'; return; end if;
  select count(*) into n_bad from crm.leads where id = any(ids) and coalesce(source, '') not like 'Call Center%';
  if n_bad > 0 then raise exception 'หยุด: มี % ลีดที่ไม่ได้มาจากโหมดเจ้าของส่งเบอร์เข้าเพจ (ไม่ใช่ลีดทดสอบ) — ไม่ได้ลบอะไร', n_bad; end if;
  select count(*) into n_deal from crm.deals where lead_id = any(ids);
  if n_deal > 0 then raise exception 'หยุด: ลีดมีใบจอง/ส่งมอบ % รายการ — ไม่ได้ลบอะไร', n_deal; end if;

  delete from crm.alerts where task_id in (select id from crm.tasks where lead_id = any(ids));
  delete from crm.tasks where lead_id = any(ids);
  delete from crm.ai_insights where lead_id = any(ids);
  delete from crm.lead_stars where lead_id = any(ids);
  delete from crm.lead_events where lead_id = any(ids);
  delete from crm.data_quality_issues where entity = 'lead' and entity_id in (select unnest(ids)::text);
  delete from crm.leads where id = any(ids);
  raise notice 'ลบลีดทดสอบแล้ว % ลีด', n_found;
end $$;
