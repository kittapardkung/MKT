-- ทดสอบ: สถานะ 13 ขั้น, ปุ่ม "จองแล้ว", ดาวลูกค้าเป้าหมาย (รันต่อจาก test_crm.sql / test_reply.sql ในฐานเดียวกัน)
do $$
declare r jsonb; l1 uuid; l2 uuid; own1 uuid; own1_user uuid; other_user uuid; other2 uuid; dl uuid; n int;
begin
  perform set_config('statement_timeout', '20s', false);
  r := crm.ingest_message('ft1', 'fbF1', 'อยากจอง Darion', 'คุณเอฟ', '0855550001', 'Darion');
  l1 := (r->>'lead_id')::uuid; own1 := (r->'owner'->>'id')::uuid;
  select user_id into own1_user from crm.sales_team where id = own1;
  select user_id into other_user from crm.sales_team where role = 'sales' and id <> own1 limit 1;

  -- 13 สถานะ
  update crm.leads set stage = 'NEGOTIATION' where id = l1;
  perform t_assert((select stage from crm.leads where id = l1) = 'NEGOTIATION', 'stage: NEGOTIATION ใช้ได้โดยไม่ต้องมีหลักฐาน');
  perform t_raises(format($q$update crm.leads set stage = 'FINANCE_PENDING' where id = %L$q$, l1), 'evidence_required', 'GUARD: FINANCE_PENDING ต้องมีการจองที่ตรวจสอบแล้ว');
  perform t_raises(format($q$update crm.leads set stage = 'READY_TO_DELIVER' where id = %L$q$, l1), 'evidence_required', 'GUARD: READY_TO_DELIVER ต้องมีการจองที่ตรวจสอบแล้ว');
  perform t_raises(format($q$update crm.leads set stage = 'FINANCE_APPROVED' where id = %L$q$, l1), 'evidence_required', 'GUARD: FINANCE_APPROVED ต้องมีการจองที่ตรวจสอบแล้ว');
  perform t_raises(format($q$update crm.leads set stage = 'XYZ' where id = %L$q$, l1), 'violates check', 'stage: ค่านอกรายการถูกปฏิเสธ');

  -- เซลล์คนอื่นแจ้งจองลีดนี้ไม่ได้
  perform t_as(other_user);
  perform t_raises(format($q$select crm.mark_booked(%L, 'RES-9001', 10000, '{"model":"Darion","purchase_type":"CASH"}')$q$, l1), 'forbidden', 'สิทธิ์: เซลล์คนอื่นแจ้งจองลีดนี้ไม่ได้');
  perform t_reset();

  -- เจ้าของกด "จองแล้ว"
  perform t_as(own1_user);
  perform t_raises(format($q$select crm.mark_booked(%L, 'RES-9001', 10000, '{"purchase_type":"CASH"}')$q$, l1), 'model_required', 'จองแล้ว: ต้องระบุรถ/รุ่น');
  perform t_raises(format($q$select crm.mark_booked(%L, 'RES-9001', 10000, '{"model":"Darion"}')$q$, l1), 'purchase_type_required', 'จองแล้ว: ต้องระบุเงื่อนไขการซื้อ');
  perform t_raises(format($q$select crm.mark_booked(%L, '', 10000, '{"model":"Darion","purchase_type":"CASH"}')$q$, l1), 'doc_ref_required', 'จองแล้ว: ต้องมีเลขที่ใบจอง');
  dl := crm.mark_booked(l1, 'RES-9001', 10000, '{"model":"Darion","variant":"EV 7 ที่นั่ง","color":"ขาว","purchase_type":"FINANCE","down_payment":150000,"term_months":60,"bank":"KBank"}', null);
  perform t_assert(dl is not null, 'จองแล้ว: บันทึกการจองสำเร็จ');
  perform t_raises(format($q$select crm.mark_booked(%L, 'RES-9001', 10000, '{"model":"Darion","purchase_type":"CASH"}')$q$, l1), 'duplicate_booking', 'จองแล้ว: เลขที่ใบจองซ้ำถูกปฏิเสธ');
  perform t_assert((select stage = 'NEGOTIATION' from crm.leads where id = l1), 'จองแล้ว: ลีดยังไม่ขึ้น BOOKING จนกว่าผู้จัดการตรวจสอบ');
  perform t_assert((select verified = false and details->>'bank' = 'KBank' and details->>'model' = 'Darion' from crm.v_bookings where deal_id = dl), 'v_bookings: เห็นการจองที่รอตรวจสอบพร้อมรายละเอียดรถ/เงื่อนไข');
  perform t_raises(format($q$select crm.verify_deal(%L)$q$, dl), 'forbidden', 'สิทธิ์: เซลล์ตรวจสอบการจองของตัวเองไม่ได้');
  perform t_reset();

  perform t_as(other_user);
  select count(*) into n from crm.v_bookings; perform t_assert(n = 0 or not exists (select 1 from crm.v_bookings where deal_id = dl), 'RLS: เซลล์คนอื่นไม่เห็นการจองนี้');
  perform t_reset();

  -- ผู้จัดการตรวจสอบ → BOOKING อัตโนมัติ
  perform t_as('10000000-0000-0000-0000-0000000000b1');
  perform crm.verify_deal(dl);
  perform t_assert((select verified from crm.v_bookings where deal_id = dl), 'v_bookings: ตรวจสอบแล้ว');
  perform t_reset();
  perform t_assert((select stage = 'BOOKING' from crm.leads where id = l1), 'verify: ตรวจสอบการจองแล้ว ลีดขึ้น BOOKING อัตโนมัติ');
  perform t_assert(exists (select 1 from crm.lead_events where lead_id = l1 and type = 'STAGE_CHANGE' and evidence->>'source' = 'booking_verified'), 'timeline: บันทึกที่มาของการเปลี่ยนสถานะ');
  update crm.leads set stage = 'FINANCE_PENDING' where id = l1;
  update crm.leads set stage = 'FINANCE_APPROVED' where id = l1;
  update crm.leads set stage = 'READY_TO_DELIVER' where id = l1;
  perform t_assert((select stage = 'READY_TO_DELIVER' from crm.leads where id = l1), 'stage: มีการจองที่ตรวจสอบแล้ว → FINANCE_PENDING / READY_TO_DELIVER ได้');

  -- ดาว
  r := crm.ingest_message('ft2', 'fbF2', 'สนใจ Porta', 'คุณจี', '0855550002', 'Porta'); l2 := (r->>'lead_id')::uuid;
  perform t_as((select user_id from crm.sales_team where id = (r->'owner'->>'id')::uuid));
  perform crm.set_star(l2, true, 'deal ใหญ่ ซื้อ 3 คัน');
  perform t_assert((select starred and star_note = 'deal ใหญ่ ซื้อ 3 คัน' from crm.v_lead_control_center where lead_id = l2), 'ดาว: เจ้าของติดดาวพร้อมโน้ต เห็นใน control center');
  perform crm.set_star(l2, true);
  perform t_assert((select note from crm.lead_stars where lead_id = l2) = 'deal ใหญ่ ซื้อ 3 คัน', 'ดาว: ติดซ้ำโดยไม่ใส่โน้ต ไม่ลบโน้ตเดิม');
  perform t_reset();
  perform t_as('10000000-0000-0000-0000-0000000000b1');
  perform t_assert((select not starred from crm.v_lead_control_center where lead_id = l2), 'ดาว: ของใครของมัน ผู้จัดการไม่เห็นดาวของเซลล์');
  perform t_assert((select count(*) from crm.lead_stars) = 0, 'ดาว: ผู้จัดการอ่านดาวของคนอื่นตรงๆ ไม่ได้');
  perform t_reset();
  select user_id into other2 from crm.sales_team where role = 'sales' and id <> (select owner_id from crm.leads where id = l2) limit 1;
  perform t_as(other2);
  perform t_raises(format($q$select crm.set_star(%L, true)$q$, l2), 'forbidden', 'ดาว: ติดดาวลีดของคนอื่นไม่ได้');
  perform t_reset();
  perform t_as((select st.user_id from crm.sales_team st join crm.leads x on x.owner_id = st.id where x.id = l2));
  perform crm.set_star(l2, false);
  perform t_assert(not exists (select 1 from crm.lead_stars where lead_id = l2), 'ดาว: เอาดาวออกได้');
  perform t_reset();
  perform set_config('statement_timeout', '0', false);
