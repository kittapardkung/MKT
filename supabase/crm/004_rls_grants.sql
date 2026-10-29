-- JUSTICE GROUP AI Sales Manager — RLS + Grants (Phase 3)
-- หลักการ: authenticated อ่านได้ตาม RLS, เขียนผ่าน RPC เท่านั้น; service_role (n8n) เรียก ingest/sweep/claim

do $$ declare t text; begin
  foreach t in array array['settings','sla_rules','sales_team','leads','lead_events','deals','tasks','alerts',
                           'ai_insights','data_quality_issues','audit_log','ingest_log'] loop
    execute format('alter table crm.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists p_leads_sel on crm.leads;
create policy p_leads_sel on crm.leads for select to authenticated
  using ((select crm.is_manager()) or owner_id = (select crm.my_id()));

-- ตารางลูกของลีด: เห็นได้เมื่อเห็นลีดนั้น (RLS ของ leads ทำงานใน subquery)
do $$ declare t text; begin
  foreach t in array array['lead_events','deals','tasks','ai_insights'] loop
    execute format('drop policy if exists p_%1$s_sel on crm.%1$I', t);
    execute format('create policy p_%1$s_sel on crm.%1$I for select to authenticated using ((select crm.is_manager()) or exists (select 1 from crm.leads l where l.id = lead_id and l.owner_id = (select crm.my_id())))', t);
  end loop;
end $$;

drop policy if exists p_sales_team_sel on crm.sales_team;
create policy p_sales_team_sel on crm.sales_team for select to authenticated using (true);

drop policy if exists p_sla_sel on crm.sla_rules;
create policy p_sla_sel on crm.sla_rules for select to authenticated using (true);
drop policy if exists p_sla_upd on crm.sla_rules;
create policy p_sla_upd on crm.sla_rules for update to authenticated
  using ((select crm.my_role()) in ('executive','admin')) with check ((select crm.my_role()) in ('executive','admin'));

drop policy if exists p_settings_sel on crm.settings;
create policy p_settings_sel on crm.settings for select to authenticated using (true);
drop policy if exists p_settings_upd on crm.settings;
create policy p_settings_upd on crm.settings for update to authenticated
  using ((select crm.my_role()) in ('executive','admin')) with check ((select crm.my_role()) in ('executive','admin'));

drop policy if exists p_alerts_sel on crm.alerts;
create policy p_alerts_sel on crm.alerts for select to authenticated using ((select crm.is_leadership()));
drop policy if exists p_dq_sel on crm.data_quality_issues;
create policy p_dq_sel on crm.data_quality_issues for select to authenticated using ((select crm.is_leadership()));
drop policy if exists p_audit_sel on crm.audit_log;
create policy p_audit_sel on crm.audit_log for select to authenticated using ((select crm.my_role()) in ('admin','executive'));

-- ---------- Grants ----------
revoke all on schema crm from public, anon;
revoke all on all tables in schema crm from public, anon;
revoke all on all functions in schema crm from public, anon;

grant usage on schema crm to authenticated, service_role;
grant select on crm.leads, crm.lead_events, crm.deals, crm.tasks, crm.ai_insights, crm.sla_rules, crm.settings,
                crm.alerts, crm.data_quality_issues, crm.audit_log to authenticated;
grant select (id, user_id, code, display_name, role, manager_id, active) on crm.sales_team to authenticated;  -- ไม่เปิด telegram_chat_id
grant update (minutes, business_hours_only, remind_before_minutes, escalate_after_minutes) on crm.sla_rules to authenticated;
grant update (value) on crm.settings to authenticated;
grant select on crm.v_lead_control_center, crm.v_my_today, crm.v_sales_performance, crm.v_exec_summary,
                crm.v_funnel, crm.v_exec_risk_leads to authenticated;

grant execute on function crm.me(), crm.my_id(), crm.my_role(), crm.is_manager(), crm.is_leadership(), crm.setting(text),
  crm.add_work_minutes(timestamptz, int), crm.normalize_phone(text) to authenticated, service_role;
grant execute on function crm.accept_lead(uuid), crm.log_contact(uuid, text, text, text, timestamptz, text),
  crm.change_stage(uuid, text, text, jsonb), crm.add_deal(uuid, text, text, numeric), crm.verify_deal(uuid),
  crm.reassign_lead(uuid, uuid, text) to authenticated;
grant execute on function crm.ingest_message(text, text, text, text, text, text, timestamptz),
  crm.sweep_sla(), crm.claim_alerts(int), crm.run_data_quality(), crm.assign_lead(uuid), crm.refresh_task(uuid) to service_role;

grant all on all tables in schema crm to service_role;
grant all on all sequences in schema crm to service_role;
