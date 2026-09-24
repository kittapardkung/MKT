-- MKT Content Manager — PPS Content System (KPI แผนก Marketing)
-- รันใน Supabase SQL Editor "หลังจาก" schema.sql + policies.sql แล้วเท่านั้น
-- ปลอดภัยที่จะรันซ้ำ (idempotent) — ไม่แก้ไข/ลบข้อมูลเดิม คอลัมน์ใหม่เป็น NULL/false สำหรับโพสต์เก่า
--
-- เพิ่มการจัดหมวดคอนเทนต์ตาม PPS Content System:
--   Push  = สร้าง Awareness / เข้าถึงลูกค้าใหม่ (Viral, Interview, Challenge, Lifestyle, Tie-in แบบไม่ขายตรง)
--   Pull  = สร้าง Authority / ความน่าเชื่อถือ (ความรู้ EV, รีวิวการใช้งาน, FAQ, เปรียบเทียบ, Behind the Scene, Test Drive)
--   Sell  = กระตุ้นการตัดสินใจ/ยอดขาย (โปรโมชั่น, รีวิวลูกค้า, ส่งมอบรถ, ข้อเสนอพิเศษ, CTA นัด Test Drive)
--   Event = งาน Event/Test Drive นอกสถานที่หรือที่บริษัท
-- is_viral ใช้ระบุว่าคลิป Push ชิ้นนั้นเป็น Viral Content (เป้าหมาย >= 8 คลิป/เดือน)

alter table posts add column if not exists content_type text
  check (content_type in ('Push','Pull','Sell','Event'));
alter table posts add column if not exists is_viral boolean not null default false;

create index if not exists posts_content_type_idx on posts (content_type);
