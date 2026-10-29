# JUSTICE GROUP — AI Sales Manager
## เอกสาร 01: ผลตรวจระบบเดิม (Phase 1) และสถาปัตยกรรมย้าย Google Sheets → Supabase (Phase 2)

สถานะ: **ร่างเพื่อขออนุมัติ — ยังไม่มีโค้ดหรือ migration ถูกรัน**
วันที่ตรวจ: 2026-10-29

---

## 1. ข้อค้นพบสำคัญ (อ่านส่วนนี้ก่อน)

1. **n8n workflow (export `WULING_Facebook_Lead Capture&CRM + supabase`) เป็นสำเนาที่แทน Google Sheets ด้วย Supabase แล้ว แต่ยังใช้งานไม่ได้** — `active: false`, Supabase node ทั้ง 5 ตัว**ไม่มี credential ผูกอยู่เลย** (นี่คือสาเหตุของเครื่องหมายเตือนสีแดงในภาพ) และ Google Sheets node 5 ตัวถูกทิ้งลอยไม่มีเส้นเชื่อม ดังนั้นเวอร์ชันนี้ไม่ได้เขียน Sheet เลย (ไม่มี dual-write) รายละเอียดช่องโหว่/บั๊กดูหัวข้อ 2.1
2. **ตาราง `leads` ในรีโปนี้ไม่ใช่ CRM เต็มรูปแบบ** — `supabase/schema_leads.sql` มีเพียง 12 คอลัมน์ (จาก 53 คอลัมน์ของ `SHEET_1_TEL`) และมี policy `leads_select_public` (อ่านได้โดยไม่ล็อกอิน) ซึ่ง **เปิดเบอร์โทรลูกค้าสู่สาธารณะ ขัด PDPA** ในสถานะทดสอบ ต้องปิดก่อนใช้งานจริง
3. **CRM Web App เดิม (Apps Script) ไม่อยู่ในรีโปนี้** — `Code.gs`/`Index.html` ในรีโปคือ MKT Content Manager ไม่ใช่ระบบ Lead CRM จึงยังตรวจ Business Logic ฝั่ง Lead CRM เดิมไม่ได้ (ต้องขอโค้ด/สำเนา)
4. **รีโปมี Next.js + Supabase Auth พร้อมแล้ว** (`web/`) → ใช้เป็น Presentation Layer ของ AI Sales Manager ได้เลย ไม่ต้องสร้าง HTML/GAS ใหม่
5. **คุณภาพข้อมูลมีปัญหาจริง** (ดูหัวข้อ 3) — ต้องแยกเป็น Data Quality Issue ไม่แก้ทับต้นฉบับ

---

## 2. โครงสร้างข้อมูลเดิม (Google Sheet `LOGGING_2_WULING`)

| แท็บ | ขนาด | หน้าที่จริง | หมายเหตุ |
|---|---|---|---|
| `SHEET_1_TEL` | 53 คอลัมน์ × ~439 แถว | **Lead Master** (1 แถว/ลีดที่มีเบอร์) | Lead_ID รูปแบบ `YYYYMMDD-xxxxxx` |
| `ACTIVITY_LOG` | 132 คอลัมน์ × ~1,123 แถว | **Snapshot ทั้งแถวทุกครั้งที่ลีดเปลี่ยน** (append-only) | มีคอลัมน์ Test_Drive/Quotation/Booking/Deal/Lost_Reason ที่ `SHEET_1_TEL` ไม่มี |
| `SHEET_1_MES` | 15 คอลัมน์ × ~2,766 แถว | ลีดที่ยังไม่มีเบอร์ (ทักแชตเฉยๆ) | Created_Date เป็น `8/8/2026` ต่างจากแท็บอื่น (`2026-08-08`) |
| `ชีต1` | 12 คอลัมน์ × ~9,836 แถว | Chat log ดิบ + sentiment JSON จาก AI | |
| `DAY_LOG` | 32 คอลัมน์ × ~4,506 แถว | ตารางรายงานรายวัน/รายเซลล์ (สูตร) | **เป็น derived data — ไม่ย้าย** ให้ Supabase view แทน |
| `KPI` | 27 คอลัมน์ × 27 แถว | KPI โฆษณารายเดือน | อยู่ในโดเมน MKT เดิม ไม่ใช่ขอบเขตนี้ |
| `NOTE` | 16 แถว | คำอธิบายคอลัมน์ | ใช้เป็นแหล่งอ้างอิง Data Dictionary |

