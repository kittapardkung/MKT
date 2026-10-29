import type { Api, Booking, ContactInput, ExecSummary, LeadEvent, LeadRow, Me, SalesPerf, Stage, Temperature, TodayItem } from "./types";

// ข้อมูลสมมติทั้งหมด (ชื่อ/เบอร์ไม่ใช่ลูกค้าจริง) — ใช้สาธิตหน้าจอเมื่อยังไม่เชื่อม Supabase
const now = Date.now();
const iso = (offsetMin: number) => new Date(now + offsetMin * 60000).toISOString();

interface DemoLead extends LeadRow { events: LeadEvent[] }

const NBA: Record<Stage, string> = {
  NEW: "โทรติดต่อลูกค้าครั้งแรก และสอบถามความต้องการ", CONTACTED: "สอบถามงบ/ระยะเวลาซื้อ และส่งรายละเอียดรุ่นรถ",
  FOLLOW_UP: "ส่งตารางผ่อน และชวนนัดทดลองขับ", APPOINTMENT: "ยืนยันนัดหมายก่อนวันนัด",
  TEST_DRIVE: "ถามความเห็นหลังทดลองขับ และเสนอราคา", QUOTATION: "ติดตามผลการเสนอราคา และช่วยประเมินสินเชื่อ",
  NEGOTIATION: "เจรจาราคา/โปรโมชั่น/เงื่อนไข เพื่อปิดการขาย", BOOKING: "ดำเนินการสินเชื่อ/เอกสารการจอง",
  FINANCE_PENDING: "ติดตามผลไฟแนนซ์และเอกสาร", FINANCE_APPROVED: "ยืนยันเงื่อนไขและเตรียมรถ", READY_TO_DELIVER: "นัดหมายวันรับรถ", WON: "—",
  LOST: "ทบทวนสาเหตุที่เสีย และประเมินว่าควรกลับมาติดต่อหรือไม่",
};
const GUARDED: Stage[] = ["BOOKING", "FINANCE_PENDING", "FINANCE_APPROVED", "READY_TO_DELIVER", "WON"];

function mk(code: string, name: string | null, model: string | null, phone: string | null, sales: string | null,
  stage: Stage, temp: Temperature, nextMin: number | null, lastMin: number | null, flags: string[], risk: LeadRow["risk_level"],
  ev: Array<[string, string | null, string | null, string, number, string | null]>): DemoLead {
  return {
    lead_id: code, lead_code: code, customer_name: name, interested_model: model, phone, responsible_sales: sales,
    stage, temperature: temp, last_contact_at: lastMin === null ? null : iso(lastMin), next_follow_up_at: nextMin === null ? null : iso(nextMin),
    next_best_action: NBA[stage], task_status: stage === "WON" || stage === "LOST" ? "NONE" : "OPEN",
    task_due_at: nextMin === null ? null : iso(nextMin), risk_level: risk, flags, created_at: iso(-60 * 24 * 3),
    first_contact_at: stage === "NEW" ? null : iso(lastMin ?? -60 * 24), accepted_at: stage === "NEW" && !flags.includes("NOT_ACCEPTED") ? iso(-5) : stage === "NEW" ? null : iso(-60 * 24),
    dormant: false, last_customer_message: ev.filter((e) => e[0] === "CUSTOMER_MESSAGE").map((e) => e[3]).pop() ?? null,
    last_customer_message_at: ev.filter((e) => e[0] === "CUSTOMER_MESSAGE").map((e) => iso(e[4])).pop() ?? null, starred: false, star_note: null,
    events: ev.map((e, i) => ({ id: i + 1, type: e[0], channel: e[1], outcome: e[2], body: e[3], occurred_at: iso(e[4]), actor: e[5] })),
  };
}

