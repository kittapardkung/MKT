"use client";
import { useCallback, useEffect, useState } from "react";
import { BookmarkCheck, Phone, X } from "lucide-react";
import { api } from "@/lib/api";
import { dayKey } from "@/lib/analytics";
import type { BookingDetails, LeadEvent, LeadRow, Stage, Temperature } from "@/lib/types";
import { EVENT_TH, OUTCOME_TH, STAGE_ORDER, STAGE_TH, STATUS_GUIDE, fmtDateTime, friendlyError, maskPhone } from "@/lib/format";
import { Flags, StageChip, StarButton, TempChip } from "./ui";
import StatusGuideButton, { StatusGuideCard } from "./StatusGuide";

const tomorrow10 = () => {
  const d = new Date(Date.now() + 86400000); d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const inputCls = "mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink";
const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(/,/g, "")));

export default function LeadSheet({ lead, onClose, onChanged }: { lead: LeadRow; onClose: () => void; onChanged: () => void }) {
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [channel, setChannel] = useState("PHONE");
  const [outcome, setOutcome] = useState("CONNECTED");
  const [note, setNote] = useState("");
  const [next, setNext] = useState(tomorrow10);
  const [temp, setTemp] = useState<Temperature>(lead.temperature);
  const [stage, setStage] = useState<Stage | "">("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [booking, setBooking] = useState(false);
  const [bk, setBk] = useState({ doc_ref: "", amount: "", booked_on: dayKey(new Date()), model: lead.interested_model ?? "", variant: "", color: "", vehicle_price: "",
    purchase_type: "" as "" | "CASH" | "FINANCE", down_payment: "", term_months: "", bank: "", promo: "", note: "" });
  const closed = lead.stage === "WON" || lead.stage === "LOST";

  const load = useCallback(() => api.events(lead.lead_id).then(setEvents).catch(() => setEvents([])), [lead.lead_id]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<void>, ok: string, after?: () => void) {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); setNote(""); after?.(); await load(); onChanged(); }
    catch (e) { setMsg({ ok: false, text: friendlyError(e instanceof Error ? e.message : String(e)) }); }
    finally { setBusy(false); }
  }

  const submitBooking = () => {
    const details: BookingDetails = {
      model: bk.model.trim(), variant: bk.variant.trim() || undefined, color: bk.color.trim() || undefined, vehicle_price: num(bk.vehicle_price),
      purchase_type: bk.purchase_type as "CASH" | "FINANCE", down_payment: bk.purchase_type === "FINANCE" ? num(bk.down_payment) : undefined,
      term_months: bk.purchase_type === "FINANCE" ? num(bk.term_months) : undefined, bank: bk.purchase_type === "FINANCE" ? bk.bank.trim() || undefined : undefined,
      promo: bk.promo.trim() || undefined, note: bk.note.trim() || undefined,
    };
    return run(() => api.markBooked(lead.lead_id, { doc_ref: bk.doc_ref, amount: num(bk.amount) ?? null, booked_on: bk.booked_on, details }),
      "บันทึกการจองแล้ว — รอผู้จัดการตรวจสอบหลักฐาน จากนั้นสถานะจะเปลี่ยนเป็น “จองแล้ว” อัตโนมัติ", () => setBooking(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-bg p-4 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{lead.customer_name ?? lead.lead_code}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted"><TempChip t={lead.temperature} /><StageChip s={lead.stage} /><span>{lead.lead_code}</span></div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <StarButton on={lead.starred} label={lead.customer_name ?? lead.lead_code} onToggle={() => run(() => api.setStar(lead.lead_id, !lead.starred), lead.starred ? "เอาออกจากลูกค้าเป้าหมายแล้ว" : "เพิ่มเป็นลูกค้าเป้าหมายแล้ว ⭐")} />
            <button aria-label="ปิด" onClick={onClose} className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-line"><X size={18} /></button>
          </div>
        </div>

        <div className="card mt-3 p-3 text-sm">
          <div>รุ่นที่สนใจ: {lead.interested_model ?? "—"} · เบอร์: {maskPhone(lead.phone)} · ผู้รับผิดชอบ: {lead.responsible_sales ?? "—"}</div>
          <div className="mt-1 text-muted">ติดต่อล่าสุด {fmtDateTime(lead.last_contact_at)} · นัดถัดไป {fmtDateTime(lead.next_follow_up_at)}</div>
          {lead.last_customer_message && <div className="mt-2 rounded-xl bg-bg p-2 text-xs text-muted">ลูกค้าพิมพ์ล่าสุด: “{lead.last_customer_message}”</div>}
          <div className="mt-2"><b>Next Best Action:</b> {lead.next_best_action}</div>
          <Flags flags={lead.flags} />
        </div>

        {!closed && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {lead.phone ? <a href={`tel:${lead.phone}`} className="btn-dark focus-ring flex min-h-11 items-center justify-center gap-2 no-underline"><Phone size={16} />โทร</a> : <span />}
            <button onClick={() => setBooking((v) => !v)} aria-expanded={booking} className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-accent font-bold text-black"><BookmarkCheck size={16} />จองแล้ว</button>
          </div>
        )}

        {booking && !closed && (
          <form className="card mt-3 space-y-3 p-3" onSubmit={(e) => { e.preventDefault(); void submitBooking(); }}>
            <div><h3 className="font-semibold">บันทึกการจอง</h3><p className="text-xs text-muted">ระบุรถ รุ่น และเงื่อนไขการซื้อ — ผู้จัดการจะตรวจสอบหลักฐานก่อน สถานะจึงเปลี่ยนเป็น “จองแล้ว”</p></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">เลขที่ใบจอง *<input required value={bk.doc_ref} onChange={(e) => setBk({ ...bk, doc_ref: e.target.value })} className={inputCls} placeholder="เช่น RES-2026-0123" /></label>
              <label className="text-xs text-muted">วันที่จอง *<input required type="date" value={bk.booked_on} onChange={(e) => setBk({ ...bk, booked_on: e.target.value })} className={inputCls} /></label>
              <label className="text-xs text-muted">รถ (รุ่นหลัก) *<input required value={bk.model} onChange={(e) => setBk({ ...bk, model: e.target.value })} className={inputCls} placeholder="Darion / Porta / Bingo" /></label>
              <label className="text-xs text-muted">รุ่นย่อย<input value={bk.variant} onChange={(e) => setBk({ ...bk, variant: e.target.value })} className={inputCls} placeholder="เช่น EV 7 ที่นั่ง" /></label>
              <label className="text-xs text-muted">สี<input value={bk.color} onChange={(e) => setBk({ ...bk, color: e.target.value })} className={inputCls} /></label>
              <label className="text-xs text-muted">ราคารถ (บาท)<input inputMode="numeric" value={bk.vehicle_price} onChange={(e) => setBk({ ...bk, vehicle_price: e.target.value })} className={inputCls} /></label>
              <label className="text-xs text-muted">เงินจอง (บาท)<input inputMode="numeric" value={bk.amount} onChange={(e) => setBk({ ...bk, amount: e.target.value })} className={inputCls} /></label>
              <label className="text-xs text-muted">เงื่อนไขการซื้อ *
                <select required value={bk.purchase_type} onChange={(e) => setBk({ ...bk, purchase_type: e.target.value as "" | "CASH" | "FINANCE" })} className={inputCls}>
                  <option value="">เลือก…</option><option value="CASH">เงินสด</option><option value="FINANCE">ผ่อน / สินเชื่อ</option>
                </select></label>
              {bk.purchase_type === "FINANCE" && (<>
                <label className="text-xs text-muted">เงินดาวน์ (บาท)<input inputMode="numeric" value={bk.down_payment} onChange={(e) => setBk({ ...bk, down_payment: e.target.value })} className={inputCls} /></label>
                <label className="text-xs text-muted">ระยะผ่อน (เดือน)<input inputMode="numeric" value={bk.term_months} onChange={(e) => setBk({ ...bk, term_months: e.target.value })} className={inputCls} /></label>
                <label className="col-span-2 text-xs text-muted">ธนาคาร / ไฟแนนซ์<input value={bk.bank} onChange={(e) => setBk({ ...bk, bank: e.target.value })} className={inputCls} /></label>
              </>)}
              <label className="col-span-2 text-xs text-muted">โปรโมชั่น / ของแถม<input value={bk.promo} onChange={(e) => setBk({ ...bk, promo: e.target.value })} className={inputCls} /></label>
              <label className="col-span-2 text-xs text-muted">หมายเหตุ<textarea rows={2} value={bk.note} onChange={(e) => setBk({ ...bk, note: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-ink" /></label>
            </div>
            <button disabled={busy} className="btn-dark min-h-11 w-full disabled:opacity-60">{busy ? "กำลังบันทึก…" : "ยืนยันการจอง"}</button>
          </form>
        )}

        {!closed && (
          <form className="card mt-3 space-y-2 p-3"
            onSubmit={(e) => { e.preventDefault(); run(() => api.logContact(lead.lead_id, { channel, outcome, note, next_follow_up: next, temperature: temp }), "บันทึกผลการติดต่อแล้ว"); }}>
            <h3 className="font-semibold">บันทึกผลการติดต่อ (หลักฐาน)</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">ช่องทาง
                <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
                  <option value="PHONE">โทรศัพท์</option><option value="LINE">LINE</option><option value="FACEBOOK">Facebook</option><option value="SMS">SMS</option><option value="WALK_IN">มาที่โชว์รูม</option>
                </select></label>
              <label className="text-xs text-muted">ผลการติดต่อ
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls}>{Object.entries(OUTCOME_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <label className="block text-xs text-muted">สรุปการคุย
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required minLength={5} placeholder="เช่น ลูกค้าสนใจ Darion งบ 8 แสน ขอเวลาปรึกษาภรรยา" className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-ink" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">นัดติดตามครั้งถัดไป<input type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} required className={inputCls} /></label>
              <label className="text-xs text-muted">ความสนใจ
                <select value={temp ?? ""} onChange={(e) => setTemp((e.target.value || null) as Temperature)} className={inputCls}><option value="">ไม่เปลี่ยน</option><option value="HOT">HOT</option><option value="WARM">WARM</option><option value="COLD">COLD</option></select></label>
            </div>
            <button disabled={busy} className="btn-dark min-h-11 w-full disabled:opacity-60">{busy ? "กำลังบันทึก…" : "บันทึกผลการติดต่อ"}</button>
          </form>
        )}

        {!closed && (
          <div className="card mt-3 space-y-2 p-3">
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">เปลี่ยนสถานะ</h3><StatusGuideButton className="!min-h-9" /></div>
            <label className="block text-xs text-muted">เลือกสถานะใหม่
              <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={inputCls}>
                <option value="">เลือกสถานะ…</option>
                {STAGE_ORDER.filter((s) => s !== lead.stage).map((s) => (
                  <option key={s} value={s} disabled={s === "BOOKING"}>{STAGE_TH[s]} — {s === "BOOKING" ? "ใช้ปุ่ม “จองแล้ว”" : STATUS_GUIDE[s].meaning}</option>
                ))}
              </select></label>
            {stage && <StatusGuideCard stage={stage} />}
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={stage === "LOST" ? "เหตุผลที่เสียลูกค้า (จำเป็น)" : "หมายเหตุ (ถ้ามี)"} className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" />
            <button disabled={busy || !stage} onClick={() => run(() => api.changeStage(lead.lead_id, stage as Stage, reason), "เปลี่ยนสถานะแล้ว", () => setStage(""))}
              className="min-h-11 w-full rounded-[14px] border border-line font-semibold disabled:opacity-50">{stage ? `ยืนยันเปลี่ยนเป็น “${STAGE_TH[stage]}”` : "เลือกสถานะก่อน"}</button>
          </div>
        )}

        {msg && <div role="status" className={`mt-3 rounded-2xl p-3 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</div>}

        <h3 className="mt-4 font-semibold">ไทม์ไลน์</h3>
        <ol className="mt-2 space-y-2 border-l-2 border-line pl-3">
          {events.length === 0 && <li className="text-sm text-muted">ยังไม่มีกิจกรรม</li>}
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <div className="text-xs text-muted">{fmtDateTime(e.occurred_at)} · {EVENT_TH[e.type] ?? e.type}{e.actor ? ` · ${e.actor}` : ""}{e.outcome ? ` · ${OUTCOME_TH[e.outcome] ?? e.outcome}` : ""}</div>
              {e.body && <div>{e.body}</div>}
            </li>
          ))}
        </ol>
        {!closed && lead.flags.includes("NOT_ACCEPTED") && (
          <button disabled={busy} onClick={() => run(() => api.accept(lead.lead_id), "รับลีดแล้ว (ยังต้องติดต่อลูกค้าและบันทึกผล)")} className="mt-4 min-h-11 w-full rounded-[14px] border border-line font-semibold">กดรับลีด</button>
        )}
      </div>
    </div>
  );
}