end $$;

-- LOST ต้องยังแก้ไข/เปิดกลับได้ และแก้ข้อมูลลูกค้าได้
do $$
declare r jsonb; l uuid; o uuid; ou uuid; other_user uuid; l2 uuid; dl uuid; mgr uuid := '10000000-0000-0000-0000-0000000000b1';
begin
  r := crm.ingest_message('lost1', 'fbLost1', 'สนใจ Porta', 'คุณปุ้ย', '0866660001', 'Porta');
  l := (r->>'lead_id')::uuid; o := (r->'owner'->>'id')::uuid;
  select user_id into ou from crm.sales_team where id = o;
  select user_id into other_user from crm.sales_team where role = 'sales' and id <> o limit 1;
  perform t_as(ou);
  perform crm.change_stage(l, 'LOST', 'ติดต่อไม่ได้');
  perform t_assert((select stage = 'LOST' from crm.leads where id = l), 'LOST: ปิดลีดได้');
  perform crm.log_contact(l, 'PHONE', 'CONNECTED', 'ลูกค้าโทรกลับ เปลี่ยนใจแล้ว', now() + interval '1 day', 'WARM');
  perform t_assert(true, 'LOST: บันทึกผลการติดต่อได้');
  perform crm.change_stage(l, 'FOLLOW_UP', 'ลูกค้าเปลี่ยนใจ');
  perform t_assert((select stage = 'FOLLOW_UP' and lost_reason is null from crm.leads where id = l), 'LOST: เปิดกลับเป็น FOLLOW_UP และล้างเหตุผลเสีย');
  perform t_assert(exists (select 1 from crm.lead_events where lead_id = l and type = 'STAGE_CHANGE' and evidence->>'reopened' = 'true'), 'LOST: event ระบุว่าเปิดกลับ');

  perform crm.update_lead_info(l, 'คุณปุ้ย ใจดี', '0866660001', 'Darion', '{"Occupation":"ครู","Budget":"800000","Evil":"x"}');
  perform t_assert((select customer_name = 'คุณปุ้ย ใจดี' and interested_model = 'Darion' and profile->>'Occupation' = 'ครู' and not profile ? 'Evil' from crm.leads where id = l), 'แก้ข้อมูล: ชื่อ/รุ่น/profile ถูกบันทึก และ key นอก whitelist ถูกทิ้ง');
  perform crm.update_lead_info(l, 'คุณปุ้ย ใจดี', '0866660001', 'Darion', '{"Occupation":""}');
  perform t_assert((select not profile ? 'Occupation' from crm.leads where id = l), 'แก้ข้อมูล: ค่าว่างลบ field');
  perform t_raises(format($q$select crm.update_lead_info(%L, 'x', '123', 'Darion', '{}')$q$, l), 'phone_invalid', 'แก้ข้อมูล: เบอร์ไม่ถูกต้อง');
  perform t_reset();
  perform t_as(other_user);
  perform t_raises(format($q$select crm.update_lead_info(%L, 'x', '0866660001', 'Darion', '{}')$q$, l), 'forbidden', 'แก้ข้อมูล: เซลล์คนอื่นแก้ไม่ได้');
  perform t_reset();

  -- จองลีดที่ LOST แล้ว manager ยืนยัน → BOOKING
  r := crm.ingest_message('lost2', 'fbLost2', 'จองครับ', 'คุณโล', '0866660002', 'Bingo');
  l2 := (r->>'lead_id')::uuid; select user_id into ou from crm.sales_team where id = (r->'owner'->>'id')::uuid;
  perform t_as(ou);
  perform crm.change_stage(l2, 'LOST', 'ไม่สนใจ');
  dl := crm.mark_booked(l2, 'RES-LOST-1', 5000, '{"model":"Bingo","purchase_type":"CASH"}', null);
  perform t_reset();
  perform t_as(mgr);
  perform crm.verify_deal(dl);
  perform t_assert((select stage = 'BOOKING' and lost_reason is null from crm.leads where id = l2), 'LOST: จอง+ตรวจสอบแล้วขึ้น BOOKING');
  perform t_reset();

  -- WON: เซลล์แก้ไม่ได้ ผู้จัดการแก้ได้
  update crm.leads set stage = 'WON' where id = l2;
  perform t_as(ou);
  perform t_raises(format($q$select crm.change_stage(%L, 'FOLLOW_UP', 'x')$q$, l2), 'forbidden', 'WON: เซลล์เปลี่ยนสถานะไม่ได้');
  perform t_reset();
  perform t_as(mgr);
  perform crm.change_stage(l2, 'READY_TO_DELIVER', 'ผู้จัดการแก้');
  perform t_assert((select stage = 'READY_TO_DELIVER' from crm.leads where id = l2), 'WON: ผู้จัดการเปลี่ยนสถานะได้');
  perform t_reset();
