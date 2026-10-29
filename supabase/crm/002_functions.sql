-- JUSTICE GROUP AI Sales Manager — ฟังก์ชัน/ทริกเกอร์ (Phase 3)
-- หลักการ: ผู้ใช้ไม่เขียนตารางตรง — เขียนผ่าน RPC เหล่านี้เท่านั้น (ตรวจ role + หลักฐาน)

-- ---------- helpers ----------
create or replace function crm.setting(p_key text) returns text
language sql stable as $$ select value from crm.settings where key = p_key $$;

create or replace function crm.normalize_phone(p_raw text) returns text
language plpgsql immutable as $$
declare d text;
begin
  if p_raw is null then return null; end if;
  d := regexp_replace(p_raw, '\D', '', 'g');
  if d like '66%' and length(d) in (11, 10) then d := '0' || substr(d, 3); end if;
  if length(d) = 9 and d ~ '^[2-9]' then d := '0' || d; end if;   -- ACTIVITY_LOG เดิมตัด 0 นำหน้า
  if d ~ '^0([689][0-9]{8}|[2-7][0-9]{7})$' then return d; end if;
  return null;
end $$;

-- บวกนาทีทำการ (ตามชั่วโมงเปิด-ปิดใน crm.settings; สมมติเปิดทุกวัน)
create or replace function crm.add_work_minutes(p_from timestamptz, p_minutes int) returns timestamptz
language plpgsql stable as $$
declare
  tz text := crm.setting('tz');
  ws int := crm.setting('work_start_hour')::int;
  we int := crm.setting('work_end_hour')::int;
  loc timestamp := p_from at time zone tz;
  remaining int := p_minutes;
  day_start timestamp; day_end timestamp; avail int;
begin
  loop
    day_start := date_trunc('day', loc) + make_interval(hours => ws);
    day_end   := date_trunc('day', loc) + make_interval(hours => we);
    if loc < day_start then loc := day_start; end if;
    if loc >= day_end then loc := day_start + interval '1 day'; continue; end if;
    avail := floor(extract(epoch from (day_end - loc)) / 60)::int;
    if remaining <= avail then
      return (loc + make_interval(mins => remaining)) at time zone tz;
    end if;
    remaining := remaining - avail;
    loc := day_start + interval '1 day';
  end loop;
end $$;

create or replace function crm.me() returns crm.sales_team
language sql stable security definer set search_path = crm, pg_temp as $$
  select * from crm.sales_team where user_id = auth.uid() and active
$$;

create or replace function crm.my_role() returns text
language sql stable security definer set search_path = crm, pg_temp as $$
  select role from crm.sales_team where user_id = auth.uid() and active
$$;

create or replace function crm.is_manager() returns boolean   -- เห็นข้อมูลลีดทั้งหมด (ไม่รวม executive)
language sql stable security definer set search_path = crm, pg_temp as $$
  select coalesce(crm.my_role() in ('sales_manager','admin'), false)
$$;

create or replace function crm.is_leadership() returns boolean   -- ดู Dashboard รวม
language sql stable security definer set search_path = crm, pg_temp as $$
  select coalesce(crm.my_role() in ('sales_manager','executive','admin'), false)
$$;

-- ---------- Audit ----------
create or replace function crm.audit_trg() returns trigger
language plpgsql security definer set search_path = crm, pg_temp as $$
begin
  insert into crm.audit_log(tbl, row_id, action, before, after, actor)
  values (tg_table_name,
          coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id')),
          tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
          coalesce(auth.uid()::text, current_user));
  return coalesce(new, old);
end $$;

create or replace function crm.audit_immutable() returns trigger
language plpgsql as $$ begin raise exception 'audit_log is append-only'; end $$;

drop trigger if exists audit_immutable on crm.audit_log;
create trigger audit_immutable before update or delete on crm.audit_log
  for each row execute function crm.audit_immutable();

