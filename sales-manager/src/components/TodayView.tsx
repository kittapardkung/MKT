"use client";
import { useState } from "react";
import { Phone, ClipboardPen, AlarmClock } from "lucide-react";
import type { TodayItem } from "@/lib/types";
import { fmtDateTime, fmtOverdue, maskPhone } from "@/lib/format";
import { Empty, Flags, StageChip, TempChip } from "./ui";

const TOP_N = 15;

export default function TodayView({ items, onOpen, showOwner }: { items: TodayItem[]; onOpen: (leadId: string) => void; showOwner: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const overdue = items.filter((i) => i.overdue_minutes > 0).length;
  const veryOld = items.filter((i) => i.overdue_minutes > 7 * 1440).length;
  const shown = showAll ? items : items.slice(0, TOP_N);
  return (
    <section>
      <h1 className="text-xl font-bold">วันนี้ต้องติดต่อใครก่อน</h1>
      <p className="mt-1 text-sm text-muted">
        {items.length === 0 ? "ไม่มีงานค้างสำหรับวันนี้" : `${items.length} งาน · เลยกำหนดแล้ว ${overdue} งาน${veryOld ? ` (ค้างเกิน 7 วัน ${veryOld} งาน)` : ""} — เรียงตามความเร่งด่วน`}
      </p>
      <div className="mt-4 space-y-3">
        {items.length === 0 && <Empty>เยี่ยมมาก! ไม่มีงานติดตามค้างวันนี้</Empty>}
        {shown.map((i, idx) => (
          <article key={i.task_id} className={`rounded-2xl border bg-surface p-4 ${i.overdue_minutes > 0 ? "border-danger/40" : "border-line"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="num grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{idx + 1}</span>
                  <h2 className="truncate font-semibold">{i.customer_name ?? i.lead_code}</h2>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <TempChip t={i.temperature} /><StageChip s={i.stage} />
                  {i.interested_model && <span>· {i.interested_model}</span>}
                  {showOwner && i.responsible_sales && <span>· ผู้ดูแล {i.responsible_sales}</span>}
                </div>
              </div>
              {i.overdue_minutes > 0 ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 py-1 text-xs font-semibold text-danger">
                  <AlarmClock size={14} />เลย {fmtOverdue(i.overdue_minutes)}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-muted">ครบ {fmtDateTime(i.due_at)}</span>
              )}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div><dt className="inline font-semibold">เพราะอะไร: </dt><dd className="inline">{i.reason}</dd></div>
              <div><dt className="inline font-semibold">ต้องทำอะไร: </dt><dd className="inline">{i.action}</dd></div>
            </dl>
            <Flags flags={i.flags} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {i.phone ? (
                <a href={`tel:${i.phone}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white no-underline">
                  <Phone size={18} />โทร {maskPhone(i.phone)}
                </a>
              ) : <span />}
              <button onClick={() => onOpen(i.lead_id)} className="flex items-center justify-center gap-2 rounded-xl border border-line font-semibold">
                <ClipboardPen size={18} />บันทึกผล
              </button>
            </div>
          </article>
        ))}
        {items.length > TOP_N && (
          <button onClick={() => setShowAll((v) => !v)} className="min-h-11 w-full rounded-xl border border-line font-semibold">
            {showAll ? `แสดงเฉพาะ ${TOP_N} งานแรก` : `ดูทั้งหมด (${items.length} งาน)`}
          </button>
        )}
      </div>
    </section>
  );
}
