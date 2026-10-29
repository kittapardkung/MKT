-- JUSTICE GROUP AI Sales Manager — Views, RLS, Grants (Phase 3)

-- ============ Views (security_invoker: ผ่าน RLS ของผู้เรียก) ============
create or replace view crm.v_lead_control_center with (security_invoker = true) as
select
  l.id as lead_id, l.lead_code, l.customer_name, l.interested_model,
  s.display_name as responsible_sales, s.code as sales_code,
  l.stage, l.temperature, l.last_contact_at, l.next_follow_up_at,
  l.phone_norm as phone,
  coalesce(l.next_action, ai.next_best_action, case l.stage
    when 'NEW' then 'โทรติดต่อลูกค้าครั้งแรก และสอบถามความต้องการ'
    when 'CONTACTED' then 'สอบถามงบ/ระยะเวลาซื้อ และส่งรายละเอียดรุ่นรถ'
    when 'FOLLOW_UP' then 'ส่งตารางผ่อน และชวนนัดทดลองขับ'
    when 'APPOINTMENT' then 'ยืนยันนัดหมายก่อนวันนัด'
    when 'TEST_DRIVE' then 'ถามความเห็นหลังทดลองขับ และเสนอราคา'
    when 'QUOTATION' then 'ติดตามผลการเสนอราคา และช่วยประเมินสินเชื่อ'
    when 'NEGOTIATION' then 'เจรจาราคา/โปรโมชั่น/เงื่อนไข เพื่อปิดการขาย'
    when 'BOOKING' then 'ดำเนินการสินเชื่อ/เอกสารการจอง'
    when 'FINANCE_PENDING' then 'ติดตามผลไฟแนนซ์และเอกสาร'
    when 'FINANCE_APPROVED' then 'ยืนยันเงื่อนไขและเตรียมรถ'
    when 'READY_TO_DELIVER' then 'นัดหมายวันรับรถ'
    when 'LOST' then 'ทบทวนสาเหตุที่เสีย และประเมินว่าควรกลับมาติดต่อหรือไม่'
    else 'ตรวจสอบสถานะลีด' end) as next_best_action,
  t.id as task_id, t.kind as task_kind, t.due_at as task_due_at, t.reminder_state, t.escalation_level,
  case when t.id is null then 'NONE' else 'OPEN' end as task_status,
  f.flags,
  case
    when f.flags && array['UNASSIGNED','FIRST_CONTACT_OVERDUE','LOST_WITH_SIGNAL'] then 'HIGH'
    when 'OVERDUE_FOLLOWUP' = any(f.flags) and l.temperature = 'HOT' then 'HIGH'
    when cardinality(f.flags) > 0 then 'MEDIUM'
    else 'LOW' end as risk_level,
  l.created_at, l.legacy_unverified,
  l.first_contact_at, l.accepted_at, l.dormant, ev.last_msg as last_customer_message_at, ev.last_msg_body as last_customer_message,
  (st.lead_id is not null) as starred, st.note as star_note
from crm.leads l
left join crm.sales_team s on s.id = l.owner_id
left join crm.tasks t on t.lead_id = l.id and t.status = 'OPEN'
-- สรุปประวัติต่อลีด "ครั้งเดียว" (ไม่ใช่ subquery ต่อแถว) เพื่อไม่ให้ช้าเมื่อข้อมูลโต
left join (
  select e.lead_id,
         max(e.occurred_at) as last_event,
         max(e.occurred_at) filter (where e.type = 'CUSTOMER_MESSAGE') as last_msg,
         left((array_agg(e.body order by e.occurred_at desc) filter (where e.type = 'CUSTOMER_MESSAGE'))[1], 200) as last_msg_body,
         max(e.occurred_at) filter (where e.type = 'STAGE_CHANGE' and e.evidence->>'to' = 'LOST') as last_lost
  from crm.lead_events e group by e.lead_id
) ev on ev.lead_id = l.id
left join (select ls.lead_id, ls.note from crm.lead_stars ls where ls.sales_id = (select crm.my_id())) st on st.lead_id = l.id
left join (
  select q.entity_id from crm.data_quality_issues q
  where q.entity = 'lead' and q.status = 'OPEN' and q.severity <> 'INFO' group by q.entity_id
) dq on dq.entity_id = l.id::text
left join (select distinct on (i.lead_id) i.lead_id, i.next_best_action from crm.ai_insights i order by i.lead_id, i.id desc) ai on ai.lead_id = l.id
cross join (select minutes as new_minutes from crm.sla_rules where scope = 'NEW') sla
cross join lateral (
  select coalesce(array_remove(array[
    case when l.owner_id is null and l.phone_norm is not null and l.stage not in ('WON','LOST') then 'UNASSIGNED' end,
    case when not l.dormant and l.owner_id is not null and l.accepted_at is null and l.stage = 'NEW'
              and l.assigned_at < now() - make_interval(mins => sla.new_minutes) then 'NOT_ACCEPTED' end,
    case when not l.dormant and l.first_contact_at is null and t.kind = 'FIRST_CONTACT' and t.due_at < now() then 'FIRST_CONTACT_OVERDUE' end,
    case when not l.dormant and l.stage not in ('WON','LOST') and l.owner_id is not null and l.first_contact_at is not null and l.next_follow_up_at is null then 'NO_NEXT_FOLLOWUP' end,
    case when not l.dormant and l.stage not in ('WON','LOST') and l.next_follow_up_at < now() then 'OVERDUE_FOLLOWUP' end,
    case when not l.dormant and l.stage not in ('WON','LOST') and l.owner_id is not null
              and coalesce(ev.last_event, l.updated_at) < now() - interval '7 days' then 'STALE' end,
    case when l.stage = 'LOST' and ev.last_msg is not null and ev.last_msg > coalesce(ev.last_lost, l.created_at) then 'LOST_WITH_SIGNAL' end,
    case when dq.entity_id is not null then 'DATA_CONFLICT' end
  ], null), '{}'::text[]) as flags
) f;

