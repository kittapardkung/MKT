-- รายงานรายสัปดาห์ (รวมตัวเลขทั้งหมดเป็น JSON ไม่มีชื่อ/เบอร์ลูกค้า — อ้างลีดด้วย lead_code เท่านั้น)
-- เรียกจาก n8n ด้วย service_role หรือรันใน SQL Editor:  select crm.weekly_report(7);
create or replace function crm.weekly_report(p_days int default 7) returns jsonb
language plpgsql stable set search_path = crm, pg_temp as $$
declare
  d int := greatest(1, least(coalesce(p_days, 7), 90));
  w0 timestamptz := now() - make_interval(days => d);        -- ต้นช่วงปัจจุบัน
  w1 timestamptz := now() - make_interval(days => 2 * d);    -- ต้นช่วงก่อนหน้า
  post text[] := array['BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON'];
begin
  return jsonb_build_object(
    'generated_at', now(), 'period_days', d, 'timezone', 'Asia/Bangkok',
    'window_start', w0, 'previous_window_start', w1,
    'note', 'เวลาเป็น UTC (เวลาไทย = UTC+7); ข้อมูลก่อน 2026-11-03 มาจาก Google Sheet เดิม ไม่มีประวัติเปลี่ยนสถานะละเอียด',

    'sales', (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]') from (
      select s.code, s.display_name as name,
        (select count(*) from crm.leads l where l.owner_id = s.id and l.assigned_at > w0) as leads_assigned,
        (select count(*) from crm.leads l where l.owner_id = s.id and l.assigned_at > w1 and l.assigned_at <= w0) as leads_assigned_prev,
        (select count(*) from crm.leads l where l.owner_id = s.id and l.assigned_at > w0 and l.temperature = 'HOT') as hot_leads_assigned,
        (select count(*) from crm.leads l where l.owner_id = s.id and l.assigned_at > w0 and l.first_contact_at is not null) as contacted,
        (select count(*) from crm.leads l where l.owner_id = s.id and l.assigned_at > w0 and l.first_contact_at is null and l.stage <> 'LOST') as not_contacted,
        (select round((avg(extract(epoch from (l.first_contact_at - l.assigned_at))) / 3600)::numeric, 1) from crm.leads l
           where l.owner_id = s.id and l.assigned_at > w0 and l.first_contact_at >= l.assigned_at) as avg_hours_to_first_contact,
        (select count(*) from crm.lead_events e where e.actor_id = s.id and e.type in ('CONTACT_SUCCESS','CONTACT_ATTEMPT','SALES_REPLY') and e.occurred_at > w0) as contact_logs,
        (select count(*) from crm.lead_events e where e.actor_id = s.id and e.type in ('CONTACT_SUCCESS','CONTACT_ATTEMPT','SALES_REPLY') and e.occurred_at > w1 and e.occurred_at <= w0) as contact_logs_prev,
        (select count(*) from crm.tasks k where k.assignee_id = s.id and k.status = 'OPEN') as open_tasks,
        (select count(*) from crm.tasks k where k.assignee_id = s.id and k.status = 'OPEN' and k.due_at < now()) as overdue_tasks,
        (select count(*) from crm.tasks k where k.assignee_id = s.id and k.status = 'OPEN' and k.due_at < now() - interval '7 days') as overdue_over_7d,
        (select count(*) from crm.deals x join crm.leads l on l.id = x.lead_id where l.owner_id = s.id and x.kind = 'BOOKING' and x.created_at > w0) as bookings_reported,
        (select count(*) from crm.deals x join crm.leads l on l.id = x.lead_id where l.owner_id = s.id and x.kind = 'BOOKING' and x.verified_at is not null) as bookings_verified_total,
        (select count(*) from crm.leads l where l.owner_id = s.id and l.stage = 'WON') as won_total,
        (select count(*) from crm.lead_events e where e.actor_id = s.id and e.type = 'STAGE_CHANGE' and e.evidence->>'to' = 'LOST' and e.occurred_at > w0) as lost_in_period,
        (select count(*) from crm.leads l where l.owner_id = s.id and l.stage not in ('WON','LOST') and not l.dormant) as active_leads
      from crm.sales_team s where s.role = 'sales' and s.active) t),

    'leads_by_source', (select coalesce(jsonb_agg(to_jsonb(t) order by t.this_period desc), '[]') from (
      select source, count(*) filter (where created_at > w0) as this_period,
             count(*) filter (where created_at > w1 and created_at <= w0) as previous_period
      from crm.leads where created_at > w1 group by source) t),

    'leads_assigned_per_day', (select coalesce(jsonb_agg(to_jsonb(t) order by t.day, t.sales), '[]') from (
      select (l.assigned_at at time zone 'Asia/Bangkok')::date as day, s.code as sales, count(*) as leads
      from crm.leads l join crm.sales_team s on s.id = l.owner_id where l.assigned_at > w0 group by 1, 2) t),

    'unassigned_leads', (select count(*) from crm.leads where owner_id is null and phone_norm is not null and stage not in ('WON','LOST')),

    'funnel_now', (select coalesce(jsonb_agg(to_jsonb(t) order by t.leads desc), '[]') from (
      select stage, count(*) as leads from crm.leads where not dormant or stage = any(post) group by stage) t),

    'dormant_leads', (select count(*) from crm.leads where dormant),

    'stage_changes_in_period', (select coalesce(jsonb_agg(to_jsonb(t) order by t.n desc), '[]') from (
      select e.evidence->>'from' as from_stage, e.evidence->>'to' as to_stage, count(*) as n
      from crm.lead_events e where e.type = 'STAGE_CHANGE' and e.occurred_at > w0 group by 1, 2) t),

    'bookings_and_delivery', (select coalesce(jsonb_agg(to_jsonb(t) order by t.booked_on desc nulls last), '[]') from (
      select l.lead_code, s.code as sales, x.details->>'model' as model, x.details->>'purchase_type' as purchase_type,
             (x.verified_at is not null) as verified, l.stage, x.booked_on,
             (coalesce(x.details->>'vin', '') <> '') as vin_recorded,
             x.details->>'delivery_date' as delivery_date, x.details->>'delivered_on' as delivered_on
      from crm.deals x join crm.leads l on l.id = x.lead_id left join crm.sales_team s on s.id = l.owner_id
      where x.kind = 'BOOKING' and (x.created_at > w0 or l.stage = any(post) and l.stage <> 'WON'
            or (x.details->>'delivered_on') >= to_char(w0, 'YYYY-MM-DD'))) t),

    'risk_leads', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
      select l.lead_code, s.code as sales, l.stage, l.temperature, l.next_follow_up_at, l.last_contact_at, l.assigned_at,
             case when l.first_contact_at is null then 'NO_FIRST_CONTACT_OVER_4H' else 'HOT_OVERDUE' end as reason
      from crm.leads l left join crm.sales_team s on s.id = l.owner_id
      where l.stage not in ('BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON','LOST') and not l.dormant
        and ((l.first_contact_at is null and l.assigned_at < now() - interval '4 hours')
             or (l.temperature = 'HOT' and l.next_follow_up_at < now() and (l.last_contact_at is null or l.next_follow_up_at > l.last_contact_at)))
      order by l.assigned_at nulls last limit 30) t),

    'data_quality_open', (select coalesce(jsonb_agg(to_jsonb(t) order by t.open_issues desc), '[]') from (
      select code, severity, count(*) as open_issues from crm.data_quality_issues where status = 'OPEN' group by 1, 2) t),

    'ingest_log_in_period', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
      select result, count(*) as n from crm.ingest_log where at > w0 group by 1) t),

    'system', jsonb_build_object('alerts_enabled', crm.setting('alerts_enabled'))
  );
end $$;

revoke all on function crm.weekly_report(int) from public, anon, authenticated;
grant execute on function crm.weekly_report(int) to service_role;
