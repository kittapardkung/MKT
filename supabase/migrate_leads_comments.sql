-- MKT Content Manager — เพิ่มคอลัมน์คอมเมนต์เซลล์ในตาราง leads
-- ใช้สำหรับหน้า "ภาพรวมลีด" (วิเคราะห์เชิงคุณภาพจากคอมเมนต์ที่เซลล์พิมพ์ไว้)
-- แหล่งข้อมูล: Google Sheet "LOGGING_2_WULING" แท็บ SHEET_1_TEL คอลัมน์ Sales_Reply / Follow_Up_Note
-- รันใน SQL Editor เดียวกับที่รัน schema_leads.sql มาก่อน (ไม่ลบข้อมูลเดิม ปลอดภัยรันซ้ำได้)

alter table leads add column if not exists sales_reply text;
alter table leads add column if not exists follow_up_note text;
