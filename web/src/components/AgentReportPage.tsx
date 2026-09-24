import type { AgentId, AgentReport } from '@/lib/types';
import { displayDateTime } from '@/lib/date-utils';

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

const AGENT_META: Record<AgentId, { tagline: string; className: string }> = {
  SCOUT: { tagline: 'ทีมวิเคราะห์คู่แข่ง WULING CHONBURI', className: 'agent-scout' },
  COMPASS: { tagline: 'AI นักกลยุทธ์การตลาด', className: 'agent-compass' },
  SPARK: { tagline: 'AI Content Creator', className: 'agent-spark' },
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

      {data?.kind === 'table' && (
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
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
