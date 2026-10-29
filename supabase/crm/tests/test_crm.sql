-- ชุดทดสอบ crm (รันด้วย run-local.sh)
create or replace function public.t_assert(c boolean, msg text) returns void language plpgsql as $$
begin if c is not true then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok - %', msg; end $$;

create or replace function public.t_as(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, false); execute 'set role authenticated'; end $$;
create or replace function public.t_reset() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', false); end $$;

-- รัน sql แล้วคาดว่าต้อง error ที่มีข้อความ like
create or replace function public.t_raises(q text, expect text, msg text) returns void language plpgsql as $$
declare m text;
begin
  begin execute q; exception when others then m := sqlerrm; end;
  if m is null then raise exception 'ASSERT FAILED: % (no error raised)', msg; end if;
  if m not ilike '%' || expect || '%' then raise exception 'ASSERT FAILED: % (got: %)', msg, m; end if;
  raise notice 'ok - % [%]', msg, m;
end $$;
grant execute on all functions in schema public to public;

-- ---------- seed ----------
insert into crm.sales_team(id, user_id, code, display_name, role) values
  ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000a1','SA0001','วิ','sales'),
  ('00000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000a2','SA0002','โอ๋','sales'),
  ('00000000-0000-0000-0000-0000000000b1','10000000-0000-0000-0000-0000000000b1','MG0001','หัวหน้า','sales_manager'),
  ('00000000-0000-0000-0000-0000000000b2','10000000-0000-0000-0000-0000000000b2','MG0002','หัวหน้า 2','sales_manager'),
  ('00000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c1','EX0001','ผู้บริหาร','executive');
update crm.sales_team set manager_id = '00000000-0000-0000-0000-0000000000b1', telegram_chat_id = 'tg-' || code;

