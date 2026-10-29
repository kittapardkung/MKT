import { createClient } from "@supabase/supabase-js";
import type { Api, Booking, ExecSummary, Funnel, LeadEvent, LeadRow, Me, SalesPerf, TodayItem } from "./types";

// ใช้ publishable key เท่านั้น — ข้อมูลทั้งหมดคุมด้วย RLS ใน schema crm
export function createLiveApi(url: string, key: string): Api {
  const sb = createClient(url, key, { db: { schema: "crm" } });
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

  return {
    mode: "live",
    async me(): Promise<Me | null> {
      const { data: s } = await sb.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return null;
      const { data, error } = await sb.from("sales_team").select("id,display_name,role").eq("user_id", uid).maybeSingle();
      fail(error);
      return data ? { id: data.id, name: data.display_name, role: data.role } : null;
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    async signOut() { await sb.auth.signOut(); },
    async today() {
      const { data, error } = await sb.from("v_my_today").select("*");
      fail(error); return (data ?? []) as TodayItem[];
    },
    async leads() {
      const out: LeadRow[] = [];
      for (let from = 0; from < 10000; from += 1000) {   // PostgREST จำกัด 1,000 แถว/คำขอ
        const { data, error } = await sb.from("v_lead_control_center").select("*")
          .order("created_at", { ascending: false }).range(from, from + 999);
        fail(error);
        out.push(...((data ?? []) as LeadRow[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
    async events(leadId) {
      const { data, error } = await sb.from("lead_events")
        .select("id,type,channel,outcome,body,occurred_at,actor:sales_team(display_name)")
        .eq("lead_id", leadId).order("occurred_at", { ascending: false }).limit(100);
      fail(error);
      return (data ?? []).map((e) => ({ ...e, actor: (e.actor as unknown as { display_name: string } | null)?.display_name ?? null })) as LeadEvent[];
    },
    async accept(leadId) { fail((await sb.rpc("accept_lead", { p_lead: leadId })).error); },
    async logContact(leadId, c) {
      fail((await sb.rpc("log_contact", {
        p_lead: leadId, p_channel: c.channel, p_outcome: c.outcome, p_note: c.note,
        p_next_follow_up: new Date(c.next_follow_up).toISOString(), p_temperature: c.temperature,
      })).error);
    },
    async changeStage(leadId, to, reason) {
      fail((await sb.rpc("change_stage", { p_lead: leadId, p_to: to, p_reason: reason })).error);
    },
    async performance() {
      const { data, error } = await sb.from("v_sales_performance").select("*");
      fail(error); return (data ?? []) as SalesPerf[];
    },
    async summary() {
      const { data, error } = await sb.from("v_exec_summary").select("*").maybeSingle();
      fail(error); return (data as ExecSummary | null) ?? null;
    },
    async bookings() {
      const { data, error } = await sb.from("v_bookings").select("*").order("created_at", { ascending: false }).limit(500);
      fail(error); return (data ?? []) as Booking[];
    },
    async markBooked(leadId, b) {
      fail((await sb.rpc("mark_booked", { p_lead: leadId, p_doc_ref: b.doc_ref, p_amount: b.amount, p_details: b.details, p_booked_on: b.booked_on || null })).error);
    },
    async verifyBooking(dealId) { fail((await sb.rpc("verify_deal", { p_deal: dealId })).error); },
    async updateLeadInfo(leadId, i) { fail((await sb.rpc("update_lead_info", { p_lead: leadId, p_name: i.name, p_phone: i.phone, p_model: i.model, p_profile: i.profile })).error); },
    async setStar(leadId, on, note) { fail((await sb.rpc("set_star", { p_lead: leadId, p_on: on, p_note: note ?? null })).error); },
    async funnel() {
      const { data, error } = await sb.from("v_funnel").select("*");
      fail(error); return (data ?? []) as Funnel[];
    },
  };
}