do $$ declare t text; begin
  foreach t in array array['leads','tasks','deals','sales_team','sla_rules','settings'] loop
    execute format('drop trigger if exists audit on crm.%I', t);
    execute format('create trigger audit after insert or update or delete on crm.%I for each row execute function crm.audit_trg()', t);
  end loop;
end $$;

-- ---------- Guard: ห้ามขึ้น BOOKING/FINANCE_APPROVED/WON ถ้าไม่มีหลักฐานที่ตรวจสอบแล้ว ----------
create or replace function crm.stage_guard() returns trigger
language plpgsql security definer set search_path = crm, pg_temp as $$
declare need text;
begin
  if tg_op = 'UPDATE' and new.stage is not distinct from old.stage then return new; end if;
  if current_setting('crm.migration_mode', true) = 'on' then
    if new.stage in ('BOOKING','FINANCE_APPROVED','WON') and not exists
       (select 1 from crm.deals d where d.lead_id = new.id and d.verified_at is not null) then
      new.legacy_unverified := true;
    end if;
    return new;
  end if;
  need := case new.stage when 'BOOKING' then 'BOOKING' when 'FINANCE_APPROVED' then 'FINANCE' when 'WON' then 'BOOKING' end;
  if need is not null and not exists
     (select 1 from crm.deals d where d.lead_id = new.id and d.kind = need and d.verified_at is not null) then
    raise exception 'evidence_required: stage % needs a verified % deal', new.stage, need using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists stage_guard on crm.leads;
create trigger stage_guard before insert or update of stage on crm.leads
  for each row execute function crm.stage_guard();

create or replace function crm.touch_updated() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch on crm.leads;
create trigger touch before update on crm.leads for each row execute function crm.touch_updated();

-- ---------- Task Engine ----------
create or replace function crm.sla_scope(p_stage text, p_first_contact timestamptz, p_temp text) returns text
language sql stable as $$
  select case when p_first_contact is null then 'NEW'
              else coalesce(p_temp, crm.setting('default_temperature')) end
$$;

create or replace function crm.refresh_task(p_lead uuid) returns void
language plpgsql security definer set search_path = crm, pg_temp as $$
declare
  l crm.leads; r crm.sla_rules; v_kind text; v_due timestamptz; v_base timestamptz; v_prio int; v_open crm.tasks;
begin
  select * into l from crm.leads where id = p_lead;
  if not found then return; end if;
  if l.stage in ('WON','LOST') or l.owner_id is null then
    update crm.tasks set status = 'CANCELLED' where lead_id = p_lead and status = 'OPEN';
    return;
  end if;

  select * into r from crm.sla_rules where scope = crm.sla_scope(l.stage, l.first_contact_at, l.temperature);
  if l.first_contact_at is null then
    v_kind := 'FIRST_CONTACT';
    v_due  := coalesce(l.next_follow_up_at,
                case when r.business_hours_only then crm.add_work_minutes(coalesce(l.assigned_at, l.created_at), r.minutes)
                     else coalesce(l.assigned_at, l.created_at) + make_interval(mins => r.minutes) end);
    v_prio := 100;
  else
    v_kind := 'FOLLOW_UP';
    v_base := coalesce(l.last_contact_at, l.first_contact_at);
    v_due  := coalesce(l.next_follow_up_at,
                case when r.business_hours_only then crm.add_work_minutes(v_base, r.minutes)
                     else v_base + make_interval(mins => r.minutes) end);
    v_prio := case coalesce(l.temperature, crm.setting('default_temperature')) when 'HOT' then 90 when 'WARM' then 60 else 30 end;
  end if;

  update crm.tasks set status = 'CANCELLED' where lead_id = p_lead and status = 'OPEN' and kind <> v_kind;

  select * into v_open from crm.tasks where lead_id = p_lead and kind = v_kind and status = 'OPEN';
  if found and v_open.due_at <> v_due then
    update crm.tasks set status = 'CANCELLED' where id = v_open.id;   -- กำหนดเวลาเปลี่ยน = งานใหม่ (แจ้งเตือนเริ่มใหม่)
    v_open := null;
  end if;
  if v_open.id is null then
    insert into crm.tasks(lead_id, assignee_id, kind, due_at, priority)
    values (p_lead, l.owner_id, v_kind, v_due, v_prio)
    on conflict (lead_id, kind) where status = 'OPEN' do nothing;
  else
    update crm.tasks set assignee_id = l.owner_id, priority = v_prio where id = v_open.id;
  end if;