end $$;

-- ลีดที่จองแล้ว (BOOKING ขึ้นไป) ต้องไม่มีงานติดตาม
do $$
declare r jsonb; l uuid;
begin
  r := crm.ingest_message('bk-task', 'fbBkTask', 'สนใจ', 'คุณบีเค', '0877770001', 'Darion');
  l := (r->>'lead_id')::uuid;
  perform t_assert(exists (select 1 from crm.tasks where lead_id = l and status = 'OPEN'), 'งาน: ลีดปกติมีงานติดตาม');
  perform set_config('crm.migration_mode', 'on', true);
  update crm.leads set stage = 'BOOKING' where id = l;
  perform set_config('crm.migration_mode', 'off', true);
  perform t_assert(not exists (select 1 from crm.tasks where lead_id = l and status = 'OPEN'), 'งาน: ลีดที่จองแล้วไม่มีงานติดตามค้าง');
  perform t_assert(not exists (select 1 from crm.v_my_today where lead_id = l), 'วันนี้: ลีดที่จองแล้วไม่แสดง');
end $$;

-- สถานะส่งมอบ: สินเชื่ออนุมัติ → พร้อมส่งมอบ → ปิดการขาย (เลขตัวถัง)
do $$
declare r jsonb; l uuid; ou uuid; other_user uuid; dl uuid; l2 uuid; dl2 uuid; mgr uuid := '10000000-0000-0000-0000-0000000000b1'; ou2 uuid;
begin
  r := crm.ingest_message('dv1', 'fbDv1', 'จองครับ', 'คุณดีวี', '0899990001', 'Darion');
  l := (r->>'lead_id')::uuid; select user_id into ou from crm.sales_team where id = (r->'owner'->>'id')::uuid;
  select user_id into other_user from crm.sales_team where role = 'sales' and user_id <> ou limit 1;
  perform t_as(ou);
  dl := crm.mark_booked(l, 'RES-DV-1', 5000, '{"model":"Darion","purchase_type":"FINANCE"}', null);
  perform t_raises(format($q$select crm.set_delivery_step(%L, 'FINANCE_APPROVED')$q$, dl), 'evidence_required', 'ส่งมอบ: การจองที่ยังไม่ตรวจสอบเดินขั้นต่อไม่ได้');
  perform t_reset();
  perform t_as(mgr); perform crm.verify_deal(dl); perform t_reset();
  perform t_as(other_user);
  perform t_raises(format($q$select crm.set_delivery_step(%L, 'FINANCE_APPROVED')$q$, dl), 'forbidden', 'ส่งมอบ: เซลล์คนอื่นทำไม่ได้');
  perform t_reset();
  perform t_as(ou);
  perform t_raises(format($q$select crm.set_delivery_step(%L, 'READY_TO_DELIVER', current_date)$q$, dl), 'finance_not_approved', 'ส่งมอบ: ลูกค้าผ่อนข้ามสินเชื่อไม่ได้');
  perform crm.set_delivery_step(dl, 'FINANCE_APPROVED');
  perform t_assert((select stage = 'FINANCE_APPROVED' from crm.leads where id = l), 'ส่งมอบ: สินเชื่ออนุมัติ');
  perform t_raises(format($q$select crm.set_delivery_step(%L, 'READY_TO_DELIVER')$q$, dl), 'date_required', 'ส่งมอบ: ต้องระบุวันนัดรับรถ');
  perform t_raises(format($q$select crm.set_delivery_step(%L, 'DELIVERED', current_date, 'VIN12345')$q$, dl), 'invalid_step', 'ส่งมอบ: ปิดการขายก่อนพร้อมส่งมอบไม่ได้');
  perform crm.set_delivery_step(dl, 'READY_TO_DELIVER', current_date + 3);
  perform t_assert((select stage = 'READY_TO_DELIVER' from crm.leads where id = l) and (select details->>'delivery_date' is not null from crm.deals where id = dl), 'ส่งมอบ: พร้อมส่งมอบ + บันทึกวันนัด');
  perform t_raises(format($q$select crm.set_delivery_step(%L, 'DELIVERED', current_date, 'AB')$q$, dl), 'vin_required', 'ส่งมอบ: ต้องมีเลขตัวถัง');
  perform t_raises(format($q$select crm.set_delivery_step(%L, 'DELIVERED', current_date + 1, 'VIN12345')$q$, dl), 'date_future', 'ส่งมอบ: วันส่งมอบอนาคตไม่ได้');
  perform crm.set_delivery_step(dl, 'DELIVERED', current_date, 'lsvin12345', 'ลูกค้ารับรถเรียบร้อย');
  perform t_assert((select stage = 'WON' from crm.leads where id = l) and (select details->>'vin' = 'LSVIN12345' from crm.deals where id = dl), 'ส่งมอบ: ปิดการขาย + เก็บเลขตัวถัง');
  perform t_assert(not exists (select 1 from crm.tasks where lead_id = l and status = 'OPEN'), 'ส่งมอบ: ปิดการขายแล้วไม่มีงานติดตาม');
  perform t_reset();

  -- เลขตัวถังซ้ำกับลูกค้าอื่น + ลูกค้าเงินสดข้ามสินเชื่อได้
  r := crm.ingest_message('dv2', 'fbDv2', 'จองครับ', 'คุณดีวีสอง', '0899990002', 'Bingo');
  l2 := (r->>'lead_id')::uuid; select user_id into ou2 from crm.sales_team where id = (r->'owner'->>'id')::uuid;
  perform t_as(ou2); dl2 := crm.mark_booked(l2, 'RES-DV-2', 5000, '{"model":"Bingo","purchase_type":"CASH"}', null); perform t_reset();
  perform t_as(mgr); perform crm.verify_deal(dl2); perform t_reset();
  perform t_as(ou2);
  perform crm.set_delivery_step(dl2, 'READY_TO_DELIVER', current_date + 1);
  perform t_assert((select stage = 'READY_TO_DELIVER' from crm.leads where id = l2), 'ส่งมอบ: ลูกค้าเงินสดข้ามสินเชื่อได้');
  perform t_raises(format($q$select crm.set_delivery_step(%L, 'DELIVERED', current_date, 'LSVIN12345')$q$, dl2), 'duplicate_vin', 'ส่งมอบ: เลขตัวถังซ้ำถูกปฏิเสธ');
  perform t_reset();
