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
