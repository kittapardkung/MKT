-- MKT Content Manager — Agent workflow migration
-- รันใน Supabase SQL Editor "หลังจาก" schema.sql + policies.sql (+ migrate_leads.sql ถ้ามี) แล้วเท่านั้น
--
-- เพิ่มความสามารถให้แต่ละ "AI agent" (SCOUT / COMPASS / SPARK / ALMANAC) มีพื้นที่ทำงานของตัวเองในเว็บแอป:
--   - SCOUT     ทีมวิเคราะห์คู่แข่ง        → รายงานอ่านอย่างเดียวใน agent_reports (agent='SCOUT')
--   - COMPASS   AI นักกลยุทธ์การตลาด      → รายงานอ่านอย่างเดียวใน agent_reports (agent='COMPASS')
--   - SPARK     AI Content Creator        → เสนอไอเดีย/Hook เข้า ideas (คอลัมน์ agent/suggested_*)
--   - ALMANAC   AI Content Planner        → หน้า "ไทม์ไลน์การผลิต" อนุมัติไอเดียเข้าปฏิทิน (ต่อยอดจาก promoteIdea เดิม)
--
-- ไม่มีการ drop table ใดๆ ในไฟล์นี้ — ปลอดภัยที่จะรันซ้ำ (idempotent)

-- ======================
-- ideas: เพิ่มคอลัมน์รองรับ "เสนอวันที่ควรลง" ก่อนส่งเข้าปฏิทิน
-- ======================
alter table ideas add column if not exists agent text not null default 'SPARK'
  check (agent in ('SCOUT','COMPASS','SPARK','ALMANAC'));
alter table ideas add column if not exists suggested_date date;
alter table ideas add column if not exists suggested_channel text default 'Facebook';
alter table ideas add column if not exists suggested_format text default 'ภาพ'
  check (suggested_format in ('ภาพ','วิดีโอ'));

create index if not exists ideas_suggested_date_idx on ideas (suggested_date);
create index if not exists ideas_agent_idx on ideas (agent);