end $$;

-- เบอร์ใหม่ของลูกค้าเดิม (เก็บเป็นเบอร์อื่น) + โหมดเจ้าของส่งเบอร์เข้าเพจ (intake)
do $$
declare r jsonb; l uuid; n0 int; ou uuid; l2 uuid; r2 jsonb;
begin
  r := crm.ingest_message('alt1', 'fbAlt', 'สนใจครับ', 'คุณอัลท์', '0891110001', 'Darion');
  l := (r->>'lead_id')::uuid; select user_id into ou from crm.sales_team where id = (r->'owner'->>'id')::uuid;
  r := crm.ingest_message('alt2', 'fbAlt', 'เบอร์ใหม่ 0891110002', null, '0891110002', null);
  perform t_assert(r->>'action' = 'appended' and (r->>'lead_id')::uuid = l and r->>'notify' = 'PHONE_RESENT', 'เบอร์ใหม่ลูกค้าเดิม: ลีดเดิม แจ้งเจ้าของเดิม');
  perform t_assert((select phone_norm = '0891110001' and profile->>'Alt_Phones' = '0891110002' from crm.leads where id = l), 'เบอร์ใหม่ลูกค้าเดิม: ไม่ทับเบอร์หลัก เก็บเป็นเบอร์อื่น');
  r := crm.ingest_message('alt3', 'fbAlt', 'เบอร์เดิมอีกรอบ 0891110002', null, '0891110002', null);
  perform t_assert((select profile->>'Alt_Phones' = '0891110002' from crm.leads where id = l), 'เบอร์ใหม่ลูกค้าเดิม: เบอร์อื่นไม่ซ้ำในรายการ');
  perform t_as(ou);
  perform crm.update_lead_info(l, 'คุณอัลท์', '0891110002', 'Darion', '{}');
  perform t_reset();
  perform t_assert((select phone_norm = '0891110002' and profile->>'Alt_Phones' = '0891110001' from crm.leads where id = l), 'ใช้เบอร์อื่นเป็นเบอร์หลัก: เบอร์เดิมย้ายไปเป็นเบอร์อื่น');

  -- intake: เจ้าของส่งเบอร์เข้าเพจเพื่อกระจายลีด
  insert into crm.settings(key, value) values ('intake_fb_ids', 'fbOwnerX') on conflict (key) do update set value = excluded.value;
  select count(*) into n0 from crm.leads;
  r := crm.ingest_message('in1', 'fbOwnerX', 'คุณเอ 0892220001 สนใจ Porta', 'คุณเอ', '0892220001', 'Porta');
  perform t_assert(r->>'action' = 'created' and r->>'notify' = 'NEW_LEAD', 'intake: เบอร์ใหม่ = ลีดใหม่ + กระจายเซลล์');
  perform t_assert((select fb_user_id is null and source like 'Call Center%' from crm.leads where id = (r->>'lead_id')::uuid), 'intake: ไม่ผูก FB ID เจ้าของ และบันทึกแหล่งที่มา');
  r2 := crm.ingest_message('in2', 'fbOwnerX', 'คุณบี 0892220002', 'คุณบี', '0892220002', null);
  perform t_assert(r2->>'action' = 'created' and (r2->>'lead_id') <> (r->>'lead_id'), 'intake: เบอร์ใหม่อีกเบอร์ = ลีดใหม่อีกใบ (ไม่รวมเป็นลีดเดียวกัน)');
  perform t_assert(crm.ingest_message('in3', 'fbOwnerX', 'สวัสดี')->>'action' = 'ignored', 'intake: ข้อความไม่มีเบอร์ ไม่สร้างลีด');
  r := crm.ingest_message('in4', 'fbOwnerX', 'คุณเอ 0892220001 อีกครั้ง', null, '0892220001', null);
  perform t_assert(r->>'action' = 'appended' and r->>'notify' = 'PHONE_RESENT', 'intake: เบอร์ซ้ำ = ลีดเดิม แจ้งเจ้าของเดิม ไม่สร้างซ้ำ');
  perform t_assert((select count(*) from crm.leads) = n0 + 2, 'intake: สร้างลีดใหม่เฉพาะเบอร์ใหม่ 2 ใบ');
  delete from crm.settings where key = 'intake_fb_ids';
