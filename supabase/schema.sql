-- MKT Content Manager — Supabase (Postgres) schema
-- ออกแบบให้ตรงกับโครงสร้างข้อมูลเดิมใน Google Sheet (Marketing_Content_2026)
-- รันไฟล์นี้ทั้งหมดใน Supabase SQL Editor ครั้งเดียว

-- ป้องกันรันซ้ำพัง (ลบของเก่าก่อนถ้ามี) — ใช้ตอน setup ครั้งแรกเท่านั้น
drop table if exists log cascade;
drop table if exists targets cascade;
drop table if exists events cascade;
drop table if exists tags cascade;
drop table if exists ideas cascade;
drop table if exists posts cascade;

-- ======================
-- Posts
-- ======================
create table posts (
  id            text primary key,
  date          date not null,
  time          text default '09:00',
  channel       text default 'Facebook', -- คั่นด้วยจุลภาคได้ เช่น "Facebook, TikTok"
  title         text not null,
  format        text not null default 'ภาพ' check (format in ('ภาพ','วิดีโอ')),
  status        text not null default 'DRAFT' check (status in ('DRAFT','REVIEW','APPROVED','PUBLISHED')),
  owner         text,
  caption       text default '',
  tags          text default '', -- คั่นด้วยจุลภาค อ้างอิงชื่อจาก tags.tag
  src_link      text default '',
  final_link    text default '',
  approved_by   text default '',
  approved_at   timestamptz,
  post_url      text default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index posts_date_idx on posts (date);
create index posts_status_idx on posts (status);

-- ======================
-- Ideas
-- ======================
create table ideas (
  id                text primary key,
  created_at        timestamptz not null default now(),
  created_by        text,
  title             text not null,
  category          text default '',
  note              text default '',
  score             integer default 5,
  promoted_post_id  text references posts(id) on delete set null
);

-- ======================
-- Tags
-- ======================
create table tags (
  tag         text primary key,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ======================
-- Events (Event Test Drive ฯลฯ ใช้คำนวณ KPI)
-- ======================
create table events (
  id      text primary key,
  date    date not null,
  name    text,
  status  text default '',
  leads   integer default 0
);

-- ======================
-- Targets (เป้าหมาย KPI)
-- ======================
create table targets (
  key     text primary key,
  label   text not null,
  target  integer not null,
  period  text not null default 'month'
);

insert into targets (key, label, target, period) values
  ('leads',   'Lead Generation',     150, 'quarter'),
  ('content', 'คอนเทนต์ที่ผลิต',       20,  'month'),
  ('video',   'วิดีโอ',                20,  'month'),
  ('image',   'ภาพ',                  20,  'month'),
  ('events',  'Event Test Drive',    2,   'quarter');

-- ======================
-- Log (ประวัติการเปลี่ยนแปลงคอนเทนต์)
-- ======================
create table log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  who         text,
  post_id     text references posts(id) on delete set null,
  action      text not null, -- CREATE / UPDATE / STATUS_CHANGE / APPROVE / COMMENT / PROMOTE_IDEA
  from_status text default '',
  to_status   text default '',
  comment     text default ''
);

create index log_post_id_idx on log (post_id);

-- ======================
-- updated_at อัปเดตอัตโนมัติทุกครั้งที่แก้ posts
-- ======================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_set_updated_at
  before update on posts
  for each row
  execute function set_updated_at();

-- ======================
-- Row Level Security — เปิดไว้ก่อน ยังไม่ตั้ง policy
-- (ต้องเพิ่ม policy ก่อนถึงจะอ่าน/เขียนผ่าน anon/service key ได้ตามสิทธิ์ที่ต้องการ)
-- ======================
alter table posts enable row level security;
alter table ideas enable row level security;
alter table tags enable row level security;
alter table events enable row level security;
alter table targets enable row level security;
alter table log enable row level security;
