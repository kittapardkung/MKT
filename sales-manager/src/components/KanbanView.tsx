"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { LeadRow, Stage } from "@/lib/types";
import { fmtDateTime, friendlyError, STAGE_TH } from "@/lib/format";
import { RiskPill, TempChip } from "./ui";

// คอลัมน์ที่ย้ายได้ด้วยการลาก/เมนู (ไม่ต้องมีหลักฐาน) — จอง/ปิดการขายต้องมีหลักฐานจึงย้ายจากบอร์ดไม่ได้ (ฐานข้อมูลบังคับซ้ำ)
const MOVABLE: Stage[] = ["NEW", "CONTACTED", "FOLLOW_UP", "APPOINTMENT", "TEST_DRIVE", "QUOTATION", "NEGOTIATION"];
const LOCKED: Array<{ key: string; label: string; stages: Stage[] }> = [
  { key: "booked", label: "จอง / สินเชื่อ / รอส่งมอบ", stages: ["BOOKING", "FINANCE_PENDING", "FINANCE_APPROVED", "READY_TO_DELIVER"] },
  { key: "won", label: "ปิดการขาย", stages: ["WON"] },
];
const PAGE = 25;

export default function KanbanView({ leads, onOpen, onChanged }: { leads: LeadRow[]; onOpen: (id: string) => void; onChanged: () => Promise<void> }) {
  const [owner, setOwner] = useState("all");
  const [temp, setTemp] = useState("all");
  const [limit, setLimit] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<LeadRow | null>(null);
  const [reason, setReason] = useState("");
  const [over, setOver] = useState<string | null>(null);

  const owners = useMemo(() => [...new Set(leads.map((l) => l.responsible_sales).filter((x): x is string => !!x))].sort(), [leads]);
  const live = useMemo(() => leads.filter((l) => !l.dormant && (owner === "all" || (owner === "none" ? !l.responsible_sales : l.responsible_sales === owner)) && (temp === "all" || (temp === "none" ? !l.temperature : l.temperature === temp))), [leads, owner, temp]);
  const lostCount = live.filter((l) => l.stage === "LOST").length;
  const dormantCount = leads.filter((l) => l.dormant).length;

  const move = async (lead: LeadRow, to: Stage | "LOST", why?: string) => {
    if (lead.stage === to) return;
    setBusy(lead.lead_id); setMsg(null);
    try {
      await api.changeStage(lead.lead_id, to, why ?? `ย้ายจากบอร์ด: ${STAGE_TH[lead.stage]} → ${to === "LOST" ? "เสียโอกาส" : STAGE_TH[to]}`);
      await onChanged();
      setMsg({ ok: true, text: `ย้าย ${lead.lead_code} ไป “${to === "LOST" ? "เสียโอกาส" : STAGE_TH[to]}” แล้ว` });
    } catch (e) { setMsg({ ok: false, text: friendlyError(e instanceof Error ? e.message : String(e)) }); }
    finally { setBusy(null); }
  };
  const request = (lead: LeadRow, to: string) => {
    if (to === "LOST") { setLostFor(lead); setReason(""); return; }
    if (!MOVABLE.includes(to as Stage)) { setMsg({ ok: false, text: "ย้ายไป จอง/ปิดการขาย จากบอร์ดไม่ได้ — ต้องกด “จองแล้ว” พร้อมหลักฐานในใบลีด แล้วผู้จัดการตรวจสอบ" }); return; }
    void move(lead, to as Stage);
  };
  const drop = (e: React.DragEvent, to: string) => {
    e.preventDefault(); setOver(null);
    const lead = leads.find((l) => l.lead_id === e.dataTransfer.getData("text/lead"));
    if (lead) request(lead, to);
  };

  const Card = ({ l, movable }: { l: LeadRow; movable: boolean }) => (
    <li draggable={movable && busy === null} onDragStart={(e) => e.dataTransfer.setData("text/lead", l.lead_id)}
      className={`rounded-xl border border-line bg-surface p-2.5 text-sm shadow-sm ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${busy === l.lead_id ? "opacity-50" : ""}`}>
      <button onClick={() => onOpen(l.lead_id)} className="focus-ring block w-full text-left">
        <div className="flex items-center justify-between gap-2"><span className="num text-xs font-semibold">{l.lead_code}</span><TempChip t={l.temperature} /></div>
        <div className="mt-1 truncate font-medium">{l.customer_name ?? "ไม่ระบุชื่อ"}</div>
        <div className="truncate text-xs text-muted">{l.interested_model ?? "ไม่ระบุรุ่น"} · {l.responsible_sales ?? "ไม่มีผู้ดูแล"}</div>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <RiskPill r={l.risk_level} />
        <span className="text-[11px] text-muted">{l.next_follow_up_at ? `ตาม ${fmtDateTime(l.next_follow_up_at)}` : "ไม่มีนัด"}</span>
      </div>
      {movable && (
        <label className="mt-2 block"><span className="sr-only">ย้ายสถานะของ {l.lead_code}</span>
          <select value="" disabled={busy !== null} onChange={(e) => { if (e.target.value) request(l, e.target.value); }} className="min-h-9 w-full rounded-lg border border-line bg-bg px-2 text-xs">
            <option value="">ย้ายไป…</option>
            {MOVABLE.filter((s) => s !== l.stage).map((s) => <option key={s} value={s}>{STAGE_TH[s]}</option>)}
            <option value="LOST">เสียโอกาส (ต้องระบุเหตุผล)</option>
          </select>
        </label>
      )}
    </li>
  );

  const Column = ({ id, title, stages, movable }: { id: string; title: string; stages: Stage[]; movable: boolean }) => {
    const rows = live.filter((l) => stages.includes(l.stage));
    const shown = rows.slice(0, limit[id] ?? PAGE);
    return (
      <section onDragOver={(e) => { if (movable) { e.preventDefault(); setOver(id); } }} onDragLeave={() => setOver(null)} onDrop={(e) => movable && drop(e, id)}
        aria-label={`${title} ${rows.length} ราย`} className={`flex w-64 shrink-0 flex-col rounded-2xl bg-line/60 p-2 ${over === id ? "ring-2 ring-accent" : ""}`}>
        <h3 className="flex items-center justify-between px-1.5 py-1 text-sm font-bold">{title}<span className="num rounded-full bg-surface px-2 py-0.5 text-xs">{rows.length}</span></h3>
        <ul className="mt-1 max-h-[65vh] space-y-2 overflow-y-auto pr-0.5">
          {shown.map((l) => <Card key={l.lead_id} l={l} movable={movable} />)}
          {!rows.length && <li className="p-3 text-center text-xs text-muted">ไม่มีลีด</li>}
        </ul>
        {rows.length > shown.length && <button onClick={() => setLimit((m) => ({ ...m, [id]: (m[id] ?? PAGE) + PAGE }))} className="focus-ring mt-2 min-h-9 rounded-lg border border-line bg-surface text-xs">แสดงเพิ่ม ({rows.length - shown.length})</button>}
      </section>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="card flex min-h-11 items-center px-3 text-sm"><span className="mr-2 text-muted">เซลล์</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="min-h-11 bg-transparent outline-none"><option value="all">ทั้งหมด</option><option value="none">ไม่มีผู้ดูแล</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
        <label className="card flex min-h-11 items-center px-3 text-sm"><span className="mr-2 text-muted">ความร้อน</span>
          <select value={temp} onChange={(e) => setTemp(e.target.value)} className="min-h-11 bg-transparent outline-none"><option value="all">ทั้งหมด</option><option value="HOT">HOT</option><option value="WARM">WARM</option><option value="COLD">COLD</option><option value="none">ยังไม่ประเมิน</option></select></label>
        <p className="text-xs text-muted">ลากการ์ด หรือใช้เมนู “ย้ายไป…” (มือถือ) · ซ่อนลีดที่พักไว้ {dormantCount} ราย · เสียโอกาส {lostCount} ราย (ไม่แสดงการ์ด)</p>
      </div>
      {msg && <div role={msg.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</div>}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {MOVABLE.map((s) => <Column key={s} id={s} title={STAGE_TH[s]} stages={[s]} movable />)}
        <section onDragOver={(e) => { e.preventDefault(); setOver("LOST"); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, "LOST")}
          className={`flex w-56 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line p-4 text-center text-sm text-muted ${over === "LOST" ? "border-danger bg-danger-soft text-danger" : ""}`}>
          <div className="font-bold">เสียโอกาส</div><div className="mt-1 text-xs">ลากมาวางที่นี่ แล้วระบุเหตุผล</div>
        </section>
        {LOCKED.map((g) => <Column key={g.key} id={g.key} title={`${g.label} 🔒`} stages={g.stages} movable={false} />)}
      </div>

      {lostFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="ระบุเหตุผลเสียโอกาส">
          <form className="card w-full max-w-md space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); const l = lostFor; setLostFor(null); void move(l, "LOST", reason.trim()); }}>
            <h3 className="font-bold">ย้าย {lostFor.lead_code} ไป “เสียโอกาส”</h3>
            <p className="text-sm text-muted">ต้องระบุเหตุผล (อย่างน้อย 3 ตัวอักษร) ห้ามใส่ชื่อหรือเบอร์โทรลูกค้าในช่องนี้</p>
            <textarea autoFocus required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-xl border border-line bg-surface p-3 text-sm" placeholder="เช่น ลูกค้าเลือกยี่ห้ออื่น / งบไม่พอ / ติดต่อไม่ได้เกิน 3 ครั้ง" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLostFor(null)} className="card focus-ring min-h-11 px-4 text-sm">ยกเลิก</button>
              <button disabled={reason.trim().length < 3} className="btn-dark min-h-11 px-4 text-sm disabled:opacity-50">ยืนยันย้าย</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