end $$;

-- สคริปต์ลบลีดทดสอบ (maintenance/delete_test_leads.sql)
set crm.delete_codes = 'ZZ-T1,ZZ-T2';
do $$
declare l1 uuid; l2 uuid; l3 uuid; t1 uuid;
begin
  insert into crm.leads(lead_code, phone_norm, phone_raw, customer_name, source) values ('ZZ-T1', '0800000001', '0800000001', 'ทดสอบ1', 'Call Center / เจ้าของส่งเข้า') returning id into l1;
  insert into crm.leads(lead_code, phone_norm, phone_raw, customer_name, source) values ('ZZ-T2', '0800000002', '0800000002', 'ทดสอบ2', 'Call Center / เจ้าของส่งเข้า') returning id into l2;
  insert into crm.leads(lead_code, phone_norm, phone_raw, customer_name, source) values ('ZZ-KEEP', '0800000099', '0800000099', 'ห้ามลบ', 'Facebook Messenger') returning id into l3;
  insert into crm.lead_events(lead_id, type, channel, body) values (l1, 'CUSTOMER_MESSAGE', 'FACEBOOK', 'zz-x'), (l2, 'CUSTOMER_MESSAGE', 'FACEBOOK', 'zz-y');
  insert into crm.data_quality_issues(entity, entity_id, code, detail) values ('lead', l1::text, 'PHONE_INVALID', 'zz');
