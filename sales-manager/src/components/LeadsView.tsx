"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { LeadRow, Risk } from "@/lib/types";
import { fmtDateTime, maskPhone } from "@/lib/format";
import { Avatar, Empty, Flags, RiskPill, StageChip, TempChip } from "./ui";

const FILTERS: Array<[string, string, (l: LeadRow) => boolean]> = [
  ["all", "ทั้งหมด", () => true],
  ["risk", "เสี่ยงสูง", (l) => l.risk_level === "HIGH"],
  ["active", "ยังเปิดอยู่", (l) => l.stage !== "WON" && l.stage !== "LOST"],
  ["noaction", "ไม่มีนัดถัดไป", (l) => l.flags.includes("NO_NEXT_FOLLOWUP")],
  ["lost", "LOST", (l) => l.stage === "LOST"],
];
const RISK_ORDER: Record<Risk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const PAGE = 40;

export default function LeadsView({ leads, onOpen, showOwner, q, setQ }: { leads: LeadRow[]; onOpen: (id: string) => void; showOwner: boolean; q: string; setQ: (v: string) => void }) {
  const [f, setF] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const rows = useMemo(() => {
    const fn = FILTERS.find((x) => x[0] === f)![2];
    const s = q.trim().toLowerCase();
    return leads.filter(fn)
      .filter((l) => !s || `${l.customer_name ?? ""} ${l.lead_code} ${l.interested_model ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(s))
      .sort((a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level]);
  }, [leads, f, q]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{showOwner ? "ลีดทั้งหมด" : "ลีดของฉัน"}</h1>
        <p className="mt-0.5 text-sm text-muted">{rows.length} จาก {leads.length} ราย · เรียงตามความเสี่ยง</p>
      </div>
      <label className="card focus-within:ring-2 focus-within:ring-accent flex min-h-11 items-center gap-2 px-3 lg:hidden">
        <Search size={16} className="text-muted" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="ค้นหาชื่อ / เบอร์ / รหัสลีด / รุ่น" className="min-h-11 flex-1 bg-transparent outline-none" />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => { setF(k); setLimit(PAGE); }} className={`min-h-10 shrink-0 rounded-full px-4 text-sm ${f === k ? "bg-dark font-semibold text-dark-ink" : "card text-muted"}`}>{label}</button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {rows.length === 0 && <div className="lg:col-span-2"><Empty>ไม่พบลีดตามเงื่อนไข</Empty></div>}
        {rows.slice(0, limit).map((l) => (
          <button key={l.lead_id} onClick={() => onOpen(l.lead_id)} className="card focus-ring block w-full p-4 text-left transition hover:-translate-y-0.5">
            <div className="flex items-start gap-3">
              <Avatar name={l.customer_name ?? l.lead_code} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{l.customer_name ?? l.lead_code}</span><RiskPill r={l.risk_level} /></div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <TempChip t={l.temperature} /><StageChip s={l.stage} />
                  {l.interested_model && <span>· {l.interested_model}</span>}
                  {showOwner && <span>· {l.responsible_sales ?? "ยังไม่มอบหมาย"}</span>}
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted">ติดต่อล่าสุด {fmtDateTime(l.last_contact_at)} · นัดถัดไป {fmtDateTime(l.next_follow_up_at)} · {maskPhone(l.phone)}</div>
            <Flags flags={l.flags} />
          </button>
        ))}
      </div>
      {rows.length > limit && <button onClick={() => setLimit((n) => n + PAGE)} className="card focus-ring min-h-11 w-full font-semibold">แสดงเพิ่ม ({rows.length - limit} ราย)</button>}
    </section>
  );
}