**ความสัมพันธ์:** `Lead_ID` เป็นกุญแจร่วม — `SHEET_1_TEL` (1) → `ACTIVITY_LOG` (N). `SHEET_1_MES` เป็นลีดช่วงก่อนมีเบอร์ (เชื่อมด้วย `Facebook_User_ID`). `Phone_Number` ใช้ dedupe แต่รูปแบบไม่คงที่ (ดูข้อ 3)

**สถานะที่พบจริงใน `Lead_Status`:** `NEW, CONTACTED, FOLLOW_UP, TEST_DRIVE, LOST, WON` — **ยังไม่พบ** `APPOINTMENT, QUOTATION, BOOKING, FINANCE_APPROVED` ในตัวอย่าง จึงต้อง map ตอน migrate

### n8n workflow ที่ export มา (ยืนยันจาก JSON)

```
Webhook (GET+POST, responseNode)
 ├─ GET  → Respond to Webhook (hub.challenge)
 └─ POST → Edit Fields7 (chatinput,userid,message_id,timestamp จาก entry[0].messaging[0])
        → Remove Duplicates (message_id, ข้าม execution)
        → Workflow Configuration (salespeople="SA0001 - วิ ,SA0002 - โอ๋")
        → Extract Customer Data (AI Agent gpt-4.1-mini + Structured Output Parser)
        → Normalize Phone Number (Code: ตัดเลข, 66→0, วัน/เวลา Asia/Bangkok)
        → Supabase Lookup Lead (leads where Phone_Number = เบอร์)
        → HAVE TEL Y/N ?  (switch ตาม normalizedPhone ว่าง/ไม่ว่าง)
             ├─ NO  → Create New Lead1 → Supabase Insert Lead (No Phone)        [จบ]
             └─ YES → IF Phone Exists? (Phone_Number มีใน lookup?)
                    ├─ ใช่  → Supabase Update Lead                               [จบ]
                    └─ ไม่  → Create New Lead (สร้าง Lead_ID) → Supabase Get All Leads
                            → Assign Sales1 (round-robin) → Supabase Insert New Lead
                            → Switch (Assigned_Sales)
                                 ├─ SA0001 → Telegram กลุ่ม LEAD1 → Telegram ส่วนตัว วิ
                                 └─ SA0002 → Telegram กลุ่ม LEAD  → Telegram ส่วนตัว โอ๋
(ลอย ไม่เชื่อมต่อ: Google Sheets ×5 — Update Existing Lead, Lookup, Append row, Get row(s), Append row in sheet2)
```

> แก้ไขจากร่างก่อนหน้า: ร่างแรกอ่านจากภาพและเข้าใจว่า Sheet append ต่อท้าย Telegram — JSON ยืนยันว่าไม่เชื่อมต่อ

**ส่วนที่ไม่อยู่ใน export นี้แต่ต้องมีอยู่จริง:** ข้อความ Telegram บอกให้เซลล์ "ตอบกลับข้อความนี้เพื่อติดต่อลูกค้า" และชีตมี `Accepted_Time/Accepted_By/Response_Minutes/Sales_Reply/Lead_Status` กับ `ACTIVITY_LOG` — แปลว่ามี workflow/สคริปต์อื่นรับ reply จาก Telegram แล้วอัปเดตสถานะ (น่าจะเป็นต้นทางของ Response_Minutes ติดลบด้วย) **ต้องขอ workflow นั้นเพิ่ม** เพราะเป็นหัวใจของการรับ/ติดต่อลีด

### 2.1 ผลตรวจ workflow (เรียงตามความรุนแรง)

