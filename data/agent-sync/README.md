# Agent sync data (SCOUT / COMPASS / SPARK / ALMANAC)

ไฟล์ในโฟลเดอร์นี้คือ snapshot ข้อมูลที่ดึงมาจาก Artifact ของทีม 4-agent workflow
(เรดาร์คู่แข่ง, กลยุทธ์การตลาด, คลัง Hook วิดีโอ, แผนคอนเทนต์) เพื่อ sync เข้า Supabase ให้แอป
MKT Content Manager แสดงผล

## ลิงก์ Artifact ถาวร (ไม่ต้องขอใหม่ทุกรอบ)

ลิงก์ต่อไปนี้เป็นลิงก์ถาวร — แต่ละ Routine อัปเดตเนื้อหาในลิงก์เดิมทุกครั้งที่รัน
ไม่ได้สร้างลิงก์ใหม่ ดังนั้นเมื่อผู้ใช้บอกว่า "agent ทำงานแล้ว" Claude อ่านลิงก์เหล่านี้ได้เลย
โดยไม่ต้องขอให้ส่งซ้ำ:

- SCOUT (เรดาร์คู่แข่ง): https://claude.ai/artifact/UnAcD64FcaG8HB9R45n1MF
- COMPASS (กลยุทธ์การตลาด): https://claude.ai/artifact/JxfvDqncTQCdpAV5knmwKm
- SPARK (คลัง Hook วิดีโอ): https://claude.ai/artifact/14MjfxWPiEFJoFDFDSMJyK
- ALMANAC (แผนคอนเทนต์): https://claude.ai/artifact/YWbFDvHwUiQUA1s6rBSaAW

ถ้าอ่านแล้วเนื้อหาดู "เก่า" ไม่ตรงกับที่ผู้ใช้บอกว่าเพิ่งรัน ให้ถามผู้ใช้ว่าลิงก์เปลี่ยนไปหรือไม่
(เผื่อมีการสร้าง Routine/Artifact ใหม่แทนของเดิม)

## ทำไมต้องมีขั้นตอนนี้ (แทนที่จะ sync อัตโนมัติ)

ลองมาแล้วสองทาง ทั้งคู่ติดกำแพงที่แก้ไม่ได้จากฝั่งเรา:

1. **ให้ Routine (SCOUT/COMPASS/SPARK/ALMANAC) push เข้า Supabase ตรงๆ ผ่าน curl** — ถูกบล็อกด้วย
   นโยบายเครือข่ายขององค์กร (`hard organization policy denial, 403 connect_rejected`)
2. **ให้ script ภายนอก (GitHub Action) ดึงหน้า Artifact มา parse เอง** — โดนกำแพง
   Cloudflare bot-protection ของ claude.ai บล็อก (ได้ challenge page แทนเนื้อหาจริง)

ทางที่เหลือที่ใช้ได้จริง: ให้ Claude session แบบมี Artifact tool (เช่น session ที่คุยกับคุณ
ตอนนี้) อ่าน Artifact ทั้ง 4 หน้าเอง (ใช้ได้ปกติ เป็นเครื่องมือ first-party) แล้วเขียนข้อมูล
ที่สกัดได้ลงไฟล์ JSON ในโฟลเดอร์นี้ commit + push เข้า repo — GitHub Action
(`.github/workflows/sync-agent-data.yml`) จะรันสคริปต์ `web/scripts/sync-agent-data.mjs`
อ่านไฟล์เหล่านี้แล้ว upsert เข้า Supabase อีกที (GitHub Actions runner ไม่โดนบล็อกเครือข่ายแบบ
Claude session)

## วิธีอัปเดตข้อมูลรอบใหม่

1. เมื่อผู้ใช้บอกว่า agent ทำงานเสร็จแล้ว อ่านลิงก์ถาวรทั้ง 4 ด้านบนด้วย Artifact tool
   (ไม่ต้องขอให้ผู้ใช้ส่งลิงก์ใหม่)
2. สกัดเนื้อหาล่าสุดใส่ไฟล์ `scout.json` / `compass.json` / `spark.json` / `almanac.json`
   ตามโครงสร้างเดิม (ดูตัวอย่างในไฟล์ที่มีอยู่) — SCOUT/COMPASS/SPARK มัก embed JSON สำเร็จรูป
   ไว้ในตัว Artifact เอง (script tag id="agent-sync-data") ใช้ก๊อปตรงได้เลย
3. commit + push ไป `main` และ branch หลักของ repo — GitHub Action จะรัน sync ให้อัตโนมัติ

## โครงสร้างไฟล์

- `scout.json` → sync เข้า `agent_reports` (id: `scout-summary`, `scout-scorecard`, `scout-findings`, ...)
- `compass.json` → sync เข้า `agent_reports` (id: `compass-positioning`, `compass-pps`, `compass-roadmap`)
- `spark.json` → sync เข้า `ideas` (id: `spark-<content-code>` เช่น `spark-SPK-PU01`) — รัน upsert
  ซ้ำด้วย code เดิมจะอัปเดตทับแถวเดิม ไม่สร้างซ้ำ
- `almanac.json` → sync เข้า `agent_reports` (id: `almanac-summary`, `almanac-insights`, ...)
- `ads.json` → sync เข้า `agent_reports` (id: `ads-summary`, `ads-creatives`, ...) — ข้อมูลนี้
  Claude ดึงเองจาก Meta Ads API โดยตรง ไม่ได้มาจาก Artifact/Routine

