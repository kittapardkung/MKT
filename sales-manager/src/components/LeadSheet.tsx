"use client";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { LeadEvent, LeadRow, Stage, Temperature } from "@/lib/types";
import { EVENT_TH, OUTCOME_TH, STAGE_TH, fmtDateTime, maskPhone } from "@/lib/format";
import { Flags, StageChip, TempChip } from "./ui";

const STAGES: Stage[] = ["CONTACTED", "FOLLOW_UP", "APPOINTMENT", "TEST_DRIVE", "QUOTATION", "BOOKING", "FINANCE_APPROVED", "WON", "LOST"];
const tomorrow10 = () => {
  const d = new Date(Date.now() + 86400000); d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

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
  const closed = lead.stage === "WON" || lead.stage === "LOST";

  const load = useCallback(() => api.events(lead.lead_id).then(setEvents).catch(() => setEvents([])), [lead.lead_id]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); setNote(""); await load(); onChanged(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-bg p-4 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{lead.customer_name ?? lead.lead_code}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <TempChip t={lead.temperature} /><StageChip s={lead.stage} /><span>{lead.lead_code}</span>
            </div>
          </div>
          <button aria-label="ปิด" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-line"><X size={18} /></button>
        </div>

        <div className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm">
          <div>รุ่นที่สนใจ: {lead.interested_model ?? "—"} · เบอร์: {maskPhone(lead.phone)} · ผู้รับผิดชอบ: {lead.responsible_sales ?? "—"}</div>
          <div className="mt-1 text-muted">ติดต่อล่าสุด {fmtDateTime(lead.last_contact_at)} · นัดถัดไป {fmtDateTime(lead.next_follow_up_at)}</div>
          <div className="mt-2"><b>Next Best Action:</b> {lead.next_best_action}</div>
          <Flags flags={lead.flags} />
        </div>

        {!closed && (
          <form className="mt-3 space-y-2 rounded-xl border border-line bg-surface p-3"
            onSubmit={(e) => { e.preventDefault(); run(() => api.logContact(lead.lead_id, { channel, outcome, note, next_follow_up: next, temperature: temp }), "บันทึกผลการติดต่อแล้ว"); }}>
            <h3 className="font-semibold">บันทึกผลการติดต่อ (หลักฐาน)</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">ช่องทาง
                <select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-ink">
                  <option value="PHONE">โทรศัพท์</option><option value="LINE">LINE</option><option value="FACEBOOK">Facebook</option><option value="SMS">SMS</option><option value="WALK_IN">มาที่โชว์รูม</option>
                </select></label>
              <label className="text-xs text-muted">ผลการติดต่อ
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-ink">
                  {Object.entries(OUTCOME_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
            </div>
            <label className="block text-xs text-muted">สรุปการคุย
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required minLength={5} placeholder="เช่น ลูกค้าสนใจ Darion งบ 8 แสน ขอเวลาปรึกษาภรรยา"
                className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-ink" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">นัดติดตามครั้งถัดไป
                <input type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} required className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-ink" /></label>
              <label className="text-xs text-muted">ความสนใจ
                <select value={temp ?? ""} onChange={(e) => setTemp((e.target.value || null) as Temperature)} className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-ink">
                  <option value="">ไม่เปลี่ยน</option><option value="HOT">HOT</option><option value="WARM">WARM</option><option value="COLD">COLD</option>
                </select></label>
            </div>
            <button disabled={busy} className="min-h-11 w-full rounded-xl bg-brand font-semibold text-white disabled:opacity-60">{busy ? "กำลังบันทึก…" : "บันทึกผลการติดต่อ"}</button>
          </form>
        )}

        {!closed && (
          <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface p-3">
            <h3 className="font-semibold">เปลี่ยนสถานะ</h3>
            <div className="flex gap-2">
              <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-2">
                <option value="">เลือกสถานะ…</option>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_TH[s]}</option>)}
              </select>
              <button disabled={busy || !stage} onClick={() => run(() => api.changeStage(lead.lead_id, stage as Stage, reason), "เปลี่ยนสถานะแล้ว")}
                className="rounded-xl border border-line px-4 font-semibold disabled:opacity-50">ยืนยัน</button>
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผล (จำเป็นเมื่อ LOST)" className="min-h-11 w-full rounded-lg border border-line bg-surface px-2" />
            <p className="text-xs text-muted">BOOKING / สินเชื่ออนุมัติ / WON ต้องมีหลักฐานธุรกรรมที่ผู้จัดการตรวจสอบแล้ว — ระบบไม่อนุญาตให้ข้าม</p>
          </div>
        )}

        {msg && <div role="status" className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</div>}

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
          <button disabled={busy} onClick={() => run(() => api.accept(lead.lead_id), "รับลีดแล้ว (ยังต้องติดต่อลูกค้าและบันทึกผล)")}
            className="mt-4 min-h-11 w-full rounded-xl border border-brand font-semibold text-brand">กดรับลีด</button>
        )}
      </div>
    </div>
  );
}
