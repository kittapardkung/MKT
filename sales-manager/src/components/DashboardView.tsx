"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Layers, ListChecks, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ExecSummary, LeadRow, SalesPerf, TodayItem } from "@/lib/types";
import { FLAG_TH } from "@/lib/format";
import { STAGE_GROUPS, countBetween, cumulative, leadsPerDay, modelOf, stageBreakdown } from "@/lib/analytics";
import { AreaChart, Donut, Sparkline } from "./charts";
import { Avatar, Empty, RiskPill } from "./ui";

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const MODEL_ORDER = ["Darion", "Porta", "Bingo", "อื่นๆ / ไม่ระบุ"];

function Kpi({ icon, label, value, sub, dark, spark, tone, onClick }: {
  icon: React.ReactNode; label: string; value: string | number; sub: React.ReactNode; dark?: boolean; spark?: number[]; tone?: "danger"; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`card focus-ring relative min-h-[132px] overflow-hidden p-4 text-left ${dark ? "!bg-dark text-dark-ink" : ""} ${onClick ? "transition hover:-translate-y-0.5" : "cursor-default"}`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${dark ? "bg-white/10 text-accent" : tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-warn"}`}>{icon}</span>
        <span className={`text-sm ${dark ? "text-white/70" : "text-muted"}`}>{label}</span>
      </div>
      <div className="num mt-3 text-3xl font-bold tracking-tight">{value}</div>
      <div className={`mt-1 text-xs ${dark ? "text-white/70" : "text-muted"}`}>{sub}</div>
      {spark && <Sparkline values={spark} className="pointer-events-none absolute bottom-3 right-3 hidden h-10 w-24 opacity-90 sm:block xl:w-28" />}
    </button>
  );
}

export default function DashboardView({ leads, today, summary, perf, leadership, range, onOpen, onGo }: {
  leads: LeadRow[]; today: TodayItem[]; summary: ExecSummary | null; perf: SalesPerf[]; leadership: boolean; range: number;
  onOpen: (id: string) => void; onGo: (tab: "today" | "leads") => void;
}) {
  const [mode, setMode] = useState<"daily" | "cum">("daily");
  const now = useMemo(() => new Date(), []);
  const active = leads.filter((l) => l.stage !== "WON" && l.stage !== "LOST").length;
  const high = leads.filter((l) => l.risk_level === "HIGH").length;
  const overdue = today.filter((t) => t.overdue_minutes > 0).length;

  const daily = useMemo(() => leadsPerDay(leads, range, now), [leads, range, now]);
  const chart = useMemo(() => mode === "daily" ? daily : cumulative(daily, leads.length - daily.reduce((a, d) => a + d.value, 0)), [mode, daily, leads.length]);
  const spark30 = useMemo(() => leadsPerDay(leads, 30, now).map((d) => d.value), [leads, now]);
  const last30 = countBetween(leads, 30, 0, now), prev30 = countBetween(leads, 60, 30, now);
  const delta = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null;
  const stages = useMemo(() => stageBreakdown(leads), [leads]);
  const total = leads.length || 1;

  const models = useMemo(() => {
    const week = now.getTime() - 7 * 86400000;
    return MODEL_ORDER.map((m) => {
      const ls = leads.filter((l) => modelOf(l) === m);
      return { m, n: ls.length, warm: ls.filter((l) => l.temperature === "HOT" || l.temperature === "WARM").length,
        deal: ls.filter((l) => ["BOOKING", "FINANCE_APPROVED", "WON"].includes(l.stage)).length, wk: ls.filter((l) => Date.parse(l.created_at) >= week).length };
    }).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  }, [leads, now]);

  const watch = useMemo(() => leads.filter((l) => l.risk_level === "HIGH").slice(0, 6), [leads]);

  return (
    <section className="space-y-4 lg:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{leadership ? "ภาพรวมการขาย" : "ผลงานของฉัน"}</h1>
        <p className="mt-0.5 text-sm text-muted">ติดตามประสิทธิภาพการขายและลีดแบบเรียลไทม์</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi dark icon={<Layers size={18} />} label="ลีดทั้งหมด" value={leads.length}
          sub={delta === null ? <>ใหม่ {last30} ราย ใน 30 วัน</> : <span className="inline-flex items-center gap-1">{delta >= 0 ? <ArrowUpRight size={13} className="text-green-400" /> : <ArrowDownRight size={13} className="text-red-400" />}{Math.abs(delta)}% จาก 30 วันก่อน</span>} spark={spark30} onClick={() => onGo("leads")} />
        <Kpi icon={<Users size={18} />} label="ลีดที่ยังเปิดอยู่" value={active} sub={`${Math.round((active / total) * 100)}% ของลีดทั้งหมด`} onClick={() => onGo("leads")} />
        <Kpi icon={<ListChecks size={18} />} label="งานเลยกำหนด" value={overdue} tone="danger" sub={`จากงานติดตามทั้งหมด ${today.length} งาน`} onClick={() => onGo("today")} />
        <Kpi icon={<AlertTriangle size={18} />} label="ลีดเสี่ยงสูง" value={high} tone="danger" sub="ต้องตรวจสอบทันที" onClick={() => onGo("leads")} />
      </div>

      {leadership && summary && (
        <div className="card grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-4">
          {([["ติดต่อทันเวลา SLA", pct(summary.contact_sla_pct)], ["จอง / ปิดการขาย", summary.booking_or_won], ["ยังไม่มีผู้รับผิดชอบ", summary.unassigned_leads], ["ปัญหาคุณภาพข้อมูล", summary.open_dq_issues]] as Array<[string, string | number]>).map(([k, v]) => (
            <div key={k}><div className="text-xs text-muted">{k}</div><div className="num text-xl font-bold">{v}</div></div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="card p-4 lg:col-span-2 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">ลีดเข้ารายวัน</h2>
              <p className="text-xs text-muted">{range} วันล่าสุด · ใหม่ {daily.reduce((a, d) => a + d.value, 0)} ลีด</p>
            </div>
            <div className="flex rounded-full bg-bg p-1 text-sm" role="tablist">
              {(["daily", "cum"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                  className={`min-h-9 rounded-full px-4 ${mode === k ? "bg-dark font-semibold text-dark-ink" : "text-muted"}`}>{k === "daily" ? "รายวัน" : "สะสม"}</button>
              ))}
            </div>
          </div>
          <div className="mt-3"><AreaChart data={chart} unit={mode === "daily" ? "ลีดใหม่" : "ลีดสะสม"} /></div>
        </div>

        <div className="card p-4 lg:p-5">
          <h2 className="font-semibold">ลีดตามสถานะ</h2>
          <p className="text-xs text-muted">ตามสถานะปัจจุบัน</p>
          <div className="mt-2"><Donut slices={stages} centerValue={String(leads.length)} centerLabel="ลีดทั้งหมด" /></div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {stages.map((s) => (
              <li key={s.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /><span className="flex-1">{s.label}</span><span className="num font-semibold">{Math.round((s.value / total) * 100)}%</span></li>
            ))}
          </ul>
          <p className="sr-only">{STAGE_GROUPS.length} กลุ่มสถานะ</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="card p-4 lg:p-5">
          <h2 className="font-semibold">รุ่นที่ลูกค้าสนใจ</h2>
          {models.length === 0 ? <p className="mt-3 text-sm text-muted">ยังไม่มีข้อมูล</p> : (
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="pb-2 font-normal">รุ่น</th><th className="pb-2 text-right font-normal">ลีด</th><th className="pb-2 text-right font-normal">อุ่น/ร้อน</th><th className="pb-2 text-right font-normal">จอง/ปิด</th><th className="pb-2 text-right font-normal">7 วัน</th></tr></thead>
              <tbody>{models.map((r) => (
                <tr key={r.m} className="border-t border-line"><td className="py-2.5 font-medium">{r.m}</td><td className="num py-2.5 text-right">{r.n}</td><td className="num py-2.5 text-right">{r.warm}</td><td className="num py-2.5 text-right">{r.deal}</td>
                  <td className="num py-2.5 text-right"><span className={r.wk ? "font-semibold text-ok" : "text-muted"}>{r.wk ? `+${r.wk}` : "0"}</span></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <div className="card p-4 lg:p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">ลีดที่ต้องจับตา</h2><button onClick={() => onGo("leads")} className="min-h-0 text-xs font-semibold text-warn">ดูทั้งหมด →</button></div>
          {watch.length === 0 ? <p className="mt-3 text-sm text-muted">ไม่มีลีดเสี่ยงสูงในตอนนี้</p> : (
            <ul className="mt-2 divide-y divide-line">
              {watch.map((l) => (
                <li key={l.lead_id}><button onClick={() => onOpen(l.lead_id)} className="focus-ring flex min-h-14 w-full items-center gap-3 py-2 text-left">
                  <Avatar name={l.customer_name ?? l.lead_code} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{l.customer_name ?? l.lead_code}</span><span className="block truncate text-xs text-muted">{l.flags.map((f) => FLAG_TH[f] ?? f)[0] ?? l.lead_code}</span></span>
                  <RiskPill r={l.risk_level} />
                </button></li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4 lg:p-5">
          <h2 className="font-semibold">{leadership ? "ผลงานทีมขาย" : "ตัวชี้วัดของฉัน"}</h2>
          {perf.length === 0 ? <p className="mt-3 text-sm text-muted">ยังไม่มีข้อมูล</p> : (
            <ul className="mt-3 space-y-4">
              {perf.map((p) => { const c = p.assigned_leads ? Math.round((p.contacted_leads / p.assigned_leads) * 100) : 0; return (
                <li key={p.code}>
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold">{p.display_name}</span><span className="num text-xs text-muted">{p.assigned_leads} ลีด</span></div>
                  <div className="mt-1.5 h-2 rounded-full bg-bg"><div className="h-2 rounded-full bg-accent" style={{ width: `${c}%` }} /></div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] text-muted">
                    <span>ติดต่อแล้ว <b className="num text-ink">{c}%</b></span><span>SLA <b className="num text-ink">{pct(p.first_response_sla_pct)}</b></span><span>เลยกำหนด <b className={`num ${p.overdue_tasks ? "text-danger" : "text-ink"}`}>{p.overdue_tasks}</b></span>
                  </div>
                </li>); })}
            </ul>
          )}
        </div>
      </div>
      {leads.length === 0 && <Empty>ยังไม่มีลีดในระบบ</Empty>}
    </section>
  );
}
