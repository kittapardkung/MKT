-- ทดสอบ record_sales_reply (ต่อจาก test_crm.sql ในฐานเดียวกัน)
do $$
declare r jsonb; l uuid; lcode text; t0 timestamptz;
begin
  update crm.sales_team s set telegram_user_id = 'tgu-' || s.code where s.role = 'sales';
  r := crm.ingest_message('r1', 'fbR1', 'สนใจครับ', 'คุณอาร์', '0861112222', 'Darion');
  l := (r->>'lead_id')::uuid; lcode := r->>'lead_code';
  perform t_assert(r->'owner'->>'code' is not null, 'reply: เตรียมลีดทดสอบ');
  declare owner_code text := r->'owner'->>'code'; other_code text; begin
    other_code := case when owner_code = 'SA0001' then 'SA0002' else 'SA0001' end;
    perform t_assert(crm.record_sales_reply(1001, lcode, 'tgu-' || other_code, 'ขอรับลีดนี้', '{}')->>'status' = 'forbidden', 'reply: เซลล์คนอื่นตอบการ์ดลีดของคนอื่นไม่ได้');
    perform t_assert(crm.record_sales_reply(1002, lcode, 'unknown-user', 'x', '{}')->>'status' = 'forbidden', 'reply: ผู้ส่งที่ไม่รู้จักถูกปฏิเสธ');
    perform t_assert(crm.record_sales_reply(1003, 'NOPE-000000', 'tgu-' || owner_code, 'x', '{}')->>'status' = 'lead_not_found', 'reply: ไม่พบ Lead ID');

    -- ตอบครั้งแรก: รับลีด + ติดต่อสำเร็จ + AI พยายามให้ WON และวันนัดปี 2024
    r := crm.record_sales_reply(1004, lcode, 'tgu-' || owner_code, 'คุยแล้วครับ ลูกค้าสนใจมาก งบ 8 แสน นัดโทรกลับ',
      jsonb_build_object('contact_outcome','CONNECTED','lead_status','WON','lead_temperature','HOT','next_follow_up','2024-02-16T10:00:00+07','Budget','800000','Occupation','','Customer_Name','ห้ามเขียนทับ'));
    perform t_assert(r->>'status' = 'ok', 'reply: ตอบครั้งแรกสำเร็จ');
    perform t_assert((select accepted_at is not null and first_contact_at is not null and stage = 'CONTACTED' and temperature = 'HOT' from crm.leads where id = l), 'reply: รับลีด+ติดต่อสำเร็จ+ HOT');
    perform t_assert((select stage from crm.leads where id = l) <> 'WON', 'GUARD: AI เสนอ WON ไม่ถูกนำไปใช้');
    perform t_assert(r->'needs_review' ? 'stage:WON', 'reply: WON ถูกส่งให้มนุษย์ตรวจ');
    perform t_assert(exists (select 1 from crm.lead_events where lead_id = l and type = 'AI' and evidence->>'suggested_stage' = 'WON'), 'timeline: บันทึกข้อเสนอของ AI');
    perform t_assert((select next_follow_up_at is null from crm.leads where id = l) and exists (select 1 from crm.data_quality_issues where code = 'FOLLOWUP_DATE_IMPLAUSIBLE' and entity_id = l::text), 'DQ: วันนัดปี 2024 ไม่ถูกใช้ + บันทึกเป็นปัญหาข้อมูล');
    perform t_assert((select profile->>'Budget' = '800000' and not profile ? 'Occupation' and not profile ? 'Customer_Name' from crm.leads where id = l), 'profile: เติมเฉพาะค่าที่ไม่ว่างและอยู่ในรายการอนุญาต');
    perform t_assert((select count(*) from crm.tasks where lead_id = l and status = 'OPEN' and kind = 'FOLLOW_UP') = 1, 'task: ปิด FIRST_CONTACT แล้วสร้าง FOLLOW_UP');
    perform t_assert((select accepted_at >= assigned_at from crm.leads where id = l), 'response time: ไม่ติดลบ (คำนวณใน DB)');

    perform t_assert(crm.record_sales_reply(1004, lcode, 'tgu-' || owner_code, 'ซ้ำ', '{}')->>'status' = 'duplicate', 'reply: update_id ซ้ำ = duplicate');

    -- ตอบรอบสอง: นัดในอนาคตถูกต้อง + เลื่อนสถานะไปข้างหน้า
    r := crm.record_sales_reply(1005, lcode, 'tgu-' || owner_code, 'นัดทดลองขับพรุ่งนี้', jsonb_build_object('lead_status','TEST_DRIVE','next_follow_up', (now() + interval '2 days')::text, 'Down_Payment','150000'));
    perform t_assert((select stage = 'TEST_DRIVE' and next_follow_up_at > now() and profile->>'Down_Payment' = '150000' from crm.leads where id = l), 'reply: สถานะ TEST_DRIVE + นัดใหม่ + เติมดาวน์');
    perform t_assert((select count(*) from crm.lead_events where lead_id = l and type = 'ACCEPTED') = 1, 'reply: รับลีดครั้งเดียว');
    -- ย้อนสถานะไม่ได้ (rank ต่ำกว่า) → เสนอให้ตรวจ ไม่ถอยเอง
    r := crm.record_sales_reply(1006, lcode, 'tgu-' || owner_code, 'ยังไม่แน่ใจ', jsonb_build_object('lead_status','FOLLOW_UP'));
    perform t_assert((select stage from crm.leads where id = l) = 'TEST_DRIVE', 'reply: ไม่ถอยสถานะอัตโนมัติ');
  end;
end $$;
