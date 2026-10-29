# นำเข้าข้อมูลเดิมจาก Google Sheet → Supabase `crm`

ตัวแปลงอ่านไฟล์ `LOGGING_2_WULING.xlsx` (ดาวน์โหลดจาก Google Sheets: File → Download → .xlsx) แล้ว **สร้างไฟล์ SQL** ไม่เชื่อมฐานข้อมูลเอง และไม่แก้ชีตต้นฉบับ
ห้าม commit ไฟล์ .xlsx หรือโฟลเดอร์ `out/` (มีชื่อ/เบอร์ลูกค้า)

```bash
cd supabase/crm/import
npm install
node import-legacy.mjs ../../../LOGGING_2_WULING.xlsx --out ./out        # แล้วอ่าน out/REPORT.txt
# ตัวเลือก: --include-mes-only (นำเข้าคนที่ทักแชตแต่ไม่เคยให้เบอร์ ~980 คน)  --dormant-days 14
```

จากนั้นรันไฟล์ใน `out/` **ตามลำดับชื่อไฟล์** (10_leads → 20_events → 30_data_quality) ใน Supabase SQL Editor ทีละไฟล์ (รันซ้ำได้ ไม่สร้างข้อมูลซ้ำ) หรือใช้ psql:

```bash
for f in out/[1-3]*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
psql "$DATABASE_URL" -f out/99_verify.sql
```
ก่อนนำเข้าต้องมีแถว `crm.sales_team` รหัส SA0001/SA0002 แล้ว (ไม่งั้นลีดจะไม่มีเจ้าของ)

## กติกาที่ตัวแปลงใช้
- เวลาในชีต = เวลาไทย; ปี พ.ศ. (เช่น 2569) แปลงเป็น ค.ศ.
- `Response_Minutes` เดิมไม่นำมาใช้ (ผิดเพราะบั๊กเขตเวลา) เก็บไว้ใน `legacy` และบันทึกเป็น DQ (INFO)
- แถวเดิมครบทุกคอลัมน์เก็บใน `crm.leads.legacy`; ข้อมูล Customer Card ใน `profile`
- WON/BOOKING เดิมไม่มีหลักฐาน → ติดธง `legacy_unverified` (ไม่ลดสถานะ; ต้องแนบหลักฐานแล้วให้ผู้จัดการตรวจ)
- วันนัดที่อยู่ก่อนวันสร้างลีด / อ่านค่าไม่ได้ → ไม่นำมาใช้ + DQ
- Facebook ID ที่ Excel ปัดทอนเป็นตัวเลข → ไม่นำมาใช้จับคู่ + DQ
- สถานะ `PROSPECT` (AI สร้างเอง) → CONTACTED + DQ; ผู้รับผิดชอบที่ไม่ใช่ SA0001/SA0002 → ไม่มีเจ้าของ + DQ
- ลีดที่ไม่มีความเคลื่อนไหวเกิน N วัน (ค่าเริ่มต้น 14 วัน และไม่มีนัดติดตามที่ยังไม่ถึงกำหนด) = `dormant` (ไม่สร้างงานค้าง/แจ้งเตือน จนกว่าลูกค้าจะทักใหม่)
- ประวัติสถานะสร้างจาก ACTIVITY_LOG เป็น STAGE_CHANGE; ข้อความเซลล์เป็น SALES_REPLY; ข้อความลูกค้าเป็น CUSTOMER_MESSAGE
- `alerts_enabled` = false ตามค่าเริ่มต้น — sweep_sla จะไม่แจ้งเตือนจนกว่าจะตั้งเป็น true ตอน cut-over
