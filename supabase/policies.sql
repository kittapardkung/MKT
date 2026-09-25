-- MKT Content Manager — Row Level Security policies
-- รันหลังจาก schema.sql แล้วเท่านั้น (SQL Editor เดียวกัน)
--
-- แนวคิด: ทุกตารางต้อง "ล็อกอินก่อน" (Supabase Auth) ถึงจะอ่าน/เขียนได้ — ไม่มี anonymous access
-- เหมือนของเดิมที่ต้องล็อกอิน Google ก่อนถึงเปิดเว็บแอปได้ ส่วนสิทธิ์ editor/creative (เช่นปุ่ม "อนุมัติ")
-- ยังคงเช็คที่ชั้นแอปเหมือนเดิม ไม่ได้บังคับที่ระดับฐานข้อมูล เพื่อให้พฤติกรรมตรงกับระบบเดิม
--
-- ตาราง team_members ใช้แทนตัวแปร TEAM ที่เคยฝังในโค้ด Code.gs — แก้ role ผ่านตารางนี้ได้เลย
-- (INSERT/UPDATE ตารางนี้ทำได้เฉพาะผ่าน service_role/secret key เท่านั้น กันไม่ให้ผู้ใช้ self-promote เป็น editor)

-- ======================
-- team_members
-- ======================
create table if not exists team_members (
  email       text primary key,
  role        text not null default 'creative' check (role in ('editor','creative')),
  created_at  timestamptz not null default now()
);

alter table team_members enable row level security;

-- ใส่บัญชีเริ่มต้นเป็น editor (แก้/เพิ่มอีเมลอื่นได้ทีหลังผ่าน Table Editor)
insert into team_members (email, role) values
  ('kittapard.sp@gmail.com', 'editor'),
  ('panpan14158@gmail.com', 'editor')
on conflict (email) do nothing;

-- ฟังก์ชันช่วยอ่าน role ของผู้ใช้ที่ล็อกอินอยู่ จาก JWT email เทียบกับ team_members
create or replace function app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from team_members where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))),
    'creative'
  );
$$;

drop policy if exists "team_members_select_authenticated" on team_members;
create policy "team_members_select_authenticated" on team_members
  for select
  to authenticated
  using (true);

-- ไม่มี policy insert/update/delete ให้ authenticated โดยเจตนา —
-- แก้ role ได้เฉพาะผ่าน service_role (Table Editor / SQL Editor / server script) เท่านั้น

-- ======================
-- posts
-- ======================
drop policy if exists "posts_select_authenticated" on posts;
create policy "posts_select_authenticated" on posts
  for select to authenticated using (true);

drop policy if exists "posts_insert_authenticated" on posts;
create policy "posts_insert_authenticated" on posts
  for insert to authenticated with check (true);

drop policy if exists "posts_update_authenticated" on posts;
create policy "posts_update_authenticated" on posts
  for update to authenticated using (true) with check (true);

drop policy if exists "posts_delete_authenticated" on posts;
create policy "posts_delete_authenticated" on posts
  for delete to authenticated using (true);

-- ======================
-- ideas
-- ======================
drop policy if exists "ideas_select_authenticated" on ideas;
create policy "ideas_select_authenticated" on ideas
  for select to authenticated using (true);

drop policy if exists "ideas_insert_authenticated" on ideas;
create policy "ideas_insert_authenticated" on ideas
  for insert to authenticated with check (true);

drop policy if exists "ideas_update_authenticated" on ideas;
create policy "ideas_update_authenticated" on ideas
  for update to authenticated using (true) with check (true);

drop policy if exists "ideas_delete_authenticated" on ideas;
create policy "ideas_delete_authenticated" on ideas
  for delete to authenticated using (true);

-- ======================
-- tags
-- ======================
drop policy if exists "tags_select_authenticated" on tags;
create policy "tags_select_authenticated" on tags
  for select to authenticated using (true);

drop policy if exists "tags_insert_authenticated" on tags;
create policy "tags_insert_authenticated" on tags
  for insert to authenticated with check (true);

drop policy if exists "tags_update_authenticated" on tags;
create policy "tags_update_authenticated" on tags
  for update to authenticated using (true) with check (true);

-- ======================
-- events (อ่านได้ทุกคน แก้ไขเฉพาะ editor — เดิมจัดการผ่านชีตโดยแอดมินเท่านั้น)
-- ======================
drop policy if exists "events_select_authenticated" on events;
create policy "events_select_authenticated" on events
  for select to authenticated using (true);

drop policy if exists "events_write_editor" on events;
create policy "events_write_editor" on events
  for all to authenticated using (app_role() = 'editor') with check (app_role() = 'editor');

-- ======================
-- targets (อ่านได้ทุกคน แก้ไขเฉพาะ editor)
-- ======================
drop policy if exists "targets_select_authenticated" on targets;
create policy "targets_select_authenticated" on targets
  for select to authenticated using (true);

drop policy if exists "targets_write_editor" on targets;
create policy "targets_write_editor" on targets
  for all to authenticated using (app_role() = 'editor') with check (app_role() = 'editor');

-- ======================
-- log (บันทึกได้ทุกคน แต่แก้ไข/ลบไม่ได้ — เป็น audit log ที่ไม่ควรถูกแก้ย้อนหลัง)
-- ======================
drop policy if exists "log_select_authenticated" on log;
create policy "log_select_authenticated" on log
  for select to authenticated using (true);

drop policy if exists "log_insert_authenticated" on log;
create policy "log_insert_authenticated" on log
  for insert to authenticated with check (true);

-- ======================
-- leads (อ่านอย่างเดียว — ข้อมูลมาจากชีตฝ่ายขาย ไม่มีใครเขียนผ่านแอปนี้)
-- ======================
drop policy if exists "leads_select_authenticated" on leads;
create policy "leads_select_authenticated" on leads
  for select to authenticated using (true);
