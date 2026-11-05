-- รายงานเซลล์รายคน (อ่านอย่างเดียว ไม่มีชื่อ/เบอร์ลูกค้า) — รันใน Supabase SQL Editor
-- ช่วงเวลา: แก้เลข 7 และ 30 วัน ได้ที่ CTE "p" ด้านล่าง
with p as (select 7 as d_short, 30 as d_long),
s as (select id, code, display_name from crm.sales_team where role = 'sales' and active),
lead as (
  select l.*, p.d_short, p.d_long from crm.leads l cross join p where l.owner_id is not null
),
ev as (
  select e.actor_id, e.type, e.occurred_at, e.evidence, p.d_short, p.d_long
  from crm.lead_events e cross join p where e.actor_id is not null
)
select
  s.code as "รหัส", s.display_name as "เซลล์",
  -- ลีดที่ได้รับ
  (select count(*) from lead where owner_id = s.id and assigned_at > now() - make_interval(days => d_short)) as "ลีดใหม่ที่ได้ (7 วัน)",
  (select count(*) from lead where owner_id = s.id and assigned_at > now() - make_interval(days => d_long))  as "ลีดใหม่ที่ได้ (30 วัน)",
  -- ความเร็วในการติดต่อ (ลีดที่ได้รับใน 30 วัน)
  (select count(*) from lead where owner_id = s.id and assigned_at > now() - make_interval(days => d_long) and first_contact_at is not null) as "ติดต่อแล้ว (30 วัน)",
  (select count(*) from lead where owner_id = s.id and assigned_at > now() - make_interval(days => d_long) and first_contact_at is null and stage <> 'LOST') as "ยังไม่ได้ติดต่อ (30 วัน)",
  (select round((avg(extract(epoch from (first_contact_at - assigned_at))) / 3600)::numeric, 1) from lead
     where owner_id = s.id and assigned_at > now() - make_interval(days => d_long) and first_contact_at >= assigned_at) as "ติดต่อแรกเฉลี่ย (ชม.)",
  -- การทำงาน
  (select count(*) from ev where actor_id = s.id and type in ('CONTACT_SUCCESS','CONTACT_ATTEMPT','SALES_REPLY') and occurred_at > now() - make_interval(days => d_short)) as "บันทึกผลติดต่อ (7 วัน)",
  (select count(*) from ev where actor_id = s.id and type in ('CONTACT_SUCCESS','CONTACT_ATTEMPT','SALES_REPLY') and occurred_at > now() - make_interval(days => d_long))  as "บันทึกผลติดต่อ (30 วัน)",
  -- งานค้าง ณ ตอนนี้
  (select count(*) from crm.tasks k where k.assignee_id = s.id and k.status = 'OPEN') as "งานค้างทั้งหมด",
  (select count(*) from crm.tasks k where k.assignee_id = s.id and k.status = 'OPEN' and k.due_at < now()) as "งานเลยกำหนด",
  (select count(*) from crm.tasks k where k.assignee_id = s.id and k.status = 'OPEN' and k.due_at < now() - interval '7 days') as "เลยกำหนดเกิน 7 วัน",
  -- ผลลัพธ์
  (select count(*) from crm.deals d join crm.leads l on l.id = d.lead_id where l.owner_id = s.id and d.kind = 'BOOKING' and d.created_at > now() - make_interval(days => (select d_long from p))) as "แจ้งจอง (30 วัน)",
  (select count(*) from crm.deals d join crm.leads l on l.id = d.lead_id where l.owner_id = s.id and d.kind = 'BOOKING' and d.verified_at is not null) as "จองยืนยันแล้ว (รวม)",
  (select count(*) from lead where owner_id = s.id and stage = 'WON') as "ปิดการขาย (ทั้งหมด)",
  (select count(*) from ev where actor_id = s.id and type = 'STAGE_CHANGE' and evidence->>'to' = 'LOST' and occurred_at > now() - make_interval(days => d_long)) as "ปิดเป็นเสียโอกาส (30 วัน)",
  -- ลีดในมือ
  (select count(*) from lead where owner_id = s.id and stage not in ('WON','LOST') and not dormant) as "ลีดที่กำลังติดตาม"
from s
cross join (select d_short, d_long from p) pp
order by s.code;
