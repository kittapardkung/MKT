import { useMemo, useState } from 'react';
import type { AgentReport, Idea, IdeaInterest, Post } from '@/lib/types';
import { displayDate, displayDateTime } from '@/lib/date-utils';
import { ReportCard } from '@/components/AgentReportPage';

/* SUSAN · นักกลยุทธ์การตลาดออนไลน์ (รวมงาน COMPASS + SPARK เดิม)
   ① รับผล Meta Ads จาก Beary/ทีม Ads → ② วิเคราะห์ + วางกลยุทธ์ PPS
   → ③ คลัง Hook ที่อ้างผล Meta ได้ → ④ หยิบ Hook จากคลังไปสั่งทำวิดีโอ */

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

const PPS_TARGET: Record<string, number> = { Push: 45, Pull: 35, Sell: 20 };
const PPS_TYPES = ['Push', 'Pull', 'Sell'] as const;

type MetaStat = { campaign: string; status: string; result: string; cost: string };

// อ่านผลแคมเปญจริงจากรายงาน ADS (section drilldown) แล้วจับคู่กับรุ่นรถของ Hook
function useMetaByProduct(reports: AgentReport[]) {
  return useMemo(() => {
    const drill = reports.find((r) => r.agent === 'ADS' && r.section === 'drilldown');
    const rows = drill?.data?.kind === 'drilldown' ? drill.data.rows : [];
    const find = (kw: string): MetaStat | null => {
      const row = rows.find((r) => (r.cells[0] || '').toLowerCase().includes(kw) && !/test drive/i.test(r.cells[0] || ''));
      if (!row) return null;
      return {
        campaign: row.cells[0] || '',
        status: row.cells[1] || '',
        result: (row.cells[3] || '').split('(')[0].trim(),
        cost: ((row.cells[4] || '').match(/฿[\d,.]+/) || [''])[0],
      };
    };
    return { porta: find('porta'), darion: find('darion'), updatedAt: drill?.updated_at || null };
  }, [reports]);
}

function metaFor(product: string | null | undefined, m: ReturnType<typeof useMetaByProduct>) {
  const p = (product || '').toLowerCase();
  if (p.includes('porta')) return m.porta;
  if (p.includes('darion')) return m.darion;
  return null;
}

function evidenceOf(note: string) {
  const line = note.split('\n').find((l) => l.startsWith('อิงผล Meta Ads:'));
  return line ? line.replace('อิงผล Meta Ads:', '').trim() : '';
}

function noteWithoutEvidence(note: string) {
  return note
    .split('\n')
    .filter((l) => !l.startsWith('อิงผล Meta Ads:'))
    .join('\n');
}

function FlowStep({ n, title, value, note, active }: { n: string; title: string; value: string; note: string; active?: boolean }) {
  return (
    <div className={`susan-step ${active ? 'active' : ''}`}>
      <div className="susan-step-n">{n}</div>
      <div className="susan-step-title">{title}</div>
      <div className="susan-step-value">{value}</div>
      <div className="susan-step-note">{note}</div>
    </div>
  );
}

function SectionTitle({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="susan-section-title">
      <span className="susan-section-n">{n}</span>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="meta">{sub}</div>
      </div>
    </div>
  );
}

