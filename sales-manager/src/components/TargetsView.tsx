"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import type { LeadRow } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { Avatar, Empty, RiskPill, StagePill, StarButton, TempChip } from "./ui";

function NoteField({ lead, onSave }: { lead: LeadRow; onSave: (note: string) => void }) {
  const [v, setV] = useState(lead.star_note ?? "");
  return (
    <label className="block text-xs text-muted">เหตุผล / ขนาด deal
      <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== (lead.star_note ?? "")) onSave(v); }} placeholder="เช่น deal ใหญ่ ซื้อ 3 คัน / ตัดสินใจเร็ว"
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink" />
    </label>
  );
}

export default function TargetsView({ leads, onOpen, showOwner, onStar }: { leads: LeadRow[]; onOpen: (id: string) => void; showOwner: boolean; onStar: (id: string, on: boolean, note?: string) => void }) {
  const [now] = useState(() => Date.now());
  const rows = leads.filter((l) => l.starred).sort((a, b) => (a.next_follow_up_at ? Date.parse(a.next_follow_up_at) : Infinity) - (b.next_follow_up_at ? Date.parse(b.next_follow_up_at) : Infinity));
  const due = rows.filter((l) => l.next_follow_up_at && Date.parse(l.next_follow_up_at) < now && l.stage !== "WON" && l.stage !== "LOST").length;
  return (
    <section className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Star className="fill-amber-400 text-amber-500" />ลูกค้าเป้าหมาย</h1>
        <p className="mt-0.5 text-sm text-muted">ลูกค้าที่คุณติดดาวไว้ — โอกาสสูงหรือ deal ใหญ่ที่ต้องเน้น · {rows.length} ราย{due ? ` · ถึงกำหนดติดตาม ${due} ราย` : ""} (ดาวเป็นของแต่ละคน คนอื่นไม่เห็น)</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {rows.length === 0 && <div className="lg:col-span-2"><Empty>ยังไม่มีลูกค้าเป้าหมาย — กดดาว ⭐ ที่ลีดใดก็ได้เพื่อเพิ่มที่นี่</Empty></div>}
        {rows.map((l) => {
          const late = l.next_follow_up_at && Date.parse(l.next_follow_up_at) < now && l.stage !== "WON" && l.stage !== "LOST";
          return (
            <article key={l.lead_id} className="card p-4">
              <div className="flex items-start gap-3">
                <Avatar name={l.customer_name ?? l.lead_code} />
                <button onClick={() => onOpen(l.lead_id)} className="focus-ring min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold">{l.customer_name ?? l.lead_code}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted"><TempChip t={l.temperature} /><StagePill s={l.stage} />{l.interested_model && <span>· {l.interested_model}</span>}{showOwner && <span>· {l.responsible_sales ?? "ยังไม่มอบหมาย"}</span>}</span>
                </button>
                <RiskPill r={l.risk_level} />
                <StarButton on label={l.customer_name ?? l.lead_code} onToggle={() => onStar(l.lead_id, false)} />
              </div>
              <div className={`mt-2 text-xs ${late ? "font-semibold text-danger" : "text-muted"}`}>นัดถัดไป {fmtDateTime(l.next_follow_up_at)}{late ? " · เลยกำหนด" : ""} · ติดต่อล่าสุด {fmtDateTime(l.last_contact_at)}</div>
              <div className="mt-2"><NoteField key={`${l.lead_id}:${l.star_note ?? ""}`} lead={l} onSave={(n) => onStar(l.lead_id, true, n)} /></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
