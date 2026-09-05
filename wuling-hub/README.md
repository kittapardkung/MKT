# WULING HUB — Project Workspace

ระบบบริหารโครงการ/งาน (Dashboard, Today, Weekly TODO, My Tasks, Projects, Timeline,
Calendar, Kanban, Team, Reports, Management, Settings) — พอร์ตมาจากดีไซน์ "WULING HUB
Project Workspace" ที่แนบมา สร้างด้วย **Google Apps Script + Google Sheets เป็นฐานข้อมูล**
เป็นโปรเจกต์แยกต่างหาก ไม่เกี่ยวข้องกับแอป MKT Content Manager ที่อยู่ในโฟลเดอร์หลักของ repo นี้

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `Index.html` | โครงหน้าเว็บหลัก (รวม Stylesheet + JavaScript ผ่าน `include()`) |
| `Stylesheet.html` | CSS ทั้งหมด (โทนสี/ฟอนต์ตามดีไซน์ต้นฉบับ) |
| `JavaScript.html` | โค้ด client-side ทั้งหมด — state, การ render ทุกหน้า, การเรียก backend ผ่าน `google.script.run` |
| `Code.gs` | Apps Script backend — อ่าน/เขียน Google Sheets และเสิร์ฟหน้าเว็บผ่าน `doGet()` |
| `appsscript.json` | ไฟล์ manifest ของโปรเจกต์ |

## วิธีติดตั้ง

1. สร้าง Google Sheet ใหม่ (จะใช้เป็นฐานข้อมูล) — แนะนำให้สร้างสคริปต์แบบ **bound script**
   (เปิดชีต → Extensions → Apps Script)
2. ลบโค้ดตัวอย่างเริ่มต้น แล้วสร้างไฟล์ตามตารางด้านบน คัดลอกเนื้อหาจากโฟลเดอร์นี้ไปวาง
   - เปิด **Project Settings → Show "appsscript.json" manifest file in editor** ก่อน จึงจะแก้ไข manifest ได้
3. **Deploy → New deployment → Web app**
   - Execute as: **User accessing the web app**
   - Who has access: ตามนโยบายทีม
   - กด Deploy แล้วแชร์ลิงก์ให้ทีม
4. ผู้ใช้แต่ละคนต้องมีสิทธิ์ **Editor** บน Google Sheet นี้ด้วย (เว็บแอปรันด้วยสิทธิ์ผู้ใช้ที่เข้าถึง)
5. เปิดเว็บแอปครั้งแรก ระบบจะสร้างชีตและข้อมูลตัวอย่าง (6 โครงการ, ทีม 6 คน, งานตัวอย่าง) ให้อัตโนมัติ
   ผ่าน `ensureSeed_()` ใน `doGet()` — ไม่ต้องรันฟังก์ชันใดด้วยมือ

### กรณีต้องการรันแบบ standalone script (ไม่ผูกกับสเปรดชีต)

ตั้ง Script Property ชื่อ `SPREADSHEET_ID` เป็น ID ของ Google Sheet ที่ต้องการใช้
(Project Settings → Script Properties) — ถ้าไม่ตั้งค่า ระบบจะสร้างสเปรดชีตใหม่ชื่อ
"WULING HUB — Database" ให้อัตโนมัติในการรันครั้งแรก แล้วจำ ID ไว้ให้เอง

## Sheets ที่ระบบใช้งาน

สร้าง/ซ่อมหัวตารางให้อัตโนมัติทุกครั้งที่เรียก API (`sheet_()`) โดยเติมเฉพาะคอลัมน์ที่ขาด ไม่ทับข้อมูลเดิม:

- **Users** — `id,name,dept,role,tone`
- **Projects** — `id,name,category,dept,desc,ownerId,team,priority,status,start,due,budget,actualCost,manual,tags,note`
  (`team`, `tags` เก็บเป็นข้อความ JSON array ในเซลล์เดียว)
- **Tasks** — `id,projectId,name,ownerId,dept,status,start,due,priority,progress,estCost,actualCost,subtasks,comments,desc`
  (`subtasks`, `comments` เก็บเป็นข้อความ JSON)
- **Milestones** — `id,projectId,name,date,done`
- **Activity** — `id,projectId,at,userId,text` — Log กิจกรรมของแต่ละโครงการ
- **Notifications** — `id,text,at,read`

แก้ไขข้อมูลตรงในชีตได้โดยตรง (เช่นแก้ชื่อคอลัมน์ JSON ต้องเป็น JSON ที่ถูกต้อง) เว็บแอปจะอ่านค่าล่าสุดทุกครั้งที่โหลดหรือหลังบันทึกข้อมูล

## ฟีเจอร์หลัก

- **Dashboard** — สรุป KPI, TODO สัปดาห์นี้, ความคืบหน้าโครงการ, งานเลยกำหนด
- **Today / Weekly TODO / My Tasks** — มุมมองงานของตัวเอง รายวัน/รายสัปดาห์/ทั้งหมด
- **Projects** — grid + หน้ารายละเอียดโครงการ (แท็บ ภาพรวม/Task/Timeline/Milestone/Activity/Budget)
- **Timeline / Calendar / Kanban** — ภาพรวมเชิงเวลาและบอร์ดสถานะงาน (Kanban ลากวางเปลี่ยนสถานะได้)
- **Team / Reports / Management / Settings** — จัดการสมาชิก, รายงานสรุป, ภาพรวมผู้บริหาร

การแก้ไขทุกอย่าง (สร้าง/แก้/ลบ โครงการ-งาน-Milestone-สมาชิก, คอมเมนต์, subtask) เขียนกลับ
ลง Google Sheet ทันทีผ่านฟังก์ชันใน `Code.gs` — เปิดพร้อมกันหลายคนได้ (sync แบบ refresh
หลังบันทึก และ auto-refresh เบาๆ ทุก 45 วินาที)

## จุดที่ยังไม่ได้ทำ (ต่อยอดได้)

- ไม่มีระบบสิทธิ์ผู้ใช้ตาม login จริง — สลับ "ผู้ใช้ปัจจุบัน" เป็นการจำลองในหน้า Settings/Sidebar
- ไม่มีอีเมลแจ้งเตือนอัตโนมัติ (ต่างจาก MKT Content Manager) — แจ้งเตือนอยู่ในกระดิ่งบนเว็บแอปเท่านั้น