| # | ปัญหา | ผลกระทบ | แนวทางแก้ใน design ใหม่ |
|---|---|---|---|
| W1 | Supabase node ไม่มี credential, workflow ปิดอยู่ | รันไม่ได้ | ใช้ HTTP Request → RPC พร้อม credential เดียว (service role เก็บใน n8n) |
| W2 | **ไม่ตรวจลายเซ็น Facebook** (`X-Hub-Signature-256`) | ใครก็ POST ลีดปลอม/ยิงสแปมเข้าระบบ + เข้า OpenAI/Telegram ได้ | ตรวจ HMAC ก่อนทำอะไรต่อ |
| W3 | Supabase Lookup ไม่ตั้ง `alwaysOutputData` (ฝั่ง Sheets ตั้งไว้) | เบอร์ใหม่/ไม่พบ = 0 item → flow หยุด **ลีดใหม่ไม่ถูกสร้างและไม่แจ้งเตือน** | ย้าย lookup+insert ไปไว้ใน RPC เดียว (atomic) |
| W4 | `Supabase Update Lead` เขียนทับด้วยค่าเดิมของ `$json` (แถวที่ lookup เจอ) ไม่ใช่ข้อความใหม่ | ลูกค้าเก่าทักมาอีก → **ข้อความใหม่ไม่ถูกบันทึก ไม่แจ้งเซลล์** | บันทึกเป็น `lead_events` ใหม่ + reopen/สร้าง task ติดต่อ |
| W5 | เคส "ไม่มีเบอร์" insert ทุกข้อความเป็นลีดใหม่ ไม่ dedupe ด้วย `Facebook_User_ID`, ไม่ assign, ไม่แจ้ง | เป็นที่มาของ `SHEET_1_MES` ~2,766 แถว, ลีดไร้เจ้าของจำนวนมาก | 1 FB user = 1 lead; ข้อความถัดไปเป็น event; ได้เบอร์ภายหลัง → ผูกเข้าลีดเดิม |
| W6 | Round-robin อ่านลีดทั้งตาราง (ไม่เรียงลำดับ) แล้วดู "แถวสุดท้าย" | แถวไม่มีเจ้าของ (W5) ทำให้ `indexOf=-1` → รีเซ็ตเป็น SA0001 เสมอ → **แจกไม่เท่ากัน**; ช้าลงเมื่อข้อมูลโต; แข่งกันเมื่อมีลีดพร้อมกัน | `assign_lead()` ใน DB ใช้ตัวนับ/ลีดเปิดน้อยสุด + lock, รองรับเซลล์ลา/เพิ่มคน |
| W7 | Lead_ID = `YYYYMMDD-` + 6 หลักท้ายของ ms | ชนกันได้ (รอบ 1,000 วินาที), ไม่ idempotent | `lead_code` unique + `idempotency_key = message_id` |
| W8 | POST ไม่ถูกตอบทันที (Respond to Webhook ต่อเฉพาะ GET) แต่ต้องรอ AI+DB | Facebook timeout แล้วส่งซ้ำ → ลีดซ้ำ (Remove Duplicates เป็นเพียงชั้นเดียว) | ตอบ 200 ทันที แล้วประมวลผลต่อ; dedupe ที่ DB |
| W9 | อ่านเฉพาะ `entry[0].messaging[0].message.text`; ไม่กรอง echo/attachment/read receipt/postback | batch event ถูกทิ้ง; event ไม่มี text ถูกส่งเข้า AI | วนทุก entry/messaging; กรอง `is_echo`, ไม่มี text |
| W10 | AI extract ไม่ validate; Normalize ไม่ตรวจความยาว/รูปแบบเบอร์ | เบอร์ 11 หลัก/เลขขยะเข้าฐาน (พบจริง `08968660966`) | validate ใน DB (`^0[689]\d{8}$` + เก็บ `phone_raw`) → ผิดรูป = DQ issue ไม่ทิ้ง |
| W11 | Code node ใช้ `new Date(toLocaleString(...))` + `toISOString()` | ถูกต้องเฉพาะเมื่อเซิร์ฟเวอร์ n8n ตั้ง TZ=UTC | ใช้ `timestamptz` ใน DB (`now()`), ให้ DB เป็นผู้กำหนดเวลา |
| W12 | เลขเซลล์/ชื่อ (`SA0001 - วิ`) เป็น string ฮาร์ดโค้ด, ใช้เป็นคีย์ใน Switch และ Telegram chat id ฮาร์ดโค้ด | เพิ่ม/ลาเซลล์ต้องแก้ workflow | ตาราง `sales_team` (+ `telegram_chat_id`) |
| W13 | ไม่มี Error Workflow / retry / บันทึกความล้มเหลว | ลีดหายเงียบ | `ingest_log` + Error Trigger → Telegram ผู้ดูแล |
| W14 | ชื่อคอลัมน์ใน Supabase node เป็น `Lead_ID`, `Phone_Number`, `Customer_Message`, `Facebook_User_ID`, `Telegram_Status` ฯลฯ | **ไม่ตรงกับตาราง `leads` ของรีโป** (snake_case, 12 คอลัมน์, ไม่มี Customer_Message/Facebook_User_ID/Telegram_Status) → insert จะพังถ้าชี้มาที่โปรเจกต์นี้ | ไม่เขียนตรง ให้ผ่าน RPC ของ schema `crm` |

**PDPA:** ข้อความลูกค้าทั้งก้อนถูกส่งไป OpenAI เพื่อสกัดชื่อ/เบอร์ (จำเป็นต่อวัตถุประสงค์นี้ แต่ควรบันทึกไว้ในนโยบายความเป็นส่วนตัว) และ Telegram กลุ่มได้รับชื่อ+เบอร์เต็ม — ควรยืนยันว่าเป็นกลุ่มเฉพาะทีมขาย

