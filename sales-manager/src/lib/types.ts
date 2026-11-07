export type Role = "sales" | "sales_manager" | "executive" | "admin";
export type Stage =
  | "NEW" | "CONTACTED" | "FOLLOW_UP" | "APPOINTMENT" | "TEST_DRIVE" | "QUOTATION" | "NEGOTIATION"
  | "BOOKING" | "FINANCE_PENDING" | "FINANCE_APPROVED" | "READY_TO_DELIVER" | "WON" | "LOST";
export type Temperature = "HOT" | "WARM" | "COLD" | null;
export type Risk = "HIGH" | "MEDIUM" | "LOW";

export interface Me { id: string; name: string; role: Role }

export interface TodayItem {
  task_id: string; lead_id: string; lead_code: string;
  customer_name: string | null; interested_model: string | null; phone: string | null;
  stage: Stage; temperature: Temperature; kind: "FIRST_CONTACT" | "FOLLOW_UP";
  due_at: string; overdue_minutes: number; reason: string; action: string;
  risk_level: Risk; flags: string[]; responsible_sales?: string | null;
}

export interface LeadRow {
  lead_id: string; lead_code: string; customer_name: string | null; interested_model: string | null;
  responsible_sales: string | null; stage: Stage; temperature: Temperature;
  last_contact_at: string | null; next_follow_up_at: string | null; phone: string | null;
  next_best_action: string; task_status: "OPEN" | "NONE"; task_due_at: string | null;
  risk_level: Risk; flags: string[]; created_at: string;
  first_contact_at: string | null; accepted_at: string | null; dormant: boolean;
  last_customer_message: string | null; last_customer_message_at: string | null;
  starred: boolean; star_note: string | null;
  lost_reason?: string | null; profile?: Record<string, string>;
}

export interface LeadInfoInput { name: string; phone: string; model: string; profile: Record<string, string> }

export interface BookingDetails {
  model: string; variant?: string; color?: string; vehicle_price?: number;
  purchase_type: "CASH" | "FINANCE"; down_payment?: number; term_months?: number; bank?: string; promo?: string; note?: string;
  finance_approved_on?: string; delivery_date?: string; delivered_on?: string; vin?: string; delivery_note?: string; delivered_by?: string;
}

export type DeliveryStep = "FINANCE_APPROVED" | "READY_TO_DELIVER" | "DELIVERED";
export interface DeliveryInput { date?: string; vin?: string; note?: string }

export interface BookingInput { doc_ref: string; amount: number | null; booked_on: string; details: BookingDetails }

export interface Booking {
  deal_id: string; lead_id: string; lead_code: string; customer_name: string | null; phone: string | null; stage: Stage;
  interested_model: string | null; doc_ref: string; amount: number | null; details: Partial<BookingDetails>; booked_on: string | null;
  created_at: string; verified_at: string | null; verified: boolean; reported_by: string | null; responsible_sales: string | null; verified_by_name: string | null;
}

export interface LeadEvent {
  id: number; type: string; channel: string | null; outcome: string | null;
  body: string | null; occurred_at: string; actor: string | null;
}

export interface ContactInput {
  channel: string; outcome: string; note: string; next_follow_up: string; temperature: Temperature;
}

export interface SalesPerf {
  code: string; display_name: string; assigned_leads: number; accepted_leads: number;
  first_response_sla_pct: number | null; contacted_leads: number; leads_without_next_action: number;
  overdue_tasks: number; followup_ontime_pct: number | null; appointment_rate_pct: number | null;
  test_drive_rate_pct: number | null; quotation_rate_pct: number | null; booking_rate_pct: number | null;
  won: number; lost: number; pipeline_age_days: number | null; hot_share_pct: number | null;
}

export interface ExecSummary {
  total_leads: number; active_leads: number; unassigned_leads: number; leads_at_risk: number;
  overdue_followups: number; contact_sla_pct: number | null; booking_or_won: number; won: number;
  lost: number; open_dq_issues: number;
}

export interface Funnel { stage: Stage; leads: number }

export interface ReportSales {
  code: string; name: string; leads_assigned: number; leads_assigned_prev: number; hot_leads_assigned: number;
  contacted: number; not_contacted: number; avg_hours_to_first_contact: number | null; contact_logs: number; contact_logs_prev: number;
  overdue_tasks_new?: number; overdue_tasks_legacy?: number; bookings_reported: number; lost_in_period: number; active_leads: number;
}
export interface ReportQuality {
  code: string; first_contact_within_1h: number; first_contact_1_to_4h: number; first_contact_4_to_24h: number; first_contact_over_24h: number;
  contact_outcomes: Record<string, number>; active_days: number; notes_logged: number; telegram_replies: number;
  assigned_now_advanced: number; stage_changes: number; active_hot: number; active_warm: number; active_cold: number; active_temp_unset: number;
  active_with_next_followup: number; active_total: number; models_requested: Array<{ model: string; n: number }>;
}
export interface WeeklyReport {
  generated_at: string; period_days: number; unassigned_leads: number; sales: ReportSales[]; sales_quality: ReportQuality[];
  risk_leads: Array<{ lead_code: string; sales: string | null; stage: string; temperature: string | null; reason: string }>;
  leads_by_source: Array<{ source: string; this_period: number; previous_period: number }>;
}
export interface ReportSnapshot { id: number; period_days: number; generated_at: string; report: WeeklyReport; overview_text: string | null; person_texts: Record<string, string> }

export interface Api {
  weeklyReport(days: number): Promise<WeeklyReport | null>;
  reportSnapshots(): Promise<ReportSnapshot[]>;
  mode: "demo" | "live";
  me(): Promise<Me | null>;
  signIn?(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  today(): Promise<TodayItem[]>;
  leads(): Promise<LeadRow[]>;
  events(leadId: string): Promise<LeadEvent[]>;
  accept(leadId: string): Promise<void>;
  logContact(leadId: string, c: ContactInput): Promise<void>;
  changeStage(leadId: string, to: Stage, reason: string): Promise<void>;
  performance(): Promise<SalesPerf[]>;
  summary(): Promise<ExecSummary | null>;
  funnel(): Promise<Funnel[]>;
  bookings(): Promise<Booking[]>;
  markBooked(leadId: string, b: BookingInput): Promise<void>;
  verifyBooking(dealId: string): Promise<void>;
  setStar(leadId: string, on: boolean, note?: string): Promise<void>;
  setDeliveryStep(dealId: string, step: DeliveryStep, i?: DeliveryInput): Promise<void>;
  updateLeadInfo(leadId: string, i: LeadInfoInput): Promise<void>;
}