function PpsChart({ ideas }: { ideas: Idea[] }) {
  const interested = ideas.filter((i) => i.interest === 'interested');
  const total = interested.length;
  const counts: Record<string, number> = { Push: 0, Pull: 0, Sell: 0 };
  interested.forEach((i) => {
    if (i.type && i.type in counts) counts[i.type] += 1;
  });
  return (
    <div className="spark-pps-chart">
      <div className="spark-pps-chart-title">สัดส่วน Hook ที่ &quot;สนใจ&quot; ตอนนี้ ({total} รายการ)</div>
      {total === 0 ? (
        <Empty text="ยังไม่มี Hook ที่ทำเครื่องหมายว่าสนใจ" />
      ) : (
        <>
          <div className="spark-pps-rows">
            {PPS_TYPES.map((type) => {
              const pct = Math.round((counts[type] / total) * 100);
              const target = PPS_TARGET[type];
              const met = type === 'Sell' ? pct <= target : pct >= target;
              return (
                <div className="spark-pps-row" key={type}>
                  <div className="spark-pps-row-head">
                    <span className={`type-badge ${typeBadgeClass(type)}`}>{type}</span>
                    <span className="spark-pps-row-value num">{pct}%</span>
                  </div>
                  <div className="spark-pps-track">
                    <div className={`spark-pps-fill ${met ? 'met' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    <div className="spark-pps-target" style={{ left: `${target}%` }} title={`เป้า: ${type === 'Sell' ? '≤' : ''}${target}%`} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="spark-pps-legend">
            <span className="spark-pps-legend-item"><span className="spark-pps-legend-swatch" /> % จริงจาก Hook ที่สนใจ</span>
            <span className="spark-pps-legend-item"><span className="spark-pps-legend-tick" /> เป้าหมายของ Susan</span>
          </div>
        </>
      )}
    </div>
  );
}

function HookTable({
  ideas,
  meta,
  emptyText,
  onSetInterest,
  onOrderVideo,
}: {
  ideas: Idea[];
  meta: ReturnType<typeof useMetaByProduct>;
  emptyText: string;
  onSetInterest: (idea: Idea, interest: IdeaInterest) => void;
  onOrderVideo: (idea: Idea) => void;
}) {
  if (!ideas.length) return <Empty text={emptyText} />;
  return (
    <div className="report-table-wrap">
      <table className="report-table susan-hook-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Hook</th>
            <th>อิงผล Meta Ads</th>
            <th>คะแนน</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {ideas.map((idea) => {
            const interest: IdeaInterest = idea.interest || 'pending';
            const m = metaFor(idea.product, meta);
            const evidence = evidenceOf(idea.note || '');
            return (
              <tr key={idea.id}>
                <td>
                  <div className="num">{idea.code || '—'}</div>
                  <div className="spark-hook-meta">{idea.product || ''}</div>
                </td>
                <td>{idea.type ? <span className={`type-badge ${typeBadgeClass(idea.type)}`}>{idea.type}</span> : '—'}</td>
                <td>
                  <div className="spark-hook-title">{idea.title}</div>
                  {idea.formula && <div className="susan-formula">สูตร: {idea.formula}</div>}
                  {idea.note && <div className="spark-hook-meta">{noteWithoutEvidence(idea.note)}</div>}
                </td>
                <td>
                  {m && (
                    <div className="susan-meta-live" title={m.campaign}>
                      <b>{m.cost || '—'}</b>/แชท · {m.result}
                      <span>{m.status.split(' ')[0]}</span>
                    </div>
                  )}
                  {evidence ? <div className="spark-hook-meta">{evidence}</div> : !m && <span className="meta">— ยังไม่ได้อ้างผล Meta</span>}
                </td>
                <td className="num">{idea.score ?? '—'}</td>
                <td>
                  <div className="spark-actions">
                    <button className="btn sm primary" onClick={() => onOrderVideo(idea)}>สั่งทำวิดีโอ</button>
                    {interest !== 'interested' && (
                      <button className="btn sm success" onClick={() => onSetInterest(idea, 'interested')}>สนใจ</button>
                    )}
                    {interest !== 'not_interested' && (
                      <button className="btn sm danger" onClick={() => onSetInterest(idea, 'not_interested')}>ไม่สนใจ</button>
                    )}
                    {interest !== 'pending' && (
                      <button className="btn sm" onClick={() => onSetInterest(idea, 'pending')}>ย้ายกลับ</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SusanPage({
  ideas,
  posts,
  reports,
  onAddIdea,
  onSetInterest,
  onOrderVideo,
  onOpenPost,
}: {
  ideas: Idea[];
  posts: Post[];
  reports: AgentReport[];
  onAddIdea: () => void;
  onSetInterest: (idea: Idea, interest: IdeaInterest) => void;
  onOrderVideo: (idea: Idea) => void;
  onOpenPost: (post: Post) => void;
}) {
  const [tab, setTab] = useState<IdeaInterest>('pending');
  const meta = useMetaByProduct(reports);

  const susan = (section: string) => reports.find((r) => r.agent === 'SUSAN' && r.section === section);
  const ads = (section: string) => reports.find((r) => r.agent === 'ADS' && r.section === section);
  const signals = susan('signals');
  const positioning = susan('positioning');
  const pps = susan('pps');
  const roadmap = susan('roadmap');
  const videoOrders = susan('video_orders');
  const adsSummary = ads('summary');
  const adsCreatives = ads('creatives');
  const adsKpis = adsSummary?.data?.kind === 'kpi' ? adsSummary.data.items.slice(0, 3) : [];
  const signalCount = signals?.data?.kind === 'table' && 'rows' in signals.data ? signals.data.rows.length : 0;
  const briefCount = videoOrders?.data?.kind === 'table' && 'rows' in videoOrders.data ? videoOrders.data.rows.length : 0;

  const scoreSort = (a: Idea, b: Idea) => Number(b.score || 0) - Number(a.score || 0);
  const library = ideas.filter((i) => !i.promoted_post_id);
  const byInterest = (v: IdeaInterest) => library.filter((i) => (i.interest || 'pending') === v).sort(scoreSort);
  const tabs: { id: IdeaInterest; label: string; list: Idea[]; emptyText: string }[] = [
    { id: 'pending', label: `รอพิจารณา (${byInterest('pending').length})`, list: byInterest('pending'), emptyText: 'ยังไม่มี Hook รอพิจารณา' },
    { id: 'interested', label: `สนใจ (${byInterest('interested').length})`, list: byInterest('interested'), emptyText: 'ยังไม่มี Hook ที่ทำเครื่องหมายว่าสนใจ' },
    { id: 'not_interested', label: `ไม่สนใจ (${byInterest('not_interested').length})`, list: byInterest('not_interested'), emptyText: 'ยังไม่มี Hook ที่ทำเครื่องหมายว่าไม่สนใจ' },
  ];
  const active = tabs.find((t) => t.id === tab) || tabs[0];

  // ใบสั่งวิดีโอที่สร้างจากคลังในแอป = ไอเดียที่ถูกส่งออกเป็นโพสต์รูปแบบวิดีโอ
  const postById = new Map(posts.map((p) => [p.id, p]));
  const ordered = ideas
    .filter((i) => i.promoted_post_id && postById.get(i.promoted_post_id)?.format === 'วิดีโอ')
    .map((i) => ({ idea: i, post: postById.get(i.promoted_post_id!)! }))
    .sort((a, b) => String(b.post.date).localeCompare(String(a.post.date)));

  return (
    <div className="susan-page">
      <div className="agent-header agent-susan">
        <span className="agent-badge">SUSAN</span>
        <div>
          <h1 style={{ margin: 0 }}>SUSAN นักกลยุทธ์ : การตลาดออนไลน์</h1>
          <div className="meta">อ่านผล Meta Ads จาก Beary → วางกลยุทธ์ → สร้างคลัง Hook → หยิบจากคลังไปสั่งทำวิดีโอ</div>
        </div>
      </div>

      <div className="susan-flow">
        <FlowStep
          n="1"
          title="รับข้อมูลจาก Beary"
          value={adsKpis[0]?.value || '—'}
          note={meta.updatedAt ? `ผล Meta Ads อัปเดต ${displayDateTime(meta.updatedAt)}` : 'ยังไม่มีรายงาน ADS'}
        />
        <FlowStep n="2" title="วิเคราะห์ + กลยุทธ์" value={`${signalCount} สัญญาณ`} note="แปลตัวเลข Meta เป็นแนวคอนเทนต์ + PPS" />
        <FlowStep n="3" title="คลัง Hook" value={`${library.length} Hook`} note={`สนใจ ${byInterest('interested').length} · รอพิจารณา ${byInterest('pending').length}`} active />
        <FlowStep n="4" title="สั่งทำวิดีโอ" value={`${ordered.length + briefCount} ใบ`} note={`สั่งจากแอป ${ordered.length} · บรีฟ TikTok ${briefCount}`} />
      </div>

      {/* ① ข้อมูลจาก Beary */}
      <SectionTitle n="1" title="ข้อมูลที่ได้จาก Beary · Meta Ads" sub="ตัวเลขจริงจากรายงานทีม Ads (หน้า ADS) — Susan ใช้เป็นฐานคิดคอนเทนต์ทุกชิ้น" />
      <div className="report-list-wrap">
        {adsKpis.length > 0 && (
          <div className="card">
            <div className="kpi-chip-row">
              {adsKpis.map((item, i) => (
                <div className="kpi-chip-sm" key={i}>
                  <div className="kpi-chip-label">{item.label}</div>
                  <div className="kpi-chip-value">{item.value}</div>
                  {item.note && <div className="kpi-chip-note">{item.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {adsCreatives && <ReportCard report={adsCreatives} leads={[]} />}
        {signals ? <ReportCard report={signals} leads={[]} /> : (
          <div className="card"><Empty text="ยังไม่มีบทวิเคราะห์ของ Susan — sync data/agent-sync/susan.json" /></div>
        )}
      </div>

      {/* ② กลยุทธ์ */}
      <SectionTitle n="2" title="กลยุทธ์คอนเทนต์" sub="จุดยืนแบรนด์ · สัดส่วน Push / Pull / Sell · แผนปฏิบัติการ (เดิมคืองานของ COMPASS)" />
      <div className="report-list-wrap">
        {positioning && <ReportCard report={positioning} leads={[]} />}
        <div className="card">
          <h2>{pps?.title || 'สัดส่วนคอนเทนต์ (PPS)'}</h2>
          <div className="compass-direction-grid">
            <div>
              {pps?.body && <p className="report-body">{pps.body}</p>}
              {pps?.data?.kind === 'kpi' && (
                <div className="kpi-chip-row">
                  {pps.data.items.map((item, i) => (
                    <div className="kpi-chip-sm" key={i}>
                      <div className="kpi-chip-label">{item.label}</div>
                      <div className="kpi-chip-value">{item.value}</div>
                      {item.note && <div className="kpi-chip-note">{item.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <PpsChart ideas={ideas} />
          </div>
        </div>
        {roadmap && <ReportCard report={roadmap} leads={[]} />}
      </div>

      {/* ③ คลัง Hook */}
      <SectionTitle n="3" title="คลังไอเดีย/Hook" sub="ทุก Hook ต้องอ้างผล Meta Ads ได้ — ตัวเลขในคอลัมน์ “อิงผล Meta Ads” ดึงสดจากแคมเปญของรุ่นนั้น" />
      <div className="card">
        <div className="toolbar">
          <div className="spark-tabs" style={{ marginBottom: 0 }}>
            {tabs.map((t) => (
              <button key={t.id} className={`spark-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={onAddIdea}>+ เพิ่ม Hook</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <HookTable ideas={active.list} meta={meta} emptyText={active.emptyText} onSetInterest={onSetInterest} onOrderVideo={onOrderVideo} />
        </div>
      </div>

      {/* ④ สั่งทำวิดีโอ */}
      <SectionTitle n="4" title="สั่งทำวิดีโอจากคลัง" sub="กด “สั่งทำวิดีโอ” ที่ Hook → สร้างงานวิดีโอเป็นร่างในปฏิทิน พร้อมบรีฟ Hook/CTA/หลักฐาน Meta ในแคปชัน" />
      <div className="report-list-wrap">
        <div className="card">
          <h2>ใบสั่งวิดีโอจากแอป ({ordered.length})</h2>
          {ordered.length ? (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr><th>วันที่ลง</th><th>Hook</th><th>ช่องทาง</th><th>สถานะ</th><th></th></tr>
                </thead>
                <tbody>
                  {ordered.map(({ idea, post }) => (
                    <tr key={idea.id}>
                      <td>{displayDate(post.date)}</td>
                      <td>
                        <div className="spark-hook-title">{post.title}</div>
                        <div className="spark-hook-meta">{idea.code || ''} {idea.type ? `· ${idea.type}` : ''}</div>
                      </td>
                      <td>{post.channel}</td>
                      <td>{({ DRAFT: 'ร่าง', REVIEW: 'รออนุมัติ', APPROVED: 'อนุมัติแล้ว', PUBLISHED: 'เผยแพร่แล้ว' } as Record<string, string>)[post.status] || post.status}</td>
                      <td><button className="btn sm" onClick={() => onOpenPost(post)}>เปิด</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="ยังไม่มีวิดีโอที่สั่งจากคลัง — กด “สั่งทำวิดีโอ” ที่ Hook ด้านบน" />
          )}
        </div>
        {videoOrders && <ReportCard report={videoOrders} leads={[]} />}
      </div>
    </div>
  );
}