### 2.2 workflow รับ reply จาก Telegram (`TELEGRAM_SA001_DEMO(NEED)`, `TELEGRAM_SA002` — ทั้งคู่ `active: true`)

โครงเหมือนกัน (โค้ดต่างกันแค่ชื่อ node): เซลล์ตอบกลับ (reply) การ์ดลีดใน Telegram → ดึง Lead ID ด้วย regex `\d{8}-\d{6}` → ค้น `SHEET_1_TEL` → **AI (gpt) สกัดข้อมูล ~75 ฟิลด์จากข้อความ** → รวมกับแถวเดิม → append `ACTIVITY_LOG` → update `SHEET_1_TEL` → ส่งข้อความยืนยัน นี่คือที่มาของ `Accepted_*`, `Response_Minutes`, `Sales_Reply`, `Lead_Status` และ ACTIVITY_LOG ทั้งหมด

| # | ปัญหา | หลักฐานใน JSON | ผลกระทบ |
|---|---|---|---|
| T1 | **Response_Minutes ติดลบ — พบรากเหตุแล้ว** | `new Date(\`${Created_Date}T${Created_Time}\`)` ถูกตีความเป็นเวลาของเซิร์ฟเวอร์ (UTC) ทั้งที่ค่าเป็นเวลาไทย; ลบกับ `now` จริง → คลาดเคลื่อน −420 นาที | ลีด `20260810-884615`: จริง 117 นาที → −303 ✔ ตรง; ลีด `20260811-523198`: จริง 17 นาที → −403 ✔ ตรง — **ทุกค่าที่รายงาน SLA การตอบกลับใน Sheet ผิดทั้งหมด** |
| T2 | `Accepted_Time` สร้างด้วย `toLocaleString('th-TH')` | ได้ `10/08/2569 19:28:36` (พ.ศ. + dd/mm) | ที่มาของวันที่ปี พ.ศ. ในชีต |
| T3 | **Prompt ไม่บอกวันที่ปัจจุบัน** AI จึงเดาปี | ไม่มีวันที่ใน system message | ที่มาของ Appointment/Next_Follow_Up เป็นปี 2024 |
| T4 | Node IF 4 ตัว (`Check If Reply`, `Validate Lead ID`, `Check Lead Found`, `Check If Already Accepted`) **ไม่มีเงื่อนไขจริง** (เปรียบเทียบ "" กับ "" หรือไม่มี conditions) | พารามิเตอร์ใน export | ข้อความใดๆ ที่ส่งเข้าบอท (ไม่ใช่ reply / ไม่พบ Lead ID / ลีดที่รับแล้ว) ผ่านเข้า AI และเขียนชีตได้ทั้งหมด — ตรวจใน n8n UI ว่าการ export ตรงกับของจริงหรือไม่ |
| T5 | **AI เขียนทับฟิลด์สำคัญได้** `getValue(ai, เดิม)` ใช้ค่า AI ถ้าไม่ว่าง รวมถึง `Assigned_Sales`, `Lead_Status` (รวม WON/BOOKING), `Phone_Number`, `Customer_Name` | โค้ด Merge | ขัดข้อกำหนด "ห้ามเปลี่ยนเป็น BOOKING/WON โดยไม่มีหลักฐาน" และ "การเปลี่ยนเจ้าของต้องเป็นมนุษย์" |
| T6 | ไม่ตรวจว่าผู้ตอบเป็นเจ้าของลีดหรือไม่; ไม่มี allowlist ผู้ส่ง; `Accepted_By` = ชื่อ Telegram (`Sale Two`, `เซลล์ One`) | โค้ด Extract Lead ID | ใครก็ตอบแทนลีดของคนอื่นได้, ชื่อไม่ผูกกับ `Assigned_Sales` |
| T7 | "ตอบครั้งแรก" = รับลีด = ติดต่อสำเร็จ (ปนกัน) | `Accepted_Time` ตั้งเมื่อว่าง | ขัดกฎ "กดรับลีดไม่ถือว่าติดต่อลูกค้าสำเร็จ" |
| T8 | ข้อความยืนยันฝั่ง SA002 อ้าง node `Google Sheets Lookup by Lead ID` / `Append to ACTIVITY_LOG` ซึ่ง**ไม่มีใน workflow นี้** (ชื่อจริงลงท้าย `1`) | Telegram node `WLC_LEAD_S0002_โอ๋2` | ข้อความยืนยันถึงโอ๋ error/ว่าง (copy-paste จาก SA001) |
| T9 | อ่าน-แก้-เขียนชีตแบบไม่ล็อก; เขียน ACTIVITY_LOG ก่อนแล้วค่อย update SHEET_1_TEL (ไม่ atomic) | Connections | reply ซ้อนกันทับกัน / ข้อมูล 2 แท็บไม่ตรงกัน (ACTIVITY_LOG 1,123 แถว vs SHEET_1_TEL) |
| T10 | Lead_Score 1–10 ไม่มีเหตุผลประกอบ; ค่าตัวเลขเชื่อใจ AI คำนวณเป็นค่าสุดท้าย | System prompt | แทนด้วย scoring 0–100 พร้อมเหตุผลตามสเปก (Phase 5) |