end $$;

create or replace function crm.lead_task_trg() returns trigger
language plpgsql as $$ begin perform crm.refresh_task(new.id); return null; end $$;
drop trigger if exists lead_task on crm.leads;
create trigger lead_task after insert or update of owner_id, stage, temperature, next_follow_up_at, first_contact_at, last_contact_at
  on crm.leads for each row execute function crm.lead_task_trg();

-- ---------- มอบหมายลีด (ยุติธรรม: ดูจำนวนลีดเข้าใน 7 วัน, tie-break ผู้ที่ได้ลีดนานสุด) ----------
create or replace function crm.assign_lead(p_lead uuid) returns uuid
language plpgsql security definer set search_path = crm, pg_temp as $$
declare v_sales uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('crm.assign', 0));
  select s.id into v_sales
  from crm.sales_team s
  where s.active and s.role = 'sales'
  order by (select count(*) from crm.leads x where x.owner_id = s.id and x.assigned_at > now() - interval '7 days'),
           s.last_assigned_at nulls first, s.code
  limit 1;
  if v_sales is null then
    insert into crm.data_quality_issues(entity, entity_id, code, severity, detail)
    values ('lead', p_lead::text, 'NO_ACTIVE_SALES', 'ERROR', 'ไม่มีเซลล์ที่ active สำหรับรับลีด')
    on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
    return null;
  end if;
  update crm.leads set owner_id = v_sales, assigned_at = now() where id = p_lead;
  update crm.sales_team set last_assigned_at = now() where id = v_sales;
  insert into crm.lead_events(lead_id, type, actor_id, body) values (p_lead, 'ASSIGNED', null, 'auto round-robin');
  return v_sales;
end $$;

-- ---------- Ingest (เรียกจาก n8n ด้วย service_role) ----------
create or replace function crm.ingest_message(
  p_message_id text, p_fb_user_id text, p_text text,
  p_customer_name text default null, p_phone_raw text default null, p_model text default null,
  p_occurred_at timestamptz default clock_timestamp()
) returns jsonb
language plpgsql security definer set search_path = crm, pg_temp as $$
declare
  v_key text; v_phone text; l crm.leads; v_action text; v_notify text; v_owner crm.sales_team; v_new_owner uuid;
