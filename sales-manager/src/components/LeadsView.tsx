"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, LayoutGrid, Phone, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import type { LeadRow, Risk, Stage, Temperature } from "@/lib/types";
import { FLAG_TH, STAGE_ORDER, STAGE_TH, STATUS_GUIDE, fmtDateTime, maskPhone } from "@/lib/format";
import { modelOf } from "@/lib/analytics";
import { Avatar, Empty, Flags, RiskPill, StagePill, StageChip, StarButton, TempChip } from "./ui";
import StatusGuideButton from "./StatusGuide";

const STAGES: Stage[] = STAGE_ORDER;
const STAGE_RANK = Object.fromEntries(STAGES.map((s, i) => [s, i])) as Record<Stage, number>;
const RISKS: Risk[] = ["HIGH", "MEDIUM", "LOW"];
const RISK_TH: Record<Risk, string> = { HIGH: "เสี่ยงสูง", MEDIUM: "เสี่ยงกลาง", LOW: "ปกติ" };
const RISK_RANK: Record<Risk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const TEMPS: Array<NonNullable<Temperature> | "NONE"> = ["HOT", "WARM", "COLD", "NONE"];
const NO_OWNER = "ยังไม่มอบหมาย";
const ACTIVE = (l: LeadRow) => l.stage !== "WON" && l.stage !== "LOST";

type Sel = Set<string>;
interface Filters { stages: Sel; temps: Sel; risks: Sel; owners: Sel; models: Sel; flags: Sel; created: number }
const EMPTY: Filters = { stages: new Set(), temps: new Set(), risks: new Set(), owners: new Set(), models: new Set(), flags: new Set(), created: 0 };

const PRESETS: Array<{ key: string; label: string; test: (l: LeadRow) => boolean }> = [
  { key: "all", label: "ทุกลีด", test: () => true },
  { key: "due", label: "ต้องติดตามเดี๋ยวนี้", test: (l) => l.flags.includes("OVERDUE_FOLLOWUP") || l.flags.includes("FIRST_CONTACT_OVERDUE") },
  { key: "risk", label: "เสี่ยงสูง", test: (l) => l.risk_level === "HIGH" },
  { key: "hot", label: "ลีดร้อน / อุ่น (ยังเปิด)", test: (l) => ACTIVE(l) && (l.temperature === "HOT" || l.temperature === "WARM") },
  { key: "noaction", label: "ไม่มีนัดถัดไป", test: (l) => l.flags.includes("NO_NEXT_FOLLOWUP") },
  { key: "signal", label: "LOST แต่ลูกค้ายังทัก", test: (l) => l.flags.includes("LOST_WITH_SIGNAL") },
  { key: "deal", label: "จองแล้ว / ปิดการขาย", test: (l) => ["BOOKING", "FINANCE_PENDING", "FINANCE_APPROVED", "READY_TO_DELIVER", "WON"].includes(l.stage) },
  { key: "starred", label: "⭐ ลูกค้าเป้าหมาย", test: (l) => l.starred },
];

type SortKey = "name" | "owner" | "stage" | "temp" | "risk" | "last" | "next" | "created";
const TEMP_RANK: Record<string, number> = { HOT: 0, WARM: 1, COLD: 2, NONE: 3 };
const tempKey = (l: LeadRow) => l.temperature ?? "NONE";

function sortRows(rows: LeadRow[], key: SortKey, dir: 1 | -1) {
  const val = (l: LeadRow): number | string => {
    switch (key) {
      case "name": return (l.customer_name ?? l.lead_code).toLowerCase();
      case "owner": return l.responsible_sales ?? "~";
      case "stage": return STAGE_RANK[l.stage];
      case "temp": return TEMP_RANK[tempKey(l)];
      case "risk": return RISK_RANK[l.risk_level];
      case "last": return l.last_contact_at ? Date.parse(l.last_contact_at) : -Infinity;
      case "next": return l.next_follow_up_at ? Date.parse(l.next_follow_up_at) : Infinity;
      case "created": return Date.parse(l.created_at);
    }
  };
  return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || Date.parse(b.created_at) - Date.parse(a.created_at); });
}

function Chip({ label, on, onClick, n, title }: { label: string; on: boolean; onClick: () => void; n?: number; title?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} title={title}
      className={`focus-ring min-h-9 rounded-full border px-3 text-sm ${on ? "border-dark bg-dark text-dark-ink" : "border-line text-muted hover:bg-bg"}`}>
      {label}{n !== undefined && <span className="num ml-1.5 text-xs opacity-60">{n}</span>}
    </button>
  );
}

