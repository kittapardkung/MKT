-- ⚠️ ชั่วคราวสำหรับทดสอบเท่านั้น — เปิดให้เข้าถึงข้อมูลได้โดยไม่ต้องล็อกอิน (role: anon)
-- ห้ามใช้ตอนเปิดให้ทีมใช้งานจริง เพราะใครก็เข้าดู/แก้ข้อมูลได้โดยไม่ต้องล็อกอิน
-- พร้อมกับปิดการบังคับล็อกอินไว้ที่ REQUIRE_LOGIN = false ใน web/src/lib/supabase/middleware.ts
--
-- ตอนพร้อมใช้งานจริง: รัน supabase/policies.sql ซ้ำอีกครั้ง (กลับไปเป็น to authenticated)
-- แล้วเปลี่ยน REQUIRE_LOGIN กลับเป็น true ในโค้ด

drop policy if exists "posts_select_authenticated" on posts;
create policy "posts_select_public" on posts for select to public using (true);
drop policy if exists "posts_insert_authenticated" on posts;
create policy "posts_insert_public" on posts for insert to public with check (true);
drop policy if exists "posts_update_authenticated" on posts;
create policy "posts_update_public" on posts for update to public using (true) with check (true);

drop policy if exists "ideas_select_authenticated" on ideas;
create policy "ideas_select_public" on ideas for select to public using (true);
drop policy if exists "ideas_insert_authenticated" on ideas;
create policy "ideas_insert_public" on ideas for insert to public with check (true);
drop policy if exists "ideas_update_authenticated" on ideas;
create policy "ideas_update_public" on ideas for update to public using (true) with check (true);
drop policy if exists "ideas_delete_authenticated" on ideas;
create policy "ideas_delete_public" on ideas for delete to public using (true);

drop policy if exists "tags_select_authenticated" on tags;
create policy "tags_select_public" on tags for select to public using (true);
drop policy if exists "tags_insert_authenticated" on tags;
create policy "tags_insert_public" on tags for insert to public with check (true);
drop policy if exists "tags_update_authenticated" on tags;
create policy "tags_update_public" on tags for update to public using (true) with check (true);

drop policy if exists "events_select_authenticated" on events;
create policy "events_select_public" on events for select to public using (true);

drop policy if exists "targets_select_authenticated" on targets;
create policy "targets_select_public" on targets for select to public using (true);

drop policy if exists "log_select_authenticated" on log;
create policy "log_select_public" on log for select to public using (true);
drop policy if exists "log_insert_authenticated" on log;
create policy "log_insert_public" on log for insert to public with check (true);

drop policy if exists "team_members_select_authenticated" on team_members;
create policy "team_members_select_public" on team_members for select to public using (true);

-- agent_reports (SCOUT/COMPASS/SPARK/ALMANAC) — เพิ่มทีหลังตอน migrate_agent_workflow.sql
drop policy if exists "agent_reports_select_authenticated" on agent_reports;
create policy "agent_reports_select_public" on agent_reports for select to public using (true);
drop policy if exists "agent_reports_write_editor" on agent_reports;
create policy "agent_reports_write_public" on agent_reports for all to public using (true) with check (true);
