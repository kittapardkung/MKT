"use client";
import { useMemo, useState } from "react";
import { Check, Eye, Search } from "lucide-react";
import type { Booking, DeliveryInput, DeliveryStep, Stage } from "@/lib/types";
import { friendlyError } from "@/lib/format";
import { Avatar, Empty, baht } from "./ui";

const day = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" }).format(new Date(iso)) : "—");
const today = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const inputCls = "mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink";
const POST: Stage[] = ["BOOKING", "FINANCE_PENDING", "FINANCE_APPROVED", "READY_TO_DELIVER", "WON"];
type Filter = "active" | "BOOKING" | "FINANCE_APPROVED" | "READY_TO_DELIVER" | "WON";
const TABS: Array<[Filter, string]> = [["active", "ที่ต้องดำเนินการ"], ["BOOKING", "จองแล้ว/รอสินเชื่อ"], ["FINANCE_APPROVED", "สินเชื่ออนุมัติ"], ["READY_TO_DELIVER", "พร้อมส่งมอบ"], ["WON", "ส่งมอบแล้ว"]];

function stepsFor(b: Booking): Array<{ key: Stage; label: string }> {
  const s: Array<{ key: Stage; label: string }> = [{ key: "BOOKING", label: "จองแล้ว" }];
  if (b.details.purchase_type === "FINANCE") s.push({ key: "FINANCE_APPROVED", label: "สินเชื่ออนุมัติ" });
  s.push({ key: "READY_TO_DELIVER", label: "พร้อมส่งมอบ" }, { key: "WON", label: "ปิดการขาย" });
  return s;
}

