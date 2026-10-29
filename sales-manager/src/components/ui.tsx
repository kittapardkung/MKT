import type { Risk, Stage, Temperature } from "@/lib/types";
import { FLAG_TH, STAGE_TH } from "@/lib/format";

export function TempChip({ t }: { t: Temperature }) {
  if (!t) return <span className="rounded-full bg-line px-2 py-0.5 text-xs text-muted">ยังไม่ประเมิน</span>;
  const cls = t === "HOT" ? "bg-danger-soft text-danger" : t === "WARM" ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{t}</span>;
}

export function StageChip({ s }: { s: Stage }) {
  return <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{STAGE_TH[s]}</span>;
}

export function RiskDot({ r }: { r: Risk }) {
  const cls = r === "HIGH" ? "bg-danger" : r === "MEDIUM" ? "bg-warn" : "bg-ok";
  const th = r === "HIGH" ? "เสี่ยงสูง" : r === "MEDIUM" ? "เสี่ยงกลาง" : "ปกติ";
  return <span className="inline-flex items-center gap-1 text-xs text-muted"><span className={`h-2 w-2 rounded-full ${cls}`} />{th}</span>;
}

export function Flags({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f} className="rounded bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn">{FLAG_TH[f] ?? f}</span>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "danger" | "warn" | "ok" }) {
  const c = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-1 text-2xl font-bold ${c}`}>{value}</div>
    </div>
  );
}
