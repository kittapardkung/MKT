import { Star } from "lucide-react";
import type { Risk, Stage, Temperature } from "@/lib/types";
import { FLAG_TH, STAGE_TH } from "@/lib/format";
import { STAGE_GROUPS } from "@/lib/analytics";

export function TempChip({ t }: { t: Temperature }) {
  if (!t) return <span className="rounded-full bg-line px-2 py-0.5 text-[11px] text-muted">ยังไม่ประเมิน</span>;
  const cls = t === "HOT" ? "bg-danger-soft text-danger" : t === "WARM" ? "bg-warn-soft text-warn" : "bg-line text-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{t}</span>;
}

export function StageChip({ s }: { s: Stage }) {
  return <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{STAGE_TH[s]}</span>;
}

export function RiskPill({ r }: { r: Risk }) {
  const cls = r === "HIGH" ? "bg-danger-soft text-danger" : r === "MEDIUM" ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok";
  const th = r === "HIGH" ? "เสี่ยงสูง" : r === "MEDIUM" ? "เสี่ยงกลาง" : "ปกติ";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{th}</span>;
}

export function Flags({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {flags.map((f) => (<span key={f} className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn">{FLAG_TH[f] ?? f}</span>))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-sm text-muted">{children}</div>;
}

export function Avatar({ name }: { name: string | null }) {
  const t = (name ?? "?").trim().replace(/^คุณ\s*/, "").slice(0, 2).toUpperCase();
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-warn">{t}</span>;
}

export const stageColor = (s: Stage) => STAGE_GROUPS.find((g) => g.stages.includes(s))?.color ?? "#9ca3af";

export function StagePill({ s }: { s: Stage }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: stageColor(s) }} />{STAGE_TH[s]}
    </span>
  );
}

export function StarButton({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `เอาดาวออก: ${label}` : `ติดดาวลูกค้าเป้าหมาย: ${label}`} title={on ? "ลูกค้าเป้าหมาย — กดเพื่อเอาออก" : "ติดดาว = ลูกค้าเป้าหมาย (โอกาสสูง / deal ใหญ่)"}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-bg">
      <Star size={18} className={on ? "fill-amber-400 text-amber-500" : "text-muted"} />
    </button>
  );
}

export const baht = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `฿${n.toLocaleString("th-TH")}`);
