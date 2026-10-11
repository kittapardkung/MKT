import { useMemo, useState } from 'react';
import type { Lead } from '@/lib/types';
import { MONTHS_TH, parseDate, ymd } from '@/lib/date-utils';

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 1000) / 10 : 0;
}

const STATUS_PALETTE = ['#5b5bd6', '#22c55e', '#f59e0b', '#38bdf8', '#ef4444', '#8b5cf6', '#14b8a6', '#9ca3af'];

const STATUS_LABELS: Record<string, string> = {
  NEW: 'ลีดใหม่',
  CONTACTED: 'ติดต่อแล้ว',
  FOLLOW_UP: 'ติดตามต่อ',
  TEST_DRIVE: 'นัดทดลองขับ',
  APPOINTMENT: 'นัดหมาย',
  QUOTATION: 'เสนอราคา',
  BOOKING: 'จอง',
  PROSPECT: 'ลูกค้าคาดหวัง',
  LOST: 'เสียโอกาส',
  WON: 'ปิดการขาย',
};

function statusLabel(s: string) {
  return STATUS_LABELS[s] || s || 'ไม่ระบุ';
}

const TEMP_LABELS: Record<string, string> = {
  HOT: 'น่าสนใจมาก (HOT)',
  WARM: 'น่าสนใจ (WARM)',
  COLD: 'ยังไม่สนใจ (COLD)',
};

function tempLabel(t: string) {
  return TEMP_LABELS[t] || 'ไม่ระบุ';
}

