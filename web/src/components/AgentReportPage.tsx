import { useState } from 'react';
import type { AgentId, AgentReport, DrilldownRow } from '@/lib/types';
import { displayDateTime } from '@/lib/date-utils';

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function TableRow({ row, rowKey }: { row: string[]; rowKey: number }) {
  return (
    <tr key={rowKey}>
      {row.map((cell, j) =>
        cell.startsWith('http') ? (
          <td key={j}>
            <a href={cell} target="_blank" rel="noopener noreferrer">
              ดูตัวอย่าง ↗
            </a>
          </td>
        ) : (
          <td key={j}>{cell || '—'}</td>
        )
      )}
    </tr>
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

const AGENT_META: Record<AgentId, { tagline: string; className: string }> = {
  SCOUT: { tagline: 'ทีมวิเคราะห์คู่แข่ง WULING CHONBURI', className: 'agent-scout' },
  COMPASS: { tagline: 'AI นักกลยุทธ์การตลาด', className: 'agent-compass' },
  SPARK: { tagline: 'AI Content Creator', className: 'agent-spark' },
  ADS: { tagline: 'ทีมโฆษณา Meta Ads — เป้า 100 เบอร์/เดือน ใต้งบ ฿45,000', className: 'agent-ads' },
  ALMANAC: { tagline: 'AI Content Planner', className: 'agent-almanac' },
};

function ReportCard({ report }: { report: AgentReport }) {
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
                <TableRow row={row} rowKey={i} key={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.kind === 'bar' && <BarChart items={data.items} />}

      {data?.kind === 'drilldown' && <DrilldownTable columns={data.columns} rows={data.rows} />}

      {data?.kind === 'todo' && <TodoList items={data.items} />}
    </div>
  );
}

export default function AgentReportPage({ agent, reports }: { agent: AgentId; reports: AgentReport[] }) {
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
            <ReportCard key={r.id} report={r} />
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
