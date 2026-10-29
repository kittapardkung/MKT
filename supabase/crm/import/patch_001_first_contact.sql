-- แก้ลีดเก่าที่นำเข้าแล้ว: สถานะเลย NEW ไปแล้วแต่ไม่มีเวลาติดต่อครั้งแรก (ประวัติเดิมมีแต่การเปลี่ยนสถานะ ไม่มีข้อความเซลล์)
-- ใช้เวลาของเหตุการณ์แรกในประวัติเดิมเป็นหลักฐาน; ลีดที่ไม่มีหลักฐานเลยจะไม่ถูกแก้ (ยังเป็น NULL)
-- รันซ้ำได้
select set_config('crm.migration_mode', 'on', false);
update crm.leads l set
  first_contact_at = coalesce(
    (select min(e.occurred_at) from crm.lead_events e where e.lead_id = l.id and e.type in ('SALES_REPLY', 'STAGE_CHANGE')),
    l.accepted_at),
  last_contact_at = coalesce(l.last_contact_at,
    (select max(e.occurred_at) from crm.lead_events e where e.lead_id = l.id and e.type in ('SALES_REPLY', 'STAGE_CHANGE')),
    l.accepted_at)
where l.legacy is not null and l.stage <> 'NEW' and l.first_contact_at is null
  and exists (select 1 from crm.lead_events e where e.lead_id = l.id and e.type in ('SALES_REPLY', 'STAGE_CHANGE') or l.accepted_at is not null);
select set_config('crm.migration_mode', 'off', false);
select count(*) as still_missing_first_contact from crm.leads where legacy is not null and stage <> 'NEW' and first_contact_at is null and owner_id is not null;
select count(*) filter (where kind = 'FIRST_CONTACT') as first_contact_tasks, count(*) filter (where kind = 'FOLLOW_UP') as follow_up_tasks from crm.tasks where status = 'OPEN';
