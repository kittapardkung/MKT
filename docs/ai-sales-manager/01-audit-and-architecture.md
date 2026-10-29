# JUSTICE GROUP — AI Sales Manager
## เอกสาร 01: ผลตรวจระบบเดิม (Phase 1) และสถาปัตยกรรมย้าย Google Sheets → Supabase (Phase 2)

สถานะ: **ร่างเพื่อขออนุมัติ — ยังไม่มีโค้ดหรือ migration ถูกรัน**
วันที่ตรวจ: 2026-10-29

---

## 1. ข้อค้นพบสำคัญ (อ่านส่วนนี้ก่อน)

1. **n8n workflow ครึ่งทางไปที่ Supabase แล้ว** — จากภาพ มี Supabase node 5 ตัว (Lookup / Insert / Insert No Phone / Update / Get All Leads) แต่ยังมี `Append row in sheet` 2 ตัว และ Supabase node ทุกตัวมีเครื่องหมายเตือนสีแดง (น่าจะ credential/ตั้งค่าไม่ครบ — ต้องเปิดดูใน n8n จริง ยืนยันจากภาพอย่างเดียวไม่ได้)
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

### n8n workflow ปัจจุบัน (อ่านจากภาพ)

```
Webhook ─┬─ Respond to Webhook
         └─ Edit Fields1 → Remove Duplicates → Workflow Configuration
              → Extract Customer Data (AI Agent + OpenAI Chat Model + Structured Output Parser)
              → Normalize Phone Number (Code)
              → Supabase Lookup Lead → HAVE TEL Y/N?
                   ├─ ไม่มีเบอร์ → Create New Lead1 → Supabase Insert Lead (No Phone)
                   └─ มีเบอร์   → IF Phone Exists?
                          ├─ มีแล้ว  → Supabase Update Lead
                          └─ ยังไม่มี → Create New Lead → Supabase Get All Leads
                                → Assign Sales1 (Code) → Supabase Insert New Lead
                                → Switch → Telegram LEAD1 → Append row in sheet
                                         → Telegram LEAD2 → Append row in sheet (Mobile)
(แยกลอย) Append row in sheet 2
```

ข้อสังเกต: การกระจายเซลล์ (`Assign Sales1`) อ่านลีดทั้งหมดมานับเอง และ Supabase Insert/Update ไม่มี idempotency key (webhook ซ้ำอาจสร้างลีดซ้ำ — มี `Remove Duplicates` แต่เป็น in-memory ต่อ execution)

---

## 3. ปัญหาคุณภาพข้อมูลที่พบจากตัวอย่าง (Module G)

| ปัญหา | ตัวอย่างจริง | แนวทาง |
|---|---|---|
| Response_Minutes **ติดลบ** | `-303`, `-403`, `-175` | คำนวณใหม่เป็น `accepted_at - created_at` ใน Supabase; เก็บค่าเดิมเป็น `raw` + flag DQ |
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
| D4 | Google Sheet คง **read-only mirror** ช่วง cut-over (n8n เขียนทั้งสองที่) แล้วค่อยเลิก | ไม่ทำ workflow เดิมหยุด / rollback ได้ |
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
| M4 | แก้ n8n: เขียน `crm.*` ผ่าน RPC **ควบคู่** กับ Sheet (dual-write) ใช้ webhook ทดสอบก่อน | ปิดสาขาใหม่ |
| M5 | รัน dual-write 1–2 สัปดาห์ เทียบผลทุกวัน (Sheet vs Supabase) | สลับกลับไปอ่าน Sheet |
| M6 | Cut-over: UI/Telegram อ่านจาก Supabase; Sheet เป็น read-only archive | เปิด Sheet เขียนอีกครั้ง |

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

## 8. สิ่งที่ต้องขอจากผู้ใช้ก่อนเริ่ม Phase 3

1. **n8n workflow JSON** (Export จาก n8n) — ภาพอ่านได้แค่โครงสร้าง ไม่เห็น config/expression/credential และสาเหตุเครื่องหมายเตือนสีแดง
2. **Supabase project**: ใช้โปรเจกต์เดียวกับ MKT Content Manager หรือแยกใหม่? (ตอนนี้ข้อมูลลูกค้ามี policy เปิดสาธารณะอยู่ — แนะนำแยกหรือล็อกก่อน)
3. **รายชื่อเซลล์ + หัวหน้า + Telegram chat ID** และ **เวลาทำการ** (สำหรับ SLA ชั่วโมงทำการ)
4. โค้ด/สำเนา **Apps Script ของ Lead CRM เดิม** (ถ้ามี) เพื่อไม่ทำ logic เดิมหาย
5. ยืนยันการตัดสินใจ D1–D6 ข้างต้น