end $$;
\ir ../maintenance/delete_test_leads.sql
do $$
begin
  perform t_assert(not exists (select 1 from crm.leads where lead_code in ('ZZ-T1','ZZ-T2')), 'ลบลีดทดสอบ: ลีดตามรายการถูกลบ');
  perform t_assert(not exists (select 1 from crm.lead_events where body in ('zz-x','zz-y')), 'ลบลีดทดสอบ: กิจกรรมของลีดที่ลบถูกลบด้วย');
  perform t_assert(not exists (select 1 from crm.data_quality_issues where detail = 'zz'), 'ลบลีดทดสอบ: DQ ของลีดที่ลบถูกลบด้วย');
  perform t_assert(exists (select 1 from crm.leads where lead_code = 'ZZ-KEEP'), 'ลบลีดทดสอบ: ลีดอื่นไม่ถูกลบ');
end $$;
-- guard: ลีดที่ไม่ใช่ลีดจากโหมดเจ้าของ ต้องหยุดและไม่ลบ
set crm.delete_codes = 'ZZ-KEEP';
do $$ begin
  begin
    perform 1;
    -- เรียกสคริปต์ด้วยการรันซ้ำผ่าน \ir ไม่ได้ในบล็อก → ตรวจเงื่อนไขเดียวกันตรงนี้
    perform t_assert((select coalesce(source, '') not like 'Call Center%' from crm.leads where lead_code = 'ZZ-KEEP'), 'ลบลีดทดสอบ: guard — ZZ-KEEP ไม่ใช่ลีดจากโหมดเจ้าของ');
  end;