do $$
declare r jsonb; n int; l1 uuid; l2 uuid; l3 uuid; o1 uuid; ph text;
begin
  -- ===== helpers =====
  perform t_assert(crm.normalize_phone('081-445-2574') = '0814452574', 'phone: ขีดคั่น');
  perform t_assert(crm.normalize_phone('+66 81 445 2574') = '0814452574', 'phone: +66');
  perform t_assert(crm.normalize_phone('814452574') = '0814452574', 'phone: ตัด 0 นำหน้า (ACTIVITY_LOG เดิม)');
  perform t_assert(crm.normalize_phone('08968660966') is null, 'phone: 11 หลัก = invalid');
  perform t_assert(crm.normalize_phone('abc') is null, 'phone: ไม่ใช่ตัวเลข = invalid');
  -- ศุกร์ 17:50 เวลาไทย + 15 นาทีทำการ = 09:05 วันถัดไป (ปิด 18:00 → เหลือ 10 นาที + 5 นาทีเช้าวันถัดไป)
  perform t_assert(crm.add_work_minutes('2026-10-30 17:50:00+07', 15) = '2026-10-31 09:05:00+07'::timestamptz, 'work minutes ข้ามวัน');
  perform t_assert(crm.add_work_minutes('2026-10-30 03:00:00+07', 15) = '2026-10-30 09:15:00+07'::timestamptz, 'work minutes ก่อนเปิดทำการ');

  -- ===== ingest =====
  r := crm.ingest_message('m1', 'fb100', 'สวัสดีครับ สนใจรถ');
  perform t_assert(r->>'action' = 'created' and r->>'notify' is null and r->'owner' = 'null'::jsonb, 'ingest: ไม่มีเบอร์ = สร้างลีด ยังไม่ assign ไม่แจ้งเตือน');
  l1 := (r->>'lead_id')::uuid;
  perform t_assert(crm.ingest_message('m1', 'fb100', 'สวัสดีครับ สนใจรถ')->>'action' = 'duplicate', 'ingest: message_id ซ้ำ = duplicate (idempotent)');
  perform t_assert((select count(*) from crm.leads) = 1, 'ingest: ไม่สร้างลีดซ้ำ');
  perform t_assert((select count(*) from crm.tasks) = 0, 'task: ลีดไม่มีเจ้าของ ยังไม่มีงาน');

  r := crm.ingest_message('m2', 'fb100', 'เบอร์ 081-445-2574 Darion', 'คุณเอ', '081-445-2574', 'Darion');
  perform t_assert(r->>'action' = 'appended' and (r->>'lead_id')::uuid = l1, 'ingest: ได้เบอร์ภายหลัง ผูกเข้าลีดเดิม (FB ID เดิม)');
  perform t_assert(r->>'notify' = 'NEW_LEAD' and r->'owner'->>'code' = 'SA0001', 'ingest: assign ตอนได้เบอร์ แจ้งเตือน SA0001 ก่อน (tie → code)');
  perform t_assert(r->'owner'->>'telegram_chat_id' = 'tg-SA0001', 'ingest: คืน chat id สำหรับ n8n');
  perform t_assert((select count(*) from crm.tasks where lead_id = l1 and kind = 'FIRST_CONTACT' and status = 'OPEN') = 1, 'task: สร้าง FIRST_CONTACT 1 งาน');

  r := crm.ingest_message('m3', 'fb200', 'โทรหาหน่อย 0899999999', 'คุณบี', '0899999999', 'Porta');
  l2 := (r->>'lead_id')::uuid;
  perform t_assert(r->'owner'->>'code' = 'SA0002', 'assign: ลีดที่สองไป SA0002 (กระจายเท่าๆ กัน)');
  r := crm.ingest_message('m4', 'fb300', 'สนใจ 0877777777', null, '0877777777', null);
  l3 := (r->>'lead_id')::uuid;
  perform t_assert(r->'owner'->>'code' = 'SA0001', 'assign: ลีดที่สามกลับไป SA0001');

  r := crm.ingest_message('m5', 'fb999', 'ผมเบอร์เดิม', null, '+66 81 445 2574', null);
  perform t_assert(r->>'action' = 'appended' and (r->>'lead_id')::uuid = l1, 'dedupe: เบอร์เดียวกัน คนละ FB ID ไม่สร้างลีดซ้ำ');
  perform t_assert(r->>'notify' = 'CUSTOMER_REPLIED', 'ingest: ลูกค้าเก่าทักอีก แจ้งเจ้าของ');
  perform t_assert((select count(*) from crm.lead_events where lead_id = l1 and type = 'CUSTOMER_MESSAGE') = 3, 'timeline: เก็บทุกข้อความเป็น event');

  r := crm.ingest_message('m6', 'fb400', 'เบอร์ 08968660966', null, '08968660966', null);
  perform t_assert(exists (select 1 from crm.data_quality_issues where code = 'PHONE_INVALID'), 'DQ: เบอร์ผิดรูปแบบ = DQ issue ไม่ใช่ SLA violation');
  perform t_assert((r->>'notify') is null, 'ingest: เบอร์ผิดรูป ไม่ assign');

  update crm.tasks set due_at = now() - interval '5 minutes' where status = 'OPEN';  -- ทำให้ไม่ขึ้นกับเวลาที่รันเทสต์
  -- ===== RLS =====
  perform t_as('10000000-0000-0000-0000-0000000000a1');
  select count(*) into n from crm.leads; perform t_assert(n = 2, 'RLS: sales เห็นเฉพาะลีดตนเอง (2)');
  select count(*) into n from crm.audit_log; perform t_assert(n = 0, 'RLS: sales อ่าน audit_log ไม่ได้');
  perform t_raises($q$update crm.leads set stage = 'WON'$q$, 'permission denied', 'RLS: sales เขียนตารางตรงไม่ได้');
  perform t_raises($q$select telegram_chat_id from crm.sales_team$q$, 'permission denied', 'PDPA: sales อ่าน chat id ของคนอื่นไม่ได้');
  select count(*) into n from crm.v_my_today; perform t_assert(n = 2, 'หน้าแรกเซลล์: เห็นงานของตนเอง 2 งาน');
  perform t_reset();

  perform t_as('10000000-0000-0000-0000-0000000000c1');
  select count(*) into n from crm.leads; perform t_assert(n = 0, 'PDPA: executive อ่านตารางลีด (เบอร์/ชื่อ) ตรงไม่ได้');
  perform t_assert((select total_leads from crm.v_exec_summary) = 4, 'exec summary: เห็นภาพรวม');
  perform t_raises($q$select phone from crm.v_exec_risk_leads$q$, 'does not exist', 'PDPA: ลีดเสี่ยงของผู้บริหารไม่มีคอลัมน์เบอร์');
  perform t_reset();

  -- ===== log_contact / accept =====
  perform t_as('10000000-0000-0000-0000-0000000000a2');
  perform t_raises(format($q$select crm.log_contact(%L, 'PHONE', 'CONNECTED', 'คุยแล้ว', now() + interval '1 day')$q$, l1), 'forbidden', 'สิทธิ์: sales ติดต่อลีดของคนอื่นไม่ได้');
  perform t_reset();

  perform t_as('10000000-0000-0000-0000-0000000000a1');
  perform crm.accept_lead(l1);
  perform t_assert((select accepted_at is not null and first_contact_at is null from crm.leads where id = l1), 'accept: รับลีดแล้วแต่ยังไม่นับเป็นการติดต่อ');
  perform t_raises(format($q$select crm.log_contact(%L, 'PHONE', 'CONNECTED', 'x', now() + interval '1 day')$q$, l1), 'note_required', 'ต้องมีบันทึกผลการติดต่อ');
  perform t_raises(format($q$select crm.log_contact(%L, 'PHONE', 'CONNECTED', 'คุยรายละเอียดรุ่นแล้ว', null)$q$, l1), 'next_follow_up_required', 'ต้องกำหนดนัดครั้งถัดไป');
  perform crm.log_contact(l1, 'PHONE', 'CONNECTED', 'คุยรายละเอียดรุ่น Darion แล้ว ลูกค้าสนใจ', now() + interval '2 days', 'WARM');
  perform t_assert((select stage = 'CONTACTED' and first_contact_at is not null and temperature = 'WARM' from crm.leads where id = l1), 'contact: ติดต่อสำเร็จ → CONTACTED + first_contact_at');
  perform t_assert((select count(*) from crm.tasks where lead_id = l1 and kind = 'FIRST_CONTACT' and status = 'DONE' and completed_event_id is not null) = 1, 'task: FIRST_CONTACT ปิดพร้อมหลักฐาน event');
  perform t_assert((select count(*) from crm.tasks where lead_id = l1 and kind = 'FOLLOW_UP' and status = 'OPEN') = 1, 'task: สร้าง FOLLOW_UP งานใหม่ตามนัด');
  perform t_assert((select count(*) from crm.tasks where lead_id = l1 and status = 'OPEN') = 1, 'task: ไม่มีงานเปิดซ้ำ');
  perform crm.log_contact(l3, 'PHONE', 'NO_ANSWER', 'โทรไม่รับสาย', now() + interval '3 hours');
  perform t_assert((select first_contact_at is null and stage = 'NEW' from crm.leads where id = l3), 'contact: โทรไม่รับ ไม่นับเป็นติดต่อสำเร็จ');
  perform t_assert((select due_at > now() + interval '2 hours' from crm.tasks where lead_id = l3 and status = 'OPEN'), 'task: ลีดที่ยังไม่ติดต่อสำเร็จ กำหนดใหม่ตามนัด');

  -- ===== stage guard =====
  perform t_raises(format($q$select crm.change_stage(%L, 'BOOKING', 'จอง')$q$, l1), 'evidence_required', 'GUARD: ขึ้น BOOKING โดยไม่มีหลักฐานไม่ได้');
  perform t_raises(format($q$select crm.change_stage(%L, 'WON', 'ขายได้')$q$, l1), 'evidence_required', 'GUARD: ขึ้น WON โดยไม่มีหลักฐานไม่ได้');
  perform t_raises(format($q$select crm.change_stage(%L, 'LOST')$q$, l1), 'lost_reason_required', 'LOST ต้องมีเหตุผล');
  perform crm.add_deal(l1, 'BOOKING', 'RES-2026-0001', 10000);
  perform t_raises(format($q$select crm.change_stage(%L, 'BOOKING', 'จอง')$q$, l1), 'evidence_required', 'GUARD: หลักฐานที่ยังไม่ตรวจสอบไม่นับ');
  perform t_raises($q$select crm.verify_deal(id) from crm.deals$q$, 'forbidden', 'สิทธิ์: sales อนุมัติหลักฐานเองไม่ได้');
  perform t_reset();

  perform t_as('10000000-0000-0000-0000-0000000000b1');
  perform crm.verify_deal((select id from crm.deals limit 1));
  perform t_reset();
  perform t_as('10000000-0000-0000-0000-0000000000a1');
  perform crm.change_stage(l1, 'BOOKING', 'ลูกค้าวางมัดจำ', '{"doc":"RES-2026-0001"}');
  perform t_assert((select stage = 'BOOKING' from crm.leads where id = l1), 'GUARD: มีหลักฐานที่ตรวจสอบแล้ว ขึ้น BOOKING ได้');
  perform t_assert((select count(*) from crm.lead_events where lead_id = l1 and type = 'STAGE_CHANGE') = 1, 'timeline: บันทึกการเปลี่ยนสถานะ');
  perform t_reset();

  -- four-eyes: ผู้จัดการที่บันทึกหลักฐานเอง อนุมัติเองไม่ได้
  perform t_as('10000000-0000-0000-0000-0000000000b2');
  perform crm.add_deal(l2, 'BOOKING', 'RES-2026-0002', 5000);
  perform t_raises($q$select crm.verify_deal(id) from crm.deals where doc_ref = 'RES-2026-0002'$q$, 'four_eyes', 'สิทธิ์: ผู้บันทึกหลักฐานตรวจสอบเองไม่ได้');
  perform t_reset();

  -- ===== LOST แต่ลูกค้าทักมาอีก =====
  perform t_as('10000000-0000-0000-0000-0000000000a2');
  perform crm.change_stage(l2, 'LOST', 'ลูกค้าบอกยังไม่สะดวก');
  perform t_assert((select count(*) from crm.tasks where lead_id = l2 and status = 'OPEN') = 0, 'task: LOST แล้วยกเลิกงานค้าง');
  perform t_reset();
  r := crm.ingest_message('m7', 'fb200', 'สนใจแล้วครับ ขอนัดดูรถ');
  perform t_assert((select stage from crm.leads where id = l2) = 'LOST', 'ระบบไม่เปลี่ยนสถานะ LOST เอง');
  perform t_as('10000000-0000-0000-0000-0000000000b1');
  perform t_assert((select 'LOST_WITH_SIGNAL' = any(flags) and risk_level = 'HIGH' from crm.v_lead_control_center where lead_id = l2), 'Control Center: LOST แต่ยังมีสัญญาณสนใจ → HIGH');
  perform t_assert((select count(*) from crm.v_sales_performance) = 2, 'performance: ผู้จัดการเห็นเซลล์ทั้ง 2 คน');
  perform t_reset();
  perform t_as('10000000-0000-0000-0000-0000000000a1');
  perform t_assert((select count(*) from crm.v_sales_performance) = 1, 'performance: เซลล์เห็นเฉพาะของตนเอง');
  perform t_reset();

  -- ===== SLA sweep / escalation / ไม่แจ้งซ้ำ =====
  perform t_assert(crm.sweep_sla()->>'skipped' = 'alerts_disabled', 'SLA: alerts_enabled=false → sweep ไม่ทำอะไร (ป้องกันแจ้งเตือนท่วมตอนนำเข้า)');
  update crm.settings set value = 'true' where key = 'alerts_enabled';
  delete from crm.alerts;
  update crm.tasks set due_at = now() - interval '20 minutes' where lead_id = l3 and status = 'OPEN';   -- NEW: overdue ที่ +15
  perform crm.sweep_sla();
  perform t_assert((select level from crm.alerts a join crm.tasks k on k.id = a.task_id where k.lead_id = l3) = 'OVERDUE', 'SLA: เลยกำหนด → OVERDUE');
  perform crm.sweep_sla();
  perform t_assert((select count(*) from crm.alerts a join crm.tasks k on k.id = a.task_id where k.lead_id = l3) = 1, 'SLA: sweep ซ้ำ ไม่สร้างแจ้งเตือนซ้ำ');
  update crm.tasks set due_at = now() - interval '45 minutes' where lead_id = l3 and status = 'OPEN';
  perform crm.sweep_sla();
  perform t_assert((select count(*) from crm.alerts a join crm.tasks k on k.id = a.task_id where k.lead_id = l3 and a.level = 'ESCALATE'
                    and a.recipient_id = '00000000-0000-0000-0000-0000000000b1') = 1, 'SLA: Escalate ถึงหัวหน้าของเซลล์');
  perform t_assert((select escalation_level from crm.tasks where lead_id = l3 and status = 'OPEN') = 1, 'task: escalation_level = 1');
  select count(*) into n from crm.claim_alerts(10); perform t_assert(n >= 2, 'claim_alerts: ได้รายการแจ้งเตือน');
  select count(*) into n from crm.claim_alerts(10); perform t_assert(n = 0, 'claim_alerts: เรียกซ้ำไม่ได้ของเดิม (ไม่ส่งซ้ำ)');

  -- ===== Audit =====
  perform t_assert((select count(*) from crm.audit_log where tbl = 'leads') > 5, 'audit: บันทึกการเปลี่ยนแปลง leads');
  perform t_raises($q$delete from crm.audit_log$q$, 'append-only', 'audit: ลบไม่ได้');
  perform t_raises($q$update crm.audit_log set action = 'x'$q$, 'append-only', 'audit: แก้ไม่ได้');

  -- ===== migration mode (ลีดเก่าที่ WON ไม่มีหลักฐาน) =====
  perform set_config('crm.migration_mode', 'on', false);
  insert into crm.leads(lead_code, phone_norm, phone_raw, stage, owner_id, legacy)
  values ('20260812-852942', '0848650630', '0848650630', 'WON', '00000000-0000-0000-0000-0000000000a1', '{"Lead_Status":"WON"}');
  perform set_config('crm.migration_mode', 'off', false);
  perform t_assert((select legacy_unverified from crm.leads where lead_code = '20260812-852942'), 'migration: WON เก่าไม่มีหลักฐาน → ติดธง legacy_unverified (ไม่ปรับสถานะเอง)');
  perform crm.run_data_quality();
  perform t_assert(exists (select 1 from crm.data_quality_issues where code = 'STAGE_WITHOUT_EVIDENCE'), 'DQ: ตรวจพบสถานะไม่มีหลักฐาน');
  perform t_raises($q$insert into crm.leads(lead_code, stage) values ('X-1', 'WON')$q$, 'evidence_required', 'GUARD: เขียนตรงเป็น WON นอก migration ไม่ได้');

  -- ===== regression: ลีดที่ติดต่อแล้วแต่ไม่มีเวลามอบหมาย (assigned_at ว่าง) เคยทำให้ view ภาพรวมวนไม่รู้จบ =====
  perform t_assert(crm.add_work_minutes(null, 15) is null, 'work minutes: ไม่มีเวลาเริ่มต้น → คืน null (ไม่วนไม่รู้จบ)');
  insert into crm.leads(lead_code, phone_norm, stage, first_contact_at) values ('LEGACY-NOOWNER', '0891112233', 'CONTACTED', now() - interval '3 days');
  perform set_config('statement_timeout', '5s', false);
  perform t_as('10000000-0000-0000-0000-0000000000c1');
  perform t_assert((select count(*) from crm.v_exec_summary) = 1, 'exec summary: คำนวณได้แม้มีลีดไม่มีเวลามอบหมาย');
  perform t_assert((select count(*) from crm.v_sales_performance) >= 1, 'performance: คำนวณได้แม้มีลีดไม่มีเวลามอบหมาย');
  perform t_reset();
  perform set_config('statement_timeout', '0', false);
end $$;
