-- MKT Content Manager — เพิ่มตาราง leads (ข้อมูลลีดจากฝ่ายขาย)
-- แหล่งข้อมูลเดิม: Google Sheet "LOGGING_2_WULING" แท็บ SHEET_1_TEL
-- รันใน SQL Editor เดียวกับที่รัน schema.sql/policies.sql มาก่อน (ไม่ลบตารางอื่น ปลอดภัยรันซ้ำได้)

create table if not exists leads (
  lead_id             text primary key,
  created_date        date,
  created_time        text,
  customer_name       text,
  phone_number        text,
  interested_model    text,
  source              text,
  assigned_sales      text,
  lead_status         text,
  lead_temperature    text,
  synced_at           timestamptz not null default now()
);

create index if not exists leads_created_date_idx on leads (created_date);
create index if not exists leads_phone_idx on leads (phone_number);

alter table leads enable row level security;

-- ให้สิทธิ์เหมือนตารางอื่นตอนนี้ (ทดสอบ = เปิดให้ public อ่านได้โดยไม่ต้องล็อกอิน)
-- ตอนเปิดใช้งานจริงพร้อมกับ policies.sql (to authenticated) ให้เปลี่ยนอันนี้ตามด้วย
drop policy if exists "leads_select_public" on leads;
create policy "leads_select_public" on leads for select to public using (true);