-- ======================
-- agent_reports: พื้นที่รายงาน/สรุปของแต่ละ agent (SCOUT/COMPASS เป็นหลัก)
-- หนึ่งแถว = หนึ่งบล็อกเนื้อหาในหน้าแดชบอร์ดของ agent นั้น เรียงตาม sort_order
-- data (jsonb) ใช้เก็บของที่ต้อง render เป็นตาราง/ชิป เช่น
--   {"kind":"scorecard","rows":[{"label":"WULING (เรา)","value":"5.70","highlight":true}, ...]}
--   {"kind":"kpi","items":[{"label":"Share of Voice เป้าหมาย","value":"≥ 25%","note":"จาก 21%"}]}
--   {"kind":"list","items":["ข้อความที่ 1","ข้อความที่ 2"]}
-- ======================
create table if not exists agent_reports (
  id          text primary key,
  agent       text not null check (agent in ('SCOUT','COMPASS','SPARK','ALMANAC')),
  section     text not null default 'summary',
  title       text not null,
  body        text default '',
  data        jsonb,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create index if not exists agent_reports_agent_idx on agent_reports (agent, sort_order);

create or replace function set_agent_reports_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agent_reports_set_updated_at on agent_reports;
create trigger agent_reports_set_updated_at
  before update on agent_reports
  for each row
  execute function set_agent_reports_updated_at();

alter table agent_reports enable row level security;

-- อ่านได้ทุกคนที่ล็อกอิน (ทุก agent dashboard เปิดให้ทั้งทีมเห็น) แก้ไข/เขียนเฉพาะ editor
-- (เนื้อหารายงานอัปเดตโดยทีม/agent session ผ่านสิทธิ์ editor หรือ service_role เท่านั้น)
drop policy if exists "agent_reports_select_authenticated" on agent_reports;
create policy "agent_reports_select_authenticated" on agent_reports
  for select to authenticated using (true);

drop policy if exists "agent_reports_write_editor" on agent_reports;
create policy "agent_reports_write_editor" on agent_reports
  for all to authenticated using (app_role() = 'editor') with check (app_role() = 'editor');

-- ======================
-- Seed เนื้อหาเริ่มต้น SCOUT + COMPASS (สรุปจากเรดาร์คู่แข่ง/กลยุทธ์ล่าสุด — แก้ไขต่อได้ผ่าน Table Editor)
-- ใช้ on conflict เพื่อให้รันซ้ำได้โดยไม่สร้างซ้ำ
-- ======================
insert into agent_reports (id, agent, section, title, body, data, sort_order) values
(
  'scout-summary', 'SCOUT', 'summary', 'Executive Summary',
  'WULING CHONBURI แข่งขันได้ดีด้านราคา/ตำแหน่งเซกเมนต์ (PORTA EV ใกล้เคียง ORA 5 EV Pro มากที่สุด, Darion EV แทบไม่มีคู่แข่งตรงในเซกเมนต์ MPV ไฟฟ้า 7 ที่นั่ง) แต่ Share of Voice ด้านโฆษณายังตามหลังคู่แข่งหลักอยู่มาก ช่องว่างที่ยังไม่มีแบรนด์ใดยึดครองคือ "EV สำหรับธุรกิจ/โลจิสติกส์"',
  '{"kind":"kpi","items":[{"label":"Share of Voice","value":"~21%","note":"29 โฆษณาเรา vs ~111 คู่แข่ง EV รวม"},{"label":"คะแนนถ่วงน้ำหนัก","value":"5.70/10","note":"อันดับ 3 จาก 7 แบรนด์"}]}'::jsonb,
  1
),
(
  'scout-scorecard', 'SCOUT', 'scorecard', 'Competitor Scorecard (ถ่วงน้ำหนัก)',
  'คะแนนประเมินจากรูปแบบโฆษณาที่สังเกตได้จาก Meta Ad Library เท่านั้น ไม่ใช่ข้อมูลผลลัพธ์จริง (conversion/ยอดขาย)',
  '{"kind":"scorecard","rows":[{"label":"GWM · ORA","value":"6.15"},{"label":"BYD","value":"5.95"},{"label":"WULING (เรา)","value":"5.70","highlight":true},{"label":"AION","value":"5.50"},{"label":"Geely / Deepal","value":"4.35"},{"label":"Chery","value":"3.70"},{"label":"MG","value":"2.95"}]}'::jsonb,
  2
),
(
  'scout-findings', 'SCOUT', 'findings', 'Key Findings',
  '',
  '{"kind":"list","items":["AION และ BYD ใช้ครีเอทีฟภาพนิ่ง/carousel ต่อเนื่อง น่าจะเป็นชุดที่ยิงมานานที่สุด","Hook ที่พบซ้ำมากที่สุดคือ \"ราคาเริ่มต้น\" และ \"ดอกเบี้ย/ดาวน์พิเศษ\"","คู่แข่งส่วนใหญ่จับกลุ่มลูกค้าซื้อคันแรก/เปลี่ยนรถทั่วไป ยังไม่มีแบรนด์ใดจับกลุ่มเจ้าของธุรกิจ/โลจิสติกส์อย่างชัดเจน","Meta Ad Library สาธารณะไม่เปิดเผยรูปแบบครีเอทีฟ (ภาพ/วิดีโอ) หรือวัตถุประสงค์แคมเปญของคู่แข่งโดยตรง"]}'::jsonb,
  3
)
on conflict (id) do nothing;

insert into agent_reports (id, agent, section, title, body, data, sort_order) values
(
  'compass-positioning', 'COMPASS', 'positioning', 'จุดยืนแบรนด์ (Positioning Statement)',
  '"ผู้เชี่ยวชาญ EV สำหรับธุรกิจ" ในชลบุรี — คู่แข่งอย่าง GWM·ORA และ BYD ใช้งบและความถี่โฆษณาสูงกว่าเราแต่เน้นขายผู้บริโภคทั่วไป ช่องว่างที่ยังไม่มีใครยึดคือกลุ่มผู้ประกอบการที่ต้องการรถ EV ไว้ใช้งานธุรกิจ ซึ่ง PORTA EV ตอบโจทย์ตรงและยังไม่มีคู่แข่งพูดถึงมุมนี้อย่างจริงจัง',
  '{"kind":"kpi","items":[{"label":"Share of Voice","value":"~21%"},{"label":"คะแนนถ่วงน้ำหนัก","value":"5.70/10"},{"label":"แบรนด์คู่แข่ง","value":"7"}]}'::jsonb,
  1
),
(
  'compass-pps', 'COMPASS', 'pps', 'สัดส่วนคอนเทนต์ (PPS Content System)',
  'Push 45% (Awareness) · Pull 35% (Authority) · Sell ≤20% (ปิดการขาย) — ห้ามคอนเทนต์ขายของเกิน 1 ใน 5 ของทั้งหมด',
  '{"kind":"kpi","items":[{"label":"Push","value":"45%","note":"Awareness"},{"label":"Pull","value":"35%","note":"Authority"},{"label":"Sell","value":"≤20%","note":"ปิดการขาย"}]}'::jsonb,
  2
),
(
  'compass-roadmap', 'COMPASS', 'roadmap', 'แผนปฏิบัติการ 90 วัน',
  '',
  '{"kind":"list","items":["สัปดาห์ 1–2: ปรับ Bio/Pin Post ทุกช่องทางให้พูดจุดยืนเดียวกัน","สัปดาห์ 3–6: เปิดตัวชุดคอนเทนต์ \"PORTA EV เพื่อธุรกิจ\" ตามสัดส่วน PPS","สัปดาห์ 7–10: ทดสอบครีเอทีฟจากคลัง Hook วัดผลที่ CTR/อัตราทักแชท","สัปดาห์ 11–13: ทบทวนคะแนน Scorecard รอบถัดไปและปรับกลยุทธ์ตามผลจริง"]}'::jsonb,
  3
)
on conflict (id) do nothing;