**ของที่ดีและเก็บไว้ใน design ใหม่:** กฎ "อย่าเปลี่ยนสถานะ/อุณหภูมิ/คะแนน ถ้าข้อความเป็นแค่ข้อมูล Customer Card", กฎตัวเลข "คืนค่าสุดท้ายไม่ใช่ส่วนต่าง", และรายการฟิลด์ Customer Card ทั้งหมด

**วิธีแก้ที่ทำแล้วใน DB (`supabase/crm/005_sales_reply.sql`, ทดสอบผ่าน):** n8n ส่งผล AI + ข้อความ + `telegram_user_id` ผู้ตอบ + `update_id` เข้า `crm.record_sales_reply()` แล้ว DB ตัดสินใจเอง —
- ผู้ตอบต้องเป็นเจ้าของลีดหรือผู้จัดการ (ผูกด้วย `sales_team.telegram_user_id`) (T6)
- เวลา/Response time คำนวณใน DB เป็น `timestamptz` (T1, T2); `update_id` กันซ้ำ (T9)
- "รับลีด" แยกจาก "ติดต่อสำเร็จ"; ติดต่อสำเร็จนับเมื่อเซลล์รายงานผลชัดเจนเท่านั้น (T7)
- AI เติม Customer Card ได้เฉพาะฟิลด์ที่อนุญาตและไม่ว่าง; **ไม่แตะ** เจ้าของ/เบอร์/ชื่อ (T5)
- สถานะ: เลื่อนไปข้างหน้าเฉพาะขั้นที่ไม่ต้องใช้หลักฐาน; BOOKING/FINANCE_APPROVED/WON/LOST = เป็น "ข้อเสนอของ AI" รอมนุษย์ (T5)
- วันนัดต้องอยู่ในอนาคตไม่เกิน 1 ปี มิฉะนั้นไม่ใช้และบันทึกเป็น DQ issue (T3)

ฝั่ง n8n ที่ต้องแก้ตาม: ใส่วันที่/เวลาปัจจุบัน (Asia/Bangkok) ใน prompt, ตั้งเงื่อนไข IF ให้ถูก, ใช้ workflow เดียวสำหรับเซลล์ทุกคน (แยกด้วย `telegram_user_id` แทนการก๊อป workflow ต่อคน) และแก้ T8

---

## 3. ปัญหาคุณภาพข้อมูลที่พบจากตัวอย่าง (Module G)

| ปัญหา | ตัวอย่างจริง | แนวทาง |
|---|---|---|
| Response_Minutes **ติดลบ** | `-303`, `-403`, `-175` | **สาเหตุคือบั๊ก timezone ใน n8n (T1)** — คำนวณใหม่ใน Supabase; ค่าเดิมเก็บใน `legacy` ห้ามใช้รายงาน SLA |
| วันที่ผิดปี | Appointment `2024-02-16`, Next_Follow_Up `2024-06-16` ในลีดที่สร้าง 2026-08 | flag `DATE_IMPLAUSIBLE` ไม่แก้อัตโนมัติ |
| วันที่ปี พ.ศ. + รูปแบบ dd/mm | `Accepted_Time = 10/08/2569 19:28:36` | parser แปลง พ.ศ.→ ค.ศ. เก็บ `timestamptz` (Asia/Bangkok) |
| วันที่รูปแบบปนกัน | `8/8/2026` (MES) vs `2026-08-08` (TEL) | normalize ตอน import |
| เบอร์โทรรูปแบบปน | `0814452574`, `814452574` (ACTIVITY_LOG ตัด 0), `096-2696260`, `08968660966` (11 หลัก) | เก็บ `phone_e164` + `phone_raw`; flag เบอร์ผิดรูป |
| ชื่อ/ข้อความผิดช่อง | Customer_Name ว่างแต่เบอร์ไปอยู่ใน `Customer_Message`; Interested_Model เป็นเบอร์ | flag; ไม่ย้ายค่าอัตโนมัติ |
| Interested_Model พิมพ์อิสระ | `PORTA`, `Porta`, `porta ev`, `Daion`, `Darion 7ที่นั่ง`, `บิงโก`, `รถขนาดเล็ก` | ตาราง `vehicle_models` + alias mapping; ที่ map ไม่ได้ไว้ให้คนยืนยัน |
| **สถานะขัดกับประวัติ** | ลีด `20260810-884615` เป็น `LOST` แต่ Sales_Reply เขียนว่านัด test drive วันที่ 16 และลูกค้าบอกจะทักมาเอง | ตัวอย่างตรงกับ "LOST แต่ยังมีสัญญาณสนใจ" (Module A) → alert ให้ผู้จัดการทบทวน |
| LOST ไม่มีเหตุผล | คอลัมน์ `Lost_Reason` ว่างใน ACTIVITY_LOG | บังคับกรอกเมื่อเปลี่ยนเป็น LOST (ลีดเก่าใช้ `UNKNOWN`) |
| Lead_Score ไม่มีคำอธิบาย | `9`, `7` | แทนด้วย scoring ใหม่ 0–100 พร้อมเหตุผล (ไม่ทับค่าเดิม) |
| Temperature ว่าง | `LOST` + temperature `NULL` | อนุญาต NULL ไม่เดา |

