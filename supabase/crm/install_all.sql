-- JUSTICE GROUP AI Sales Manager — schema `crm` (Phase 3)
-- รันซ้ำได้ (idempotent). ไม่แตะตารางเดิมใน public (เช่น public.leads)
-- ต้องเพิ่ม `crm` ใน Supabase → Settings → API → Exposed schemas

create schema if not exists crm;

-- ---------- การตั้งค่า ----------
create table if not exists crm.settings (
  key   text primary key,
  value text not null
);
insert into crm.settings(key, value) values
  ('tz', 'Asia/Bangkok'),
  ('work_start_hour', '9'),        -- สมมติฐาน: ผู้บริหารแก้ได้
  ('work_end_hour', '18'),
  ('default_temperature', 'WARM'),  -- ลีดที่ยังไม่ระบุ temperature ใช้ SLA ของค่านี้ (ไม่เดาว่า COLD)
  ('alerts_enabled', 'false')       -- เปิดเป็น 'true' ตอน cut-over; false = sweep_sla ไม่สร้างงาน/แจ้งเตือน
on conflict (key) do nothing;

create table if not exists crm.sla_rules (
  scope                 text primary key check (scope in ('NEW','HOT','WARM','COLD')),
  minutes               int  not null check (minutes > 0),
  business_hours_only   boolean not null default true,
  remind_before_minutes int  not null default 10 check (remind_before_minutes >= 0),
  escalate_after_minutes int not null default 60 check (escalate_after_minutes >= 0)
);
insert into crm.sla_rules(scope, minutes, business_hours_only, remind_before_minutes, escalate_after_minutes) values
  ('NEW',  15,    true,  5,   30),
  ('HOT',  120,   true,  15,  60),
  ('WARM', 1440,  false, 120, 240),
  ('COLD', 10080, false, 720, 1440)
on conflict (scope) do nothing;