const leads: DemoLead[] = [
  mk("20261029-000101", "คุณสมชาย (ตัวอย่าง)", "DARION", "0812345601", "วิ", "NEW", null, -35, null, ["FIRST_CONTACT_OVERDUE", "NOT_ACCEPTED"], "HIGH",
    [["CUSTOMER_MESSAGE", "FACEBOOK", null, "สนใจ Darion ครับ ขอราคาหน่อย 081-234-5601", -50, null], ["ASSIGNED", null, null, "auto round-robin", -49, null]]),
  mk("20261028-000088", "คุณมาลี (ตัวอย่าง)", "PORTA", "0812345602", "วิ", "TEST_DRIVE", "HOT", -130, -60 * 26, ["OVERDUE_FOLLOWUP"], "HIGH",
    [["CONTACT_SUCCESS", "PHONE", "CONNECTED", "ลูกค้าไปทดลองขับแล้ว ชอบมาก ขอเวลาปรึกษาครอบครัว", -60 * 26, "วิ"], ["STAGE_CHANGE", null, null, "ทดลองขับ", -60 * 27, "วิ"]]),
  mk("20261027-000071", "คุณสุดา (ตัวอย่าง)", "BINGO", "0812345603", "วิ", "FOLLOW_UP", "WARM", 180, -60 * 20, [], "LOW",
    [["CONTACT_SUCCESS", "LINE", "REPLIED", "ส่งตารางผ่อนให้แล้ว รอตอบกลับ", -60 * 20, "วิ"]]),
  mk("20261026-000060", "คุณอนันต์ (ตัวอย่าง)", "DARION", "0812345604", "วิ", "QUOTATION", "HOT", null, -60 * 50, ["NO_NEXT_FOLLOWUP"], "MEDIUM",
    [["CONTACT_SUCCESS", "PHONE", "CONNECTED", "เสนอราคาแล้ว ลูกค้าเทียบกับยี่ห้ออื่น", -60 * 50, "วิ"]]),
  mk("20261029-000102", "คุณพิมพ์ (ตัวอย่าง)", "PORTA", "0812345605", "โอ๋", "NEW", null, 8, null, [], "LOW",
    [["CUSTOMER_MESSAGE", "FACEBOOK", null, "ขอรายละเอียด Porta ครับ", -7, null], ["ASSIGNED", null, null, "auto round-robin", -6, null]]),
  mk("20261025-000040", "คุณธนา (ตัวอย่าง)", "DARION", "0812345606", "โอ๋", "FOLLOW_UP", "WARM", -300, -60 * 40, ["OVERDUE_FOLLOWUP", "STALE"], "MEDIUM",
    [["CONTACT_ATTEMPT", "PHONE", "NO_ANSWER", "โทรไม่รับสาย 2 ครั้ง", -60 * 40, "โอ๋"]]),
  mk("20261020-000012", "คุณวรรณา (ตัวอย่าง)", "BINGO", "0812345607", "โอ๋", "LOST", "COLD", null, -60 * 24 * 9, ["LOST_WITH_SIGNAL"], "HIGH",
    [["CUSTOMER_MESSAGE", "FACEBOOK", null, "ตอนนี้พร้อมแล้วค่ะ ขอนัดดูรถได้ไหม", -90, null], ["STAGE_CHANGE", null, null, "ลูกค้าบอกยังไม่สะดวก", -60 * 24 * 9, "โอ๋"]]),
  mk("20261015-000005", "คุณประเสริฐ (ตัวอย่าง)", "DARION", "0812345608", "โอ๋", "BOOKING", "HOT", 60 * 24, -60 * 5, [], "LOW",
    [["STAGE_CHANGE", null, null, "ลูกค้าวางมัดจำ (หลักฐาน RES-0001 ตรวจสอบแล้ว)", -60 * 5, "โอ๋"]]),
];