> ตัวเลข "439 / 1,123 / 2,766 แถว" มาจาก table range ของชีต ไม่ได้ผ่านการนับแถวที่มีข้อมูลจริง — ต้องนับซ้ำใน Migration Dry-run

---

## 4. สถาปัตยกรรมเป้าหมาย (4 Layers)

```
┌───────────────────── Presentation (Next.js ใน web/, mobile-first) ─────────────────────┐
│ Sales Home · My Leads · Tasks · Lead Timeline · Kanban · Perf · Exec · Settings         │
│ Supabase Auth + RLS (role: sales / sales_manager / executive / admin)                   │
└───────────────┬─────────────────────────────────────────────────────────────────────────┘
                │ supabase-js (RLS)                          ▲ Realtime
┌───────────────▼──────────── Business Logic (อยู่ใน Postgres + Edge Functions) ──────────┐
│ • RPC functions: accept_lead, log_contact, change_stage (ตรวจหลักฐาน), assign_lead       │
│ • Triggers: audit_log, stage-evidence guard, task upsert (idempotent)                    │
│ • pg_cron: SLA sweep ทุก 5 นาที, daily brief 08:00 Asia/Bangkok                          │
│ • Views: v_lead_control_center, v_sales_performance, v_funnel                            │
└───────────────┬───────────────────────────────────────────────┬─────────────────────────┘
                │ service-role (เซิร์ฟเวอร์เท่านั้น)              │
┌───────────────▼──────────── Orchestration (n8n) ──┐  ┌─────────▼──── AI Intelligence ──────┐
│ Webhook ingest (FB/LINE) → normalize → upsert RPC │  │ Edge Function `ai-analyze-lead`      │
│ Telegram: reminder / due / overdue / escalate     │  │ ส่งเฉพาะ: ข้อความแชตที่ redact เบอร์/ │
│ Retry + Error Workflow + dedupe ด้วย idempotency  │  │ ชื่อ, stage, ช่วงเวลา, รุ่น — ไม่ส่ง │
│                                                   │  │ เบอร์/ชื่อ/ID. บันทึกผลลง ai_insights│
└───────────────────────────────────────────────────┘  └──────────────────────────────────────┘
```

**การตัดสินใจหลัก (ขอให้ยืนยัน):**

| # | ตัดสินใจ | เหตุผล |
|---|---|---|
| D1 | Supabase (Postgres) เป็น **Source of Truth เดียว**; Apps Script ไม่ใช้เป็น backend อีก | SLA/Task/Audit ต้อง transaction + trigger; Sheets ไม่รองรับ |
| D2 | Business rules อยู่ใน **Postgres functions/triggers** ไม่ใช่ใน n8n | บังคับ "ห้ามเปลี่ยน BOOKING/WON ไม่มีหลักฐาน" ได้ทุกช่องทางรวมทั้ง UI และ n8n |
| D3 | n8n ทำแค่ ingest + แจ้งเตือน + เรียก AI | ลดความซับซ้อน; logic ไม่กระจาย |
| D4 | **Workflow production เดิมที่เขียน Google Sheets ไม่แตะ** จนกว่าชุดใหม่ผ่านทดสอบ; ชุดใหม่ทดสอบด้วย webhook แยก (Facebook test) แล้วค่อยสลับ; Sheet เก็บเป็น archive | ไม่ทำ workflow เดิมหยุด / rollback ได้ |
| D5 | ใช้ `web/` (Next.js) เป็น UI | มี Auth/Supabase client แล้ว |
| D6 | AI แนะนำอย่างเดียว; การเปลี่ยน owner/อนุมัติ/ขึ้น BOOKING ต้องมีมนุษย์กดผ่าน RPC ที่เช็ก role | ตามข้อกำหนดผู้บริหาร |