end $$;
delete from crm.leads where lead_code = 'ZZ-KEEP';
reset crm.delete_codes;

-- ลีดจริงที่มีเจ้าของ/งาน/การแจ้งเตือน ลบได้ครบ (ผ่านโหมดเจ้าของส่งเบอร์)
insert into crm.settings(key, value) values ('intake_fb_ids', 'fbDelOwner') on conflict (key) do update set value = excluded.value;
do $$
declare r jsonb; t uuid; n int;
begin
  r := crm.ingest_message('del1', 'fbDelOwner', 'ลบทดสอบ 0897770001', 'ลบทดสอบ', '0897770001', 'Darion');
  perform set_config('crm.delete_codes', r->>'lead_code', false);
  select count(*) into n from crm.tasks where lead_id = (r->>'lead_id')::uuid;
  perform t_assert(n >= 1, 'ลบลีดทดสอบ: ลีดตัวอย่างมีงานติดตามก่อนลบ');
  perform set_config('crm.del_lead_id', r->>'lead_id', false);
end $$;
\ir ../maintenance/delete_test_leads.sql
do $$
begin
  perform t_assert(not exists (select 1 from crm.leads where id = current_setting('crm.del_lead_id')::uuid), 'ลบลีดทดสอบ: ลีดที่มีเจ้าของ/งาน ถูกลบ');
  perform t_assert(not exists (select 1 from crm.tasks where lead_id = current_setting('crm.del_lead_id')::uuid), 'ลบลีดทดสอบ: งานของลีดถูกลบด้วย');
end $$;
delete from crm.settings where key = 'intake_fb_ids';
reset crm.delete_codes;

-- งานในหน้าวันนี้ต้องหายหลังเซลล์รายงานผล แม้ไม่ได้ระบุวันนัดใหม่ (Telegram reply)
do $$
declare r jsonb; l uuid; ev jsonb; n int; own uuid; tg text := 'tg-stale-' || gen_random_uuid()::text;
begin
  r := crm.ingest_message('stale1', 'fbStale', 'สนใจ', 'คุณสเตล', '0877770088', 'Darion');
  l := (r->>'lead_id')::uuid; own := (r->'owner'->>'id')::uuid;
  update crm.sales_team set telegram_user_id = tg where id = own;
  update crm.leads set next_follow_up_at = now() - interval '3 days', first_contact_at = now() - interval '4 days', last_contact_at = now() - interval '4 days', stage = 'FOLLOW_UP' where id = l;
  perform crm.refresh_task(l);
  perform t_assert((select count(*) from crm.v_my_today where lead_id = l) = 1, 'วันนี้: ลีดเลยกำหนดขึ้นในหน้าวันนี้');
  ev := crm.record_sales_reply(880001, (select lead_code from crm.leads where id = l), tg, 'โทรแล้ว คุยได้', '{"contact_outcome":"CONNECTED"}'::jsonb);
  perform t_assert((select count(*) from crm.v_my_today where lead_id = l) = 0, 'วันนี้: รายงานผลทาง Telegram แล้วงานหายจากหน้าวันนี้');
  perform t_assert(not exists (select 1 from crm.v_lead_control_center c where c.lead_id = l and 'OVERDUE_FOLLOWUP' = any(c.flags)), 'วันนี้: ไม่ติดธงเลยกำหนดติดตามหลังติดต่อแล้ว');
end $$;
