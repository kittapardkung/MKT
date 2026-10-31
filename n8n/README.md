# n8n — Sale Lead (Facebook → Supabase → Telegram)

สร้างจาก `build_workflows.py` (แก้แล้วรัน `python3 n8n/build_workflows.py` ใหม่) — **ไม่มีความลับในไฟล์**

| ไฟล์ | หน้าที่ |
|---|---|
| `01_lead_intake.json` | รับ Facebook Messenger webhook → ตรวจลายเซ็น → AI สกัดชื่อ/เบอร์/รุ่น → `crm.ingest_message` → Telegram แจ้งเซลล์เจ้าของลีด |
| `02_sales_reply.json` | เซลล์ Reply การ์ดลีดใน Telegram → AI สกัดข้อมูล → `crm.record_sales_reply` → ตอบสรุปกลับ |
| `set_telegram_ids.sql` | ผูก Telegram id ของเซลล์/เจ้าของ (รันใน Supabase SQL Editor) |

## ที่แก้จาก workflow เดิม (ผลตรวจ W1–W14)
- ตรวจลายเซ็น `X-Hub-Signature-256` + verify token (เดิมใครก็ยิง webhook ได้)
- ไม่มี Google Sheets: ค้นหาลีดซ้ำ/มอบหมายเซลล์แบบ round-robin ทำใน DB (ใช้ advisory lock, ไม่ซ้ำ ไม่ข้ามคน)
- idempotent: ใช้ `mid` ของ Facebook และ `update_id` ของ Telegram เป็น key (ยิงซ้ำไม่เกิดลีด/กิจกรรมซ้ำ)
- AI **สกัดข้อมูลเท่านั้น** ไม่เขียนเจ้าของ/สถานะเอง — DB ตัดสินว่าอัปเดตอะไร, BOOKING/WON/ขั้นการเงินต้องมีหลักฐานและผู้จัดการ
- เวลานับใน DB (Asia/Bangkok) แก้ปัญหา timezone ของ Response_Minutes
- ข้อความเซลล์ที่ผ่านบอทรวม 1 workflow สำหรับทุกคน (แยกคนด้วย Telegram user id) แก้ปัญหา copy-paste node ระหว่าง SA001/SA002
- ส่งให้ AI เฉพาะข้อความ + Customer Card (ไม่มีชื่อ/เบอร์ลูกค้าในขั้นวิเคราะห์ reply), ผู้ส่งที่ไม่รู้จักถูกเงียบก่อนถึง AI
- ถ้าบันทึกลง Supabase ล้ม → แจ้งแอดมิน/เซลล์ (เดิมเงียบ)

## ตั้งค่า (ทำครั้งเดียว)
1. **Credentials ใน n8n**
   - `Supabase service key (crm)` — ประเภท *Header Auth*: Name = `apikey`, Value = secret/service_role key ของโปรเจกต์ (**วางใน n8n เท่านั้น ห้ามส่งให้ใครรวมถึงในแชทนี้**)
   - `Telegram bot: WULING Sale Lead` — บอทใหม่ 1 ตัวจาก @BotFather (ใช้ร่วมทุกคน)
   - `OpenAI account` — ใช้อันเดิมได้
2. Import 2 ไฟล์ → เปิดโหนด **Config** แก้ค่า `REPLACE_*`:
   - `supabaseUrl` = `https://<project-ref>.supabase.co`
   - (01) `fbVerifyToken`, `fbAppSecret` (App Secret ของ Meta app), `adminChatId`
3. เลือก credentials ในโหนด HTTP Request / Telegram / OpenAI ที่ขึ้นสีแดง
4. รัน `set_telegram_ids.sql` (ใส่ id จริง) และให้เซลล์แต่ละคนกด **Start** บอทก่อน (ไม่งั้นบอทส่งหาไม่ได้)
5. **สลับของจริง:** ปิด workflow เดิม (Google Sheets) → เปิด 01 (path เดิม `63db852b-…` เมตาไม่ต้องแก้ URL แต่ต้องใช้ verify token ตรงกับที่ตั้งไว้) → เปิด 02
6. ตรวจ: ส่งข้อความทดสอบเข้าเพจที่มีเบอร์ → ได้ลีดใน Supabase + การ์ดใน Telegram → Reply การ์ด "โทรแล้ว นัดพรุ่งนี้ 10 โมง" → ได้ข้อความสรุป
7. เมื่อสลับเรียบร้อยแล้วเท่านั้น: `update crm.settings set value = 'true' where key = 'alerts_enabled';` (ค่าเริ่มต้นปิดอยู่ กันแจ้งเตือนลีดเก่าท่วม)

## หมายเหตุ
- โหนด Code ที่ตรวจลายเซ็นใช้ `require('crypto')` — บน n8n แบบ self-host ต้องตั้ง `NODE_FUNCTION_ALLOW_BUILTIN=crypto`
- ลีดที่ไม่มีเบอร์จะถูกบันทึกแต่ยังไม่มอบหมายเซลล์ (ไม่มีการแจ้ง Telegram) ตามกติกาเดิม