export default function DeliveryView({ bookings, onOpen, onStep }: { bookings: Booking[]; onOpen: (leadId: string) => void; onStep: (dealId: string, step: DeliveryStep, i?: DeliveryInput) => Promise<void> }) {
  const [f, setF] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ deal: string; step: DeliveryStep } | null>(null);
  const [val, setVal] = useState<DeliveryInput>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const verified = useMemo(() => bookings.filter((b) => b.verified && POST.includes(b.stage)), [bookings]);
  const count = (k: Filter) => verified.filter((b) => (k === "active" ? (b.stage !== "WON" || !b.details.vin) : k === "BOOKING" ? b.stage === "BOOKING" || b.stage === "FINANCE_PENDING" : b.stage === k)).length;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return verified
      .filter((b) => (f === "active" ? (b.stage !== "WON" || !b.details.vin) : f === "BOOKING" ? b.stage === "BOOKING" || b.stage === "FINANCE_PENDING" : b.stage === f))
      .filter((b) => !needle || [b.customer_name, b.lead_code, b.details.vin, b.doc_ref, b.details.model].some((x) => (x ?? "").toLowerCase().includes(needle)))
      .sort((a, b) => (f === "WON" ? (b.details.delivered_on ?? "").localeCompare(a.details.delivered_on ?? "") : (a.details.delivery_date ?? a.booked_on ?? "").localeCompare(b.details.delivery_date ?? b.booked_on ?? "")));
  }, [verified, f, q]);

  const open = (deal: string, step: DeliveryStep) => { setForm({ deal, step }); setVal({ date: step === "READY_TO_DELIVER" ? "" : today() }); setErr(null); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return; setBusy(true); setErr(null);
    try { await onStep(form.deal, form.step, val); setForm(null); }
    catch (x) { setErr(friendlyError(x instanceof Error ? x.message : String(x))); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สถานะส่งมอบ</h1>
        <p className="mt-0.5 text-sm text-muted">ติดตามลูกค้าที่จองแล้วจนส่งมอบรถ: สินเชื่ออนุมัติ → พร้อมส่งมอบ (ลงวันนัดรับรถ) → ปิดการขาย (เลขตัวถัง) — ลูกค้าที่ส่งมอบแล้วเก็บไว้เป็นประวัติ</p>
      </div>
      <div className="card flex items-center gap-2 px-3"><Search size={16} className="text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ เลขตัวถัง ใบจอง รุ่น…" className="min-h-11 flex-1 bg-transparent text-sm outline-none" /></div>
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setF(k)} aria-pressed={f === k} className={`min-h-10 shrink-0 rounded-full px-4 text-sm ${f === k ? "bg-dark font-semibold text-dark-ink" : "card text-muted"}`}>{label} <span className="num">{count(k)}</span></button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {rows.length === 0 && <div className="lg:col-span-2"><Empty>ไม่มีรายการในกลุ่มนี้ — รายการจะขึ้นเมื่อผู้จัดการตรวจสอบหลักฐานการจองแล้ว</Empty></div>}
        {rows.map((b) => {
          const d = b.details; const steps = stepsFor(b); const cur = steps.findIndex((s) => s.key === (b.stage === "FINANCE_PENDING" ? "BOOKING" : b.stage));
          const isFinance = d.purchase_type === "FINANCE";
          const next: { step: DeliveryStep; label: string } | null =
            b.stage === "BOOKING" || b.stage === "FINANCE_PENDING" ? (isFinance ? { step: "FINANCE_APPROVED", label: "สินเชื่ออนุมัติ" } : { step: "READY_TO_DELIVER", label: "พร้อมส่งมอบ" })
            : b.stage === "FINANCE_APPROVED" ? { step: "READY_TO_DELIVER", label: "พร้อมส่งมอบ" }
            : b.stage === "READY_TO_DELIVER" ? { step: "DELIVERED", label: "ปิดการขาย (ส่งมอบแล้ว)" }
            : b.stage === "WON" && !d.vin ? { step: "DELIVERED", label: "บันทึกข้อมูลส่งมอบ (เลขตัวถัง)" } : null;
          const showForm = form?.deal === b.deal_id;
          return (
            <article key={b.deal_id} className="card p-4">
              <div className="flex items-start gap-3">
                <Avatar name={b.customer_name ?? b.lead_code} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{b.customer_name ?? b.lead_code}</h2>
                  <div className="text-xs text-muted">ใบจอง {b.doc_ref} · {[d.model, d.variant].filter(Boolean).join(" ") || "—"}{d.color ? ` · ${d.color}` : ""} · เซลล์ {b.responsible_sales ?? "—"}</div>
                </div>
                <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-xs font-semibold">{isFinance ? "ผ่อน" : "เงินสด"}</span>
              </div>

              <ol className="mt-3 flex items-center gap-1 text-[11px]" aria-label="ขั้นตอนส่งมอบ">
                {steps.map((s, i) => (
                  <li key={s.key} className="flex flex-1 flex-col items-center gap-1 text-center">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${i < cur || (b.stage === "WON") ? "bg-ok text-white" : i === cur ? "bg-accent text-black" : "bg-bg text-muted"}`}>{i < cur || b.stage === "WON" ? <Check size={13} /> : i + 1}</span>
                    <span className={i === cur && b.stage !== "WON" ? "font-semibold" : "text-muted"}>{s.label}</span>
                  </li>
                ))}
              </ol>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div><dt className="text-xs text-muted">วันที่จอง</dt><dd>{day(b.booked_on)}</dd></div>
                <div><dt className="text-xs text-muted">เงินจอง / ราคารถ</dt><dd className="num">{baht(b.amount)} / {baht(d.vehicle_price)}</dd></div>
                {isFinance && <div><dt className="text-xs text-muted">ไฟแนนซ์ / ดาวน์</dt><dd>{d.bank ?? "—"} · <span className="num">{baht(d.down_payment)}</span></dd></div>}
                {d.finance_approved_on && <div><dt className="text-xs text-muted">สินเชื่ออนุมัติเมื่อ</dt><dd>{day(d.finance_approved_on)}</dd></div>}
                {d.delivery_date && <div><dt className="text-xs text-muted">นัดรับรถ</dt><dd className="font-semibold">{day(d.delivery_date)}</dd></div>}
                {d.delivered_on && <div><dt className="text-xs text-muted">ส่งมอบเมื่อ</dt><dd>{day(d.delivered_on)}{d.delivered_by ? ` · โดย ${d.delivered_by}` : ""}</dd></div>}
                {d.vin && <div className="col-span-2"><dt className="text-xs text-muted">เลขตัวถัง (VIN)</dt><dd className="num font-semibold tracking-wide">{d.vin}</dd></div>}
                {d.delivery_note && <div className="col-span-2"><dt className="text-xs text-muted">หมายเหตุการส่งมอบ</dt><dd>{d.delivery_note}</dd></div>}
              </dl>

              {showForm && form && (
                <form onSubmit={submit} className="mt-3 space-y-2 rounded-2xl bg-bg p-3">
                  <h3 className="text-sm font-semibold">{form.step === "FINANCE_APPROVED" ? "สินเชื่ออนุมัติ" : form.step === "READY_TO_DELIVER" ? "พร้อมส่งมอบ — ลงวันนัดรับรถ" : "ปิดการขาย — ส่งมอบสำเร็จ"}</h3>
                  {form.step === "FINANCE_APPROVED" && <p className="text-xs text-muted">สินเชื่อผ่านแล้ว แต่รถยังไม่มาที่ศูนย์หรือรอกำหนดการส่งมอบ</p>}
                  <label className="block text-xs text-muted">{form.step === "FINANCE_APPROVED" ? "วันที่อนุมัติ" : form.step === "READY_TO_DELIVER" ? "วันที่นัดรับรถ *" : "วันที่ส่งมอบ *"}
                    <input type="date" required={form.step !== "FINANCE_APPROVED"} value={val.date ?? ""} max={form.step === "DELIVERED" ? today() : undefined} onChange={(e) => setVal({ ...val, date: e.target.value })} className={inputCls} /></label>
                  {form.step === "DELIVERED" && <label className="block text-xs text-muted">เลขตัวถัง / VIN *<input required minLength={5} value={val.vin ?? ""} onChange={(e) => setVal({ ...val, vin: e.target.value })} className={`${inputCls} uppercase`} placeholder="เช่น LSV…" /></label>}
                  <label className="block text-xs text-muted">หมายเหตุ<input value={val.note ?? ""} onChange={(e) => setVal({ ...val, note: e.target.value })} className={inputCls} /></label>
                  {err && <div role="alert" className="rounded-xl bg-danger-soft p-2 text-sm text-danger">{err}</div>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm(null)} className="focus-ring min-h-11 flex-1 rounded-[14px] border border-line font-semibold">ยกเลิก</button>
                    <button disabled={busy} className="btn-dark focus-ring min-h-11 flex-1 disabled:opacity-60">{busy ? "กำลังบันทึก…" : "ยืนยัน"}</button>
                  </div>
                </form>
              )}

              <div className="mt-3 flex gap-2">
                {next && !showForm && <button onClick={() => open(b.deal_id, next.step)} className="focus-ring min-h-11 flex-1 rounded-[14px] bg-accent font-bold text-black">{next.label}</button>}
                <button onClick={() => onOpen(b.lead_id)} className="focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[14px] border border-line font-semibold"><Eye size={16} />ดูลีด</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
