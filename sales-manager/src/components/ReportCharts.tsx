// กราฟแท่งแบบ CSS ล้วน (ไม่ใช้ไลบรารี) — ตัวเลขกำกับทุกแท่ง อ่านได้ทั้งบนมือถือและเครื่องอ่านหน้าจอ
export type Seg = { label: string; v: number; color: string };

export const C = { ok: "#2f9e63", info: "#3b82f6", warn: "#f59e0b", bad: "#c0262d", gray: "#9ca3af", dark: "#374151" };

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
      {items.map((i) => (<li key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden="true" />{i.label}</li>))}
    </ul>
  );
}

export function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** แท่งซ้อน: แต่ละแถวคือ 1 คน/หมวด แบ่งสีตามสัดส่วน */
export function StackBars({ rows }: { rows: Array<{ name: string; segs: Seg[] }> }) {
  const legend = rows[0]?.segs.map((s) => ({ label: s.label, color: s.color })) ?? [];
  return (
    <div>
      <div className="space-y-3">
        {rows.map((r) => {
          const total = r.segs.reduce((a, s) => a + s.v, 0);
          return (
            <div key={r.name} role="img" aria-label={`${r.name}: ${r.segs.map((s) => `${s.label} ${s.v}`).join(", ")}`}>
              <div className="mb-1 flex items-baseline justify-between text-xs"><span className="font-medium">{r.name}</span><span className="num text-muted">รวม {total}</span></div>
              <div className="flex h-7 overflow-hidden rounded-lg bg-line">
                {total === 0 ? <span className="m-auto text-[11px] text-muted">ไม่มีข้อมูล</span> : r.segs.filter((s) => s.v > 0).map((s) => (
                  <span key={s.label} className="num grid place-items-center text-[11px] font-bold text-white" style={{ width: `${(s.v * 100) / total}%`, background: s.color, minWidth: s.v > 0 ? 18 : 0 }}>{(s.v * 100) / total >= 7 ? s.v : ""}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Legend items={legend} />
    </div>
  );
}

/** แท่งคู่: เทียบ 2 ค่า (เช่น ช่วงนี้ vs ช่วงก่อน) */
export function PairBars({ rows, aLabel, bLabel }: { rows: Array<{ name: string; a: number; b: number }>; aLabel: string; bLabel: string }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  return (
    <div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.name} role="img" aria-label={`${r.name}: ${aLabel} ${r.a}, ${bLabel} ${r.b}`}>
            <div className="mb-1 text-xs font-medium">{r.name}</div>
            {([[aLabel, r.a, C.info], [bLabel, r.b, C.gray]] as Array<[string, number, string]>).map(([l, v, col]) => (
              <div key={l} className="mb-1 flex items-center gap-2">
                <div className="h-4 flex-1 overflow-hidden rounded bg-line"><div className="h-full rounded" style={{ width: `${(v * 100) / max}%`, background: col }} /></div>
                <span className="num w-9 text-right text-xs">{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Legend items={[{ label: aLabel, color: C.info }, { label: bLabel, color: C.gray }]} />
    </div>
  );
}

/** แท่งเดี่ยวเรียงลำดับ (เช่น ท่อขายตามสถานะ) */
export function SimpleBars({ rows, color = C.info }: { rows: Array<{ name: string; v: number }>; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2" role="img" aria-label={`${r.name}: ${r.v}`}>
          <span className="w-28 shrink-0 truncate text-xs text-muted sm:w-32">{r.name}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-line"><div className="h-full rounded" style={{ width: `${(r.v * 100) / max}%`, background: color }} /></div>
          <span className="num w-10 text-right text-xs">{r.v}</span>
        </div>
      ))}
    </div>
  );
}
