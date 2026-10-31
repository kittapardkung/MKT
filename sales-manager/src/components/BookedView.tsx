"use client";
import { useMemo, useState } from "react";
import { BadgeCheck, Clock, Eye } from "lucide-react";
import type { Booking } from "@/lib/types";
import { friendlyError } from "@/lib/format";
import { Avatar, Empty, baht } from "./ui";

const TYPE_TH = { CASH: "เงินสด", FINANCE: "ผ่อน/สินเชื่อ" } as const;
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" }).format(new Date(iso)) : "—");

export default function BookedView({ bookings, canVerify, onOpen, onVerify }: { bookings: Booking[]; canVerify: boolean; onOpen: (leadId: string) => void; onVerify: (dealId: string) => Promise<void> }) {
  const [f, setF] = useState<"all" | "pending" | "ok">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = useMemo(() => bookings.filter((b) => f === "all" || (f === "pending" ? !b.verified : b.verified)), [bookings, f]);
  const pending = bookings.filter((b) => !b.verified).length;
  const total = bookings.reduce((a, b) => a + (b.amount ?? 0), 0);

  const verify = async (id: string) => { setBusy(id); setErr(null); try { await onVerify(id); } catch (e) { setErr(friendlyError(e instanceof Error ? e.message : String(e))); } finally { setBusy(null); } };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">ลูกค้าจองแล้ว</h1>
        <p className="mt-0.5 text-sm text-muted">ลูกค้าที่เซลล์กด “จองแล้ว” พร้อมรถ รุ่น และเงื่อนไขการซื้อ — ผู้จัดการตรวจสอบหลักฐานแล้วสถานะจึงเป็น “จองแล้ว”</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {([["จองทั้งหมด", bookings.length], ["รอตรวจสอบ", pending], ["เงินจองรวม", baht(total)]] as Array<[string, string | number]>).map(([k, v]) => (
          <div key={k} className="card p-3"><div className="text-xs text-muted">{k}</div><div className="num mt-1 text-xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {([["all", "ทั้งหมด"], ["pending", "รอตรวจสอบ"], ["ok", "ตรวจสอบแล้ว"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setF(k)} aria-pressed={f === k} className={`min-h-10 shrink-0 rounded-full px-4 text-sm ${f === k ? "bg-dark font-semibold text-dark-ink" : "card text-muted"}`}>{label}</button>
        ))}
      </div>
      {err && <div role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm text-danger">{err}</div>}
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {rows.length === 0 && <div className="lg:col-span-2"><Empty>ยังไม่มีรายการจอง — เซลล์กดปุ่ม “จองแล้ว” ในหน้ารายละเอียดลีดได้เลย</Empty></div>}
        {rows.map((b) => {
          const d = b.details;
          return (
            <article key={b.deal_id} className="card p-4">
              <div className="flex items-start gap-3">
                <Avatar name={b.customer_name ?? b.lead_code} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{b.customer_name ?? b.lead_code}</h2>
                  <div className="text-xs text-muted">ใบจอง {b.doc_ref} · {day(b.booked_on)} · เซลล์ {b.responsible_sales ?? "—"}</div>
                </div>
                {b.verified
                  ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok"><BadgeCheck size={13} />ตรวจสอบแล้ว</span>
                  : <span className="flex shrink-0 items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn"><Clock size={13} />รอตรวจสอบ</span>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div><dt className="text-xs text-muted">รถ / รุ่น</dt><dd className="font-medium">{[d.model, d.variant].filter(Boolean).join(" ") || "—"}</dd></div>
                <div><dt className="text-xs text-muted">สี</dt><dd>{d.color ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted">เงื่อนไขการซื้อ</dt><dd>{d.purchase_type ? TYPE_TH[d.purchase_type] : "—"}{d.purchase_type === "FINANCE" && d.term_months ? ` · ${d.term_months} งวด` : ""}</dd></div>
                <div><dt className="text-xs text-muted">เงินจอง / ราคารถ</dt><dd className="num">{baht(b.amount)} / {baht(d.vehicle_price)}</dd></div>
                {d.purchase_type === "FINANCE" && <div><dt className="text-xs text-muted">เงินดาวน์</dt><dd className="num">{baht(d.down_payment)}</dd></div>}
                {d.purchase_type === "FINANCE" && <div><dt className="text-xs text-muted">ไฟแนนซ์</dt><dd>{d.bank ?? "—"}</dd></div>}
                {d.promo && <div className="col-span-2"><dt className="text-xs text-muted">โปรโมชั่น / ของแถม</dt><dd>{d.promo}</dd></div>}
                {d.note && <div className="col-span-2"><dt className="text-xs text-muted">หมายเหตุ</dt><dd>{d.note}</dd></div>}
              </dl>
              <div className="mt-3 flex gap-2">
                {canVerify && !b.verified && <button disabled={busy === b.deal_id} onClick={() => verify(b.deal_id)} className="btn-dark focus-ring min-h-11 flex-1 disabled:opacity-60">{busy === b.deal_id ? "กำลังตรวจสอบ…" : "ตรวจสอบหลักฐานการจอง"}</button>}
                <button onClick={() => onOpen(b.lead_id)} className="focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[14px] border border-line font-semibold"><Eye size={16} />ดูลีด</button>
              </div>
              {b.verified && <p className="mt-2 text-xs text-muted">ตรวจสอบโดย {b.verified_by_name ?? "—"} · {day(b.verified_at)}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
