"use client";
import { useMemo, useState } from "react";
import type { LeadRow, ReportSnapshot, Stage } from "@/lib/types";
import { fmtDateTime, FLAG_TH, STAGE_TH } from "@/lib/format";
import { RiskPill, TempChip } from "./ui";
import { C, ChartCard, SimpleBars } from "./ReportCharts";

const DONE: Stage[] = ["WON", "LOST", "BOOKING", "FINANCE_PENDING", "FINANCE_APPROVED", "READY_TO_DELIVER"];
const n = (v: unknown) => Number(v) || 0;
const day = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" }).format(new Date(iso));

type Scored = { l: LeadRow; score: number; why: string[] };

// ให้คะแนนลีดที่ควรตามก่อน ด้วยกติกาตายตัว (ไม่ใช้ AI, ไม่ส่งข้อมูลลูกค้าออกนอกระบบ)
function score(l: LeadRow, now: number): Scored {
  let s = 0; const why: string[] = [];
  if (l.risk_level === "HIGH") { s += 4; why.push("ความเสี่ยงสูง"); } else if (l.risk_level === "MEDIUM") s += 2;
  if (l.temperature === "HOT") { s += 3; why.push("ลีด HOT"); } else if (l.temperature === "WARM") s += 1;
  if (!l.first_contact_at) { s += 3; why.push("ยังไม่ติดต่อครั้งแรก"); }
  if (l.task_due_at && new Date(l.task_due_at).getTime() < now) { s += 2; why.push("งานเลยกำหนด"); }
  if (["APPOINTMENT", "TEST_DRIVE", "QUOTATION", "NEGOTIATION"].includes(l.stage)) { s += 2; why.push(`ใกล้ปิด (${STAGE_TH[l.stage]})`); }
  if (l.last_customer_message_at && (!l.last_contact_at || l.last_customer_message_at > l.last_contact_at)) { s += 2; why.push("ลูกค้าทักล่าสุด ยังไม่ได้ตอบ"); }
  for (const f of l.flags) if (FLAG_TH[f] && !why.includes(FLAG_TH[f])) { s += 1; why.push(FLAG_TH[f]); }
  return { l, score: s, why };
}

export default function InsightsView({ leads, snaps, onOpen }: { leads: LeadRow[]; snaps: ReportSnapshot[]; onOpen: (id: string) => void }) {
  const [now] = useState(() => Date.now());
  const queue = useMemo(() => {
    return leads.filter((l) => !l.dormant && !DONE.includes(l.stage)).map((l) => score(l, now)).filter((x) => x.score >= 5).sort((a, b) => b.score - a.score).slice(0, 15);
  }, [leads, now]);

  // แนวโน้มจากรายงานที่บันทึกไว้ (เทียบเฉพาะรายงานที่ช่วงวันเท่ากับรายงานล่าสุด)
  const series = useMemo(() => {
    const base = snaps[0]?.period_days;
    return snaps.filter((s) => s.period_days === base).slice(0, 8).reverse().map((s) => {
      const S = s.report.sales ?? [];
      const hrs = S.map((x) => x.avg_hours_to_first_contact).filter((x): x is number => x != null);
      return { label: day(s.generated_at), leads: S.reduce((a, x) => a + n(x.leads_assigned), 0), notContacted: S.reduce((a, x) => a + n(x.not_contacted), 0), overdue: S.reduce((a, x) => a + n(x.overdue_tasks_new), 0), hours: hrs.length ? +(hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : 0 };
    });
  }, [snaps]);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h3 className="text-sm font-bold">ลีดที่ควรตามก่อน (จัดอันดับอัตโนมัติ)</h3>
        <p className="mb-3 mt-0.5 text-[11px] text-muted">คิดคะแนนจากความเสี่ยง ระดับความร้อน การติดต่อครั้งแรก งานเลยกำหนด สถานะใกล้ปิด และลูกค้าที่ทักล่าสุดแต่ยังไม่ได้ตอบ — คำนวณในแอปจากข้อมูลปัจจุบัน ไม่ส่งข้อมูลลูกค้าให้ AI</p>
        {queue.length ? (
          <ol className="divide-y divide-line">
            {queue.map(({ l, score: sc, why }, i) => (
              <li key={l.lead_id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-warn">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="num font-semibold">{l.lead_code}</span><TempChip t={l.temperature} /><RiskPill r={l.risk_level} /><span className="text-xs text-muted">{STAGE_TH[l.stage]} · {l.responsible_sales ?? "ไม่มีผู้ดูแล"}</span></div>
                  <div className="mt-1 flex flex-wrap gap-1">{why.map((w) => <span key={w} className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn">{w}</span>)}</div>
                </div>
                <span className="hidden text-[11px] text-muted sm:block">{l.next_follow_up_at ? `นัด ${fmtDateTime(l.next_follow_up_at)}` : "ไม่มีนัด"}</span>
                <span className="num text-xs text-muted" title="คะแนนความเร่งด่วน">{sc} คะแนน</span>
                <button onClick={() => onOpen(l.lead_id)} className="focus-ring min-h-9 rounded-lg border border-line px-3 text-xs">เปิดลีด</button>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-muted">ไม่มีลีดที่เร่งด่วนในขณะนี้</p>}
      </section>

      {series.length >= 2 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="ลีดใหม่ในแต่ละรอบรายงาน" hint={`รอบละ ${snaps[0].period_days} วัน`}><SimpleBars rows={series.map((x) => ({ name: x.label, v: x.leads }))} /></ChartCard>
          <ChartCard title="เวลาติดต่อครั้งแรกเฉลี่ย (ชม.)" hint="เป้า ≤ 4 ชม. — ยิ่งต่ำยิ่งดี"><SimpleBars color={C.warn} rows={series.map((x) => ({ name: x.label, v: x.hours }))} /></ChartCard>
          <ChartCard title="ลีดที่ยังไม่ได้ติดต่อ"><SimpleBars color={C.bad} rows={series.map((x) => ({ name: x.label, v: x.notContacted }))} /></ChartCard>
          <ChartCard title="งานเลยกำหนด (ลีดใหม่)"><SimpleBars color={C.bad} rows={series.map((x) => ({ name: x.label, v: x.overdue }))} /></ChartCard>
        </div>
      ) : (
        <section className="card p-4 text-sm text-muted">แนวโน้มรายสัปดาห์จะแสดงเมื่อมีรายงานที่สร้างไว้อย่างน้อย 2 รอบ (ช่วงวันเท่ากัน) — ตอนนี้มี {snaps.length} รอบ กด “สร้างบทวิเคราะห์ AI” ทุกสัปดาห์เพื่อสะสมข้อมูล</section>
      )}
    </div>
  );
}