---

## 5. Data Model ร่าง (Data Dictionary ย่อ — ฉบับเต็มทำใน Phase 2 ถัดไป)

หลักการ: **ไม่แตะตาราง `leads` เดิมที่ web/ ใช้อยู่** → สร้างสคีมาใหม่ `crm` แล้วค่อยทำ view/สลับเมื่อพร้อม

| ตาราง | หน้าที่ | คอลัมน์สำคัญ |
|---|---|---|
| `crm.leads` | Lead master | `id uuid`, `lead_code` (= Lead_ID เดิม **unique**), `phone_e164`, `phone_raw`, `customer_name`, `fb_user_id`, `source`, `model_id`, `owner_id`, `accepted_at`, `first_contact_at`, `stage`, `temperature`, `lost_reason`, `next_follow_up_at`, `next_action`, `created_at` (timestamptz, Asia/Bangkok), `legacy jsonb` (**แถวเดิมครบ 53 คอลัมน์ ไม่สูญข้อมูล**) |
| `crm.lead_events` | Timeline / หลักฐานการติดต่อ | `lead_id`, `type` (ASSIGNED/ACCEPTED/CONTACT/STAGE_CHANGE/NOTE/AI), `channel`, `outcome`, `evidence jsonb`, `actor_id`, `occurred_at`, `idempotency_key unique` — **รับข้อมูลจาก ACTIVITY_LOG 1,123 แถว** |
| `crm.deals` | หลักฐานธุรกรรม | `lead_id`, `kind` (QUOTATION/BOOKING/FINANCE/DELIVERY), `doc_ref`, `amount`, `verified_by`, `verified_at` — **จำเป็นก่อนขึ้น BOOKING/WON** |
| `crm.tasks` | Follow-up Task Engine | `lead_id`, `assignee_id`, `kind`, `due_at`, `priority`, `status`, `reminder_state`, `escalation_level`, `completed_event_id`; **unique (lead_id, kind) where status='OPEN'** → ไม่สร้างซ้ำ |
| `crm.sla_rules` | SLA แก้ได้โดยผู้บริหาร | `scope` (NEW/HOT/WARM/COLD), `minutes`, `business_hours_only`, `escalate_after_minutes[]` |
| `crm.alerts` | การแจ้งเตือน (กันซ้ำ) | `task_id`, `level`, `channel`, `sent_at`, **unique (task_id, level)** |
| `crm.ai_insights` | คะแนน+เหตุผล+Next Best Action | `lead_id`, `readiness_score`, `neglect_risk_score`, `reasons jsonb`, `nba`, `model`, `input_hash` |
| `crm.data_quality_issues` | แยกจาก SLA violation | `entity`, `entity_id`, `code`, `severity`, `detail`, `status` |
| `crm.audit_log` | ทุกการเปลี่ยนแปลง | `table`, `row_id`, `action`, `before`, `after`, `actor`, `at` — แก้/ลบไม่ได้ |
| `crm.profiles` / `crm.sales_team` | role + เซลล์ + Telegram chat id | `role`, `telegram_chat_id`, `manager_id`, `active` |
| `crm.vehicle_models` / `model_aliases` | normalize รุ่นรถ | Darion, Porta, Bingo ฯลฯ |
| `crm.chat_messages` | ย้ายจาก `ชีต1` (ทางเลือก ทำหลังสุด) | ใช้เป็น input ของ AI ที่ redact แล้ว |

**Pipeline stage** แยกจาก **Temperature** คนละคอลัมน์ตามสเปก. Mapping จากค่าเดิม: `NEW→NEW`, `CONTACTED→CONTACTED`, `FOLLOW_UP→FOLLOW_UP`, `TEST_DRIVE→TEST_DRIVE`, `LOST→LOST(+reason)`, `WON→WON`. **ลีดเก่าที่เป็น WON โดยไม่มีหลักฐานธุรกรรม** จะถูก migrate ตามเดิมแต่ติด flag `LEGACY_UNVERIFIED` (ไม่ปรับลดเอง)

