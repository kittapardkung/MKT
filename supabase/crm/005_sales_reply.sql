-- JUSTICE GROUP AI Sales Manager — รับ reply ของเซลล์จาก Telegram (แทน workflow TELEGRAM_SA001/SA002)
-- n8n เรียกด้วย service_role หลัง AI สกัดข้อมูลจากข้อความ — DB เป็นผู้ตัดสินว่าอะไรนำไปใช้ได้

alter table crm.sales_team add column if not exists telegram_user_id text;
alter table crm.leads      add column if not exists profile jsonb not null default '{}';   -- Customer Card (งบ/ดาวน์/เทิร์น/สินเชื่อ ฯลฯ)
create unique index if not exists sales_telegram_user_uq on crm.sales_team(telegram_user_id) where telegram_user_id is not null;
alter table crm.lead_events drop constraint if exists lead_events_type_check;
alter table crm.lead_events add constraint lead_events_type_check check (type in
  ('CUSTOMER_MESSAGE','ASSIGNED','ACCEPTED','CONTACT_ATTEMPT','CONTACT_SUCCESS','STAGE_CHANGE','NOTE','REASSIGNED','AI','SALES_REPLY'));

-- ฟิลด์ Customer Card ที่อนุญาตให้ AI เติม (ไม่รวมเจ้าของลีด/สถานะ/เบอร์ ซึ่งมีกติกาแยก)
create or replace function crm._profile_keys() returns text[] language sql immutable as $$
  select array['Customer_Email','Customer_Line_ID','Customer_Address','Customer_Province','Customer_District','Customer_Postal_Code',
    'Occupation','Interested_Brand','Variant','Preferred_Color','Preferred_Variant','Purchase_Type','Budget','Vehicle_Price','Down_Payment',
    'Interest_Rate','Monthly_Payment','Loan_Term','Financing_Required','Financing_Status','Finance_Amount','Finance_Note','Financing_Bank',
    'Has_Trade_In','Trade_In_Brand','Trade_In_Model','Trade_In_Year','Trade_In_Expected_Price','Trade_In_Appraised_Price','Trade_In_Status',
    'Promotion_Name','Discount_Amount','Free_Items','Closing_Condition','Test_Drive_Date','Quotation_Date','Quotation_Amount','Competitor','Notes'] $$;

create or replace function crm._stage_rank(s text) returns int language sql immutable as $$
  select array_position(array['NEW','CONTACTED','FOLLOW_UP','APPOINTMENT','TEST_DRIVE','QUOTATION','BOOKING','FINANCE_APPROVED','WON'], s) $$;