function tempColor(t: string) {
  if (t === 'HOT') return 'var(--danger)';
  if (t === 'WARM') return 'var(--warning)';
  if (t === 'COLD') return 'var(--info)';
  return 'var(--gray)';
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const startOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const startInner = polarToCartesian(cx, cy, rInner, startAngle);
  const endInner = polarToCartesian(cx, cy, rInner, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ');
}

function DonutCard({
  title,
  slices,
  total,
  totalLabel,
}: {
  title: string;
  slices: { key: string; label: string; count: number; color: string }[];
  total: number;
  totalLabel: string;
}) {
  const withAngles = useMemo(() => {
    return slices.reduce<Array<(typeof slices)[number] & { startAngle: number; endAngle: number; pct: number }>>(
      (acc, s) => {
        const prevEnd = acc.length ? acc[acc.length - 1].endAngle : 0;
        const frac = total ? s.count / total : 0;
        const sweep = Math.min(frac * 360, 359.99);
        acc.push({ ...s, startAngle: prevEnd, endAngle: prevEnd + sweep, pct: Math.round(frac * 100) });
        return acc;
      },
      []
    );
  }, [slices, total]);

  return (
    <div className="card">
      <h2>{title}</h2>
      {!total ? (
        <Empty text="ยังไม่มีข้อมูล" />
      ) : (
        <div className="pie-chart-wrap">
          <svg viewBox="0 0 200 200" className="pie-chart-svg">
            {withAngles.map((s) => (
              <path key={s.key} d={donutSlicePath(100, 100, 82, 48, s.startAngle, s.endAngle)} fill={s.color}>
                <title>{`${s.label}: ${s.count} (${s.pct}%)`}</title>
              </path>
            ))}
            <circle cx="100" cy="100" r="47" fill="var(--surface)" />
            <text x="100" y="96" textAnchor="middle" className="pie-chart-total-num">{total}</text>
            <text x="100" y="115" textAnchor="middle" className="pie-chart-total-label">{totalLabel}</text>
          </svg>
          <div className="pie-chart-legend">
            {withAngles.map((s) => (
              <div className="pie-chart-legend-row" key={s.key}>
                <span className="chart-dot" style={{ background: s.color }} />
                <span className="pie-chart-legend-label">{s.label}</span>
                <span className="pie-chart-legend-value num">{s.count} · {s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeBarList({ items }: { items: { label: string; count: number; pct: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="bar-chart">
      {items.map((item, i) => (
        <div className="bar-chart-row" key={i}>
          <div className="bar-chart-label">{item.label}</div>
          <div className="bar-chart-track">
            <div className="bar-chart-fill bar-chart-fill-highlight" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <div className="bar-chart-value">{item.count} · {item.pct}%</div>
        </div>
      ))}
    </div>
  );
}

// หมวดคุณภาพคอมเมนต์เซลล์ — จับคำสำคัญจาก Sales_Reply + Follow_Up_Note (เรียงลำดับความสำคัญ หมวดแรกที่ match ใช้ก่อน)
const QUALITATIVE_THEMES: { key: string; label: string; keywords: string[] }[] = [
  { key: 'dropped', label: 'เลิกติดตาม / ไม่สนใจแล้ว', keywords: ['เลิกติดตาม', 'ไม่สนใจ', 'ยกเลิก'] },
  { key: 'financing', label: 'เงื่อนไข / สินเชื่อไม่ผ่าน', keywords: ['ไม่เข้าเงื่อนไข', 'สินเชื่อ', 'ไฟแนนซ์', 'เครดิต', 'ดาวน์', 'ผ่อน'] },
  { key: 'unreachable', label: 'ติดต่อไม่ได้ / ไม่ตอบรับ', keywords: ['ติดต่อไม่ได้', 'ไม่รับสาย', 'ไม่ตอบ', 'เงียบ', 'ปิดเบอร์', 'สายไม่ติด'] },
  { key: 'competitor', label: 'เทียบคู่แข่ง / ซื้อแบรนด์อื่น', keywords: ['คู่แข่ง', 'แบรนด์อื่น', 'ยี่ห้ออื่น', 'aion', 'byd', 'เทียบ'] },
  { key: 'test_drive', label: 'นัดทดลองขับ / นัดหมาย', keywords: ['test drive', 'ทดลองขับ', 'นัด'] },
  { key: 'price', label: 'ราคา / โปรโมชัน', keywords: ['ราคาแพง', 'ลดราคา', 'โปรโมชัน', 'ส่วนลด', 'แพงไป'] },
  { key: 'mismatch', label: 'สินค้าไม่ตรงความต้องการ', keywords: ['ไม่ตรงกับ', 'ไม่ตรงความต้องการ', 'รถตู้', 'บรรทุก'] },
  { key: 'closed', label: 'ปิดการขายแล้ว / จอง', keywords: ['จอง', 'ปิดการขาย', 'ตัดสินใจซื้อ'] },
  { key: 'thinking', label: 'ขอคิดดูก่อน / ปรึกษาครอบครัว', keywords: ['ปรึกษา', 'คิดดูก่อน', 'ขอเวลา', 'ยังไม่รีบ', 'ยังไม่พร้อม', 'ยังไม่สะดวก'] },
  { key: 'waiting', label: 'สนใจรอดูช่วงเวลา / รอโปร', keywords: ['รอ', 'ช่วงนี้ยัง', 'รอดู'] },
];

function classifyComment(text: string): string[] {
  const matched: string[] = [];
  for (const theme of QUALITATIVE_THEMES) {
    if (theme.keywords.some((kw) => text.includes(kw))) matched.push(theme.key);
  }
  return matched.length ? matched : ['other'];
}

type QualSegment = 'all' | 'lost' | 'warmhot';

function QualitativeCard({ leads }: { leads: Lead[] }) {
  const [segment, setSegment] = useState<QualSegment>('all');

  const withComments = useMemo(
    () => leads.filter((l) => (l.sales_reply && l.sales_reply.trim()) || (l.follow_up_note && l.follow_up_note.trim())),
    [leads]
  );

  const segmented = useMemo(() => {
    if (segment === 'lost') return withComments.filter((l) => l.lead_status === 'LOST');
    if (segment === 'warmhot') return withComments.filter((l) => l.lead_temperature === 'HOT' || l.lead_temperature === 'WARM');
    return withComments;
  }, [withComments, segment]);

  const themeCounts = useMemo(() => {
    const map = new Map<string, number>();
    const examples = new Map<string, Lead>();
    segmented.forEach((l) => {
      const text = `${l.sales_reply || ''} ${l.follow_up_note || ''}`;
      for (const key of classifyComment(text)) {
        map.set(key, (map.get(key) || 0) + 1);
        if (!examples.has(key)) examples.set(key, l);
      }
    });
    const total = segmented.length;
    const rows = [
      ...QUALITATIVE_THEMES.map((t) => ({ key: t.key, label: t.label, count: map.get(t.key) || 0 })),
      { key: 'other', label: 'อื่นๆ / ไม่เข้าหมวด', count: map.get('other') || 0 },
    ]
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((r) => ({ ...r, pct: pct(r.count, total), example: examples.get(r.key) }));
    return rows;
  }, [segmented]);

  return (
    <div className="card">
      <h2>วิเคราะห์เชิงคุณภาพ — คอมเมนต์เซลล์ (Sales_Reply / Follow_Up_Note)</h2>
      <div className="meta" style={{ marginBottom: 10 }}>
        พบคอมเมนต์ {withComments.length} รายการ จากทั้งหมด {leads.length} ลีด · จัดกลุ่มด้วยคำสำคัญในคอมเมนต์ (อาจเข้าได้มากกว่า 1 หมวดต่อลีด)
      </div>
      <div className="spark-tabs">
        <button className={`spark-tab ${segment === 'all' ? 'active' : ''}`} onClick={() => setSegment('all')}>
          ทั้งหมด ({withComments.length})
        </button>
        <button className={`spark-tab ${segment === 'lost' ? 'active' : ''}`} onClick={() => setSegment('lost')}>
          เฉพาะ LOST ({withComments.filter((l) => l.lead_status === 'LOST').length})
        </button>
        <button className={`spark-tab ${segment === 'warmhot' ? 'active' : ''}`} onClick={() => setSegment('warmhot')}>
          เฉพาะ WARM/HOT ({withComments.filter((l) => l.lead_temperature === 'HOT' || l.lead_temperature === 'WARM').length})
        </button>
      </div>
      {themeCounts.length ? (
        <>
          <ThemeBarList items={themeCounts.map((r) => ({ label: r.label, count: r.count, pct: r.pct }))} />
          <div className="quote-list" style={{ marginTop: 16 }}>
            {themeCounts.slice(0, 5).map((r) => {
              const text = r.example ? (r.example.sales_reply || r.example.follow_up_note || '') : '';
              if (!text) return null;
              return (
                <div className="quote-card" key={r.key}>
                  <div className="quote-card-theme">{r.label}</div>
                  <div className="quote-card-text">&ldquo;{text}&rdquo;</div>
                  {r.example && (
                    <div className="quote-card-meta">
                      {statusLabel(r.example.lead_status || '')}
                      {r.example.lead_temperature ? ` · ${tempLabel(r.example.lead_temperature)}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <Empty text="ยังไม่มีคอมเมนต์ในกลุ่มนี้" />
      )}
    </div>
  );
}

function BySalesCard({ leads }: { leads: Lead[] }) {
  const bySales = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const s = l.assigned_sales || 'ไม่ระบุผู้ดูแล';
      map.set(s, (map.get(s) || 0) + 1);
    });
    const total = leads.length;
    return Array.from(map.entries())
      .map(([sales, count]) => ({ label: sales, count, pct: pct(count, total) }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  return (
    <div className="card">
      <h2>จำนวนลีดต่อเซล</h2>
      {bySales.length ? <ThemeBarList items={bySales} /> : <Empty text="ยังไม่มีข้อมูล" />}
    </div>
  );
}

export default function LeadsOverviewPage({ leads }: { leads: Lead[] }) {
  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const total = leads.length;

  const newThisMonth = useMemo(
    () => leads.filter((l) => {
      const d = parseDate(l.created_date || '');
      return d && ymd(d) >= ymd(monthStart);
    }),
    [leads, monthStart]
  );

  const statusOrder = useMemo(() => {
    const seen: string[] = [];
    leads.forEach((l) => {
      const s = l.lead_status || 'ไม่ระบุ';
      if (!seen.includes(s)) seen.push(s);
    });
    return seen;
  }, [leads]);

  const statusSlices = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const s = l.lead_status || 'ไม่ระบุ';
      map.set(s, (map.get(s) || 0) + 1);
    });
    return statusOrder
      .map((s, i) => ({ key: s, label: statusLabel(s), count: map.get(s) || 0, color: STATUS_PALETTE[i % STATUS_PALETTE.length] }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [leads, statusOrder]);

  const tempSlices = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const t = l.lead_temperature || 'ไม่ระบุ';
      map.set(t, (map.get(t) || 0) + 1);
    });
    const order = ['HOT', 'WARM', 'COLD', 'ไม่ระบุ'];
    return order
      .map((t) => ({ key: t, label: tempLabel(t), count: map.get(t) || 0, color: tempColor(t) }))
      .filter((s) => s.count > 0);
  }, [leads]);

  const interestingCount = useMemo(
    () => leads.filter((l) => l.lead_temperature === 'HOT' || l.lead_temperature === 'WARM').length,
    [leads]
  );

  const lostCount = useMemo(() => leads.filter((l) => l.lead_status === 'LOST').length, [leads]);
  const wonCount = useMemo(() => leads.filter((l) => l.lead_status === 'WON').length, [leads]);
  const activeCount = total - lostCount;

  return (
    <>
      <div className="calendar-head" style={{ marginBottom: 0 }}>
        <h1 style={{ marginBottom: 0 }}>ภาพรวมลีด</h1>
      </div>
      <div className="meta" style={{ marginBottom: 14 }}>
        สรุปทั้งเชิงปริมาณ (สถานะ/ความสนใจ/เซล) และเชิงคุณภาพ (คอมเมนต์เซลล์) จากข้อมูลลีดทั้งหมดที่ซิงก์ไว้ — ไม่ได้กรองตามช่วงวันที่ของ topbar
      </div>

      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <div className="card kpi-cell">
          <div className="kpi-title">
            ลีดทั้งหมด
            <span className="kpi-icon" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
              <span className="chart-dot" style={{ background: 'var(--purple)' }} />
            </span>
          </div>
          <div className="kpi-value">{total}</div>
        </div>
        <div className="card kpi-cell">
          <div className="kpi-title">
            ลีดใหม่เดือน{MONTHS_TH[now.getMonth()]}
            <span className="kpi-icon" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              <span className="chart-dot" style={{ background: 'var(--info)' }} />
            </span>
          </div>
          <div className="kpi-value">{newThisMonth.length}</div>
          <div className="kpi-foot">{pct(newThisMonth.length, total)}% ของลีดทั้งหมด</div>
        </div>
        <div className="card kpi-cell">
          <div className="kpi-title">
            น่าสนใจ (HOT+WARM)
            <span className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
              <span className="chart-dot" style={{ background: 'var(--warning)' }} />
            </span>
          </div>
          <div className="kpi-value">{interestingCount}</div>
          <div className="kpi-foot">{pct(interestingCount, total)}% ของลีดทั้งหมด</div>
        </div>
        <div className="card kpi-cell">
          <div className="kpi-title">
            ยังมีลุ้น (ไม่รวม LOST)
            <span className="kpi-icon" style={{ background: 'var(--success-soft)', color: 'var(--success-dark)' }}>
              <span className="chart-dot" style={{ background: 'var(--success-dark)' }} />
            </span>
          </div>
          <div className="kpi-value">{activeCount}</div>
          <div className="kpi-foot">{pct(activeCount, total)}% ของลีดทั้งหมด</div>
        </div>
        <div className="card kpi-cell">
          <div className="kpi-title">
            ปิดการขายแล้ว (WON)
            <span className="kpi-icon" style={{ background: 'var(--success-soft)', color: 'var(--success-dark)' }}>
              <span className="chart-dot" style={{ background: 'var(--success-dark)' }} />
            </span>
          </div>
          <div className="kpi-value">{wonCount}</div>
          <div className="kpi-foot">{pct(wonCount, total)}% ของลีดทั้งหมด</div>
        </div>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 0 }}>
        <DonutCard title="สัดส่วนตามสถานะ (Lead Status)" slices={statusSlices} total={total} totalLabel="ลีดทั้งหมด" />
        <DonutCard title="สัดส่วนตามระดับความสนใจ (Lead Temperature)" slices={tempSlices} total={total} totalLabel="ลีดทั้งหมด" />
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
        <BySalesCard leads={leads} />
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
        <QualitativeCard leads={leads} />
      </div>
    </>
  );
}