begin
  if p_message_id is null or btrim(p_message_id) = '' then raise exception 'message_id required'; end if;
  v_key := 'fb:' || p_message_id;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(nullif(p_fb_user_id, ''), p_message_id), 0));
  if exists (select 1 from crm.lead_events where idempotency_key = v_key) then
    return jsonb_build_object('action', 'duplicate');
  end if;

  v_phone := crm.normalize_phone(p_phone_raw);
  select * into l from crm.leads
   where (v_phone is not null and phone_norm = v_phone)
      or (nullif(p_fb_user_id, '') is not null and fb_user_id = p_fb_user_id)
   order by (phone_norm = v_phone) desc nulls last limit 1;

  if not found then
    insert into crm.leads(lead_code, fb_user_id, phone_norm, phone_raw, customer_name, interested_model, created_at)
    values (to_char(p_occurred_at at time zone crm.setting('tz'), 'YYYYMMDD') || '-' || lpad((nextval('crm.lead_code_seq') % 1000000)::text, 6, '0'),
            nullif(p_fb_user_id, ''), v_phone, nullif(btrim(p_phone_raw), ''), nullif(btrim(p_customer_name), ''),
            nullif(btrim(p_model), ''), p_occurred_at)
    returning * into l;
    v_action := 'created';
  else
    update crm.leads set
      phone_norm = coalesce(phone_norm, v_phone),
      phone_raw = coalesce(phone_raw, nullif(btrim(p_phone_raw), '')),
      customer_name = coalesce(customer_name, nullif(btrim(p_customer_name), '')),
      interested_model = coalesce(interested_model, nullif(btrim(p_model), '')),
      fb_user_id = coalesce(fb_user_id, case when nullif(p_fb_user_id, '') is not null
                    and not exists (select 1 from crm.leads o where o.fb_user_id = p_fb_user_id) then p_fb_user_id end)
    where id = l.id returning * into l;
    v_action := 'appended';
    if nullif(p_fb_user_id, '') is not null and l.fb_user_id is distinct from p_fb_user_id then
      insert into crm.data_quality_issues(entity, entity_id, code, detail)
      values ('lead', l.id::text, 'IDENTITY_CONFLICT', 'เบอร์ตรงกับลีดนี้ แต่ Facebook ID ผูกกับอีกลีด')
      on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
    end if;
  end if;

  insert into crm.lead_events(lead_id, type, channel, body, idempotency_key, occurred_at)
  values (l.id, 'CUSTOMER_MESSAGE', 'FACEBOOK', left(p_text, 2000), v_key, p_occurred_at);

  if nullif(btrim(p_phone_raw), '') is not null and v_phone is null then
    insert into crm.data_quality_issues(entity, entity_id, code, detail)
    values ('lead', l.id::text, 'PHONE_INVALID', 'เบอร์รูปแบบไม่ถูกต้อง: ' || left(p_phone_raw, 30))
    on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
  end if;
  if l.stage = 'LOST' then
    insert into crm.data_quality_issues(entity, entity_id, code, severity, detail)
    values ('lead', l.id::text, 'LOST_WITH_ACTIVITY', 'WARN', 'ลูกค้าทักมาอีกหลังสถานะ LOST — ให้ผู้จัดการทบทวน (ระบบไม่เปลี่ยนสถานะเอง)')
    on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
  end if;

  if l.owner_id is null and l.phone_norm is not null then
    v_new_owner := crm.assign_lead(l.id);
    if v_new_owner is not null then v_notify := 'NEW_LEAD'; end if;
    select * into l from crm.leads where id = l.id;
  elsif l.owner_id is not null and v_action = 'appended' then
    v_notify := 'CUSTOMER_REPLIED';
  end if;

  select * into v_owner from crm.sales_team where id = l.owner_id;
  return jsonb_build_object(
    'action', v_action, 'notify', v_notify,
    'lead_id', l.id, 'lead_code', l.lead_code, 'stage', l.stage,
    'customer_name', l.customer_name, 'phone', l.phone_norm, 'interested_model', l.interested_model,
    'message', left(p_text, 500), 'created_at', l.created_at,
    'owner', case when v_owner.id is null then null else jsonb_build_object(
        'id', v_owner.id, 'code', v_owner.code, 'name', v_owner.display_name, 'telegram_chat_id', v_owner.telegram_chat_id) end);
end $$;

-- ---------- RPC สำหรับผู้ใช้ (ตรวจสิทธิ์ภายใน) ----------
create or replace function crm._actor_for(p_lead uuid, p_manager_only boolean default false) returns crm.sales_team
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team; l crm.leads;
begin
  select * into a from crm.me();
  if a.id is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into l from crm.leads where id = p_lead;
  if not found then raise exception 'lead_not_found'; end if;
  if a.role in ('sales_manager','admin') then return a; end if;
  if p_manager_only or l.owner_id is distinct from a.id then raise exception 'forbidden' using errcode = '42501'; end if;
  return a;
end $$;

