-- MKT Content Manager — เพิ่ม RLS policy ที่ขาดไปสำหรับการลบคอนเทนต์ (posts)
-- แก้บั๊ก: กดปุ่ม "ลบคอนเทนต์" แล้วขึ้นกล่องยืนยัน กดตกลงแล้วแต่คอนเทนต์ไม่หายไป
-- สาเหตุ: ตาราง posts มี policy select/insert/update แต่ไม่มี policy delete ให้ authenticated
-- (ต่างจากตาราง ideas ที่มี policy ลบอยู่แล้ว) — Supabase เลยปฏิเสธคำสั่งลบเงียบๆ ไม่ error ให้เห็น
-- ปลอดภัยที่จะรันซ้ำ (idempotent) ไม่มีการ drop table ใดๆ

drop policy if exists "posts_delete_authenticated" on posts;
create policy "posts_delete_authenticated" on posts
  for delete to authenticated using (true);
