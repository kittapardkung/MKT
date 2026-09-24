import { useState } from 'react';
import type { AgentReport, Idea, IdeaInterest } from '@/lib/types';

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function typeBadgeClass(type: string) {
  const t = type.toLowerCase();
  if (t === 'push') return 'type-push';
  if (t === 'pull') return 'type-pull';
  if (t === 'sell') return 'type-sell';
  return 'type-default';
}

function CompassDirectionCard({ reports }: { reports: AgentReport[] }) {
  const positioning = reports.find((r) => r.agent === 'COMPASS' && r.section === 'positioning');
  const pps = reports.find((r) => r.agent === 'COMPASS' && r.section === 'pps');
  const ppsItems = pps?.data?.kind === 'kpi' ? pps.data.items : [];

  if (!positioning && !ppsItems.length) return null;

  return (
    <div className="card">
      <h2>COMPASS กำหนดแนวทางคอนเทนต์มาอย่างไร</h2>
      {positioning?.body && <p className="report-body">{positioning.body}</p>}
      {ppsItems.length > 0 && (
        <div className="kpi-chip-row">
          {ppsItems.map((item, i) => (
            <div className="kpi-chip-sm" key={i}>
              <div className="kpi-chip-label">{item.label}</div>
              <div className="kpi-chip-value">{item.value}</div>
              {item.note && <div className="kpi-chip-note">{item.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IdeaRow({ idea, onSetInterest }: { idea: Idea; onSetInterest: (idea: Idea, interest: IdeaInterest) => void }) {
  const interest: IdeaInterest = idea.interest || 'pending';
  return (
    <tr>
      <td>{idea.code || '—'}</td>
      <td>{idea.product || '—'}</td>
      <td>{idea.type ? <span className={`type-badge ${typeBadgeClass(idea.type)}`}>{idea.type}</span> : '—'}</td>
      <td>{idea.formula || '—'}</td>
      <td>
        <div className="spark-hook-title">{idea.title}</div>
        {idea.note && <div className="spark-hook-meta">{idea.note}</div>}
      </td>
      <td>
        <div className="spark-actions">
          {interest !== 'interested' && (
            <button className="btn sm success" onClick={() => onSetInterest(idea, 'interested')}>
              สนใจ
            </button>
          )}
          {interest !== 'not_interested' && (
            <button className="btn sm danger" onClick={() => onSetInterest(idea, 'not_interested')}>
              ไม่สนใจ
            </button>
          )}
          {interest !== 'pending' && (
            <button className="btn sm" onClick={() => onSetInterest(idea, 'pending')}>
              ย้ายกลับ
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function IdeaTable({ ideas, onSetInterest, emptyText }: { ideas: Idea[]; onSetInterest: (idea: Idea, interest: IdeaInterest) => void; emptyText: string }) {
  if (!ideas.length) return <Empty text={emptyText} />;
  return (
    <div className="report-table-wrap">
      <table className="report-table spark-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Product</th>
            <th>Type</th>
            <th>สูตรที่ใช้</th>
            <th>คลังไอเดีย/Hook</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {ideas.map((i) => (
            <IdeaRow idea={i} onSetInterest={onSetInterest} key={i.id} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SparkPage({
  ideas,
  reports,
  onAddIdea,
  onSetInterest,
}: {
  ideas: Idea[];
  reports: AgentReport[];
  onAddIdea: () => void;
  onSetInterest: (idea: Idea, interest: IdeaInterest) => void;
}) {
  const [tab, setTab] = useState<IdeaInterest>('pending');

  const scoreSort = (a: Idea, b: Idea) => Number(b.score || 0) - Number(a.score || 0);
  const notPromoted = ideas.filter((i) => !i.promoted_post_id);
  const byInterest = (v: IdeaInterest) => notPromoted.filter((i) => (i.interest || 'pending') === v).sort(scoreSort);

  const pendingList = byInterest('pending');
  const interestedList = byInterest('interested');
  const notInterestedList = byInterest('not_interested');
  const sent = ideas.filter((i) => i.promoted_post_id).length;

  const tabs: { id: IdeaInterest; label: string; list: Idea[]; emptyText: string }[] = [
    { id: 'pending', label: `รอพิจารณา (${pendingList.length})`, list: pendingList, emptyText: 'ยังไม่มีไอเดียรอพิจารณา' },
    { id: 'interested', label: `สนใจ (${interestedList.length})`, list: interestedList, emptyText: 'ยังไม่มีไอเดียที่ทำเครื่องหมายว่าสนใจ' },
    { id: 'not_interested', label: `ไม่สนใจ (${notInterestedList.length})`, list: notInterestedList, emptyText: 'ยังไม่มีไอเดียที่ทำเครื่องหมายว่าไม่สนใจ' },
  ];
  const active = tabs.find((t) => t.id === tab) || tabs[0];

  return (
    <>
      <div className="agent-header agent-spark">
        <span className="agent-badge">SPARK</span>
        <div>
          <h1 style={{ margin: 0 }}>SPARK</h1>
          <div className="meta">AI Content Creator — คลังไอเดีย/Hook ที่ยังไม่ถูกส่งเข้าปฏิทิน</div>
        </div>
      </div>

      <CompassDirectionCard reports={reports} />

      <div className="card" style={{ marginTop: 14 }}>
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>คลังไอเดีย/Hook ({notPromoted.length} รอไทม์ไลน์ · {sent} เข้าปฏิทินแล้ว)</h2>
          <button className="btn primary" onClick={onAddIdea}>+ เสนอไอเดียใหม่</button>
        </div>

        <div className="spark-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`spark-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <IdeaTable ideas={active.list} onSetInterest={onSetInterest} emptyText={active.emptyText} />
      </div>
    </>
  );
}