create or replace function crm.accept_lead(p_lead uuid) returns void
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team;
begin
  a := crm._actor_for(p_lead);
  update crm.leads set accepted_at = coalesce(accepted_at, now()) where id = p_lead and accepted_at is null;
  if found then
    insert into crm.lead_events(lead_id, type, actor_id, body) values (p_lead, 'ACCEPTED', a.id, 'รับลีด (ยังไม่นับเป็นการติดต่อลูกค้า)');
  end if;
end $$;

create or replace function crm.log_contact(
  p_lead uuid, p_channel text, p_outcome text, p_note text,
  p_next_follow_up timestamptz, p_temperature text default null
) returns bigint
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team; l crm.leads; v_success boolean; v_ev bigint;
begin
  a := crm._actor_for(p_lead);
  select * into l from crm.leads where id = p_lead for update;
  if l.stage in ('WON','LOST') then raise exception 'lead_closed'; end if;
  if p_channel not in ('PHONE','LINE','FACEBOOK','SMS','WALK_IN') then raise exception 'invalid_channel'; end if;
  if p_outcome not in ('CONNECTED','REPLIED','NO_ANSWER','MESSAGE_SENT','WRONG_NUMBER') then raise exception 'invalid_outcome'; end if;
  if p_note is null or length(btrim(p_note)) < 5 then raise exception 'note_required: ต้องบันทึกผลการติดต่ออย่างน้อย 5 ตัวอักษร'; end if;
  if p_next_follow_up is null or p_next_follow_up <= now() then raise exception 'next_follow_up_required: ต้องกำหนดนัดติดตามครั้งถัดไปในอนาคต'; end if;
  if p_temperature is not null and p_temperature not in ('HOT','WARM','COLD') then raise exception 'invalid_temperature'; end if;
  v_success := p_outcome in ('CONNECTED','REPLIED');

  insert into crm.lead_events(lead_id, type, channel, outcome, body, evidence, actor_id)
  values (p_lead, case when v_success then 'CONTACT_SUCCESS' else 'CONTACT_ATTEMPT' end, p_channel, p_outcome, p_note,
          jsonb_build_object('channel', p_channel, 'outcome', p_outcome), a.id)
  returning id into v_ev;

  update crm.tasks set status = 'DONE', completed_event_id = v_ev, completed_at = now()
   where lead_id = p_lead and status = 'OPEN';

  update crm.leads set
    last_contact_at   = now(),
    first_contact_at  = case when v_success then coalesce(first_contact_at, now()) else first_contact_at end,
    next_follow_up_at = p_next_follow_up,
    temperature       = coalesce(p_temperature, temperature),
    stage             = case when v_success and stage = 'NEW' then 'CONTACTED' else stage end
  where id = p_lead;
  return v_ev;
end $$;

create or replace function crm.change_stage(p_lead uuid, p_to text, p_reason text default null, p_evidence jsonb default '{}') returns void
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team; l crm.leads;
begin
  a := crm._actor_for(p_lead);
  select * into l from crm.leads where id = p_lead for update;
  if p_to = l.stage then return; end if;
  if l.stage in ('WON','LOST') and a.role not in ('sales_manager','admin') then raise exception 'forbidden: ลีดที่ปิดแล้วเปิดใหม่ได้เฉพาะผู้จัดการ' using errcode = '42501'; end if;
  if p_to = 'LOST' and (p_reason is null or length(btrim(p_reason)) < 3) then raise exception 'lost_reason_required'; end if;
  update crm.leads set stage = p_to,
         lost_reason = case when p_to = 'LOST' then p_reason else null end
   where id = p_lead;                                 -- stage_guard ตรวจหลักฐานให้
  insert into crm.lead_events(lead_id, type, actor_id, body, evidence)
  values (p_lead, 'STAGE_CHANGE', a.id, p_reason, p_evidence || jsonb_build_object('from', l.stage, 'to', p_to));
end $$;