**Guard ที่ฝังใน DB (Acceptance: ป้องกันเปลี่ยนสถานะไม่มีหลักฐาน)**
- `stage → BOOKING/FINANCE_APPROVED/WON` ต้องมี `crm.deals` ที่ `verified_at is not null`
- `ACCEPTED` ไม่นับเป็น first contact — `first_contact_at` ตั้งได้จาก event `CONTACT` ที่มี `outcome` เท่านั้น
- เปลี่ยน `owner_id` ได้เฉพาะ role `sales_manager+`

**RBAC/PDPA:** RLS — sales เห็นเฉพาะลีดตนเอง; manager เห็นทีม; executive เห็น aggregate (เบอร์ถูก mask); ปิด `leads_select_public`; service-role key อยู่ใน n8n/Edge เท่านั้น; ส่ง AI เฉพาะข้อความที่ redact + เก็บ `input_hash` เพื่อตรวจย้อนหลัง

---

## 6. แผน Migration (ไม่ลบ ไม่เปลี่ยนชื่อ ไม่ทำ workflow หยุด)

| ขั้น | งาน | Rollback |
|---|---|---|
| M0 | Export ชีตทั้งไฟล์เก็บสำเนา (Drive snapshot) | — |
| M1 | สร้างสคีมา `crm` ใน Supabase (ไม่กระทบตารางเดิม) | drop schema crm |
| M2 | Import แบบ dry-run: `SHEET_1_TEL`→`leads`, `ACTIVITY_LOG`→`lead_events`; ออกรายงาน reconciliation (จำนวนแถว, Lead_ID ซ้ำ/ขาด, DQ issues) | ล้างตารางแล้วรันใหม่ (idempotent ด้วย `lead_code`/`idempotency_key`) |
| M3 | ผู้ใช้ตรวจรายงาน → import จริง | — |
| M4 | สร้าง ingest workflow ใหม่ (เรียก RPC `crm.ingest_message`) แทนเวอร์ชัน `+ supabase` ที่ชำรุด; ทดสอบด้วย webhook ทดสอบ | ปิด workflow ใหม่ |
| M5 | รัน **shadow mode** 1–2 สัปดาห์: ให้ workflow เดิมเขียน Sheet ต่อ + ให้ workflow ใหม่รับ event เดียวกันเขียน Supabase (ไม่ส่ง Telegram ซ้ำ) แล้วเทียบผลรายวัน | ปิด shadow |
| M6 | Cut-over: เปิด Telegram ของ workflow ใหม่ ปิด workflow เดิม; Sheet เป็น read-only archive | เปิด workflow เดิมคืน |

ข้อมูลที่ **ไม่ย้าย**: `DAY_LOG` (derived → ทำเป็น view), `KPI` (โดเมน MKT)

---

## 7. ลำดับงานต่อ (ตาม Phase เดิม)

| Phase | ส่งมอบ |
|---|---|
| 2 (ต่อ) | Data Dictionary ฉบับเต็ม, Business Rules (SLA/Pipeline/Scoring), DDL ฉบับร่าง |
| 3 | `crm` schema + import scripts + Lead Control Center views + Task Engine |
| 4 | n8n: แก้ ingest + Telegram reminder/escalation (JSON workflow) |
| 5 | Edge Function AI scoring + Next Best Action |
| 6 | หน้า UI (Sales Home ก่อน) |
| 7 | Test cases + ทดสอบกับข้อมูลย้อนหลัง |

---

## 8. สิ่งที่ยังต้องขอจากผู้ใช้ก่อนเริ่ม Phase 3

~~1. n8n workflow รับลีด~~ ได้รับแล้ว (2.1) · ~~workflow รับ reply Telegram~~ ได้รับแล้ว (2.2)

1. **Telegram user id ของเซลล์/หัวหน้าแต่ละคน** (ใช้ผูก `sales_team.telegram_user_id`; ไม่ใช่ chat id ของกลุ่ม)
2. **Workflow production ที่ใช้อยู่จริง** (เวอร์ชัน Google Sheets) เพื่อใช้เป็นฐานเทียบใน shadow mode
3. **Supabase project**: ใช้โปรเจกต์เดียวกับ MKT Content Manager หรือแยกใหม่? (ตาราง `leads` ปัจจุบันมี policy เปิดสาธารณะ — แนะนำแยกใหม่ หรือล็อกก่อน)
4. **หัวหน้าฝ่ายขาย + Telegram chat ID ที่ใช้ escalate** และ **เวลาทำการ** (SLA ชั่วโมงทำการ) — รายชื่อเซลล์ตอนนี้เห็น 2 คน (SA0001 วิ, SA0002 โอ๋)
5. โค้ด **Apps Script ของ Lead CRM เดิม** (ถ้ามี)
6. ยืนยันการตัดสินใจ D1–D6 ข้างต้น
