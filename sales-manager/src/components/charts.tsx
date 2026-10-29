"use client";
import { useId, useState } from "react";
import type { DayPoint } from "@/lib/analytics";

/** เส้นโค้งเรียบผ่านทุกจุด (Catmull-Rom → Bézier) */
function smooth(pts: Array<[number, number]>) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function Sparkline({ values, color = "#f59e0b", className = "" }: { values: number[]; color?: string; className?: string }) {
  const id = useId(); const W = 120, H = 44, max = Math.max(1, ...values);
  const pts: Array<[number, number]> = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * W, H - 4 - (v / max) * (H - 10)]);
  const line = smooth(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true" preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.45" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {line && <><path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${id})`} /><path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></>}
    </svg>
  );
}

export function AreaChart({ data, unit = "ลีด" }: { data: DayPoint[]; unit?: string }) {
  const id = useId(); const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 240, L = 36, R = 12, T = 16, B = 28;
  const max = Math.max(4, ...data.map((d) => d.value));
  const nice = Math.ceil(max / 4) * 4;
  const x = (i: number) => L + (i / Math.max(1, data.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / nice) * (H - T - B);
  const pts: Array<[number, number]> = data.map((d, i) => [x(i), y(d.value)]);
  const line = smooth(pts);
  const ticks = [0, 1, 2, 3, 4].map((i) => (nice / 4) * i);
  const labelIdx = data.length > 1 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (data.length - 1))) : [0];
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="กราฟจำนวนลีด"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.min(data.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (data.length - 1))))); }}
        onTouchStart={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.touches[0].clientX - r.left) / r.width) * W; setHover(Math.min(data.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (data.length - 1))))); }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f59e0b" stopOpacity="0.35" /><stop offset="1" stopColor="#f59e0b" stopOpacity="0.02" /></linearGradient></defs>
        {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(t)}</text></g>))}
        {labelIdx.map((i) => (<text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{data[i]?.label}</text>))}
        {line && <><path d={`${line} L ${x(data.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill={`url(#${id})`} /><path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" /></>}
        {h && hover !== null && (<g><line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="var(--muted)" strokeDasharray="3 3" /><circle cx={x(hover)} cy={y(h.value)} r="5" fill="#f59e0b" stroke="var(--surface)" strokeWidth="2" /></g>)}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-dark px-2.5 py-1.5 text-center text-xs text-dark-ink shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.value) / H) * 100 - 3}%` }}>
          <div className="num font-semibold">{h.value} {unit}</div><div className="opacity-70">{h.label}</div>
        </div>
      )}
    </div>
  );
}

export function Donut({ slices, centerLabel, centerValue }: { slices: Array<{ label: string; value: number; color: string }>; centerLabel: string; centerValue: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1; const R = 62, C = 2 * Math.PI * R;
  const arcs = slices.filter((s) => s.value > 0).reduce<Array<{ label: string; color: string; len: number; start: number }>>((out, s) => {
    const start = out.length ? out[out.length - 1].start + out[out.length - 1].len : 0;
    return [...out, { label: s.label, color: s.color, len: (s.value / total) * C, start }];
  }, []);
  return (
    <svg viewBox="0 0 160 160" className="mx-auto h-44 w-44" role="img" aria-label="สัดส่วนลีดตามสถานะ">
      <g transform="rotate(-90 80 80)">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--line)" strokeWidth="22" />
        {arcs.map((a) => (<circle key={a.label} cx="80" cy="80" r={R} fill="none" stroke={a.color} strokeWidth="22" strokeDasharray={`${Math.max(0, a.len - 1.5)} ${C}`} strokeDashoffset={-a.start} />))}
      </g>
      <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--ink)">{centerValue}</text>
      <text x="80" y="96" textAnchor="middle" fontSize="11" fill="var(--muted)">{centerLabel}</text>
    </svg>
  );
}
