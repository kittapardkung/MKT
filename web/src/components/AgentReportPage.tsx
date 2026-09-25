import { useMemo, useState } from 'react';
import type { AgentId, AgentReport, DrilldownRow, Lead } from '@/lib/types';
import { displayDateTime, parseDate, ymd } from '@/lib/date-utils';

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

const GRADE_LETTERS = new Set(['A', 'B', 'C', 'D', 'X', 'N']);

function TableRow({ row, rowKey, gradeColumn }: { row: string[]; rowKey: number; gradeColumn?: number }) {
  return (
    <tr key={rowKey}>
      {row.map((cell, j) =>
        cell.startsWith('http') ? (
          <td key={j}>
            <a href={cell} target="_blank" rel="noopener noreferrer">
              ดูตัวอย่าง ↗
            </a>
          </td>
        ) : j === gradeColumn && GRADE_LETTERS.has(cell) ? (
          <td key={j}>
            <span className={`grade-badge grade-badge-${cell}`}>{cell}</span>
          </td>
        ) : (
          <td key={j}>{cell || '—'}</td>
        )
      )}
    </tr>
  );
}

const GRADE_LEGEND: { grade: string; label: string }[] = [
  { grade: 'A', label: '≤฿100/ผลลัพธ์' },
  { grade: 'B', label: '≤฿200/ผลลัพธ์' },
  { grade: 'C', label: '≤฿300/ผลลัพธ์' },
  { grade: 'D', label: '>฿300/ผลลัพธ์' },
  { grade: 'X', label: 'งบภาพลักษณ์ (AWN/Follow)' },
  { grade: 'N', label: 'งบน้อยเกินไปจะวัดผล' },
];

function GradeLegend() {
  return (
    <div className="grade-legend">
      {GRADE_LEGEND.map((g) => (
        <span key={g.grade}>
          <span className={`grade-badge grade-badge-${g.grade}`}>{g.grade}</span>
          {g.label}
        </span>
      ))}
    </div>
  );
}

function DrilldownRowView({ row, depth, colCount }: { row: DrilldownRow; depth: number; colCount: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!row.children && row.children.length > 0;
  return (
    <>
      <tr>
        <td className="drilldown-toggle-cell">
          {hasChildren && (
            <button
              type="button"
              className="drilldown-toggle"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? 'ย่อ' : 'ขยาย'}
            >
              {open ? '▾' : '▸'}
            </button>
          )}
        </td>
        {row.cells.map((cell, j) =>
          cell.startsWith('http') ? (
            <td key={j}>
              <a href={cell} target="_blank" rel="noopener noreferrer">
                ดูตัวอย่าง ↗
              </a>
            </td>
          ) : (
            <td key={j} style={j === 0 ? { paddingLeft: 10 + depth * 18 } : undefined}>
              {cell || '—'}
            </td>
          )
        )}
      </tr>
      {open && hasChildren && row.children!.map((child, i) => (
        <DrilldownRowView row={child} depth={depth + 1} colCount={colCount} key={i} />
      ))}
    </>
  );
}