// ข้อมูลสังเคราะห์สำหรับสาธิตกราฟ (ไม่ใช่ลูกค้าจริง) — เลขสุ่มแบบกำหนดผลได้
(function seedDemo() {
  let x = 7; const rnd = () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const models = ["DARION", "Porta", "บิงโก", "darion", "PORTA ev", null];
  const stages: Stage[] = ["NEW", "CONTACTED", "CONTACTED", "FOLLOW_UP", "FOLLOW_UP", "APPOINTMENT", "TEST_DRIVE", "QUOTATION", "LOST", "LOST", "LOST", "BOOKING", "WON"];
  const temps: Temperature[] = [null, "COLD", "COLD", "WARM", "WARM", "HOT"];
  for (let i = 0; i < 110; i++) {
    const age = Math.floor(rnd() * 60); const st = stages[Math.floor(rnd() * stages.length)]; const t = temps[Math.floor(rnd() * temps.length)];
    const l = mk(`DEMO-${String(i).padStart(4, "0")}`, `ลูกค้าตัวอย่าง ${i + 1}`, models[Math.floor(rnd() * models.length)], `08${String(10000000 + i * 7919).slice(0, 8)}`,
      rnd() < 0.5 ? "วิ" : "โอ๋", st, t, st === "LOST" || st === "WON" ? null : Math.floor(rnd() * 3000) + 60, st === "NEW" ? null : -age * 60, rnd() < 0.15 ? ["OVERDUE_FOLLOWUP"] : [], rnd() < 0.1 ? "HIGH" : rnd() < 0.3 ? "MEDIUM" : "LOW", []);
    l.created_at = iso(-(age * 1440 + Math.floor(rnd() * 600))); l.dormant = st === "NEW" && age > 14; if (st === "NEW") { l.last_customer_message = "สนใจรถครับ ขอราคาหน่อย"; l.last_customer_message_at = l.created_at; }
    l.task_status = "NONE"; l.task_due_at = null; leads.push(l);
  }
})();

const bookings: Booking[] = [
  { deal_id: "b1", lead_id: "20261015-000005", lead_code: "20261015-000005", customer_name: "คุณประเสริฐ (ตัวอย่าง)", phone: "0812345608", stage: "BOOKING", interested_model: "DARION",
    doc_ref: "RES-DEMO-0001", amount: 20000, booked_on: iso(-60 * 24 * 2).slice(0, 10), created_at: iso(-60 * 24 * 2), verified_at: iso(-60 * 24), verified: true, reported_by: "โอ๋", responsible_sales: "โอ๋", verified_by_name: "หัวหน้า",
    details: { model: "Darion", variant: "EV 7 ที่นั่ง", color: "ขาว", purchase_type: "FINANCE", down_payment: 150000, term_months: 60, bank: "KBank", vehicle_price: 689000 } },
  { deal_id: "b2", lead_id: "20261028-000088", lead_code: "20261028-000088", customer_name: "คุณมาลี (ตัวอย่าง)", phone: "0812345602", stage: "TEST_DRIVE", interested_model: "PORTA",
    doc_ref: "RES-DEMO-0002", amount: 10000, booked_on: iso(-60 * 5).slice(0, 10), created_at: iso(-60 * 5), verified_at: null, verified: false, reported_by: "วิ", responsible_sales: "วิ", verified_by_name: null,
    details: { model: "Porta", color: "เทา", purchase_type: "CASH", vehicle_price: 549000, promo: "ฟรีประกันชั้น 1" } },
];
const sales: Record<string, string> = { sales: "วิ", manager: "หัวหน้า" };
let role: "sales" | "manager" = "sales";

const mine = () => (role === "sales" ? leads.filter((l) => l.responsible_sales === "วิ") : leads);

function toToday(l: DemoLead): TodayItem {
  const due = l.task_due_at ? new Date(l.task_due_at).getTime() : now;
  const over = Math.max(0, Math.floor((Date.now() - due) / 60000));
  const first = l.stage === "NEW";
  return {
    task_id: l.lead_id, lead_id: l.lead_id, lead_code: l.lead_code, customer_name: l.customer_name, interested_model: l.interested_model,
    phone: l.phone, stage: l.stage, temperature: l.temperature, kind: first ? "FIRST_CONTACT" : "FOLLOW_UP", due_at: l.task_due_at ?? iso(0),
    overdue_minutes: over, risk_level: l.risk_level, flags: l.flags, action: l.next_best_action, responsible_sales: l.responsible_sales,
    reason: first && over > 0 ? "ลีดใหม่ เลยกำหนดติดต่อครั้งแรก — ลูกค้ากำลังรอ"
      : first ? "ลีดใหม่ ต้องติดต่อครั้งแรกภายในเวลา SLA"
      : over > 0 && l.temperature === "HOT" ? "ลีด HOT เลยกำหนดติดตาม — เสี่ยงเสียโอกาสสูง"
      : over > 0 ? "เลยกำหนดติดตาม" : "ถึงกำหนดติดตามวันนี้",
  };
}

