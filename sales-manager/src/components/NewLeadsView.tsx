"use client";
import { useState } from "react";
import { Phone, ClipboardPen, Sparkles } from "lucide-react";
import type { LeadRow } from "@/lib/types";
import { fmtOverdue, maskPhone } from "@/lib/format";
import { Avatar, Empty, StarButton } from "./ui";

/** LEAD ใหม่ = ยังไม่มีการติดต่อจากเซลล์ / ยังไม่มี sales reply (สถานะ NEW และไม่มีเวลาติดต่อครั้งแรก) */
export const isFreshLead = (l: LeadRow) => l.stage === "NEW" && !l.first_contact_at;

export default function NewLeadsView({ leads, onOpen, showOwner, onStar }: { leads: LeadRow[]; onOpen: (id: string) => void; showOwner: boolean; onStar: (id: string, on: boolean) => void }) {
  const [now] = useState(() => Date.now());
  const fresh = leads.filter(isFreshLead).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const current = fresh.filter((l) => !l.dormant);
  const old = fresh.length - current.length;
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">LEAD ใหม่</h1>
        <p className="mt-0.5 text-sm text-muted">ลีดที่เข้ามาใหม่และ <b>ยังไม่มีการติดต่อจากเซลล์</b> — รีบติดต่อและอัปเดตข้อมูลให้เร็วที่สุด · {current.length} ราย{old ? ` (มีลีดเก่าที่ไม่ได้ติดต่ออีก ${old} ราย พักไว้ ดูได้ที่ “ลีดทั้งหมด”)` : ""}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {current.length === 0 && <div className="lg:col-span-2"><Empty>ไม่มีลีดใหม่ที่รอติดต่อ — เยี่ยมมาก!</Empty></div>}
        {current.map((l) => {
          const mins = Math.max(0, Math.floor((now - Date.parse(l.created_at)) / 60000));
          const late = mins > 15;
          return (
            <article key={l.lead_id} className={`card p-4 ${late ? "border-l-4 border-l-danger" : "border-l-4 border-l-accent"}`}>
              <div className="flex items-start gap-3">
                <Avatar name={l.customer_name ?? l.lead_code} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Sparkles size={14} className="shrink-0 text-accent" /><h2 className="truncate font-semibold">{l.customer_name ?? "ลูกค้าใหม่ (ยังไม่ทราบชื่อ)"}</h2></div>
                  <div className="mt-0.5 text-xs text-muted">{l.interested_model ?? "ยังไม่ระบุรุ่น"} · {maskPhone(l.phone)}{showOwner && ` · ผู้ดูแล ${l.responsible_sales ?? "ยังไม่มอบหมาย"}`}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${late ? "bg-danger-soft text-danger" : "bg-accent-soft text-warn"}`}>เข้ามา {fmtOverdue(mins)}ที่แล้ว</span>
                <StarButton on={l.starred} label={l.customer_name ?? l.lead_code} onToggle={() => onStar(l.lead_id, !l.starred)} />
              </div>
              {l.last_customer_message && <p className="mt-3 rounded-xl bg-bg p-2.5 text-sm text-muted">“{l.last_customer_message}”</p>}
              <p className="mt-2 text-xs"><b>ยังไม่มี sales reply</b> · {l.accepted_at ? "เซลล์รับลีดแล้ว แต่ยังไม่ติดต่อ" : "ยังไม่กดรับลีด"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {l.phone ? <a href={`tel:${l.phone}`} className="btn-dark focus-ring flex min-h-11 items-center justify-center gap-2 no-underline"><Phone size={16} />โทรเลย</a> : <span />}
                <button onClick={() => onOpen(l.lead_id)} className="focus-ring flex items-center justify-center gap-2 rounded-[14px] border border-line font-semibold"><ClipboardPen size={16} />อัปเดตข้อมูล</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