-- ---------- ทีมขาย / ผู้ใช้ ----------
create table if not exists crm.sales_team (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique,                       -- auth.users.id
  code             text unique not null,              -- เช่น SA0001
  display_name     text not null,
  role             text not null default 'sales' check (role in ('sales','sales_manager','executive','admin')),
  manager_id       uuid references crm.sales_team(id),
  telegram_chat_id text,
  active           boolean not null default true,
  last_assigned_at timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------- Lead ----------
create sequence if not exists crm.lead_code_seq;

create table if not exists crm.leads (
  id                uuid primary key default gen_random_uuid(),
  lead_code         text unique not null,
  fb_user_id        text,
  phone_norm        text,                              -- 0XXXXXXXXX (ผ่าน normalize_phone)
  phone_raw         text,
  customer_name     text,
  interested_model  text,
  source            text not null default 'Facebook Messenger',
  owner_id          uuid references crm.sales_team(id),
  assigned_at       timestamptz,
  accepted_at       timestamptz,
  first_contact_at  timestamptz,
  last_contact_at   timestamptz,
  next_follow_up_at timestamptz,
  next_action       text,
  stage             text not null default 'NEW' check (stage in
    ('NEW','CONTACTED','FOLLOW_UP','APPOINTMENT','TEST_DRIVE','QUOTATION','NEGOTIATION','BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON','LOST')),
  temperature       text check (temperature in ('HOT','WARM','COLD')),
  lost_reason       text,
  legacy_unverified boolean not null default false,    -- ลีดเก่าที่ WON/BOOKING แต่ไม่มีหลักฐาน
  legacy            jsonb,                             -- แถวเดิมจาก Sheet ครบทุกคอลัมน์
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint lost_needs_reason check (stage <> 'LOST' or lost_reason is not null)
);
alter table crm.leads add column if not exists dormant boolean not null default false;  -- ลีดเก่าที่นำเข้า ไม่สร้างงาน/แจ้งเตือนจนกว่าลูกค้าจะทักมาใหม่
alter table crm.leads add column if not exists profile jsonb not null default '{}';
-- ฐานข้อมูลที่ติดตั้งไว้แล้วมี constraint แบบ 10 สถานะ → แทนที่ด้วย 13 สถานะ (ข้อมูลเดิมยังถูกต้องทุกแถว)
alter table crm.leads drop constraint if exists leads_stage_check;
alter table crm.leads add constraint leads_stage_check check (stage in
  ('NEW','CONTACTED','FOLLOW_UP','APPOINTMENT','TEST_DRIVE','QUOTATION','NEGOTIATION','BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON','LOST'));
create unique index if not exists leads_phone_uq on crm.leads(phone_norm) where phone_norm is not null;
create unique index if not exists leads_fb_uq    on crm.leads(fb_user_id) where fb_user_id is not null;
create index if not exists leads_owner_idx on crm.leads(owner_id, stage);

-- ---------- Timeline / หลักฐาน ----------
create table if not exists crm.lead_events (
  id              bigserial primary key,
  lead_id         uuid not null references crm.leads(id),
  type            text not null check (type in
    ('CUSTOMER_MESSAGE','ASSIGNED','ACCEPTED','CONTACT_ATTEMPT','CONTACT_SUCCESS','STAGE_CHANGE','NOTE','REASSIGNED','AI')),
  channel         text,
  outcome         text,
  body            text,
  evidence        jsonb,
  actor_id        uuid references crm.sales_team(id),
  occurred_at     timestamptz not null default clock_timestamp(),
  idempotency_key text unique
);
create index if not exists lead_events_lead_idx on crm.lead_events(lead_id, occurred_at desc);

-- ---------- หลักฐานธุรกรรม ----------
create table if not exists crm.deals (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references crm.leads(id),
  kind         text not null check (kind in ('QUOTATION','BOOKING','FINANCE','DELIVERY')),
  doc_ref      text not null check (length(btrim(doc_ref)) > 0),   -- เลขที่เอกสาร/ใบจอง/ใบอนุมัติสินเชื่อ
  amount       numeric(12,2),
  created_by   uuid references crm.sales_team(id),
  verified_by  uuid references crm.sales_team(id),
  verified_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint verified_pair check ((verified_by is null) = (verified_at is null))
);
alter table crm.deals add column if not exists details jsonb not null default '{}';   -- รถ/รุ่น/สี/เงื่อนไขการซื้อ (สำหรับ BOOKING)
alter table crm.deals add column if not exists booked_on date;

-- ดาว = ลูกค้าเป้าหมายของเซลล์แต่ละคน (โอกาสสูง / deal ใหญ่) — ของใครของมัน
create table if not exists crm.lead_stars (
  lead_id    uuid not null references crm.leads(id) on delete cascade,
  sales_id   uuid not null references crm.sales_team(id),
  note       text,
  created_at timestamptz not null default now(),
  primary key (lead_id, sales_id)
);

-- ---------- Follow-up Task Engine ----------
create table if not exists crm.tasks (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid not null references crm.leads(id),
  assignee_id        uuid references crm.sales_team(id),
  kind               text not null check (kind in ('FIRST_CONTACT','FOLLOW_UP')),
  due_at             timestamptz not null,
  priority           int  not null default 50,
  status             text not null default 'OPEN' check (status in ('OPEN','DONE','CANCELLED')),
  reminder_state     text not null default 'NONE' check (reminder_state in ('NONE','BEFORE_DUE','DUE','OVERDUE')),
  escalation_level   int  not null default 0,
  completed_event_id bigint references crm.lead_events(id),
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create unique index if not exists tasks_one_open_uq on crm.tasks(lead_id, kind) where status = 'OPEN';
create index if not exists tasks_assignee_open_idx on crm.tasks(assignee_id, due_at) where status = 'OPEN';

create table if not exists crm.alerts (
  id         bigserial primary key,
  task_id    uuid not null references crm.tasks(id),
  level      text not null check (level in ('BEFORE_DUE','DUE','OVERDUE','ESCALATE')),
  recipient_id uuid references crm.sales_team(id),
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  unique (task_id, level)                               -- ไม่สร้างการแจ้งเตือนซ้ำ
);

-- ---------- AI / DQ / Audit / Ingest ----------
create table if not exists crm.ai_insights (
  id                  bigserial primary key,
  lead_id             uuid not null references crm.leads(id),
  readiness_score     int check (readiness_score between 0 and 100),
  neglect_risk_score  int check (neglect_risk_score between 0 and 100),
  reasons             jsonb not null default '[]',
  next_best_action    text,
  model               text,
  input_hash          text,
  created_at          timestamptz not null default now()
);

create table if not exists crm.data_quality_issues (
  id         bigserial primary key,
  entity     text not null,
  entity_id  text not null,
  code       text not null,
  severity   text not null default 'WARN' check (severity in ('INFO','WARN','ERROR')),
  detail     text,
  status     text not null default 'OPEN' check (status in ('OPEN','RESOLVED','IGNORED')),
  created_at timestamptz not null default now()
);
create unique index if not exists dq_open_uq on crm.data_quality_issues(entity, entity_id, code) where status = 'OPEN';

create table if not exists crm.audit_log (
  id         bigserial primary key,
  tbl        text not null,
  row_id     text,
  action     text not null,
  before     jsonb,
  after      jsonb,
  actor      text,
  at         timestamptz not null default now()
);

create table if not exists crm.ingest_log (
  id         bigserial primary key,
  message_id text,
  result     text,
  error      text,
  at         timestamptz not null default now()
);
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
  day_start timestamp; day_end timestamp; avail int; guard int := 0;
begin
  if p_from is null or p_minutes is null then return null; end if;   -- ห้ามวนไม่รู้จบเมื่อไม่มีเวลาเริ่มต้น
  loop
    guard := guard + 1;
    if guard > 800 then return null; end if;                            -- กันลูปค้างเสมอ (เผื่อ settings ผิดพลาด)
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

create or replace function crm.my_id() returns uuid
language sql stable security definer set search_path = crm, pg_temp as $$
  select id from crm.sales_team where user_id = auth.uid() and active
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
  foreach t in array array['leads','tasks','deals','sales_team','sla_rules','settings','lead_stars'] loop
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
    if new.stage in ('BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON') and not exists
       (select 1 from crm.deals d where d.lead_id = new.id and d.verified_at is not null) then
      new.legacy_unverified := true;
    end if;
    return new;
  end if;
  need := case new.stage
            when 'BOOKING' then 'BOOKING' when 'FINANCE_PENDING' then 'BOOKING'     -- ยื่นสินเชื่อ/รอส่งมอบ ต้องมีการจองที่ตรวจสอบแล้ว
            when 'FINANCE_APPROVED' then 'BOOKING'
            when 'READY_TO_DELIVER' then 'BOOKING' when 'WON' then 'BOOKING' end;
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
  if l.stage in ('WON','LOST') or l.owner_id is null or l.dormant then
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
create trigger lead_task after insert or update of owner_id, stage, temperature, next_follow_up_at, first_contact_at, last_contact_at, dormant
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
      dormant = false,
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
  if l.stage = 'WON' then raise exception 'lead_closed'; end if;
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
  if l.stage = 'WON' and a.role not in ('sales_manager','admin') then raise exception 'forbidden: ลีดที่ปิดการขายแล้วเปิดใหม่ได้เฉพาะผู้จัดการ' using errcode = '42501'; end if;
  if p_to = 'LOST' and (p_reason is null or length(btrim(p_reason)) < 3) then raise exception 'lost_reason_required'; end if;
  update crm.leads set stage = p_to,
         lost_reason = case when p_to = 'LOST' then p_reason else null end
   where id = p_lead;                                 -- stage_guard ตรวจหลักฐานให้
  insert into crm.lead_events(lead_id, type, actor_id, body, evidence)
  values (p_lead, 'STAGE_CHANGE', a.id, p_reason,
          p_evidence || jsonb_build_object('from', l.stage, 'to', p_to) || case when l.stage = 'LOST' then '{"reopened": true}'::jsonb else '{}'::jsonb end);
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
declare a crm.sales_team; d crm.deals; l crm.leads;
begin
  select * into a from crm.me();
  if a.role not in ('sales_manager','admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into d from crm.deals where id = p_deal;
  if not found then raise exception 'deal_not_found'; end if;
  if d.created_by = a.id then raise exception 'four_eyes: ผู้บันทึกหลักฐานตรวจสอบเองไม่ได้'; end if;
  update crm.deals set verified_by = a.id, verified_at = now() where id = p_deal and verified_at is null;
  -- ตรวจสอบการจองแล้ว → ขยับลีดเป็น BOOKING อัตโนมัติ (ถ้ายังไม่ถึงขั้นนี้)
  if d.kind = 'BOOKING' then
    select * into l from crm.leads where id = d.lead_id for update;
    if l.stage in ('NEW','CONTACTED','FOLLOW_UP','APPOINTMENT','TEST_DRIVE','QUOTATION','NEGOTIATION','LOST') then
      update crm.leads set stage = 'BOOKING', lost_reason = null where id = l.id;
      insert into crm.lead_events(lead_id, type, actor_id, body, evidence)
      values (l.id, 'STAGE_CHANGE', a.id, 'ผู้จัดการตรวจสอบหลักฐานการจองแล้ว',
              jsonb_build_object('from', l.stage, 'to', 'BOOKING', 'source', 'booking_verified', 'deal', d.id, 'doc_ref', d.doc_ref));
    end if;
  end if;
end $$;

-- เซลล์กด "จองแล้ว": บันทึกการจอง + รถ/รุ่น/เงื่อนไข รอผู้จัดการตรวจสอบ (ลีดยังไม่ขึ้น BOOKING จนกว่าจะตรวจสอบ)
create or replace function crm.mark_booked(p_lead uuid, p_doc_ref text, p_amount numeric, p_details jsonb, p_booked_on date default null) returns uuid
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team; v_id uuid; l crm.leads;
begin
  a := crm._actor_for(p_lead);
  select * into l from crm.leads where id = p_lead for update;
  if l.stage = 'WON' then raise exception 'lead_closed'; end if;
  if p_doc_ref is null or length(btrim(p_doc_ref)) < 3 then raise exception 'doc_ref_required: ต้องระบุเลขที่ใบจอง'; end if;
  if coalesce(btrim(p_details->>'model'), '') = '' then raise exception 'model_required: ต้องระบุรถ/รุ่นที่จอง'; end if;
  if coalesce(btrim(p_details->>'purchase_type'), '') not in ('CASH','FINANCE') then raise exception 'purchase_type_required: ต้องระบุเงื่อนไขการซื้อ (เงินสด/ผ่อน)'; end if;
  if exists (select 1 from crm.deals where lead_id = p_lead and kind = 'BOOKING' and doc_ref = btrim(p_doc_ref)) then
    raise exception 'duplicate_booking: เลขที่ใบจองนี้บันทึกไว้แล้ว';
  end if;
  insert into crm.deals(lead_id, kind, doc_ref, amount, details, booked_on, created_by)
  values (p_lead, 'BOOKING', btrim(p_doc_ref), p_amount, coalesce(p_details, '{}'), coalesce(p_booked_on, (now() at time zone crm.setting('tz'))::date), a.id)
  returning id into v_id;
  insert into crm.lead_events(lead_id, type, actor_id, body, evidence)
  values (p_lead, 'NOTE', a.id, 'แจ้งจอง ' || (p_details->>'model') || ' เลขที่ ' || btrim(p_doc_ref) || ' — รอผู้จัดการตรวจสอบ',
          jsonb_build_object('deal', v_id, 'kind', 'BOOKING_REPORTED'));
  return v_id;
end $$;

-- แก้ไขข้อมูลลูกค้า (ชื่อ/เบอร์/รุ่นที่สนใจ/Customer Card) — เจ้าของลีดหรือผู้จัดการ ทุกสถานะรวมถึง LOST
create or replace function crm.update_lead_info(p_lead uuid, p_name text, p_phone text, p_model text, p_profile jsonb default '{}') returns void
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team; l crm.leads; v_norm text; v_dup text; k text; v text; v_prof jsonb; v_changed text[] := '{}';
begin
  a := crm._actor_for(p_lead);
  select * into l from crm.leads where id = p_lead for update;
  v_prof := l.profile;
  if nullif(btrim(coalesce(p_phone, '')), '') is not null and btrim(p_phone) is distinct from coalesce(l.phone_raw, '') then
    v_norm := crm.normalize_phone(p_phone);
    if v_norm is null then raise exception 'phone_invalid: เบอร์โทรไม่ถูกต้อง (ต้องเป็นเบอร์ไทย 9–10 หลัก)'; end if;
    select lead_code into v_dup from crm.leads where phone_norm = v_norm and id <> p_lead limit 1;
    if v_dup is not null then raise exception 'phone_duplicate: เบอร์นี้มีอยู่แล้วในลีด %', v_dup; end if;
    update crm.leads set phone_raw = btrim(p_phone), phone_norm = v_norm where id = p_lead;
    v_changed := v_changed || 'phone'::text;
  end if;
  if p_name is not null and btrim(p_name) is distinct from coalesce(l.customer_name, '') then
    update crm.leads set customer_name = nullif(btrim(p_name), '') where id = p_lead; v_changed := v_changed || 'name'::text;
  end if;
  if p_model is not null and btrim(p_model) is distinct from coalesce(l.interested_model, '') then
    update crm.leads set interested_model = nullif(btrim(p_model), '') where id = p_lead; v_changed := v_changed || 'model'::text;
  end if;
  for k in select unnest(crm._profile_keys()) loop      -- เฉพาะฟิลด์ที่อนุญาต; ค่าว่าง = ลบ
    if p_profile ? k then
      v := btrim(coalesce(p_profile->>k, ''));
      if v = '' then
        if v_prof ? k then v_prof := v_prof - k; v_changed := v_changed || k; end if;
      elsif v is distinct from coalesce(v_prof->>k, '') then
        v_prof := v_prof || jsonb_build_object(k, v); v_changed := v_changed || k;
      end if;
    end if;
  end loop;
  if v_prof is distinct from l.profile then update crm.leads set profile = v_prof where id = p_lead; end if;
  if cardinality(v_changed) > 0 then
    insert into crm.lead_events(lead_id, type, actor_id, body, evidence)
    values (p_lead, 'NOTE', a.id, 'แก้ไขข้อมูลลูกค้า: ' || array_to_string(v_changed, ', '), jsonb_build_object('kind', 'INFO_UPDATED', 'fields', to_jsonb(v_changed)));
  end if;
  select * into l from crm.leads where id = p_lead;
  if l.owner_id is null and l.phone_norm is not null and l.stage not in ('WON','LOST') then perform crm.assign_lead(p_lead); end if;
end $$;

-- ติดดาว / เอาดาวออก (ลูกค้าเป้าหมายของตัวเอง)
create or replace function crm.set_star(p_lead uuid, p_on boolean, p_note text default null) returns void
language plpgsql security definer set search_path = crm, pg_temp as $$
declare a crm.sales_team;
begin
  select * into a from crm.me();
  if a.id is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform 1 from crm.leads where id = p_lead and (a.role in ('sales_manager','admin') or owner_id = a.id);
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_on then
    insert into crm.lead_stars(lead_id, sales_id, note) values (p_lead, a.id, nullif(btrim(coalesce(p_note, '')), ''))
    on conflict (lead_id, sales_id) do update set note = coalesce(nullif(btrim(coalesce(excluded.note, '')), ''), crm.lead_stars.note);
  else
    delete from crm.lead_stars where lead_id = p_lead and sales_id = a.id;
  end if;
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
  if crm.setting('alerts_enabled') is distinct from 'true' then
    return jsonb_build_object('skipped', 'alerts_disabled');
  end if;
  -- งานที่ยังไม่มี (ลีดมีเจ้าของ แต่ไม่มี open task)
  for t in select l.id from crm.leads l
            where l.owner_id is not null and l.stage not in ('WON','LOST') and not l.dormant
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
   where stage in ('BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON')
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
  (st.lead_id is not null) as starred, st.note as star_note, l.lost_reason, l.profile
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

-- JUSTICE GROUP AI Sales Manager — RLS + Grants (Phase 3)
-- หลักการ: authenticated อ่านได้ตาม RLS, เขียนผ่าน RPC เท่านั้น; service_role (n8n) เรียก ingest/sweep/claim

do $$ declare t text; begin
  foreach t in array array['settings','sla_rules','sales_team','leads','lead_events','deals','tasks','alerts',
                           'ai_insights','data_quality_issues','audit_log','ingest_log','lead_stars'] loop
    execute format('alter table crm.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists p_leads_sel on crm.leads;
create policy p_leads_sel on crm.leads for select to authenticated
  using ((select crm.is_manager()) or owner_id = (select crm.my_id()));

-- ตารางลูกของลีด: เห็นได้เมื่อเห็นลีดนั้น (RLS ของ leads ทำงานใน subquery)
do $$ declare t text; begin
  foreach t in array array['lead_events','deals','tasks','ai_insights'] loop
    execute format('drop policy if exists p_%1$s_sel on crm.%1$I', t);
    execute format('create policy p_%1$s_sel on crm.%1$I for select to authenticated using ((select crm.is_manager()) or exists (select 1 from crm.leads l where l.id = lead_id and l.owner_id = (select crm.my_id())))', t);
  end loop;
end $$;

drop policy if exists p_stars_sel on crm.lead_stars;
create policy p_stars_sel on crm.lead_stars for select to authenticated using (sales_id = (select crm.my_id()));   -- ดาวของใครของมัน

drop policy if exists p_sales_team_sel on crm.sales_team;
create policy p_sales_team_sel on crm.sales_team for select to authenticated using (true);

drop policy if exists p_sla_sel on crm.sla_rules;
create policy p_sla_sel on crm.sla_rules for select to authenticated using (true);
drop policy if exists p_sla_upd on crm.sla_rules;
create policy p_sla_upd on crm.sla_rules for update to authenticated
  using ((select crm.my_role()) in ('executive','admin')) with check ((select crm.my_role()) in ('executive','admin'));

drop policy if exists p_settings_sel on crm.settings;
create policy p_settings_sel on crm.settings for select to authenticated using (true);
drop policy if exists p_settings_upd on crm.settings;
create policy p_settings_upd on crm.settings for update to authenticated
  using ((select crm.my_role()) in ('executive','admin')) with check ((select crm.my_role()) in ('executive','admin'));

drop policy if exists p_alerts_sel on crm.alerts;
create policy p_alerts_sel on crm.alerts for select to authenticated using ((select crm.is_leadership()));
drop policy if exists p_dq_sel on crm.data_quality_issues;
create policy p_dq_sel on crm.data_quality_issues for select to authenticated using ((select crm.is_leadership()));
drop policy if exists p_audit_sel on crm.audit_log;
create policy p_audit_sel on crm.audit_log for select to authenticated using ((select crm.my_role()) in ('admin','executive'));

-- ---------- Grants ----------
revoke all on schema crm from public, anon;
revoke all on all tables in schema crm from public, anon;
revoke all on all functions in schema crm from public, anon;

grant usage on schema crm to authenticated, service_role;
grant select on crm.leads, crm.lead_events, crm.deals, crm.tasks, crm.ai_insights, crm.sla_rules, crm.settings,
                crm.alerts, crm.data_quality_issues, crm.audit_log, crm.lead_stars to authenticated;
grant select (id, user_id, code, display_name, role, manager_id, active) on crm.sales_team to authenticated;  -- ไม่เปิด telegram_chat_id
grant update (minutes, business_hours_only, remind_before_minutes, escalate_after_minutes) on crm.sla_rules to authenticated;
grant update (value) on crm.settings to authenticated;
grant select on crm.v_lead_control_center, crm.v_my_today, crm.v_sales_performance, crm.v_exec_summary,
                crm.v_funnel, crm.v_exec_risk_leads, crm.v_bookings to authenticated;

grant execute on function crm.me(), crm.my_id(), crm.my_role(), crm.is_manager(), crm.is_leadership(), crm.setting(text),
  crm.add_work_minutes(timestamptz, int), crm.normalize_phone(text) to authenticated, service_role;
grant execute on function crm.accept_lead(uuid), crm.log_contact(uuid, text, text, text, timestamptz, text),
  crm.change_stage(uuid, text, text, jsonb), crm.add_deal(uuid, text, text, numeric), crm.verify_deal(uuid),
  crm.reassign_lead(uuid, uuid, text),
  crm.mark_booked(uuid, text, numeric, jsonb, date), crm.set_star(uuid, boolean, text),
  crm.update_lead_info(uuid, text, text, text, jsonb) to authenticated;
grant execute on function crm.ingest_message(text, text, text, text, text, text, timestamptz),
  crm.sweep_sla(), crm.claim_alerts(int), crm.run_data_quality(), crm.assign_lead(uuid), crm.refresh_task(uuid) to service_role;

grant all on all tables in schema crm to service_role;
grant all on all sequences in schema crm to service_role;
-- JUSTICE GROUP AI Sales Manager — รับ reply ของเซลล์จาก Telegram (แทน workflow TELEGRAM_SA001/SA002)
-- n8n เรียกด้วย service_role หลัง AI สกัดข้อมูลจากข้อความ — DB เป็นผู้ตัดสินว่าอะไรนำไปใช้ได้

alter table crm.sales_team add column if not exists telegram_user_id text;
alter table crm.leads      add column if not exists profile jsonb not null default '{}';   -- Customer Card (งบ/ดาวน์/เทิร์น/สินเชื่อ ฯลฯ)
create unique index if not exists sales_telegram_user_uq on crm.sales_team(telegram_user_id) where telegram_user_id is not null;
alter table crm.lead_events drop constraint if exists lead_events_type_check;
alter table crm.lead_events add constraint lead_events_type_check check (type in
  ('CUSTOMER_MESSAGE','ASSIGNED','ACCEPTED','CONTACT_ATTEMPT','CONTACT_SUCCESS','STAGE_CHANGE','NOTE','REASSIGNED','AI','SALES_REPLY'));

-- ฟิลด์ Customer Card ที่อนุญาตให้ AI เติม (ไม่รวมเจ้าของลีด/สถานะ/เบอร์ ซึ่งมีกติกาแยก)
create or replace function crm._profile_keys() returns text[] language sql immutable as $$
  select array['Customer_Email','Customer_Line_ID','Customer_Address','Customer_Province','Customer_District','Customer_Postal_Code',
    'Occupation','Interested_Brand','Variant','Preferred_Color','Preferred_Variant','Purchase_Type','Budget','Vehicle_Price','Down_Payment',
    'Interest_Rate','Monthly_Payment','Loan_Term','Financing_Required','Financing_Status','Finance_Amount','Finance_Note','Financing_Bank',
    'Has_Trade_In','Trade_In_Brand','Trade_In_Model','Trade_In_Year','Trade_In_Expected_Price','Trade_In_Appraised_Price','Trade_In_Status',
    'Promotion_Name','Discount_Amount','Free_Items','Closing_Condition','Test_Drive_Date','Quotation_Date','Quotation_Amount','Competitor','Notes'] $$;

create or replace function crm._stage_rank(s text) returns int language sql immutable as $$
  select array_position(array['NEW','CONTACTED','FOLLOW_UP','APPOINTMENT','TEST_DRIVE','QUOTATION','NEGOTIATION','BOOKING','FINANCE_PENDING','FINANCE_APPROVED','READY_TO_DELIVER','WON'], s) $$;

create or replace function crm.record_sales_reply(
  p_update_id bigint, p_lead_code text, p_telegram_user_id text, p_reply_text text, p_ai jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = crm, pg_temp as $$
declare
  v_key text := 'tg:' || p_update_id; l crm.leads; s crm.sales_team; ev bigint;
  v_outcome text := upper(coalesce(p_ai->>'contact_outcome', ''));
  v_stage text := upper(coalesce(p_ai->>'lead_status', ''));
  v_temp text := upper(coalesce(p_ai->>'lead_temperature', ''));
  v_next timestamptz; v_applied text[] := '{}'; v_review text[] := '{}'; k text; patch jsonb := '{}';
  v_success boolean;
begin
  if p_update_id is null then raise exception 'update_id required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_lead_code, ''), 1));
  if exists (select 1 from crm.lead_events where idempotency_key = v_key) then return jsonb_build_object('status', 'duplicate'); end if;

  select * into l from crm.leads where lead_code = p_lead_code;
  if not found then
    insert into crm.ingest_log(message_id, result, error) values (v_key, 'rejected', 'lead_not_found: ' || coalesce(left(p_lead_code, 30), ''));
    return jsonb_build_object('status', 'lead_not_found');
  end if;
  select * into s from crm.sales_team where telegram_user_id = p_telegram_user_id and active;
  if s.id is null or (s.id <> l.owner_id and s.role not in ('sales_manager','admin')) then
    insert into crm.ingest_log(message_id, result, error) values (v_key, 'rejected', 'forbidden sender for ' || p_lead_code);
    return jsonb_build_object('status', 'forbidden');
  end if;
  if l.stage = 'WON' then
    insert into crm.lead_events(lead_id, type, channel, body, actor_id, idempotency_key) values (l.id, 'SALES_REPLY', 'TELEGRAM', left(p_reply_text, 2000), s.id, v_key);
    return jsonb_build_object('status', 'closed_lead_noted');
  end if;

  -- 1) รับลีด (ยังไม่นับเป็นการติดต่อ) — เวลาตอบกลับคำนวณใน DB ไม่มีปัญหา timezone
  if l.accepted_at is null then
    update crm.leads set accepted_at = now() where id = l.id;
    insert into crm.lead_events(lead_id, type, channel, actor_id, body) values (l.id, 'ACCEPTED', 'TELEGRAM', s.id, 'เซลล์ตอบกลับการ์ดลีดครั้งแรก');
    v_applied := v_applied || 'accepted'::text;
  end if;

  -- 2) เก็บข้อความต้นฉบับเป็นหลักฐาน
  insert into crm.lead_events(lead_id, type, channel, body, evidence, actor_id, idempotency_key)
  values (l.id, 'SALES_REPLY', 'TELEGRAM', left(p_reply_text, 2000), jsonb_build_object('ai', p_ai), s.id, v_key) returning id into ev;

  -- 3) Customer Card: เติมเฉพาะค่าที่ไม่ว่าง และอยู่ในรายการอนุญาต
  for k in select unnest(crm._profile_keys()) loop
    if nullif(btrim(p_ai->>k), '') is not null then patch := patch || jsonb_build_object(k, btrim(p_ai->>k)); end if;
  end loop;
  if patch <> '{}' then update crm.leads set profile = profile || patch where id = l.id; v_applied := v_applied || 'profile'::text; end if;

  -- 4) ผลการติดต่อ: นับเป็นสำเร็จเมื่อเซลล์รายงานว่าคุยได้/ลูกค้าตอบ
  v_success := v_outcome in ('CONNECTED','REPLIED');
  if v_success then
    update crm.tasks set status = 'DONE', completed_event_id = ev, completed_at = now() where lead_id = l.id and status = 'OPEN';
    update crm.leads set first_contact_at = coalesce(first_contact_at, now()), last_contact_at = now(),
           stage = case when stage = 'NEW' then 'CONTACTED' else stage end where id = l.id;
    insert into crm.lead_events(lead_id, type, channel, outcome, body, actor_id, evidence)
      values (l.id, 'CONTACT_SUCCESS', 'TELEGRAM', v_outcome, 'เซลล์รายงานผ่าน Telegram', s.id, jsonb_build_object('source', 'telegram_reply', 'reply_event', ev));
    v_applied := v_applied || 'contact'::text;
  end if;

  -- 5) นัดติดตาม: ใช้เฉพาะวันที่ในอนาคตและไม่เกิน 1 ปี (AI เคยเดาปีผิดเป็น 2024)
  begin v_next := nullif(p_ai->>'next_follow_up', '')::timestamptz; exception when others then v_next := null; end;
  if v_next is not null then
    if v_next > now() and v_next < now() + interval '1 year' then
      update crm.leads set next_follow_up_at = v_next where id = l.id; v_applied := v_applied || 'next_follow_up'::text;
    else
      insert into crm.data_quality_issues(entity, entity_id, code, detail)
      values ('lead', l.id::text, 'FOLLOWUP_DATE_IMPLAUSIBLE', 'AI สกัดวันนัดไม่สมเหตุสมผล: ' || left(p_ai->>'next_follow_up', 30))
      on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
      v_review := v_review || 'next_follow_up'::text;
    end if;
  end if;

  -- 6) อุณหภูมิ (การจัดประเภท ไม่ใช่การตัดสินใจทางการค้า)
  if v_temp in ('HOT','WARM','COLD') then update crm.leads set temperature = v_temp where id = l.id; v_applied := v_applied || 'temperature'::text; end if;

  -- 7) สถานะ: ไปข้างหน้าได้เฉพาะขั้นที่ไม่ต้องใช้หลักฐาน; ขั้นอื่น = ข้อเสนอให้ผู้จัดการตรวจ (AI ไม่ตัดสินเอง)
  if v_stage <> '' and v_stage <> l.stage then
    if v_stage in ('FOLLOW_UP','APPOINTMENT','TEST_DRIVE','QUOTATION','NEGOTIATION','CONTACTED')
       and crm._stage_rank(v_stage) > crm._stage_rank((select stage from crm.leads where id = l.id)) then
      update crm.leads set stage = v_stage where id = l.id;
      insert into crm.lead_events(lead_id, type, channel, actor_id, body, evidence)
        values (l.id, 'STAGE_CHANGE', 'TELEGRAM', s.id, 'ตามที่เซลล์รายงาน', jsonb_build_object('from', l.stage, 'to', v_stage, 'source', 'telegram_reply'));
      v_applied := v_applied || 'stage'::text;
    else
      insert into crm.lead_events(lead_id, type, channel, body, evidence)
        values (l.id, 'AI', 'TELEGRAM', 'AI เสนอเปลี่ยนสถานะเป็น ' || v_stage || ' — รอมนุษย์ตรวจสอบ/แนบหลักฐาน', jsonb_build_object('suggested_stage', v_stage, 'reply_event', ev));
      v_review := v_review || ('stage:' || v_stage)::text;
    end if;
  end if;

  return jsonb_build_object('status', 'ok', 'lead_code', l.lead_code, 'applied', v_applied, 'needs_review', v_review,
    'sales', jsonb_build_object('code', s.code, 'name', s.display_name));
end $$;

revoke all on function crm.record_sales_reply(bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function crm.record_sales_reply(bigint, text, text, text, jsonb) to service_role;
grant execute on function crm._profile_keys(), crm._stage_rank(text) to service_role, authenticated;
