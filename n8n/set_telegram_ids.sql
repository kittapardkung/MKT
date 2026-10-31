-- ผูกเซลล์กับ Telegram (ใส่ตัวเลขจริงก่อนรัน) — แชทส่วนตัวกับบอท: chat id = user id
-- วิธีหา id: ให้แต่ละคนกด Start บอท แล้วส่งข้อความหา @userinfobot (หรือดู from.id ใน execution ของ workflow 02)
update crm.sales_team set telegram_user_id = 'REPLACE_ID_SA0001', telegram_chat_id = 'REPLACE_ID_SA0001' where code = 'SA0001';  -- วิ
update crm.sales_team set telegram_user_id = 'REPLACE_ID_SA0002', telegram_chat_id = 'REPLACE_ID_SA0002' where code = 'SA0002';  -- โอ๋
-- เจ้าของ/ผู้จัดการ (ตอบแทนเซลล์ได้): แก้ code ให้ตรงกับ select code, display_name, role from crm.sales_team;
-- update crm.sales_team set telegram_user_id = 'REPLACE_OWNER_ID', telegram_chat_id = 'REPLACE_OWNER_ID' where role = 'admin';

select code, display_name, role, telegram_user_id, telegram_chat_id from crm.sales_team order by code;