create or replace function crm.add_deal(p_lead uuid, p_kind text, p_doc_ref text, p_amount numeric default null) returns uuid
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team; v_id uuid;
begin
  a := crm._actor_for(p_lead);
  insert into crm.deals(lead_id, kind, doc_ref, amount, created_by) values (p_lead, p_kind, p_doc_ref, p_amount, a.id) returning id into v_id;
  return v_id;
end $$;

create or replace function crm.verify_deal(p_deal uuid) returns void
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team; d crm.deals;
begin
  select * into a from crm.me();
  if a.role not in ('sales_manager','admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into d from crm.deals where id = p_deal;
  if not found then raise exception 'deal_not_found'; end if;
  if d.created_by = a.id then raise exception 'four_eyes: ผู้บันทึกหลักฐานตรวจสอบเองไม่ได้'; end if;
  update crm.deals set verified_by = a.id, verified_at = now() where id = p_deal and verified_at is null;
end $$;

create or replace function crm.reassign_lead(p_lead uuid, p_new_owner uuid, p_reason text) returns void
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team; old_owner uuid;
begin
  a := crm._actor_for(p_lead, true);
  if p_reason is null or length(btrim(p_reason)) < 3 then raise exception 'reason_required'; end if;
  if not exists (select 1 from crm.sales_team where id = p_new_owner and active and role = 'sales') then raise exception 'invalid_owner'; end if;
  select owner_id into old_owner from crm.leads where id = p_lead;
  update crm.leads set owner_id = p_new_owner, assigned_at = now(), accepted_at = null where id = p_lead;
  insert into crm.lead_events(lead_id, type, actor_id, body, evidence)
  values (p_lead, 'REASSIGNED', a.id, p_reason, jsonb_build_object('from', old_owner, 'to', p_new_owner));
end $$;

-- ---------- SLA sweep + แจ้งเตือน (เรียกโดย pg_cron/n8n ทุก 5 นาที) ----------
create or replace function crm.sweep_sla() returns jsonb
language plpgsql security definer set search_path = crm, pg_temp as $$
declare t record; v_level text; v_recipient uuid; v_n int := 0; v_created int := 0; v_mgr uuid;
begin
  -- งานที่ยังไม่มี (ลีดมีเจ้าของ แต่ไม่มี open task)
  for t in select l.id from crm.leads l
            where l.owner_id is not null and l.stage not in ('WON','LOST')
              and not exists (select 1 from crm.tasks k where k.lead_id = l.id and k.status = 'OPEN') loop
    perform crm.refresh_task(t.id); v_created := v_created + 1;
  end loop;

  for t in
    select k.*, r.remind_before_minutes rb, r.escalate_after_minutes ea, s.manager_id
    from crm.tasks k
    join crm.leads l on l.id = k.lead_id
    join crm.sla_rules r on r.scope = crm.sla_scope(l.stage, l.first_contact_at, l.temperature)
    left join crm.sales_team s on s.id = k.assignee_id
    where k.status = 'OPEN'
  loop
    v_level := case
      when now() >= t.due_at + make_interval(mins => t.ea) then 'ESCALATE'
      when now() >= t.due_at + make_interval(mins => t.ea / 2) then 'OVERDUE'
      when now() >= t.due_at then 'DUE'
      when now() >= t.due_at - make_interval(mins => t.rb) then 'BEFORE_DUE'
    end;
    continue when v_level is null;
    v_recipient := t.assignee_id;
    if v_level = 'ESCALATE' then
      v_mgr := coalesce(t.manager_id, (select id from crm.sales_team where role = 'sales_manager' and active order by code limit 1));
      v_recipient := coalesce(v_mgr, t.assignee_id);
    end if;
    insert into crm.alerts(task_id, level, recipient_id) values (t.id, v_level, v_recipient)
      on conflict (task_id, level) do nothing;
    if found then v_n := v_n + 1; end if;
    update crm.tasks set reminder_state = case v_level when 'ESCALATE' then 'OVERDUE' else v_level end,
                         escalation_level = case when v_level = 'ESCALATE' then 1 else escalation_level end
     where id = t.id;
  end loop;
  return jsonb_build_object('alerts_created', v_n, 'tasks_created', v_created);
end $$;

-- n8n เรียก: ดึงการแจ้งเตือนที่ยังไม่ส่ง แล้วมาร์คว่าส่งแล้ว (SKIP LOCKED กันซ้ำเมื่อรันซ้อน)
create or replace function crm.claim_alerts(p_limit int default 50) returns table(
  alert_id bigint, level text, lead_code text, customer_name text, phone text, interested_model text,
  task_kind text, due_at timestamptz, assignee_name text, recipient_name text, recipient_chat_id text)
language sql security definer set search_path = crm, pg_temp as $$
  with c as (
    select a.id from crm.alerts a where a.sent_at is null order by a.id limit p_limit for update skip locked
  ), u as (
    update crm.alerts a set sent_at = now() from c where a.id = c.id returning a.*
  )
  select u.id, u.level, l.lead_code, l.customer_name, l.phone_norm, l.interested_model,
         k.kind, k.due_at, sa.display_name, sr.display_name, sr.telegram_chat_id
  from u join crm.tasks k on k.id = u.task_id join crm.leads l on l.id = k.lead_id
  left join crm.sales_team sa on sa.id = k.assignee_id
  left join crm.sales_team sr on sr.id = u.recipient_id
  order by u.id
$$;

-- ---------- Data Quality (แยกจาก SLA violation; ไม่แก้ข้อมูลต้นฉบับ) ----------
create or replace function crm.run_data_quality() returns int
language plpgsql security definer set search_path = crm, pg_temp as $$
declare n int := 0; c int;
begin
  insert into crm.data_quality_issues(entity, entity_id, code, severity, detail)
  select 'lead', id::text, 'PHONE_INVALID', 'WARN', 'เบอร์รูปแบบไม่ถูกต้อง' from crm.leads
   where phone_raw is not null and phone_norm is null
  on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
  get diagnostics c = row_count; n := n + c;

  insert into crm.data_quality_issues(entity, entity_id, code, severity, detail)
  select 'lead', id::text, 'FOLLOWUP_BEFORE_CREATED', 'ERROR', 'นัดติดตามอยู่ก่อนวันที่สร้างลีด' from crm.leads
   where next_follow_up_at is not null and next_follow_up_at < created_at
  on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
  get diagnostics c = row_count; n := n + c;

  insert into crm.data_quality_issues(entity, entity_id, code, severity, detail)
  select 'lead', id::text, 'ACCEPTED_BEFORE_ASSIGNED', 'ERROR', 'เวลารับลีดก่อนเวลามอบหมาย (Response time ติดลบ)' from crm.leads
   where accepted_at is not null and accepted_at < coalesce(assigned_at, created_at)
  on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
  get diagnostics c = row_count; n := n + c;

  insert into crm.data_quality_issues(entity, entity_id, code, severity, detail)
  select 'lead', id::text, 'STAGE_WITHOUT_EVIDENCE', 'ERROR', 'สถานะ '||stage||' ไม่มีหลักฐานธุรกรรมที่ตรวจสอบแล้ว' from crm.leads l
   where stage in ('BOOKING','FINANCE_APPROVED','WON')
     and not exists (select 1 from crm.deals d where d.lead_id = l.id and d.verified_at is not null)
  on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
  get diagnostics c = row_count; n := n + c;

  insert into crm.data_quality_issues(entity, entity_id, code, severity, detail)
  select 'lead', id::text, 'STAGE_CONTACT_MISMATCH', 'WARN', 'สถานะ '||stage||' แต่ไม่มีหลักฐานการติดต่อ' from crm.leads l
   where legacy is null and stage not in ('NEW','LOST') and first_contact_at is null
  on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
  get diagnostics c = row_count; n := n + c;
  return n;
end $$;