function DrilldownTable({ columns, rows }: { columns: string[]; rows: DrilldownRow[] }) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th style={{ width: 24 }}></th>
            {columns.map((col, i) => (
              <th key={i}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <DrilldownRowView row={row} depth={0} colCount={columns.length} key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TodoList({ items }: { items: { label: string; goal: string; tasks: string[] }[] }) {
  return (
    <div className="todo-grid">
      {items.map((item, i) => (
        <div className="todo-box" key={i}>
          <div className="todo-box-label">{item.label}</div>
          <div className="todo-box-goal">{item.goal}</div>
          <ul className="todo-box-tasks">
            {item.tasks.map((task, j) => (
              <li key={j}>
                <span className="todo-check">☐</span>
                {task}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BarChart({ items }: { items: { label: string; value: number; highlight?: boolean }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bar-chart">
      {items.map((item, i) => (
        <div className="bar-chart-row" key={i}>
          <div className="bar-chart-label">{item.label}</div>
          <div className="bar-chart-track">
            <div
              className={`bar-chart-fill${item.highlight ? ' bar-chart-fill-highlight' : ''}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <div className="bar-chart-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function niceMaxValue(n: number) {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const frac = n / pow;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * pow;
}

function DailySpendChartWithLeads({
  items,
  updatedAt,
  leads,
}: {
  items: { label: string; value: number; highlight?: boolean }[];
  updatedAt: string;
  leads: Lead[];
}) {
  const leadCounts = useMemo(() => {
    const byDay = new Map<string, number>();
    leads.forEach((l) => {
      const d = parseDate(l.created_date || '');
      if (!d) return;
      const key = ymd(d);
      byDay.set(key, (byDay.get(key) || 0) + 1);
    });
    const ref = parseDate(updatedAt) || new Date();
    return items.map((_, i) => {
      const d = new Date(ref.getFullYear(), ref.getMonth(), i + 1);
      return byDay.get(ymd(d)) || 0;
    });
  }, [items, updatedAt, leads]);

  return <DailySpendChart items={items} leadCounts={leadCounts} />;
}

function DailySpendChart({
  items,
  leadCounts,
}: {
  items: { label: string; value: number; highlight?: boolean }[];
  leadCounts: number[];
}) {
  const maxValue = niceMaxValue(Math.max(...items.map((i) => i.value), 0));
  const maxLeads = niceMaxValue(Math.max(...leadCounts, 0));
  const chartH = 100;
  const padTop = 10;
  const marginLeft = 46;
  const barW = items.length > 20 ? 10 : 20;
  const gap = items.length > 20 ? 4 : 10;
  const plotW = Math.max(items.length * (barW + gap) + gap, 280);
  const chartW = plotW + marginLeft;
  const showLabelEvery = Math.max(1, Math.ceil(items.length / 14));
  const tickFracs = [0, 0.25, 0.5, 0.75, 1];
  const labelStyle = { fontSize: 9 };

  const points = items.map((item, i) => {
    const x = marginLeft + gap + i * (barW + gap) + barW / 2;
    const count = leadCounts[i] || 0;
    const y = maxLeads ? padTop + chartH - (count / maxLeads) * chartH : padTop + chartH;
    return { x, y, count, label: item.label };
  });

  return (
    <>
      <div className="chart-legend">
        <span className="chart-legend-item">
          <span className="chart-dot" style={{ background: 'var(--primary)' }} />
          งบที่ใช้ (บาท)
        </span>
        <span className="chart-legend-item">
          <span className="chart-dot" style={{ background: '#c62828' }} />
          จำนวนเบอร์ที่ได้
        </span>
      </div>
      <div className="calendar-wrap">
        <svg viewBox={`0 0 ${chartW} ${chartH + padTop + 26}`} width={chartW} style={{ minWidth: '100%', overflow: 'visible' }}>
          {tickFracs.map((t) => {
            const y = padTop + chartH - chartH * t;
            return (
              <g key={t}>
                <line x1={marginLeft} x2={chartW} y1={y} y2={y} className="chart-grid" />
                <text x={marginLeft - 8} y={y} textAnchor="end" dominantBaseline="middle" className="chart-axis-label" style={labelStyle}>
                  {Math.round(maxValue * t).toLocaleString('th-TH')}
                </text>
              </g>
            );
          })}
          {items.map((item, i) => {
            const x = marginLeft + gap + i * (barW + gap);
            const h = maxValue ? Math.max((item.value / maxValue) * chartH, item.value > 0 ? 2 : 0) : 0;
            const y = padTop + chartH - h;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  fill={item.highlight ? 'var(--accent)' : 'var(--primary)'}
                >
                  <title>{`${item.label}: ฿${item.value.toLocaleString('th-TH')}`}</title>
                </rect>
                {i % showLabelEvery === 0 && (
                  <>
                    <line
                      x1={x + barW / 2}
                      x2={x + barW / 2}
                      y1={padTop + chartH}
                      y2={padTop + chartH + 5}
                      className="chart-axis-tick"
                    />
                    <text x={x + barW / 2} y={padTop + chartH + 16} textAnchor="middle" className="chart-axis-label" style={labelStyle}>
                      {item.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#c62828"
            strokeWidth={1.5}
          />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#c62828">
              <title>{`${p.label}: ${p.count} เบอร์`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </>
  );
}

const AGENT_META: Record<AgentId, { tagline: string; className: string }> = {
  SCOUT: { tagline: 'ทีมวิเคราะห์คู่แข่ง WULING CHONBURI', className: 'agent-scout' },
  COMPASS: { tagline: 'AI นักกลยุทธ์การตลาด', className: 'agent-compass' },
  SPARK: { tagline: 'AI Content Creator', className: 'agent-spark' },
  ADS: { tagline: 'ทีมโฆษณา Meta Ads — เป้า 100 เบอร์/เดือน ใต้งบ ฿45,000', className: 'agent-ads' },
  ALMANAC: { tagline: 'AI Content Planner', className: 'agent-almanac' },
};

function ReportCard({ report, leads }: { report: AgentReport; leads: Lead[] }) {
  const data = report.data;
  return (
    <div className="card report-card">
      <div className="report-card-head">
        <h2 style={{ margin: 0 }}>{report.title}</h2>
        <span className="meta">อัปเดต {displayDateTime(report.updated_at)}</span>
      </div>
      {report.body && <p className="report-body">{report.body}</p>}

      {data?.kind === 'kpi' && (
        <div className="kpi-chip-row">
          {data.items.map((item, i) => (
            <div className="kpi-chip-sm" key={i}>
              <div className="kpi-chip-label">{item.label}</div>
              <div className="kpi-chip-value">{item.value}</div>
              {item.note && <div className="kpi-chip-note">{item.note}</div>}
            </div>
          ))}
        </div>
      )}

      {data?.kind === 'scorecard' && (
        <table className="scorecard-table">
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className={row.highlight ? 'row-highlight' : ''}>
                <td>{i + 1}</td>
                <td>{row.label}</td>
                <td className="num">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data?.kind === 'list' && (
        <ul className="report-list">
          {data.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      {data?.kind === 'table' && 'groups' in data && (
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                {data.columns.map((col, i) => (
                  <th key={i}>{col}</th>
                ))}
              </tr>
            </thead>
            {data.groups.map((g, gi) => (
              <tbody key={gi}>
                <tr className="report-table-group">
                  <td colSpan={data.columns.length}>{g.label}</td>
                </tr>
                {g.rows.map((row, i) => (
                  <TableRow row={row} rowKey={i} key={i} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {data?.kind === 'table' && 'rows' in data && (
        <>
          {report.section === 'creatives' && <GradeLegend />}
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  {data.columns.map((col, i) => (
                    <th key={i}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <TableRow
                    row={row}
                    rowKey={i}
                    gradeColumn={report.section === 'creatives' ? data.columns.length - 1 : undefined}
                    key={i}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data?.kind === 'bar' && report.section === 'daily_spend' && (
        <DailySpendChartWithLeads items={data.items} updatedAt={report.updated_at} leads={leads} />
      )}
      {data?.kind === 'bar' && report.section !== 'daily_spend' && <BarChart items={data.items} />}

      {data?.kind === 'drilldown' && <DrilldownTable columns={data.columns} rows={data.rows} />}

      {data?.kind === 'todo' && <TodoList items={data.items} />}
    </div>
  );
}

export default function AgentReportPage({
  agent,
  reports,
  leads = [],
}: {
  agent: AgentId;
  reports: AgentReport[];
  leads?: Lead[];
}) {
  const meta = AGENT_META[agent];
  const mine = reports.filter((r) => r.agent === agent).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <div className={`agent-header ${meta.className}`}>
        <span className="agent-badge">{agent}</span>
        <div>
          <h1 style={{ margin: 0 }}>{agent}</h1>
          <div className="meta">{meta.tagline}</div>
        </div>
      </div>

      {mine.length ? (
        <div className="report-list-wrap">
          {mine.map((r) => (
            <ReportCard key={r.id} report={r} leads={leads} />
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty text={`ยังไม่มีรายงานจาก ${agent} — เพิ่มข้อมูลได้ผ่าน Supabase (ตาราง agent_reports)`} />
        </div>
      )}
    </>
  );
}