create or replace function crm.record_sales_reply(
  p_update_id bigint, p_lead_code text, p_telegram_user_id text, p_reply_text text, p_ai jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = crm, pg_temp as $$
declare
  v_key text := 'tg:' || p_update_id; l crm.leads; s crm.sales_team; ev bigint;
  v_outcome text := upper(coalesce(p_ai->>'contact_outcome', ''));
  v_stage text := upper(coalesce(p_ai->>'lead_status', ''));
  v_temp text := upper(coalesce(p_ai->>'lead_temperature', ''));
  v_next timestamptz; v_applied text[] := '{}'; v_review text[] := '{}'; k text; patch jsonb := '{}';
  v_success boolean;
begin
  if p_update_id is null then raise exception 'update_id required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_lead_code, ''), 1));
  if exists (select 1 from crm.lead_events where idempotency_key = v_key) then return jsonb_build_object('status', 'duplicate'); end if;

  select * into l from crm.leads where lead_code = p_lead_code;
  if not found then
    insert into crm.ingest_log(message_id, result, error) values (v_key, 'rejected', 'lead_not_found: ' || coalesce(left(p_lead_code, 30), ''));
    return jsonb_build_object('status', 'lead_not_found');
  end if;
  select * into s from crm.sales_team where telegram_user_id = p_telegram_user_id and active;
  if s.id is null or (s.id <> l.owner_id and s.role not in ('sales_manager','admin')) then
    insert into crm.ingest_log(message_id, result, error) values (v_key, 'rejected', 'forbidden sender for ' || p_lead_code);
    return jsonb_build_object('status', 'forbidden');
  end if;
  if l.stage in ('WON','LOST') then
    insert into crm.lead_events(lead_id, type, channel, body, actor_id, idempotency_key) values (l.id, 'SALES_REPLY', 'TELEGRAM', left(p_reply_text, 2000), s.id, v_key);
    return jsonb_build_object('status', 'closed_lead_noted');
  end if;

  -- 1) รับลีด (ยังไม่นับเป็นการติดต่อ) — เวลาตอบกลับคำนวณใน DB ไม่มีปัญหา timezone
  if l.accepted_at is null then
    update crm.leads set accepted_at = now() where id = l.id;
    insert into crm.lead_events(lead_id, type, channel, actor_id, body) values (l.id, 'ACCEPTED', 'TELEGRAM', s.id, 'เซลล์ตอบกลับการ์ดลีดครั้งแรก');
    v_applied := v_applied || 'accepted'::text;
  end if;

  -- 2) เก็บข้อความต้นฉบับเป็นหลักฐาน
  insert into crm.lead_events(lead_id, type, channel, body, evidence, actor_id, idempotency_key)
  values (l.id, 'SALES_REPLY', 'TELEGRAM', left(p_reply_text, 2000), jsonb_build_object('ai', p_ai), s.id, v_key) returning id into ev;

  -- 3) Customer Card: เติมเฉพาะค่าที่ไม่ว่าง และอยู่ในรายการอนุญาต
  for k in select unnest(crm._profile_keys()) loop
    if nullif(btrim(p_ai->>k), '') is not null then patch := patch || jsonb_build_object(k, btrim(p_ai->>k)); end if;
  end loop;
  if patch <> '{}' then update crm.leads set profile = profile || patch where id = l.id; v_applied := v_applied || 'profile'::text; end if;

  -- 4) ผลการติดต่อ: นับเป็นสำเร็จเมื่อเซลล์รายงานว่าคุยได้/ลูกค้าตอบ
  v_success := v_outcome in ('CONNECTED','REPLIED');
  if v_success then
    update crm.tasks set status = 'DONE', completed_event_id = ev, completed_at = now() where lead_id = l.id and status = 'OPEN';
    update crm.leads set first_contact_at = coalesce(first_contact_at, now()), last_contact_at = now(),
           stage = case when stage = 'NEW' then 'CONTACTED' else stage end where id = l.id;
    insert into crm.lead_events(lead_id, type, channel, outcome, body, actor_id, evidence)
      values (l.id, 'CONTACT_SUCCESS', 'TELEGRAM', v_outcome, 'เซลล์รายงานผ่าน Telegram', s.id, jsonb_build_object('source', 'telegram_reply', 'reply_event', ev));
    v_applied := v_applied || 'contact'::text;
  end if;

  -- 5) นัดติดตาม: ใช้เฉพาะวันที่ในอนาคตและไม่เกิน 1 ปี (AI เคยเดาปีผิดเป็น 2024)
  begin v_next := nullif(p_ai->>'next_follow_up', '')::timestamptz; exception when others then v_next := null; end;
  if v_next is not null then
    if v_next > now() and v_next < now() + interval '1 year' then
      update crm.leads set next_follow_up_at = v_next where id = l.id; v_applied := v_applied || 'next_follow_up'::text;
    else
      insert into crm.data_quality_issues(entity, entity_id, code, detail)
      values ('lead', l.id::text, 'FOLLOWUP_DATE_IMPLAUSIBLE', 'AI สกัดวันนัดไม่สมเหตุสมผล: ' || left(p_ai->>'next_follow_up', 30))
      on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
      v_review := v_review || 'next_follow_up'::text;
    end if;
  end if;

  -- 6) อุณหภูมิ (การจัดประเภท ไม่ใช่การตัดสินใจทางการค้า)
  if v_temp in ('HOT','WARM','COLD') then update crm.leads set temperature = v_temp where id = l.id; v_applied := v_applied || 'temperature'::text; end if;

  -- 7) สถานะ: ไปข้างหน้าได้เฉพาะขั้นที่ไม่ต้องใช้หลักฐาน; ขั้นอื่น = ข้อเสนอให้ผู้จัดการตรวจ (AI ไม่ตัดสินเอง)
  if v_stage <> '' and v_stage <> l.stage then
    if v_stage in ('FOLLOW_UP','APPOINTMENT','TEST_DRIVE','QUOTATION','CONTACTED')
       and crm._stage_rank(v_stage) > crm._stage_rank((select stage from crm.leads where id = l.id)) then
      update crm.leads set stage = v_stage where id = l.id;
      insert into crm.lead_events(lead_id, type, channel, actor_id, body, evidence)
        values (l.id, 'STAGE_CHANGE', 'TELEGRAM', s.id, 'ตามที่เซลล์รายงาน', jsonb_build_object('from', l.stage, 'to', v_stage, 'source', 'telegram_reply'));
      v_applied := v_applied || 'stage'::text;
    else
      insert into crm.lead_events(lead_id, type, channel, body, evidence)
        values (l.id, 'AI', 'TELEGRAM', 'AI เสนอเปลี่ยนสถานะเป็น ' || v_stage || ' — รอมนุษย์ตรวจสอบ/แนบหลักฐาน', jsonb_build_object('suggested_stage', v_stage, 'reply_event', ev));
      v_review := v_review || ('stage:' || v_stage)::text;
    end if;
  end if;

  return jsonb_build_object('status', 'ok', 'lead_code', l.lead_code, 'applied', v_applied, 'needs_review', v_review,
    'sales', jsonb_build_object('code', s.code, 'name', s.display_name));
end $$;

revoke all on function crm.record_sales_reply(bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function crm.record_sales_reply(bigint, text, text, text, jsonb) to service_role;
grant execute on function crm._profile_keys(), crm._stage_rank(text) to service_role, authenticated;