-- ลูกค้าจองแล้ว (รวมที่รอผู้จัดการตรวจสอบ)
create or replace view crm.v_bookings with (security_invoker = true) as
select d.id as deal_id, l.id as lead_id, l.lead_code, l.customer_name, l.phone_norm as phone, l.stage, l.interested_model,
  d.doc_ref, d.amount, d.details, d.booked_on, d.created_at, d.verified_at, (d.verified_at is not null) as verified,
  cb.display_name as reported_by, ow.display_name as responsible_sales, vb.display_name as verified_by_name
from crm.deals d
join crm.leads l on l.id = d.lead_id
left join crm.sales_team cb on cb.id = d.created_by
left join crm.sales_team ow on ow.id = l.owner_id
left join crm.sales_team vb on vb.id = d.verified_by
where d.kind = 'BOOKING';

-- หน้าแรกของเซลล์: "วันนี้ต้องติดต่อใครก่อน เพราะอะไร ต้องทำอะไร"
create or replace view crm.v_my_today with (security_invoker = true) as
select
  k.id as task_id, l.id as lead_id, l.lead_code, l.customer_name, l.interested_model, l.phone_norm as phone,
  l.stage, l.temperature, k.kind, k.due_at, k.priority, k.reminder_state,
  greatest(0, floor(extract(epoch from (now() - k.due_at)) / 60))::int as overdue_minutes,
  case
    when k.kind = 'FIRST_CONTACT' and k.due_at < now() then 'ลีดใหม่ เลยกำหนดติดต่อครั้งแรก — ลูกค้ากำลังรอ'
    when k.kind = 'FIRST_CONTACT' then 'ลีดใหม่ ต้องติดต่อครั้งแรกภายในเวลา SLA'
    when k.due_at < now() and l.temperature = 'HOT' then 'ลีด HOT เลยกำหนดติดตาม — เสี่ยงเสียโอกาสสูง'
    when k.due_at < now() then 'เลยกำหนดติดตาม'
    when l.temperature = 'HOT' then 'ลีด HOT ถึงกำหนดติดตามวันนี้'
    else 'ถึงกำหนดติดตาม' end as reason,
  cc.next_best_action as action,
  cc.risk_level, cc.flags, cc.responsible_sales
from crm.tasks k
join crm.leads l on l.id = k.lead_id
join crm.v_lead_control_center cc on cc.lead_id = l.id
where k.status = 'OPEN'
  and k.due_at < (date_trunc('day', now() at time zone 'Asia/Bangkok') + interval '1 day') at time zone 'Asia/Bangkok'
order by (k.due_at < now()) desc, k.priority desc, k.due_at;

-- v_lead_control_center_all = ชุดเดียวกับ v_lead_control_center แต่ข้าม RLS (ใช้ภายใน view ที่คัดสิทธิ์เอง)
create or replace view crm.v_lead_control_center_all as select * from crm.v_lead_control_center;
alter view crm.v_lead_control_center_all set (security_invoker = false);

