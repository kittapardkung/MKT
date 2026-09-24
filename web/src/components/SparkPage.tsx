import type { Idea } from '@/lib/types';
import { displayDate } from '@/lib/date-utils';

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export default function SparkPage({ ideas, onAddIdea }: { ideas: Idea[]; onAddIdea: () => void }) {
  const pending = [...ideas]
    .filter((i) => !i.promoted_post_id)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const sent = ideas.filter((i) => i.promoted_post_id).length;

  return (
    <>
      <div className="agent-header agent-spark">
        <span className="agent-badge">SPARK</span>
        <div>
          <h1 style={{ margin: 0 }}>SPARK</h1>
          <div className="meta">AI Content Creator — คลังไอเดีย/Hook ที่ยังไม่ถูกส่งเข้าปฏิทิน</div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>คลังไอเดีย/Hook ({pending.length} รอไทม์ไลน์ · {sent} เข้าปฏิทินแล้ว)</h2>
          <button className="btn primary" onClick={onAddIdea}>+ เสนอไอเดียใหม่</button>
        </div>

        {pending.length ? (
          pending.map((i) => (
            <div className="idea" key={i.id}>
              <div>
                <div className="queue-title">{i.title}</div>
                <div className="meta">
                  {i.category || 'ไม่ระบุหมวด'} · คะแนน <span className="num">{Number(i.score || 0)}</span>/10
                  {i.suggested_date ? <> · เสนอลง {displayDate(i.suggested_date)}</> : ' · ยังไม่เสนอวันที่'}
                </div>
                {i.note && <div className="meta">{i.note}</div>}
              </div>
              <span className="badge pending">รอ ALMANAC อนุมัติ</span>
            </div>
          ))
        ) : (
          <Empty text="ยังไม่มีไอเดีย — กด “เสนอไอเดียใหม่” เพื่อเริ่มคลัง Hook" />
        )}
      </div>
    </>
  );
}
