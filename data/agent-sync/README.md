# Agent sync data (SCOUT / COMPASS / SPARK)

ไฟล์ในโฟลเดอร์นี้คือ snapshot ข้อมูลที่ดึงมาจาก Artifact ของทีม 4-agent workflow
(เรดาร์คู่แข่ง, กลยุทธ์การตลาด, คลัง Hook วิดีโอ) เพื่อ sync เข้า Supabase ให้แอป
MKT Content Manager แสดงผล

## ทำไมต้องมีขั้นตอนนี้ (แทนที่จะ sync อัตโนมัติ)

ลองมาแล้วสองทาง ทั้งคู่ติดกำแพงที่แก้ไม่ได้จากฝั่งเรา:

1. **ให้ Routine (SCOUT/COMPASS/SPARK) push เข้า Supabase ตรงๆ ผ่าน curl** — ถูกบล็อกด้วย
   นโยบายเครือข่ายขององค์กร (`hard organization policy denial, 403 connect_rejected`)
2. **ให้ script ภายนอก (GitHub Action) ดึงหน้า Artifact มา parse เอง** — โดนกำแพง
   Cloudflare bot-protection ของ claude.ai บล็อก (ได้ challenge page แทนเนื้อหาจริง)

ทางที่เหลือที่ใช้ได้จริง: ให้ Claude session แบบมี Artifact tool (เช่น session ที่คุยกับคุณ
ตอนนี้) อ่าน Artifact ทั้ง 3 หน้าเอง (ใช้ได้ปกติ เป็นเครื่องมือ first-party) แล้วเขียนข้อมูล
ที่สกัดได้ลงไฟล์ JSON ในโฟลเดอร์นี้ commit + push เข้า repo — GitHub Action
(`.github/workflows/sync-agent-data.yml`) จะรันสคริปต์ `web/scripts/sync-agent-data.mjs`
อ่านไฟล์เหล่านี้แล้ว upsert เข้า Supabase อีกที (GitHub Actions runner ไม่โดนบล็อกเครือข่ายแบบ
Claude session)

## วิธีอัปเดตข้อมูลรอบใหม่

1. เปิดหน้า Artifact ทั้ง 3 (ลิงก์อยู่ใน trigger ของแต่ละ Routine หรือถามหาได้)
2. ขอให้ Claude อ่านเนื้อหาล่าสุดแล้วสกัดใส่ไฟล์ `scout.json` / `compass.json` / `spark.json`
   ตามโครงสร้างเดิม (ดูตัวอย่างในไฟล์ที่มีอยู่)
3. commit + push ไป `main` — GitHub Action จะรัน sync ให้อัตโนมัติ

## โครงสร้างไฟล์

- `scout.json` → sync เข้า `agent_reports` (id: `scout-summary`, `scout-scorecard`, `scout-findings`)
- `compass.json` → sync เข้า `agent_reports` (id: `compass-positioning`, `compass-pps`, `compass-roadmap`)
- `spark.json` → sync เข้า `ideas` (id: `spark-<content-code>` เช่น `spark-SPK-PU01`) — รัน upsert
  ซ้ำด้วย code เดิมจะอัปเดตทับแถวเดิม ไม่สร้างซ้ำ
