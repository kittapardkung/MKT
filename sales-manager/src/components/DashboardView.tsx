"use client";
import type { ExecSummary, Funnel, LeadRow, SalesPerf } from "@/lib/types";
import { STAGE_TH } from "@/lib/format";
import { Empty, Flags, RiskDot, Stat } from "./ui";

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export default function DashboardView({ summary, perf, funnel, leads, leadership }: {
  summary: ExecSummary | null; perf: SalesPerf[]; funnel: Funnel[]; leads: LeadRow[]; leadership: boolean;
}) {
  const max = Math.max(1, ...funnel.map((f) => f.leads));
  const risky = leads.filter((l) => l.risk_level === "HIGH").slice(0, 5);
  return (
    <section className="space-y-5">
      <h1 className="text-xl font-bold">{leadership ? "ภาพรวมการขาย" : "ผลงานของฉัน"}</h1>

      {leadership && summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="ลีดทั้งหมด" value={summary.total_leads} />
          <Stat label="ลีดที่ยังเปิดอยู่" value={summary.active_leads} />
          <Stat label="ยังไม่มีผู้รับผิดชอบ" value={summary.unassigned_leads} tone={summary.unassigned_leads ? "danger" : "ok"} />
          <Stat label="ลีดเสี่ยงสูง" value={summary.leads_at_risk} tone={summary.leads_at_risk ? "danger" : "ok"} />
          <Stat label="เลยกำหนดติดตาม" value={summary.overdue_followups} tone={summary.overdue_followups ? "warn" : "ok"} />
          <Stat label="ติดต่อทันเวลา SLA" value={pct(summary.contact_sla_pct)} />
          <Stat label="จอง/ปิดการขาย" value={summary.booking_or_won} tone="ok" />
          <Stat label="ปัญหาคุณภาพข้อมูล" value={summary.open_dq_issues} tone={summary.open_dq_issues ? "warn" : "ok"} />
        </div>
      )}

      {leadership && (
        <div>
          <h2 className="mb-2 font-semibold">Funnel (ตามสถานะปัจจุบัน)</h2>
          <div className="space-y-1.5 rounded-xl border border-line bg-surface p-3">
            {funnel.map((f) => (
              <div key={f.stage} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-muted">{STAGE_TH[f.stage]}</span>
                <div className="h-5 flex-1 rounded bg-line"><div className="h-5 rounded bg-brand" style={{ width: `${(f.leads / max) * 100}%` }} /></div>
                <span className="num w-10 text-right">{f.leads}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 font-semibold">{leadership ? "ผลงานรายพนักงานขาย" : "ตัวชี้วัดของฉัน"}</h2>
        {perf.length === 0 && <Empty>ยังไม่มีข้อมูล</Empty>}
        <div className="grid gap-3 sm:grid-cols-2">
          {perf.map((p) => (
            <div key={p.code} className="rounded-xl border border-line bg-surface p-3 text-sm">
              <div className="flex items-baseline justify-between"><b>{p.display_name}</b><span className="text-xs text-muted">{p.code}</span></div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {([
                  ["ลีดที่ได้รับ", p.assigned_leads], ["กดรับแล้ว", p.accepted_leads], ["ติดต่อทันเวลา", pct(p.first_response_sla_pct)],
                  ["ติดตามตรงเวลา", pct(p.followup_ontime_pct)], ["งานเลยกำหนด", p.overdue_tasks], ["ไม่มีนัดถัดไป", p.leads_without_next_action],
                  ["อัตรานัดหมาย", pct(p.appointment_rate_pct)], ["อัตราทดลองขับ", pct(p.test_drive_rate_pct)], ["อัตราเสนอราคา", pct(p.quotation_rate_pct)],
                  ["อัตราจอง", pct(p.booking_rate_pct)], ["ปิดการขาย / เสีย", `${p.won} / ${p.lost}`], ["อายุ pipeline (วัน)", p.pipeline_age_days ?? "—"],
                ] as Array<[string, string | number]>).map(([k, v]) => (<div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="num font-medium">{v}</dd></div>))}
              </dl>
              <p className="mt-2 text-xs text-muted">บริบท: ลีด HOT ที่ได้รับ {pct(p.hot_share_pct)} — เปรียบเทียบโดยดูคุณภาพลีดควบคู่กัน</p>
            </div>
          ))}
        </div>
      </div>

      {risky.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">ลีดที่ต้องจับตา</h2>
          <div className="space-y-2">
            {risky.map((l) => (
              <div key={l.lead_id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                <div className="flex items-center justify-between"><b>{l.customer_name ?? l.lead_code}</b><RiskDot r={l.risk_level} /></div>
                <div className="text-xs text-muted">{l.responsible_sales ?? "ยังไม่มอบหมาย"} · {STAGE_TH[l.stage]}</div>
                <Flags flags={l.flags} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
