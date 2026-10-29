"use client";
import { useState } from "react";
import { BookOpenText, X } from "lucide-react";
import { STAGE_ORDER, STAGE_TH, STATUS_GUIDE } from "@/lib/format";
import type { Stage } from "@/lib/types";
import { StagePill } from "./ui";

export function StatusGuideCard({ stage }: { stage: Stage }) {
  const g = STATUS_GUIDE[stage];
  return (
    <div className="rounded-2xl border border-line bg-bg p-3 text-sm" role="note">
      <div className="flex items-center gap-2"><StagePill s={stage} /><span className="font-semibold">{g.meaning}</span></div>
      <dl className="mt-2 space-y-1">
        <div><dt className="inline font-semibold">เซลล์ต้องทำ: </dt><dd className="inline">{g.todo}</dd></div>
        <div><dt className="inline font-semibold text-warn">ห้ามใช้เมื่อ: </dt><dd className="inline text-muted">{g.notWhen}</dd></div>
        {g.evidence && <div><dt className="inline font-semibold text-danger">เงื่อนไข: </dt><dd className="inline">{g.evidence}</dd></div>}
      </dl>
    </div>
  );
}

export default function StatusGuideButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium ${className}`}>
        <BookOpenText size={16} />ความหมายสถานะ
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="ความหมายสถานะลีด" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-surface p-4 sm:rounded-3xl lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold">ความหมายสถานะลีด</h2><p className="text-sm text-muted">เลือกสถานะให้ตรงความหมาย — สถานะที่มีเงื่อนไขระบบจะไม่ให้เปลี่ยนถ้ายังไม่มีหลักฐาน</p></div>
              <button aria-label="ปิด" onClick={() => setOpen(false)} className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line"><X size={18} /></button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-2 pr-3 font-medium">สถานะ</th><th className="py-2 pr-3 font-medium">ความหมาย</th><th className="py-2 pr-3 font-medium">เซลล์ต้องทำ</th><th className="py-2 font-medium">ห้ามใช้เมื่อ / เงื่อนไข</th></tr></thead>
                <tbody>
                  {STAGE_ORDER.map((s, i) => { const g = STATUS_GUIDE[s]; return (
                    <tr key={s} className="border-b border-line align-top last:border-0">
                      <td className="py-3 pr-3 whitespace-nowrap"><span className="num mr-2 text-xs text-muted">{String(i + 1).padStart(2, "0")}</span><StagePill s={s} /><div className="mt-1 text-[11px] text-muted">{s}</div></td>
                      <td className="py-3 pr-3">{g.meaning}</td><td className="py-3 pr-3">{g.todo}</td>
                      <td className="py-3"><span className="text-muted">{g.notWhen}</span>{g.evidence && <div className="mt-1 text-xs font-semibold text-danger">{g.evidence}</div>}</td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">ชื่อภาษาไทยในระบบ: {STAGE_ORDER.map((s) => `${s} = ${STAGE_TH[s]}`).join(" · ")}</p>
          </div>
        </div>
      )}
    </>
  );
}
