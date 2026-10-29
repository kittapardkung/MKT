"use client";
import { useMemo, useState } from "react";
import type { LeadRow, Risk } from "@/lib/types";
import { fmtDateTime, maskPhone } from "@/lib/format";
import { Empty, Flags, RiskDot, StageChip, TempChip } from "./ui";

const FILTERS: Array<[string, string, (l: LeadRow) => boolean]> = [
  ["all", "ทั้งหมด", () => true],
  ["risk", "เสี่ยงสูง", (l) => l.risk_level === "HIGH"],
  ["active", "ยังเปิดอยู่", (l) => l.stage !== "WON" && l.stage !== "LOST"],
  ["noaction", "ไม่มีนัดถัดไป", (l) => l.flags.includes("NO_NEXT_FOLLOWUP")],
  ["lost", "LOST", (l) => l.stage === "LOST"],
];
const RISK_ORDER: Record<Risk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export default function LeadsView({ leads, onOpen, showOwner }: { leads: LeadRow[]; onOpen: (id: string) => void; showOwner: boolean }) {
  const [f, setF] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const fn = FILTERS.find((x) => x[0] === f)![2];
    const s = q.trim().toLowerCase();
    return leads.filter(fn)
      .filter((l) => !s || `${l.customer_name ?? ""} ${l.lead_code} ${l.interested_model ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(s))
      .sort((a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level]);
  }, [leads, f, q]);

  return (
    <section>
      <h1 className="text-xl font-bold">{showOwner ? "ลีดทั้งหมด" : "ลีดของฉัน"}</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ / เบอร์ / รหัสลีด / รุ่น"
        className="mt-3 min-h-11 w-full rounded-xl border border-line bg-surface px-3" />
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setF(k)}
            className={`shrink-0 rounded-full border px-3 text-sm ${f === k ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line text-muted"}`}>{label}</button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {rows.length === 0 && <Empty>ไม่พบลีดตามเงื่อนไข</Empty>}
        {rows.map((l) => (
          <button key={l.lead_id} onClick={() => onOpen(l.lead_id)} className="block w-full rounded-xl border border-line bg-surface p-3 text-left">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{l.customer_name ?? l.lead_code}</span>
              <RiskDot r={l.risk_level} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <TempChip t={l.temperature} /><StageChip s={l.stage} />
              {l.interested_model && <span>· {l.interested_model}</span>}
              {showOwner && <span>· {l.responsible_sales ?? "ยังไม่มอบหมาย"}</span>}
            </div>
            <div className="mt-2 text-xs text-muted">
              ติดต่อล่าสุด {fmtDateTime(l.last_contact_at)} · นัดถัดไป {fmtDateTime(l.next_follow_up_at)} · {maskPhone(l.phone)}
            </div>
            <Flags flags={l.flags} />
          </button>
        ))}
      </div>
    </section>
  );
}
