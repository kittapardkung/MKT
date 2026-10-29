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
