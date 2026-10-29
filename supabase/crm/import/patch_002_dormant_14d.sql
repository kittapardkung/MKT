-- พักลีดเก่าที่ไม่เคลื่อนไหวเกิน N วัน (ค่าเริ่มต้น 14) — แก้ที่ v_days ถ้าต้องการเกณฑ์อื่น
-- เงื่อนไข "พัก": ลีดที่ยังเปิดอยู่ (ไม่ใช่ WON/LOST) + ไม่มีกิจกรรมใดเกิน N วัน + ไม่มีนัดติดตามที่ยังไม่ถึงกำหนด
-- ลีดที่พักแล้วไม่มีงานค้าง/ไม่แจ้งเตือน และ "ตื่น" เองเมื่อลูกค้าทักมาใหม่ (ingest_message) — ไม่ลบข้อมูล
-- ใช้กับลีดที่นำเข้าจากชีตเดิมเท่านั้น (legacy is not null) รันซ้ำได้
with calc as (
  select l.id,
    (l.stage not in ('WON', 'LOST')
     and greatest(l.created_at, coalesce(l.last_contact_at, l.created_at),
                  coalesce((select max(e.occurred_at) from crm.lead_events e where e.lead_id = l.id), l.created_at))
         < now() - make_interval(days => 14)
     and (l.next_follow_up_at is null or l.next_follow_up_at < now())) as d
  from crm.leads l where l.legacy is not null
)
update crm.leads l set dormant = c.d from calc c where c.id = l.id and l.dormant is distinct from c.d;

select count(*) filter (where dormant) as dormant_leads,
       count(*) filter (where not dormant and stage not in ('WON', 'LOST')) as active_leads,
       (select count(*) from crm.tasks where status = 'OPEN') as open_tasks,
       (select count(*) from crm.tasks where status = 'OPEN' and due_at < now()) as overdue_tasks
from crm.leads;