function toggle(set: Sel, v: string): Sel { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; }

function LeadCard({ l, onOpen, showOwner, onStar }: { l: LeadRow; onOpen: (id: string) => void; showOwner: boolean; onStar: (id: string, on: boolean) => void }) {
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(l.lead_id)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(l.lead_id); }} className="card focus-ring block w-full cursor-pointer p-4 text-left transition hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <Avatar name={l.customer_name ?? l.lead_code} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{l.customer_name ?? l.lead_code}</span><span className="flex items-center gap-1"><RiskPill r={l.risk_level} /><StarButton on={l.starred} label={l.customer_name ?? l.lead_code} onToggle={() => onStar(l.lead_id, !l.starred)} /></span></div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <TempChip t={l.temperature} /><StageChip s={l.stage} />
            {l.interested_model && <span>· {l.interested_model}</span>}
            {showOwner && <span>· {l.responsible_sales ?? NO_OWNER}</span>}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted">ติดต่อล่าสุด {fmtDateTime(l.last_contact_at)} · นัดถัดไป {fmtDateTime(l.next_follow_up_at)} · {maskPhone(l.phone)}</div>
      <Flags flags={l.flags} />
    </div>
  );
}

export default function LeadsView({ leads, onOpen, showOwner, q, setQ, onStar }: { leads: LeadRow[]; onOpen: (id: string) => void; showOwner: boolean; q: string; setQ: (v: string) => void; onStar: (id: string, on: boolean) => void }) {
  const [preset, setPreset] = useState("all");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [now] = useState(() => Date.now());

  const upd = (patch: Partial<Filters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(0); };
  const owners = useMemo(() => [...new Set(leads.map((l) => l.responsible_sales ?? NO_OWNER))].sort(), [leads]);
  const models = useMemo(() => [...new Set(leads.map(modelOf))].sort(), [leads]);
  const flagKeys = useMemo(() => Object.keys(FLAG_TH).filter((k) => leads.some((l) => l.flags.includes(k))), [leads]);
  const count = (fn: (l: LeadRow) => boolean) => leads.filter(fn).length;

  const activeCount = filters.stages.size + filters.temps.size + filters.risks.size + filters.owners.size + filters.models.size + filters.flags.size + (filters.created ? 1 : 0);

  const rows = useMemo(() => {
    const p = PRESETS.find((x) => x.key === preset)!.test; const s = q.trim().toLowerCase();
    const f = filters; const since = f.created ? now - f.created * 86400000 : 0;
    const out = leads.filter((l) =>
      p(l)
      && (!f.stages.size || f.stages.has(l.stage))
      && (!f.temps.size || f.temps.has(tempKey(l)))
      && (!f.risks.size || f.risks.has(l.risk_level))
      && (!f.owners.size || f.owners.has(l.responsible_sales ?? NO_OWNER))
      && (!f.models.size || f.models.has(modelOf(l)))
      && (!f.flags.size || l.flags.some((x) => f.flags.has(x)))
      && (!since || Date.parse(l.created_at) >= since)
      && (!s || `${l.customer_name ?? ""} ${l.lead_code} ${l.interested_model ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(s)));
    return sortRows(out, sort.key, sort.dir);
  }, [leads, preset, filters, q, sort, now]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * pageSize, cur * pageSize + pageSize);
  const clearAll = () => { setFilters(EMPTY); setPreset("all"); setQ(""); setPage(0); };
  const doSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{showOwner ? "ลีดทั้งหมด" : "ลีดของฉัน"}</h1>
        <p className="mt-0.5 text-sm text-muted">{rows.length} จาก {leads.length} ราย · เรียงจากใหม่ล่าสุดไปเก่า (คลิกหัวคอลัมน์เพื่อเปลี่ยนการเรียง)</p>
      </div>

      <div className="card p-3 lg:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium">
            <SlidersHorizontal size={16} />{showFilters ? "ซ่อนตัวกรอง" : "แสดงตัวกรอง"}
            {activeCount > 0 && <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-black">{activeCount}</span>}
          </button>
          <label className="relative">
            <span className="sr-only">มุมมองที่บันทึกไว้</span>
            <select value={preset} onChange={(e) => { setPreset(e.target.value); setPage(0); }} className="focus-ring min-h-11 appearance-none rounded-xl border border-line bg-surface py-0 pl-3 pr-8 text-sm font-medium">
              {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label} ({count(p.test)})</option>)}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">▾</span>
          </label>
          <StatusGuideButton />
          <div className="hidden rounded-xl border border-line p-0.5 md:flex" role="group" aria-label="รูปแบบการแสดงผล">
            {([["table", Rows3, "ตาราง"], ["cards", LayoutGrid, "การ์ด"]] as const).map(([k, Icon, label]) => (
              <button key={k} aria-label={label} aria-pressed={view === k} onClick={() => setView(k)} className={`focus-ring grid h-10 w-10 place-items-center rounded-lg ${view === k ? "bg-dark text-dark-ink" : "text-muted"}`}><Icon size={16} /></button>
            ))}
          </div>
          <label className="focus-within:ring-2 focus-within:ring-accent flex min-h-11 min-w-0 basis-full items-center gap-2 rounded-xl border border-line px-3 sm:ml-auto sm:basis-auto sm:flex-1 sm:max-w-xs">
            <Search size={15} className="shrink-0 text-muted" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="ค้นหาชื่อ / เบอร์ / รหัส / รุ่น" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" />
            {q && <button aria-label="ล้างคำค้นหา" onClick={() => setQ("")} className="min-h-0 text-muted"><X size={14} /></button>}
          </label>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
            <Group title="สถานะ">{STAGES.map((s) => <Chip key={s} label={STAGE_TH[s]} title={STATUS_GUIDE[s].meaning} n={count((l) => l.stage === s)} on={filters.stages.has(s)} onClick={() => upd({ stages: toggle(filters.stages, s) })} />)}</Group>
            <Group title="ความสนใจ (Temperature)">{TEMPS.map((t) => <Chip key={t} label={t === "NONE" ? "ยังไม่ประเมิน" : t} n={count((l) => tempKey(l) === t)} on={filters.temps.has(t)} onClick={() => upd({ temps: toggle(filters.temps, t) })} />)}</Group>
            <Group title="ความเสี่ยง">{RISKS.map((r) => <Chip key={r} label={RISK_TH[r]} n={count((l) => l.risk_level === r)} on={filters.risks.has(r)} onClick={() => upd({ risks: toggle(filters.risks, r) })} />)}</Group>
            {showOwner && <Group title="ผู้ดูแล">{owners.map((o) => <Chip key={o} label={o} n={count((l) => (l.responsible_sales ?? NO_OWNER) === o)} on={filters.owners.has(o)} onClick={() => upd({ owners: toggle(filters.owners, o) })} />)}</Group>}
            <Group title="รุ่นที่สนใจ">{models.map((m) => <Chip key={m} label={m} n={count((l) => modelOf(l) === m)} on={filters.models.has(m)} onClick={() => upd({ models: toggle(filters.models, m) })} />)}</Group>
            <Group title="สัญญาณเตือน">{flagKeys.map((f) => <Chip key={f} label={FLAG_TH[f]} n={count((l) => l.flags.includes(f))} on={filters.flags.has(f)} onClick={() => upd({ flags: toggle(filters.flags, f) })} />)}</Group>
            <Group title="สร้างลีดเมื่อ">{[[0, "ทั้งหมด"], [7, "7 วัน"], [30, "30 วัน"], [90, "90 วัน"]].map(([d, label]) => <Chip key={d} label={String(label)} on={filters.created === d} onClick={() => upd({ created: Number(d) })} />)}</Group>
          </div>
        )}
        {(activeCount > 0 || preset !== "all" || q) && (
          <div className="mt-3 flex items-center justify-between gap-2 text-sm">
            <span className="text-muted">กำลังกรอง · พบ {rows.length} ราย</span>
            <button onClick={clearAll} className="focus-ring min-h-9 rounded-lg px-3 font-semibold text-warn">ล้างตัวกรองทั้งหมด</button>
          </div>
        )}
      </div>

      {rows.length === 0 ? <Empty>ไม่พบลีดตามเงื่อนไข</Empty> : (
        <>
          {/* การ์ด: มือถือ หรือเลือกมุมมองการ์ด */}
          <div className={`grid gap-3 lg:grid-cols-2 lg:gap-4 ${view === "table" ? "md:hidden" : ""}`}>
            {slice.map((l) => <LeadCard key={l.lead_id} l={l} onOpen={onOpen} showOwner={showOwner} onStar={onStar} />)}
          </div>
          {/* ตาราง: จอ md ขึ้นไป */}
          {view === "table" && (
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className="border-b border-line bg-bg/50">
                  <tr>
                    <th scope="col" className="w-10 py-3 pl-4 pr-0"><span className="sr-only">ดาว</span></th>
                    <SortTh k="name" sort={sort} onSort={doSort}>ลีด</SortTh>
                    {showOwner && <SortTh k="owner" sort={sort} onSort={doSort}>ผู้ดูแล</SortTh>}
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-muted">รุ่นที่สนใจ</th>
                    <SortTh k="stage" sort={sort} onSort={doSort}>สถานะ</SortTh><SortTh k="temp" sort={sort} onSort={doSort}>ความสนใจ</SortTh><SortTh k="risk" sort={sort} onSort={doSort}>ความเสี่ยง</SortTh>
                    <SortTh k="created" sort={sort} onSort={doSort}>เข้ามาเมื่อ</SortTh><SortTh k="last" sort={sort} onSort={doSort}>ติดต่อล่าสุด</SortTh><SortTh k="next" sort={sort} onSort={doSort}>นัดถัดไป</SortTh>
                    <th scope="col" className="px-3 py-3 pr-5 text-right text-xs font-medium text-muted">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((l) => {
                    const late = l.next_follow_up_at && ACTIVE(l) && Date.parse(l.next_follow_up_at) < now;
                    return (
                      <tr key={l.lead_id} className="border-b border-line last:border-0 hover:bg-bg/60">
                        <td className="py-3 pl-3 pr-0"><StarButton on={l.starred} label={l.customer_name ?? l.lead_code} onToggle={() => onStar(l.lead_id, !l.starred)} /></td>
                        <td className="py-3 pl-1 pr-3">
                          <button onClick={() => onOpen(l.lead_id)} className="focus-ring flex items-center gap-3 text-left">
                            <Avatar name={l.customer_name ?? l.lead_code} />
                            <span className="min-w-0"><span className="block max-w-[200px] truncate font-semibold">{l.customer_name ?? l.lead_code}</span><span className="block text-xs text-muted">{l.customer_name ? l.lead_code : maskPhone(l.phone)}</span></span>
                          </button>
                        </td>
                        {showOwner && <td className="px-3 py-3 whitespace-nowrap">{l.responsible_sales ?? <span className="text-danger">{NO_OWNER}</span>}</td>}
                        <td className="px-3 py-3 whitespace-nowrap">{l.interested_model ?? "—"}</td>
                        <td className="px-3 py-3"><StagePill s={l.stage} /></td>
                        <td className="px-3 py-3"><TempChip t={l.temperature} /></td>
                        <td className="px-3 py-3" title={l.flags.map((f) => FLAG_TH[f] ?? f).join(", ")}><RiskPill r={l.risk_level} /></td>
                        <td className="px-3 py-3 whitespace-nowrap text-muted">{fmtDateTime(l.created_at)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-muted">{fmtDateTime(l.last_contact_at)}</td>
                        <td className={`px-3 py-3 whitespace-nowrap ${late ? "font-semibold text-danger" : "text-muted"}`}>{fmtDateTime(l.next_follow_up_at)}</td>
                        <td className="px-3 py-3 pr-5">
                          <div className="flex justify-end gap-1">
                            {l.phone && <a href={`tel:${l.phone}`} aria-label={`โทรหา ${l.customer_name ?? l.lead_code}`} className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-bg"><Phone size={16} /></a>}
                            <button aria-label={`ดูรายละเอียด ${l.customer_name ?? l.lead_code}`} onClick={() => onOpen(l.lead_id)} className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-bg"><Eye size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <span className="num">แสดง {cur * pageSize + 1}–{Math.min(rows.length, (cur + 1) * pageSize)} จาก {rows.length} ราย</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2">ต่อหน้า
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="focus-ring min-h-10 rounded-lg border border-line bg-surface px-2 text-ink">{[25, 50, 100].map((n) => <option key={n}>{n}</option>)}</select>
              </label>
              <button aria-label="หน้าก่อนหน้า" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="card focus-ring grid h-10 w-10 place-items-center disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span className="num min-w-14 text-center text-ink">{cur + 1} / {pages}</span>
              <button aria-label="หน้าถัดไป" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="card focus-ring grid h-10 w-10 place-items-center disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SortTh({ k, sort, onSort, children, className = "" }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`px-3 py-3 text-left text-xs font-medium text-muted ${className}`}>
      <button onClick={() => onSort(k)} className="focus-ring inline-flex min-h-8 items-center gap-1 whitespace-nowrap hover:text-ink">
        {children}{sort.key === k && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (<fieldset className="min-w-0"><legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</legend><div className="flex flex-wrap gap-2">{children}</div></fieldset>);
}