-- ============ Views ภาพรวม (definer: ไม่เปิดข้อมูลส่วนบุคคล, คัดสิทธิ์ในตัว view) ============
create or replace view crm.v_sales_performance as
select
  s.id as sales_id, s.code, s.display_name,
  count(l.id) as assigned_leads,
  count(l.id) filter (where l.accepted_at is not null) as accepted_leads,
  round(100.0 * count(l.id) filter (where l.first_contact_at is not null and l.assigned_at is not null
        and l.first_contact_at <= crm.add_work_minutes(l.assigned_at, (select minutes from crm.sla_rules where scope = 'NEW')))
        / nullif(count(l.id) filter (where l.assigned_at is not null), 0), 1) as first_response_sla_pct,
  count(l.id) filter (where l.first_contact_at is not null) as contacted_leads,
  count(l.id) filter (where l.stage not in ('WON','LOST') and l.first_contact_at is not null and l.next_follow_up_at is null) as leads_without_next_action,
  (select count(*) from crm.tasks k where k.assignee_id = s.id and k.status = 'OPEN' and k.due_at < now()) as overdue_tasks,
  round(100.0 * (select count(*) from crm.tasks k where k.assignee_id = s.id and k.status = 'DONE' and k.completed_at <= k.due_at)
        / nullif((select count(*) from crm.tasks k where k.assignee_id = s.id and k.status in ('DONE') ), 0), 1) as followup_ontime_pct,
  -- อัตราตามสถานะปัจจุบัน (จะแม่นยำขึ้นเมื่อมี stage history)
  round(100.0 * count(l.id) filter (where l.stage in ('APPOINTMENT','TEST_DRIVE','QUOTATION','NEGOTIATION','BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON')) / nullif(count(l.id), 0), 1) as appointment_rate_pct,
  round(100.0 * count(l.id) filter (where l.stage in ('TEST_DRIVE','QUOTATION','NEGOTIATION','BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON')) / nullif(count(l.id), 0), 1) as test_drive_rate_pct,
  round(100.0 * count(l.id) filter (where l.stage in ('QUOTATION','NEGOTIATION','BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON')) / nullif(count(l.id), 0), 1) as quotation_rate_pct,
  round(100.0 * count(l.id) filter (where l.stage in ('BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON')) / nullif(count(l.id), 0), 1) as booking_rate_pct,
  count(l.id) filter (where l.stage = 'WON') as won,
  count(l.id) filter (where l.stage = 'LOST') as lost,
  round(avg(extract(epoch from (now() - l.created_at)) / 86400) filter (where l.stage not in ('WON','LOST')), 1) as pipeline_age_days,
  -- บริบทความยุติธรรม: ลีดที่ได้รับมีสัดส่วน HOT เท่าไร
  round(100.0 * count(l.id) filter (where l.temperature = 'HOT') / nullif(count(l.id), 0), 1) as hot_share_pct
from crm.sales_team s
left join crm.leads l on l.owner_id = s.id
where s.role = 'sales' and ((select crm.is_leadership()) or s.id = (select crm.my_id()))
group by s.id, s.code, s.display_name;

create or replace view crm.v_exec_summary as
select
  count(*) as total_leads,
  count(*) filter (where stage not in ('WON','LOST')) as active_leads,
  count(*) filter (where owner_id is null and phone_norm is not null and stage not in ('WON','LOST')) as unassigned_leads,
  count(*) filter (where stage not in ('WON','LOST') and not dormant and next_follow_up_at < now()) as overdue_followups,
  count(*) filter (where stage = 'WON') as won,
  count(*) filter (where stage = 'LOST') as lost,
  count(*) filter (where stage in ('BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON')) as booking_or_won,
  (select count(*) from crm.v_lead_control_center_all c where c.risk_level = 'HIGH') as leads_at_risk,
  round(100.0 * count(*) filter (where first_contact_at is not null and assigned_at is not null
      and first_contact_at <= crm.add_work_minutes(assigned_at, (select minutes from crm.sla_rules where scope = 'NEW')))
      / nullif(count(*) filter (where assigned_at is not null), 0), 1) as contact_sla_pct,
  (select count(*) from crm.data_quality_issues where status = 'OPEN') as open_dq_issues
from crm.leads
where (select crm.is_leadership());

create or replace view crm.v_funnel as
select stage, count(*) as leads
from crm.leads where (select crm.is_leadership()) group by stage;

-- ลีดเสี่ยงสำหรับผู้บริหาร: ไม่มีชื่อ/เบอร์ลูกค้า
create or replace view crm.v_exec_risk_leads as
select c.lead_code, c.responsible_sales, c.stage, c.temperature, c.risk_level, c.flags, c.next_follow_up_at, c.created_at
from crm.v_lead_control_center_all c
where (select crm.is_leadership()) and c.risk_level = 'HIGH';

