"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { LeadRow, ReportQuality, ReportSales, ReportSnapshot, WeeklyReport } from "@/lib/types";
import { friendlyError } from "@/lib/format";
import { Empty } from "./ui";

const n = (v: unknown) => Number(v) || 0;
const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)}%` : "—");
const stamp = (iso: string) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
type Light = "ok" | "warn" | "bad";
const lightCls: Record<Light, string> = { ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", bad: "bg-danger-soft text-danger" };
const lightDot: Record<Light, string> = { ok: "bg-ok", warn: "bg-orange-500", bad: "bg-danger" };

function Stat({ label, value, light, hint }: { label: string; value: string | number; light?: Light; hint?: string }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">{light && <span className={`h-2 w-2 rounded-full ${lightDot[light]}`} aria-hidden="true" />}{label}</div>
      <div className="num mt-1 text-xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 py-1 text-sm"><span className="text-muted">{k}</span><span className="num text-right font-medium">{v}</span></div>;
}

function PersonCard({ s, q, text, teamAvg }: { s: ReportSales; q?: ReportQuality; text?: string; teamAvg: { leads: number; hours: number | null } }) {
  const o = q?.contact_outcomes ?? {};
  const ok = n(o.CONNECTED) + n(o.REPLIED), noans = n(o.NO_ANSWER), msg = n(o.MESSAGE_SENT), wrong = n(o.WRONG_NUMBER);
  const att = ok + noans + msg + wrong;
  const fcTotal = q ? n(q.first_contact_within_1h) + n(q.first_contact_1_to_4h) + n(q.first_contact_4_to_24h) + n(q.first_contact_over_24h) : 0;
  return (
    <article className="card space-y-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold">{s.name} <span className="text-sm font-normal text-muted">{s.code}</span></h3>
        <span className="num rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-warn">ลีดใหม่ {n(s.leads_assigned)}</span>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">เชิงปริมาณ</div>
          <Row k="ลีดใหม่ (ช่วงก่อน / เฉลี่ยทีม)" v={`${n(s.leads_assigned)} (${n(s.leads_assigned_prev)} / ${teamAvg.leads.toFixed(0)})`} />
          <Row k="ติดต่อแล้ว / ยังไม่ติดต่อ" v={`${n(s.contacted)} / ${n(s.not_contacted)}`} />
          <Row k="ลีด HOT ที่ได้รับ" v={n(s.hot_leads_assigned)} />
          <Row k="บันทึกผลติดต่อ (ช่วงก่อน)" v={`${n(s.contact_logs)} (${n(s.contact_logs_prev)})`} />
          <Row k="งานเลยกำหนด ลีดใหม่ / ลีดเก่า" v={`${n(s.overdue_tasks_new)} / ${n(s.overdue_tasks_legacy)}`} />
          <Row k="จอง / เสียโอกาสในช่วง" v={`${n(s.bookings_reported)} / ${n(s.lost_in_period)}`} />
          <Row k="ติดต่อครั้งแรกเฉลี่ย (ทีม)" v={`${s.avg_hours_to_first_contact ?? "—"} ชม. (${teamAvg.hours ?? "—"})`} />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">เชิงคุณภาพ (พฤติกรรมในระบบ)</div>
          {q ? (<>
            <Row k="ติดต่อครั้งแรก ≤1 / 1–4 / 4–24 / >24 ชม." v={`${n(q.first_contact_within_1h)} / ${n(q.first_contact_1_to_4h)} / ${n(q.first_contact_4_to_24h)} / ${n(q.first_contact_over_24h)}`} />
            <Row k="ติดต่อสำเร็จ / ไม่รับสาย / ข้อความ / เบอร์ผิด" v={`${ok} / ${noans} / ${msg} / ${wrong}`} />
            <Row k="อัตราติดต่อสำเร็จ" v={pct(ok, att)} />
            <Row k="วันที่ทำงานต่อเนื่อง" v={`${n(q.active_days)} วัน`} />
            <Row k="ตั้งนัดติดตามต่อ" v={`${n(q.active_with_next_followup)}/${n(q.active_total)} (${pct(n(q.active_with_next_followup), n(q.active_total))})`} />
            <Row k="เลื่อนถึงนัด/เสนอราคาขึ้นไป" v={`${n(q.assigned_now_advanced)}/${n(s.leads_assigned)}`} />
            <Row k="HOT / WARM / COLD / ยังไม่ประเมิน" v={`${n(q.active_hot)} / ${n(q.active_warm)} / ${n(q.active_cold)} / ${n(q.active_temp_unset)}`} />
            {!!q.models_requested?.length && <Row k="รุ่นที่สนใจ" v={q.models_requested.map((m) => `${m.model} ${m.n}`).join(", ")} />}
            {fcTotal === 0 && <p className="mt-1 text-[11px] text-muted">ยังไม่มีข้อมูลเวลาติดต่อครั้งแรกในช่วงนี้</p>}
          </>) : <p className="text-sm text-muted">ไม่มีข้อมูลเชิงคุณภาพ</p>}
        </div>
      </div>
      {text && (
        <div className="rounded-xl bg-bg p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">บทวิเคราะห์และข้อเสนอโค้ช (AI — ผู้จัดการพิจารณา)</div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>
        </div>
      )}
    </article>
  );
}

export default function ReportView({ leads, onOpen }: { leads: LeadRow[]; onOpen: (leadId: string) => void }) {
  const [snaps, setSnaps] = useState<ReportSnapshot[]>([]);
  const [sel, setSel] = useState<number | "live">("live");
  const [days, setDays] = useState(7);
  const [live, setLive] = useState<WeeklyReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const [ss, lv] = await Promise.all([api.reportSnapshots(), api.weeklyReport(days)]);
      setSnaps(ss); setLive(lv);
    } catch (e) { setErr(friendlyError(e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  }, [days]);
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
  useEffect(() => {
    let alive = true;
    Promise.all([api.reportSnapshots(), api.weeklyReport(days)])
      .then(([ss, lv]) => { if (alive) { setSnaps(ss); setLive(lv); setErr(null); } })
      .catch((e) => { if (alive) setErr(friendlyError(e instanceof Error ? e.message : String(e))); });
    return () => { alive = false; };
  }, [days]);

  const snap = sel === "live" ? null : snaps.find((x) => x.id === sel) ?? null;
  const latest = snaps[0] ?? null;
  const report: WeeklyReport | null = snap ? snap.report : live;
  // บทวิเคราะห์ AI: ของรอบที่เลือก; ถ้าดูตัวเลขสดแสดงบทวิเคราะห์รอบล่าสุดพร้อมวันที่กำกับ
  const aiSrc = snap ?? latest;
  const S = report?.sales ?? [];
  const Q = report?.sales_quality ?? [];

  const sum = (k: keyof ReportSales) => S.reduce((a, x) => a + n(x[k]), 0);
  const hrs = S.map((x) => x.avg_hours_to_first_contact).filter((x): x is number => x !== null && x !== undefined);
  const avgH = hrs.length ? +(hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : null;
  const newLeads = sum("leads_assigned"), prevLeads = sum("leads_assigned_prev"), notCont = sum("not_contacted");
  const ovNew = sum("overdue_tasks_new"), ovOld = sum("overdue_tasks_legacy");
  const unassigned = n(report?.unassigned_leads);
  const teamAvg = { leads: S.length ? newLeads / S.length : 0, hours: avgH };
  const byCode = useMemo(() => new Map(leads.map((l) => [l.lead_code, l.lead_id])), [leads]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">รายงานสรุปฝ่ายขาย</h1>
          <p className="mt-0.5 text-sm text-muted">ตัวเลขรวมและรายคน เชิงปริมาณ + เชิงคุณภาพ · ไม่ส่งชื่อ/เบอร์ลูกค้าให้ AI · เห็นได้เฉพาะผู้จัดการและผู้บริหาร</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {snaps.length > 0 && <label className="card flex min-h-11 items-center px-3 text-sm"><span className="sr-only">รายงาน</span>
            <select value={String(sel)} onChange={(e) => setSel(e.target.value === "live" ? "live" : Number(e.target.value))} className="min-h-11 bg-transparent outline-none">
              <option value="live">ตัวเลขล่าสุดตอนนี้</option>
              {snaps.map((x) => <option key={x.id} value={x.id}>รายงาน {stamp(x.generated_at)} ({x.period_days} วัน)</option>)}
            </select>
          </label>}
          {sel === "live" && (
            <label className="card flex min-h-11 items-center px-3 text-sm"><span className="sr-only">ช่วงเวลา</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="min-h-11 bg-transparent outline-none">
                <option value={7}>7 วันล่าสุด</option><option value={14}>14 วันล่าสุด</option><option value={30}>30 วันล่าสุด</option>
              </select>
            </label>
          )}
          <button onClick={() => void load()} className="card focus-ring min-h-11 px-4 text-sm" disabled={busy}>{busy ? "กำลังโหลด…" : "รีเฟรช"}</button>
          <button onClick={() => void analyze()} className="btn-dark min-h-11 px-4 text-sm disabled:opacity-60" disabled={aiBusy}>{aiBusy ? "AI กำลังวิเคราะห์… (ราว 30 วินาที)" : "สร้างบทวิเคราะห์ AI"}</button>
        </div>
      </div>

      {aiMsg && <div className="rounded-xl bg-warn-soft p-3 text-sm text-warn">{aiMsg}</div>}
      {err && <div role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">โหลดรายงานไม่สำเร็จ: {err}</div>}
      {!report && !err && !busy && <Empty>ยังไม่มีข้อมูลรายงาน</Empty>}

      {report && (<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="ลีดใหม่" value={newLeads} light={newLeads > 0 ? "ok" : "warn"} hint={prevLeads ? `${newLeads >= prevLeads ? "▲" : "▼"} ${Math.abs(Math.round(((newLeads - prevLeads) * 100) / prevLeads))}% จากช่วงก่อน` : "ไม่มีช่วงก่อนเทียบ"} />
          <Stat label="ติดต่อครั้งแรกเฉลี่ย" value={avgH === null ? "—" : `${avgH} ชม.`} light={avgH === null ? undefined : avgH <= 4 ? "ok" : avgH <= 8 ? "warn" : "bad"} hint="เป้า ≤ 4 ชม." />
          <Stat label="ยังไม่ได้ติดต่อ" value={notCont} light={notCont === 0 ? "ok" : notCont <= 3 ? "warn" : "bad"} />
          <Stat label="งานเลยกำหนด (ลีดใหม่)" value={ovNew} light={ovNew === 0 ? "ok" : ovNew <= 5 ? "warn" : "bad"} hint={`ลีดเก่าก่อน 3 พ.ย. แยกนับ ${ovOld}`} />
          <Stat label="ลีดไม่มีผู้ดูแล" value={unassigned} light={unassigned === 0 ? "ok" : "bad"} />
          <Stat label="จอง" value={sum("bookings_reported")} />
        </div>

        {!aiSrc?.overview_text && <p className="text-xs text-muted">ยังไม่มีบทวิเคราะห์ AI — กด “สร้างบทวิเคราะห์ AI” (ใช้เวลาประมาณ 30 วินาที ไม่ส่งชื่อ/เบอร์ลูกค้าให้ AI)</p>}
        {aiSrc?.overview_text && (
          <div className="card p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">ภาพรวมจาก AI · รายงาน {stamp(aiSrc.generated_at)}</div>
            <p className="whitespace-pre-line text-sm leading-relaxed">{aiSrc.overview_text}</p>
          </div>
        )}

        <div className="space-y-3">
          {S.map((s) => <PersonCard key={s.code} s={s} q={Q.find((x) => x.code === s.code)} text={aiSrc?.person_texts?.[s.code]} teamAvg={teamAvg} />)}
          {!S.length && <Empty>ไม่มีข้อมูลเซลล์ในช่วงนี้</Empty>}
        </div>

        <div className="card p-4">
          <h2 className="mb-2 text-sm font-bold">ลีดเสี่ยงที่ควรดูแลก่อน</h2>
          {report.risk_leads?.length ? (
            <ul className="divide-y divide-line text-sm">
              {report.risk_leads.map((r) => {
                const id = byCode.get(r.lead_code);
                return (
                  <li key={r.lead_code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="num font-medium">{r.lead_code} <span className="font-normal text-muted">· {r.sales ?? "ไม่มีผู้ดูแล"}</span></span>
                    <span className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${lightCls[r.reason === "HOT_OVERDUE" ? "bad" : "warn"]}`}>{r.reason === "HOT_OVERDUE" ? "HOT เลยกำหนดติดตาม" : "ยังไม่ติดต่อเกิน 4 ชม."}</span>
                      {id && <button onClick={() => onOpen(id)} className="focus-ring min-h-9 rounded-lg border border-line px-3 text-xs">เปิดลีด</button>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-muted">ไม่มีลีดเสี่ยงในขณะนี้</p>}
        </div>

        <p className="text-[11px] text-muted">ตัวเลขบันทึกผลติดต่อคือที่บันทึกในระบบ ไม่ใช่จำนวนสายที่โทรจริง ข้อมูลก่อน 3 พ.ย. 2026 มาจาก Google Sheet เดิม ใช้ประกอบการโค้ช ไม่ควรตัดสินคนจากตัวเลขเดียว</p>
      </>)}
    </section>
  );
}
