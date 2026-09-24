import type { Idea, Role } from '@/lib/types';
import { displayDate } from '@/lib/date-utils';

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export default function TimelinePage({
  ideas,
  role,
  onApprove,
}: {
  ideas: Idea[];
  role: Role;
  onApprove: (idea: Idea) => void;
}) {
  const pending = ideas.filter((i) => !i.promoted_post_id && i.interest === 'interested');
  const withDate = pending
    .filter((i) => i.suggested_date)
    .sort((a, b) => String(a.suggested_date).localeCompare(String(b.suggested_date)));
  const noDate = pending.filter((i) => !i.suggested_date);
  const approvedRecently = ideas.filter((i) => i.promoted_post_id).slice(0, 10);
  const canApprove = role === 'editor';

  return (
    <>
      <div className="agent-header agent-almanac">
        <span className="agent-badge">ALMANAC</span>
        <div>
          <h1 style={{ margin: 0 }}>ไทม์ไลน์การผลิต</h1>
          <div className="meta">
            เฉพาะไอเดียที่ SPARK ทำเครื่องหมายว่า &quot;สนใจ&quot; แล้ว — {canApprove ? 'กดอนุมัติเพื่อส่งเข้าปฏิทินทันที' : 'รอบรรณาธิการกดอนุมัติก่อนเข้าปฏิทิน'}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>เสนอวันที่แล้ว ({withDate.length})</h2>
        {withDate.length ? (
          withDate.map((i) => (
            <div className="idea" key={i.id}>
              <div>
                <div className="queue-title">{i.title}</div>
                <div className="meta">
                  {displayDate(i.suggested_date || '')} · {i.suggested_channel || 'Facebook'} ·{' '}
                  {i.suggested_format || 'ภาพ'} · {i.category || 'ไม่ระบุหมวด'} · คะแนน{' '}
                  <span className="num">{Number(i.score || 0)}</span>/10
                </div>
              </div>
              {canApprove ? (
                <button className="btn success" onClick={() => onApprove(i)}>
                  อนุมัติ → เข้าปฏิทิน
                </button>
              ) : (
                <span className="badge pending">รออนุมัติ</span>
              )}
            </div>
          ))
        ) : (
          <Empty text="ยังไม่มีไอเดียที่เสนอวันที่ — ให้ SPARK เพิ่มวันที่ควรลงในไอเดีย" />
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2>ยังไม่ได้เสนอวันที่ ({noDate.length})</h2>
        {noDate.length ? (
          noDate.map((i) => (
            <div className="idea" key={i.id}>
              <div>
                <div className="queue-title">{i.title}</div>
                <div className="meta">
                  {i.category || 'ไม่ระบุหมวด'} · คะแนน <span className="num">{Number(i.score || 0)}</span>/10
                </div>
              </div>
              {canApprove ? (
                <button className="btn" onClick={() => onApprove(i)}>
                  กำหนดวันที่ &amp; อนุมัติ
                </button>
              ) : (
                <span className="meta">รอเสนอวันที่</span>
              )}
            </div>
          ))
        ) : (
          <Empty text="ไม่มีไอเดียที่สนใจค้างเสนอวันที่ — ไปติ๊ก 'สนใจ' เพิ่มได้ที่หน้า SPARK" />
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2>อนุมัติเข้าปฏิทินล่าสุด</h2>
        {approvedRecently.length ? (
          approvedRecently.map((i) => (
            <div className="idea" key={i.id}>
              <div>
                <div className="queue-title">{i.title}</div>
                <div className="meta">{i.category || 'ไม่ระบุหมวด'}</div>
              </div>
              <span className="badge approved">เข้าปฏิทินแล้ว</span>
            </div>
          ))
        ) : (
          <Empty text="ยังไม่มีไอเดียที่อนุมัติเข้าปฏิทิน" />
        )}
      </div>
    </>
  );
}