const perf: SalesPerf[] = [
  { code: "SA0001", display_name: "วิ", assigned_leads: 62, accepted_leads: 58, first_response_sla_pct: 71.0, contacted_leads: 55, leads_without_next_action: 4,
    overdue_tasks: 3, followup_ontime_pct: 78.4, appointment_rate_pct: 29.0, test_drive_rate_pct: 19.4, quotation_rate_pct: 12.9, booking_rate_pct: 6.5, won: 4, lost: 21, pipeline_age_days: 9.8, hot_share_pct: 14.5 },
  { code: "SA0002", display_name: "โอ๋", assigned_leads: 60, accepted_leads: 49, first_response_sla_pct: 52.5, contacted_leads: 41, leads_without_next_action: 9,
    overdue_tasks: 8, followup_ontime_pct: 61.2, appointment_rate_pct: 21.7, test_drive_rate_pct: 13.3, quotation_rate_pct: 8.3, booking_rate_pct: 3.3, won: 2, lost: 27, pipeline_age_days: 14.2, hot_share_pct: 8.3 },
];

export function createDemoApi(): Api {
  return {
    mode: "demo",
    async me(): Promise<Me> { return { id: "demo", name: sales[role], role: role === "sales" ? "sales" : "sales_manager" }; },
    async signOut() { role = role === "sales" ? "manager" : "sales"; },   // ในโหมดสาธิตใช้ปุ่มนี้สลับมุมมองเซลล์/ผู้จัดการ
    async today() {
      return mine().filter((l) => l.task_status === "OPEN" && l.task_due_at && new Date(l.task_due_at).getTime() < now + 6 * 3600000)
        .map(toToday).sort((a, b) => (b.overdue_minutes > 0 ? 1 : 0) - (a.overdue_minutes > 0 ? 1 : 0) || (b.temperature === "HOT" ? 1 : 0) - (a.temperature === "HOT" ? 1 : 0) || b.overdue_minutes - a.overdue_minutes);
    },
    async leads() { return mine().map(({ events: _e, ...l }) => (void _e, l)); },
    async events(id) { return (leads.find((l) => l.lead_id === id)?.events ?? []).slice().sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)); },
    async accept(id) {
      const l = leads.find((x) => x.lead_id === id); if (!l) return;
      l.flags = l.flags.filter((f) => f !== "NOT_ACCEPTED");
      l.events.push({ id: l.events.length + 1, type: "ACCEPTED", channel: null, outcome: null, body: "รับลีด (ยังไม่นับเป็นการติดต่อลูกค้า)", occurred_at: iso(0), actor: "วิ" });
    },
    async logContact(id, c: ContactInput) {
      const l = leads.find((x) => x.lead_id === id); if (!l) throw new Error("lead_not_found");
      if (c.note.trim().length < 5) throw new Error("note_required: ต้องบันทึกผลการติดต่ออย่างน้อย 5 ตัวอักษร");
      if (!c.next_follow_up || new Date(c.next_follow_up).getTime() <= Date.now()) throw new Error("next_follow_up_required: ต้องกำหนดนัดติดตามครั้งถัดไปในอนาคต");
      const ok = c.outcome === "CONNECTED" || c.outcome === "REPLIED";
      l.events.push({ id: l.events.length + 1, type: ok ? "CONTACT_SUCCESS" : "CONTACT_ATTEMPT", channel: c.channel, outcome: c.outcome, body: c.note, occurred_at: iso(0), actor: sales[role] });
      l.last_contact_at = iso(0); l.next_follow_up_at = new Date(c.next_follow_up).toISOString(); l.task_due_at = l.next_follow_up_at;
      if (c.temperature) l.temperature = c.temperature;
      if (ok && l.stage === "NEW") { l.stage = "CONTACTED"; l.next_best_action = NBA.CONTACTED; }
      l.flags = l.flags.filter((f) => !["FIRST_CONTACT_OVERDUE", "OVERDUE_FOLLOWUP", "NO_NEXT_FOLLOWUP", "STALE", "NOT_ACCEPTED"].includes(f));
      l.risk_level = l.flags.length ? "MEDIUM" : "LOW";
    },
    async changeStage(id, to, reason) {
      const l = leads.find((x) => x.lead_id === id); if (!l) return;
      if (GUARDED.includes(to) && !bookings.some((b) => b.lead_id === id && b.verified)) throw new Error(`evidence_required: สถานะ ${to} ต้องมีการจองที่ผู้จัดการตรวจสอบแล้ว`);
      if (to === "LOST" && reason.trim().length < 3) throw new Error("lost_reason_required");
      l.stage = to; l.next_best_action = NBA[to];
      l.events.push({ id: l.events.length + 1, type: "STAGE_CHANGE", channel: null, outcome: null, body: reason || to, occurred_at: iso(0), actor: sales[role] });
    },
    async performance() { return role === "sales" ? perf.slice(0, 1) : perf; },
    async summary(): Promise<ExecSummary | null> {
      if (role === "sales") return null;
      return { total_leads: 128, active_leads: 47, unassigned_leads: 3, leads_at_risk: leads.filter((l) => l.risk_level === "HIGH").length * 6, overdue_followups: 11,
        contact_sla_pct: 61.8, booking_or_won: 9, won: 6, lost: 218, open_dq_issues: 37 };
    },
    async bookings() { return role === "sales" ? bookings.filter((b) => b.responsible_sales === "วิ") : bookings.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async markBooked(id, b) {
      const l = leads.find((x) => x.lead_id === id); if (!l) throw new Error("lead_not_found");
      if (!b.doc_ref || b.doc_ref.trim().length < 3) throw new Error("doc_ref_required: ต้องระบุเลขที่ใบจอง");
      if (!b.details.model) throw new Error("model_required: ต้องระบุรถ/รุ่นที่จอง");
      if (bookings.some((x) => x.doc_ref === b.doc_ref.trim())) throw new Error("duplicate_booking: เลขที่ใบจองนี้บันทึกไว้แล้ว");
      bookings.unshift({ deal_id: `b${bookings.length + 1}`, lead_id: id, lead_code: l.lead_code, customer_name: l.customer_name, phone: l.phone, stage: l.stage, interested_model: l.interested_model,
        doc_ref: b.doc_ref.trim(), amount: b.amount, details: b.details, booked_on: b.booked_on, created_at: iso(0), verified_at: null, verified: false, reported_by: sales[role], responsible_sales: l.responsible_sales, verified_by_name: null });
      l.events.push({ id: l.events.length + 1, type: "NOTE", channel: null, outcome: null, body: `แจ้งจอง ${b.details.model} เลขที่ ${b.doc_ref} — รอผู้จัดการตรวจสอบ`, occurred_at: iso(0), actor: sales[role] });
    },
    async verifyBooking(dealId) {
      if (role === "sales") throw new Error("forbidden");
      const b = bookings.find((x) => x.deal_id === dealId); if (!b) return;
      if (b.reported_by === sales[role]) throw new Error("four_eyes: ผู้บันทึกหลักฐานตรวจสอบเองไม่ได้");
      b.verified = true; b.verified_at = iso(0); b.verified_by_name = sales[role];
      const l = leads.find((x) => x.lead_id === b.lead_id);
      if (l && !GUARDED.includes(l.stage) && l.stage !== "LOST") { l.stage = "BOOKING"; l.next_best_action = NBA.BOOKING; b.stage = "BOOKING"; }
    },
    async setStar(id, on, note) { const l = leads.find((x) => x.lead_id === id); if (!l) return; l.starred = on; l.star_note = on ? (note ?? l.star_note) : null; },
    async funnel() {
      return role === "sales" ? [] : ([["NEW", 14], ["CONTACTED", 38], ["FOLLOW_UP", 41], ["APPOINTMENT", 9], ["TEST_DRIVE", 21], ["QUOTATION", 8], ["NEGOTIATION", 6], ["BOOKING", 3], ["FINANCE_PENDING", 1], ["FINANCE_APPROVED", 2], ["READY_TO_DELIVER", 1], ["WON", 6], ["LOST", 218]] as Array<[Stage, number]>).map(([stage, leads]) => ({ stage, leads }));
    },
  };
}
