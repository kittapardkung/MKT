# AI Sales Manager — เว็บแอป (Next.js, mobile-first)

หน้าจอสำหรับเซลล์/ผู้จัดการ/ผู้บริหาร WULING CHONBURI อ่าน-เขียนผ่าน Supabase schema `crm` (ดู `../supabase/crm/`)

| หน้า | ผู้ใช้ | หน้าที่ |
|---|---|---|
| วันนี้ | เซลล์ | "วันนี้ต้องติดต่อใครก่อน เพราะอะไร ต้องทำอะไร" + ปุ่มโทร + บันทึกผล |
| ลีดของฉัน / ลีดทั้งหมด | เซลล์ / ผู้จัดการ | ค้นหา กรองความเสี่ยง ไทม์ไลน์ บันทึกหลักฐานการติดต่อ เปลี่ยนสถานะ |
| ผลงาน / ภาพรวม | เซลล์ / ผู้จัดการ+ผู้บริหาร | KPI, Funnel, ผลงานรายคน, ลีดเสี่ยง |

## โหมดการทำงาน
- **สาธิต** (ไม่ตั้ง env): ใช้ข้อมูลตัวอย่างในเครื่อง ไม่เชื่อมฐานข้อมูล (ไม่มีข้อมูลลูกค้าจริง)
- **ใช้งานจริง**: ตั้ง env ทั้งสองตัวแล้ว deploy ใหม่

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # publishable key เท่านั้น — ห้ามใส่ secret/service key
```

## ขั้นตอนเชื่อม Supabase
1. สร้าง Supabase project (แนะนำแยกจาก Content Manager)
2. รัน `supabase/crm/001..004_*.sql` ตามลำดับใน SQL Editor
3. Settings → API → **Exposed schemas** เพิ่ม `crm`
4. สร้างผู้ใช้ใน Auth แล้ว insert แถวใน `crm.sales_team` (ผูก `user_id`, `role`, `code`)
5. ตั้ง env บน Vercel แล้ว redeploy

## รันในเครื่อง
```bash
cd sales-manager && npm install && npm run dev
bash supabase/crm/tests/run-local.sh   # ทดสอบ schema บน Postgres ชั่วคราว
```

## ข้อจำกัดของเวอร์ชันนี้
- เซสชันเก็บใน localStorage (supabase-js) ยังไม่ใช้ cookie/SSR
- อัตรา Funnel คำนวณจากสถานะปัจจุบัน จะแม่นขึ้นเมื่อมีประวัติเปลี่ยนสถานะ
- ยังไม่มีหน้า Kanban, SLA Settings, AI Insights (Phase 5–6)
