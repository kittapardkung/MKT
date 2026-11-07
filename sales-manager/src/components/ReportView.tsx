"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AiOverview, AiPerson, LeadRow, Role, ReportQuality, ReportSales, ReportSnapshot, Stage, WeeklyReport } from "@/lib/types";
import { friendlyError, STAGE_TH } from "@/lib/format";
import { Empty } from "./ui";
import { C, ChartCard, PairBars, SimpleBars, StackBars } from "./ReportCharts";
import KanbanView from "./KanbanView";
import InsightsView from "./InsightsView";
import SlaView from "./SlaView";

const n = (v: unknown) => Number(v) || 0;
const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)}%` : "—");
const stamp = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
type Light = "ok" | "warn" | "bad";
const dot: Record<Light, string> = { ok: "bg-ok", warn: "bg-orange-500", bad: "bg-danger" };
type Tab = "overview" | "people" | "risk" | "kanban" | "insights" | "sla";
const STAGE_ORDER = Object.keys(STAGE_TH) as Stage[];


// รายงานรุ่นเก่าเก็บเป็นข้อความก้อนเดียว: แยกตามหัวข้อและเลขข้อ "1)" "2)" ให้อ่านเป็น bullet ได้
function splitSections(text: string, heads: string[]): Record<string, string[]> {
  const re = new RegExp(`(${heads.map((h) => h.replace(/[/]/g, "\\/")).join("|")})\\s*:?`, "g");
  const out: Record<string, string[]> = {};
  const marks = [...text.matchAll(re)];
  marks.forEach((m, i) => {
    const body = text.slice((m.index ?? 0) + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim();
    const items = body.split(/\s*\d+\)\s*|\n\s*[-•]\s*/).map((x) => x.trim()).filter(Boolean);
    out[m[1]] = items.length ? items : body ? [body] : [];
  });
  return out;
}
function legacyOverview(text: string): AiOverview {
  const r = splitSections(text, ["สิ่งที่เห็น", "ต้องตัดสินใจสัปดาห์นี้", "ข้อมูลที่ขาด/น่าสงสัย", "ข้อมูลที่ขาดหรือน่าสงสัย"]);
  const obs = r["สิ่งที่เห็น"] ?? [];
  if (!obs.length && !r["ต้องตัดสินใจสัปดาห์นี้"]) return { headline: text, observations: [], decisions: [], gaps: [] };
  return { headline: "", observations: obs, decisions: (r["ต้องตัดสินใจสัปดาห์นี้"] ?? []).map((a) => ({ action: a, owner: "ผู้จัดการ/เจ้าของ" })), gaps: r["ข้อมูลที่ขาด/น่าสงสัย"] ?? r["ข้อมูลที่ขาดหรือน่าสงสัย"] ?? [] };
}
function legacyPerson(text: string): AiPerson | string {
  const r = splitSections(text, ["เชิงปริมาณ", "เชิงคุณภาพ", "จุดเด่น", "จุดที่ควรพัฒนา", "ข้อเสนอการโค้ช", "ลีดที่ควรติดตามก่อน", "ข้อมูลที่ขาด"]);
  if (!r["เชิงปริมาณ"] && !r["เชิงคุณภาพ"]) return text;
  return { quant: r["เชิงปริมาณ"] ?? [], quality: r["เชิงคุณภาพ"] ?? [], strengths: r["จุดเด่น"] ?? [], improve: r["จุดที่ควรพัฒนา"] ?? [], coaching: r["ข้อเสนอการโค้ช"] ?? [], follow_leads: (r["ลีดที่ควรติดตามก่อน"] ?? []).join(" ").split(/[\s,]+/).filter((x) => /^\d{8}-\d+$/.test(x)) };
}
const asStrs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
function readOverview(s: ReportSnapshot | null): AiOverview | null {
  if (!s) return null;
  const o = s.person_texts?._overview as Partial<AiOverview> | undefined;
  if (o && typeof o === "object") return { headline: String(o.headline ?? ""), observations: asStrs(o.observations), decisions: Array.isArray(o.decisions) ? o.decisions.map((d) => ({ action: String(d.action), owner: String(d.owner) })) : [], gaps: asStrs(o.gaps) };
  return s.overview_text ? legacyOverview(s.overview_text) : null;   // รายงานรุ่นเก่า (ข้อความล้วน) แยกหัวข้อให้อ่านง่าย
}
function readPerson(s: ReportSnapshot | null, code: string): AiPerson | string | null {
  const v = s?.person_texts?.[code];
  if (!v) return null;
  if (typeof v === "string") return legacyPerson(v);
  const o = v as Partial<AiPerson>;
  return { quant: asStrs(o.quant), quality: asStrs(o.quality), strengths: asStrs(o.strengths), improve: asStrs(o.improve), coaching: asStrs(o.coaching), follow_leads: asStrs(o.follow_leads) };
}

function Stat({ label, value, light, hint }: { label: string; value: string | number; light?: Light; hint?: string }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">{light && <span className={`h-2 w-2 rounded-full ${dot[light]}`} aria-hidden="true" />}{label}</div>
      <div className="num mt-1 text-xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function Bullets({ title, items, tone, numbered }: { title: string; items: string[]; tone?: "ok" | "warn"; numbered?: boolean }) {
  if (!items.length) return null;
  const bar = tone === "ok" ? "border-ok" : tone === "warn" ? "border-orange-500" : "border-line";
  const List = numbered ? "ol" : "ul";
  return (
    <section className={`card border-l-4 p-4 ${bar}`}>
      <h4 className="mb-2 text-sm font-bold">{title}</h4>
      <List className={`space-y-1.5 pl-5 text-sm leading-relaxed ${numbered ? "list-decimal" : "list-disc"}`}>{items.map((t, i) => <li key={i}>{t}</li>)}</List>
    </section>
  );
}

function NoAi({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm text-muted">ยังไม่มีบทวิเคราะห์ AI ของรายงานนี้ — กดสร้างได้ (ประมาณ 30 วินาที, ไม่ส่งชื่อ/เบอร์ลูกค้าให้ AI)</p>
      <button onClick={onClick} disabled={busy} className="btn-dark min-h-11 px-4 text-sm disabled:opacity-60">{busy ? "AI กำลังวิเคราะห์…" : "สร้างบทวิเคราะห์ AI"}</button>
    </div>
  );
}

function PersonView({ s, q, ai, teamHours, teamLeads, openLead, leadsByCode, risk }: {
  s: ReportSales; q?: ReportQuality; ai: AiPerson | string | null; teamHours: number | null; teamLeads: number;
  openLead: (id: string) => void; leadsByCode: Map<string, string>; risk: WeeklyReport["risk_leads"];
}) {
  const o = q?.contact_outcomes ?? {};
  const ok = n(o.CONNECTED) + n(o.REPLIED), noans = n(o.NO_ANSWER), msg = n(o.MESSAGE_SENT), wrong = n(o.WRONG_NUMBER);
  const att = ok + noans + msg + wrong;
  const fup = q ? `${n(q.active_with_next_followup)}/${n(q.active_total)}` : "—";
  const aiObj = ai && typeof ai === "object" ? ai : null;
  const mine = risk.filter((r) => r.sales === s.code);
  const chips = (aiObj?.follow_leads?.length ? aiObj.follow_leads : mine.map((r) => r.lead_code)).slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="ลีดใหม่" value={n(s.leads_assigned)} hint={`ช่วงก่อน ${n(s.leads_assigned_prev)} · เฉลี่ยทีม ${teamLeads.toFixed(0)}`} />
        <Stat label="ติดต่อแล้ว / ยังไม่ติดต่อ" value={`${n(s.contacted)} / ${n(s.not_contacted)}`} light={n(s.not_contacted) === 0 ? "ok" : n(s.not_contacted) <= 3 ? "warn" : "bad"} />
        <Stat label="ติดต่อครั้งแรกเฉลี่ย" value={s.avg_hours_to_first_contact === null || s.avg_hours_to_first_contact === undefined ? "—" : `${s.avg_hours_to_first_contact} ชม.`} light={s.avg_hours_to_first_contact == null ? undefined : s.avg_hours_to_first_contact <= 4 ? "ok" : s.avg_hours_to_first_contact <= 8 ? "warn" : "bad"} hint={`ทีม ${teamHours ?? "—"} ชม. · เป้า ≤ 4`} />
        <Stat label="อัตราติดต่อสำเร็จ" value={pct(ok, att)} hint={`สำเร็จ ${ok} จาก ${att} ครั้ง`} />
        <Stat label="งานเลยกำหนด (ใหม่/เก่า)" value={`${n(s.overdue_tasks_new)} / ${n(s.overdue_tasks_legacy)}`} light={n(s.overdue_tasks_new) === 0 ? "ok" : n(s.overdue_tasks_new) <= 5 ? "warn" : "bad"} />
        <Stat label="ตั้งนัดติดตามต่อ" value={fup} hint={q ? pct(n(q.active_with_next_followup), n(q.active_total)) : undefined} />
      </div>

      {q && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="ความเร็วติดต่อครั้งแรก" hint="จำนวนลีดแบ่งตามเวลาตั้งแต่ได้รับมอบหมาย">
            <StackBars rows={[{ name: s.name, segs: [{ label: "≤ 1 ชม.", v: n(q.first_contact_within_1h), color: C.ok }, { label: "1–4 ชม.", v: n(q.first_contact_1_to_4h), color: C.info }, { label: "4–24 ชม.", v: n(q.first_contact_4_to_24h), color: C.warn }, { label: "> 24 ชม.", v: n(q.first_contact_over_24h), color: C.bad }] }]} />
          </ChartCard>
          <ChartCard title="ผลการติดต่อ" hint="จากที่บันทึกในระบบ (ไม่ใช่จำนวนสายจริง)">
            <StackBars rows={[{ name: s.name, segs: [{ label: "สำเร็จ", v: ok, color: C.ok }, { label: "ไม่รับสาย", v: noans, color: C.warn }, { label: "ส่งข้อความ", v: msg, color: C.info }, { label: "เบอร์ผิด", v: wrong, color: C.bad }] }]} />
          </ChartCard>
          <ChartCard title="ระดับความร้อนของลีดที่ดูแล" hint="เฉพาะลีดที่ยังไม่ปิด">
            <StackBars rows={[{ name: s.name, segs: [{ label: "HOT", v: n(q.active_hot), color: C.bad }, { label: "WARM", v: n(q.active_warm), color: C.warn }, { label: "COLD", v: n(q.active_cold), color: C.info }, { label: "ยังไม่ประเมิน", v: n(q.active_temp_unset), color: C.gray }] }]} />
          </ChartCard>
        </div>
      )}

      {typeof ai === "string" && <section className="card p-4"><h4 className="mb-2 text-sm font-bold">บทวิเคราะห์ (รายงานรุ่นเก่า)</h4><p className="whitespace-pre-line text-sm leading-relaxed">{ai}</p></section>}
      {aiObj && (
        <div className="grid gap-4 md:grid-cols-2">
          <Bullets title="เชิงปริมาณ" items={aiObj.quant} />
          <Bullets title="เชิงคุณภาพ" items={aiObj.quality} />
          <Bullets title="จุดเด่น" items={aiObj.strengths} tone="ok" />
          <Bullets title="จุดที่ควรพัฒนา" items={aiObj.improve} tone="warn" />
          <div className="md:col-span-2"><Bullets title="ข้อเสนอการโค้ช (ให้ผู้จัดการพิจารณา)" items={aiObj.coaching} numbered /></div>
        </div>
      )}
      {!ai && <p className="text-xs text-muted">ยังไม่มีบทวิเคราะห์ AI ของเซลล์คนนี้ในรายงานที่เลือก</p>}

      <section className="card p-4">
        <h4 className="mb-2 text-sm font-bold">ลีดที่ควรติดตามก่อน</h4>
        {chips.length ? (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => { const id = leadsByCode.get(c); return id
              ? <button key={c} onClick={() => openLead(id)} className="num focus-ring min-h-9 rounded-full border border-line px-3 text-xs hover:bg-bg">{c}</button>
              : <span key={c} className="num rounded-full border border-line px-3 py-1.5 text-xs text-muted">{c}</span>; })}
          </div>
        ) : <p className="text-sm text-muted">ไม่มี</p>}
      </section>

      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">ตัวเลขทั้งหมดของ {s.name}</summary>
        <dl className="mt-3 grid gap-x-8 gap-y-1 md:grid-cols-2">
          {([
            ["ลีดใหม่ / ช่วงก่อน", `${n(s.leads_assigned)} / ${n(s.leads_assigned_prev)}`], ["ลีด HOT ที่ได้รับ", n(s.hot_leads_assigned)],
            ["บันทึกผลติดต่อ / ช่วงก่อน", `${n(s.contact_logs)} / ${n(s.contact_logs_prev)}`], ["งานเลยกำหนด ลีดใหม่ / ลีดเก่า", `${n(s.overdue_tasks_new)} / ${n(s.overdue_tasks_legacy)}`],
            ["จอง / เสียโอกาสในช่วง", `${n(s.bookings_reported)} / ${n(s.lost_in_period)}`], ["ลีดที่กำลังดูแล", n(s.active_leads)],
            ["วันที่ทำงานต่อเนื่อง", q ? `${n(q.active_days)} วัน` : "—"], ["ตอบแจ้งเตือนผ่าน Telegram", q ? n(q.telegram_replies) : "—"],
            ["เลื่อนถึงนัด/เสนอราคาขึ้นไป", q ? `${n(q.assigned_now_advanced)}/${n(s.leads_assigned)}` : "—"], ["เปลี่ยนสถานะ", q ? n(q.stage_changes) : "—"],
            ["รุ่นที่ลูกค้าสนใจ", q?.models_requested?.length ? q.models_requested.map((m) => `${m.model} ${m.n}`).join(", ") : "—"],
          ] as Array<[string, string | number]>).map(([k, v]) => (<div key={k} className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-muted">{k}</dt><dd className="num text-right font-medium">{v}</dd></div>))}
        </dl>
      </details>
    </div>
  );
}

export default function ReportView({ leads, onOpen, onChanged, role }: { leads: LeadRow[]; onOpen: (leadId: string) => void; onChanged: () => Promise<void>; role: Role }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [snaps, setSnaps] = useState<ReportSnapshot[]>([]);
  const [sel, setSel] = useState<number | "live">("live");
  const [days, setDays] = useState(7);
  const [live, setLive] = useState<WeeklyReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([api.reportSnapshots(), api.weeklyReport(days)])
      .then(([ss, lv]) => { if (alive) { setSnaps(ss); setLive(lv); setErr(null); } })
      .catch((e) => { if (alive) setErr(friendlyError(e instanceof Error ? e.message : String(e))); });
    return () => { alive = false; };
  }, [days, tick]);

  const analyze = async () => {
    setAiBusy(true); setAiMsg(null); setErr(null);
    try {
      const { snapshot, cached } = await api.analyzeReport(days);
      setSnaps((cur) => [snapshot, ...cur.filter((x) => x.id !== snapshot.id)]);
      setSel(snapshot.id);
      if (cached) setAiMsg("เพิ่งสร้างไปไม่ถึง 10 นาที จึงแสดงบทวิเคราะห์เดิม");
    } catch (e) { setErr(friendlyError(e instanceof Error ? e.message : String(e))); }
    finally { setAiBusy(false); }
  };

  const snap = sel === "live" ? null : snaps.find((x) => x.id === sel) ?? null;
  const aiSrc = snap ?? snaps[0] ?? null;
  const report: WeeklyReport | null = snap ? snap.report : live;
  const S = useMemo(() => report?.sales ?? [], [report]);
  const Q = useMemo(() => report?.sales_quality ?? [], [report]);
  const ov = readOverview(aiSrc);
  const byCode = useMemo(() => new Map(leads.map((l) => [l.lead_code, l.lead_id])), [leads]);

  const sum = (k: keyof ReportSales) => S.reduce((a, x) => a + n(x[k]), 0);
  const hrs = S.map((x) => x.avg_hours_to_first_contact).filter((x): x is number => x !== null && x !== undefined);
  const avgH = hrs.length ? +(hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : null;
  const newLeads = sum("leads_assigned"), prevLeads = sum("leads_assigned_prev"), notCont = sum("not_contacted");
  const ovNew = sum("overdue_tasks_new"), ovOld = sum("overdue_tasks_legacy");
  const unassigned = n(report?.unassigned_leads);
  const teamLeads = S.length ? newLeads / S.length : 0;
  const cur = S.find((x) => x.code === who) ?? S[0];

  const outcomes = (q?: ReportQuality) => { const o = q?.contact_outcomes ?? {}; return { ok: n(o.CONNECTED) + n(o.REPLIED), no: n(o.NO_ANSWER), msg: n(o.MESSAGE_SENT), wrong: n(o.WRONG_NUMBER) }; };
  const tabs: Array<[Tab, string]> = [["overview", "ภาพรวม"], ["people", "รายคน"], ["risk", `ลีดเสี่ยง${report?.risk_leads?.length ? ` (${report.risk_leads.length})` : ""}`], ["kanban", "Pipeline Kanban"], ["insights", "AI Insights"], ["sla", "ตั้งค่า SLA"]];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">รายงานสรุปฝ่ายขาย</h1>
          <p className="mt-0.5 text-sm text-muted">เห็นได้เฉพาะผู้จัดการและผู้บริหาร · ไม่ส่งชื่อ/เบอร์ลูกค้าให้ AI</p>
        </div>
        {tab !== "kanban" && tab !== "sla" && <div className="flex flex-wrap gap-2">
          {snaps.length > 0 && (
            <label className="card flex min-h-11 items-center px-3 text-sm"><span className="sr-only">เลือกรายงาน</span>
              <select value={String(sel)} onChange={(e) => setSel(e.target.value === "live" ? "live" : Number(e.target.value))} className="min-h-11 bg-transparent outline-none">
                <option value="live">ตัวเลขล่าสุดตอนนี้</option>
                {snaps.map((x) => <option key={x.id} value={x.id}>รายงาน {stamp(x.generated_at)} ({x.period_days} วัน)</option>)}
              </select>
            </label>
          )}
          {sel === "live" && (
            <label className="card flex min-h-11 items-center px-3 text-sm"><span className="sr-only">ช่วงเวลา</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="min-h-11 bg-transparent outline-none">
                <option value={7}>7 วันล่าสุด</option><option value={14}>14 วันล่าสุด</option><option value={30}>30 วันล่าสุด</option>
              </select>
            </label>
          )}
          <button onClick={() => setTick((t) => t + 1)} className="card focus-ring min-h-11 px-4 text-sm">รีเฟรช</button>
          <button onClick={() => void analyze()} disabled={aiBusy} className="btn-dark min-h-11 px-4 text-sm disabled:opacity-60">{aiBusy ? "AI กำลังวิเคราะห์… (~30 วินาที)" : "สร้างบทวิเคราะห์ AI"}</button>
        </div>}
      </div>

      <div role="tablist" aria-label="หมวดรายงาน" className="flex gap-1 overflow-x-auto rounded-2xl bg-line p-1">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`focus-ring min-h-10 shrink-0 rounded-xl px-4 text-sm ${tab === k ? "bg-surface font-bold shadow-sm" : "text-muted"}`}>{label}</button>
        ))}
      </div>

      {aiMsg && <div className="rounded-xl bg-warn-soft p-3 text-sm text-warn">{aiMsg}</div>}
      {err && <div role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">โหลดรายงานไม่สำเร็จ: {err}</div>}

      {tab === "kanban" && <KanbanView leads={leads} onOpen={onOpen} onChanged={onChanged} />}
      {tab === "insights" && <InsightsView leads={leads} snaps={snaps} onOpen={onOpen} />}
      {tab === "sla" && <SlaView role={role} />}

      {["overview", "people", "risk"].includes(tab) && !report && !err && <Empty>กำลังโหลดรายงาน…</Empty>}

      {report && tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="ลีดใหม่" value={newLeads} light={newLeads > 0 ? "ok" : "warn"} hint={prevLeads ? `${newLeads >= prevLeads ? "▲" : "▼"} ${Math.abs(Math.round(((newLeads - prevLeads) * 100) / prevLeads))}% จากช่วงก่อน` : "ไม่มีช่วงก่อนเทียบ"} />
            <Stat label="ติดต่อครั้งแรกเฉลี่ย" value={avgH === null ? "—" : `${avgH} ชม.`} light={avgH === null ? undefined : avgH <= 4 ? "ok" : avgH <= 8 ? "warn" : "bad"} hint="เป้า ≤ 4 ชม." />
            <Stat label="ยังไม่ได้ติดต่อ" value={notCont} light={notCont === 0 ? "ok" : notCont <= 3 ? "warn" : "bad"} />
            <Stat label="งานเลยกำหนด (ลีดใหม่)" value={ovNew} light={ovNew === 0 ? "ok" : ovNew <= 5 ? "warn" : "bad"} hint={`ลีดเก่าก่อน 3 พ.ย. แยกนับ ${ovOld}`} />
            <Stat label="ลีดไม่มีผู้ดูแล" value={unassigned} light={unassigned === 0 ? "ok" : "bad"} />
            <Stat label="จอง" value={sum("bookings_reported")} />
          </div>

          {ov ? (
            <div className="space-y-4">
              {ov.headline && <div className="card border-l-4 border-accent p-4"><div className="text-xs font-semibold uppercase tracking-wide text-muted">สรุปสถานการณ์ · รายงาน {aiSrc ? stamp(aiSrc.generated_at) : ""}</div><p className="mt-1 text-base font-semibold leading-snug">{ov.headline}</p></div>}
              <div className="grid gap-4 md:grid-cols-2">
                <Bullets title="สิ่งที่เห็น" items={ov.observations} />
                {!!ov.decisions.length && (
                  <section className="card border-l-4 border-orange-500 p-4">
                    <h4 className="mb-2 text-sm font-bold">ต้องตัดสินใจสัปดาห์นี้</h4>
                    <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                      {ov.decisions.map((d, i) => (<li key={i}>{d.action} <span className="ml-1 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-warn">{d.owner}</span></li>))}
                    </ol>
                  </section>
                )}
                {!!ov.gaps.length && <div className="md:col-span-2"><Bullets title="ข้อมูลที่ขาดหรือน่าสงสัย" items={ov.gaps} /></div>}
              </div>
            </div>
          ) : <NoAi onClick={() => void analyze()} busy={aiBusy} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="ลีดใหม่ต่อคน เทียบช่วงก่อนหน้า"><PairBars aLabel="ช่วงนี้" bLabel="ช่วงก่อน" rows={S.map((x) => ({ name: x.name, a: n(x.leads_assigned), b: n(x.leads_assigned_prev) }))} /></ChartCard>
            <ChartCard title="ความเร็วติดต่อครั้งแรก" hint="จำนวนลีดแบ่งตามเวลาตั้งแต่ได้รับมอบหมาย (เป้า ≤ 4 ชม.)">
              <StackBars rows={S.map((x) => { const q = Q.find((y) => y.code === x.code); return { name: x.name, segs: [{ label: "≤ 1 ชม.", v: n(q?.first_contact_within_1h), color: C.ok }, { label: "1–4 ชม.", v: n(q?.first_contact_1_to_4h), color: C.info }, { label: "4–24 ชม.", v: n(q?.first_contact_4_to_24h), color: C.warn }, { label: "> 24 ชม.", v: n(q?.first_contact_over_24h), color: C.bad }] }; })} />
            </ChartCard>
            <ChartCard title="ผลการติดต่อ" hint="จากที่บันทึกในระบบ (ไม่ใช่จำนวนสายจริง)">
              <StackBars rows={S.map((x) => { const o = outcomes(Q.find((y) => y.code === x.code)); return { name: x.name, segs: [{ label: "สำเร็จ", v: o.ok, color: C.ok }, { label: "ไม่รับสาย", v: o.no, color: C.warn }, { label: "ส่งข้อความ", v: o.msg, color: C.info }, { label: "เบอร์ผิด", v: o.wrong, color: C.bad }] }; })} />
            </ChartCard>
            <ChartCard title="ระดับความร้อนของลีดที่ดูแล" hint="เฉพาะลีดที่ยังไม่ปิด">
              <StackBars rows={S.map((x) => { const q = Q.find((y) => y.code === x.code); return { name: x.name, segs: [{ label: "HOT", v: n(q?.active_hot), color: C.bad }, { label: "WARM", v: n(q?.active_warm), color: C.warn }, { label: "COLD", v: n(q?.active_cold), color: C.info }, { label: "ยังไม่ประเมิน", v: n(q?.active_temp_unset), color: C.gray }] }; })} />
            </ChartCard>
            {!!report.leads_by_source?.length && <ChartCard title="แหล่งที่มาของลีด"><PairBars aLabel="ช่วงนี้" bLabel="ช่วงก่อน" rows={report.leads_by_source.map((x) => ({ name: x.source, a: n(x.this_period), b: n(x.previous_period) }))} /></ChartCard>}
            {!!report.funnel_now?.length && (
              <ChartCard title="ท่อขายตอนนี้" hint="จำนวนลีดแยกตามสถานะ">
                <SimpleBars rows={[...report.funnel_now].sort((a, b) => STAGE_ORDER.indexOf(a.stage as Stage) - STAGE_ORDER.indexOf(b.stage as Stage)).map((x) => ({ name: STAGE_TH[x.stage as Stage] ?? x.stage, v: n(x.leads) }))} />
              </ChartCard>
            )}
          </div>
          <p className="text-[11px] text-muted">ตัวเลขบันทึกผลติดต่อคือที่บันทึกในระบบ ไม่ใช่จำนวนสายที่โทรจริง · ข้อมูลก่อน 3 พ.ย. 2026 มาจาก Google Sheet เดิม · ใช้ประกอบการโค้ช ไม่ควรตัดสินคนจากตัวเลขเดียว</p>
        </div>
      )}

      {report && tab === "people" && (
        <div className="space-y-4">
          {S.length > 1 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="เลือกเซลล์">
              {S.map((x) => (<button key={x.code} role="tab" aria-selected={cur?.code === x.code} onClick={() => setWho(x.code)} className={`focus-ring min-h-10 rounded-full border px-4 text-sm ${cur?.code === x.code ? "border-ink bg-ink font-bold text-dark-ink" : "border-line bg-surface"}`}>{x.name} <span className="text-xs opacity-70">{x.code}</span></button>))}
            </div>
          )}
          {cur ? (<>
            <h2 className="text-lg font-bold">{cur.name} <span className="text-sm font-normal text-muted">{cur.code}</span></h2>
            <PersonView s={cur} q={Q.find((x) => x.code === cur.code)} ai={readPerson(aiSrc, cur.code)} teamHours={avgH} teamLeads={teamLeads} openLead={onOpen} leadsByCode={byCode} risk={report.risk_leads ?? []} />
            {!ov && <NoAi onClick={() => void analyze()} busy={aiBusy} />}
          </>) : <Empty>ไม่มีข้อมูลเซลล์ในช่วงนี้</Empty>}
        </div>
      )}

      {report && tab === "risk" && (
        <div className="space-y-4">
          {report.risk_leads?.length ? (
            [...new Set(report.risk_leads.map((r) => r.sales ?? "ไม่มีผู้ดูแล"))].map((owner) => (
              <section key={owner} className="card p-4">
                <h3 className="mb-2 text-sm font-bold">{owner} <span className="font-normal text-muted">· {report.risk_leads.filter((r) => (r.sales ?? "ไม่มีผู้ดูแล") === owner).length} ราย</span></h3>
                <ul className="divide-y divide-line text-sm">
                  {report.risk_leads.filter((r) => (r.sales ?? "ไม่มีผู้ดูแล") === owner).map((r) => {
                    const id = byCode.get(r.lead_code);
                    const hot = r.reason === "HOT_OVERDUE";
                    return (
                      <li key={r.lead_code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="num font-medium">{r.lead_code}</span>
                        <span className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${hot ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>{hot ? "HOT เลยกำหนดติดตาม" : "ยังไม่ติดต่อเกิน 4 ชม."}</span>
                          {id && <button onClick={() => onOpen(id)} className="focus-ring min-h-9 rounded-lg border border-line px-3 text-xs">เปิดลีด</button>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          ) : <Empty>ไม่มีลีดเสี่ยงในขณะนี้</Empty>}
        </div>
      )}
    </section>
  );
}
