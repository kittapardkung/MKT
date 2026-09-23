'use client';

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { signOut } from '@/lib/actions/auth';
import {
  addIdea,
  addTag,
  approvePost as approvePostFn,
  createPost,
  fetchBootstrap,
  promoteIdea,
  removeTag,
  savePost,
} from '@/lib/data-client';
import {
  MONTHS_TH,
  addDays,
  csvTags,
  displayDate,
  displayDateTime,
  getRange,
  parseDate,
  postDateTime,
  sortPostDate,
  ymd,
  type RangeValue,
} from '@/lib/date-utils';
import type { Bootstrap, Idea, Lead, Post, PostStatus } from '@/lib/types';
import { errMsg } from '@/lib/err';
import {
  Zap,
  LayoutDashboard,
  CalendarDays,
  KanbanSquare,
  Table as TableIcon,
  Library,
  Plus,
  LogOut,
  PhoneCall,
  FileText,
  Car,
  Video,
  Image as ImageIcon,
} from 'lucide-react';

const STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: 'ร่าง',
  REVIEW: 'รออนุมัติ',
  APPROVED: 'อนุมัติแล้ว',
  PUBLISHED: 'เผยแพร่แล้ว',
};

function statusLabel(status: string) {
  return STATUS_LABELS[status as PostStatus] || status || 'ร่าง';
}

function statusClass(status: string) {
  if (status === 'REVIEW') return 'pending';
  if (status === 'APPROVED') return 'approved';
  if (status === 'PUBLISHED') return 'published';
  return 'draft';
}

function attrUrl(url: string) {
  const s = (url || '').trim();
  if (!/^https?:\/\//i.test(s)) return '#';
  return s;
}

const NAV = [
  { id: 'dashboard', label: 'แดชบอร์ด KPI', short: 'KPI', icon: LayoutDashboard },
  { id: 'calendarPage', label: 'ปฏิทินคอนเทนต์', short: 'ปฏิทิน', icon: CalendarDays },
  { id: 'board', label: 'บอร์ดคิวงาน', short: 'คิวงาน', icon: KanbanSquare },
  { id: 'tablePage', label: 'ตารางคอนเทนต์', short: 'ตาราง', icon: TableIcon },
  { id: 'library', label: 'คลัง & แท็ก', short: 'คลัง', icon: Library },
] as const;

type PageId = (typeof NAV)[number]['id'];

const CHANNELS = ['Facebook', 'Instagram', 'TikTok', 'LINE OA', 'YouTube'];
const STATUSES: PostStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'];

type PostForm = {
  id: string;
  title: string;
  owner: string;
  date: string;
  time: string;
  channel: string;
  format: string;
  status: PostStatus;
  post_url: string;
  src_link: string;
  final_link: string;
  caption: string;
  comment: string;
};

const emptyPostForm = (me: string): PostForm => ({
  id: '',
  title: '',
  owner: me,
  date: ymd(new Date()),
  time: '09:00',
  channel: 'Facebook',
  format: 'ภาพ',
  status: 'DRAFT',
  post_url: '',
  src_link: '',
  final_link: '',
  caption: '',
  comment: '',
});

export default function AppShell() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState<PageId>('dashboard');

  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [rangePreset, setRangePreset] = useState<RangeValue>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postForm, setPostForm] = useState<PostForm>(() => emptyPostForm(''));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);

  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promoteIdeaTarget, setPromoteIdeaTarget] = useState<Idea | null>(null);
  const [promoteForm, setPromoteForm] = useState({
    title: '',
    date: ymd(new Date()),
    time: '09:00',
    channel: 'Facebook',
    format: 'ภาพ',
  });

  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [ideaForm, setIdeaForm] = useState({ title: '', category: '', score: '5', note: '' });

  async function reload() {
    try {
      const boot = await fetchBootstrap();
      setData(boot);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount
    reload();
  }, []);

  const range = useMemo(() => getRange(rangePreset, dateFrom, dateTo), [rangePreset, dateFrom, dateTo]);

  const filteredPosts = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.posts.filter((p) => {
      const d = parseDate(p.date);
      if (range.start && (!d || d < range.start || (range.end && d > range.end))) return false;
      if (channelFilter && csvTags(p.channel).indexOf(channelFilter) === -1) return false;
      if (q) {
        const hay = [p.title, p.caption, p.tags, p.owner, p.channel].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }, [data, search, channelFilter, range]);

  // ปฏิทินเลื่อนดูเดือนอื่นได้อิสระ ไม่ผูกกับตัวกรองช่วงวันที่ที่ topbar (กรองแค่ค้นหา/ช่องทาง)
  const calendarPosts = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.posts.filter((p) => {
      if (channelFilter && csvTags(p.channel).indexOf(channelFilter) === -1) return false;
      if (q) {
        const hay = [p.title, p.caption, p.tags, p.owner, p.channel].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }, [data, search, channelFilter]);

  const activeTags = useMemo(() => (data?.tags || []).filter((t) => t.active !== false), [data]);

  function target(key: string, fallback: number): number {
    const row = data?.targets.find((t) => t.key === key);
    const n = row ? Number(row.target) : fallback;
    return isNaN(n) ? fallback : n;
  }

  async function runAction(fn: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await fn();
      await reload();
      setPostModalOpen(false);
      setPromoteModalOpen(false);
      setIdeaModalOpen(false);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  function openNewPost() {
    setEditingPost(null);
    setSelectedTags([]);
    setPostForm(emptyPostForm(data?.me || ''));
    setPostModalOpen(true);
  }

  function openPost(p: Post) {
    setEditingPost(p);
    setSelectedTags(csvTags(p.tags));
    setPostForm({
      id: p.id,
      title: p.title || '',
      owner: p.owner || '',
      date: ymd(parseDate(p.date) || new Date()),
      time: (p.time || '09:00').slice(0, 5),
      channel: p.channel || 'Facebook',
      format: p.format || 'ภาพ',
      status: p.status || 'DRAFT',
      post_url: p.post_url || '',
      src_link: p.src_link || '',
      final_link: p.final_link || '',
      caption: p.caption || '',
      comment: '',
    });
    setPostModalOpen(true);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function submitPost() {
    if (!postForm.title.trim()) return alert('กรุณาระบุหัวเรื่อง');
    if (!postForm.date) return alert('กรุณาระบุวันที่');

    const input = {
      title: postForm.title.trim(),
      owner: postForm.owner.trim(),
      date: postForm.date,
      time: postForm.time,
      channel: postForm.channel,
      format: postForm.format,
      status: postForm.status,
      post_url: postForm.post_url.trim(),
      src_link: postForm.src_link.trim(),
      final_link: postForm.final_link.trim(),
      caption: postForm.caption,
      tags: selectedTags.join(', '),
      comment: postForm.comment,
    };

    runAction(async () => {
      if (editingPost) await savePost(editingPost.id, input, data?.me || '');
      else await createPost(input, data?.me || '');
    });
  }

  function doApprove(id: string) {
    if (!confirm('ยืนยันอนุมัติคอนเทนต์นี้?')) return;
    runAction(() => approvePostFn(id, data!.role, data?.me || ''));
  }

  function openPromoteIdea(idea: Idea) {
    setPromoteIdeaTarget(idea);
    setPromoteForm({ title: idea.title, date: ymd(new Date()), time: '09:00', channel: 'Facebook', format: 'ภาพ' });
    setPromoteModalOpen(true);
  }

  function confirmPromote() {
    if (!promoteIdeaTarget) return;
    if (!promoteForm.date) return alert('กรุณาเลือกวันที่');
    runAction(() => promoteIdea(promoteIdeaTarget, promoteForm, data?.me || ''));
  }

  function submitIdea() {
    if (!ideaForm.title.trim()) return alert('กรุณาระบุชื่อไอเดีย');
    runAction(() =>
      addIdea({
        title: ideaForm.title.trim(),
        category: ideaForm.category.trim(),
        score: Number(ideaForm.score || 0),
        note: ideaForm.note,
      })
    );
  }

  function promptAddTag() {
    const tag = window.prompt('ชื่อแท็กใหม่');
    if (!tag) return;
    runAction(() => addTag(tag.trim()));
  }

  function confirmRemoveTag(tag: string) {
    if (!confirm(`ลบแท็ก "${tag}" ?\nแท็กนี้จะถูกปลดออกจากคอนเทนต์ทั้งหมดด้วย`)) return;
    runAction(() => removeTag(tag));
  }

  function moveCalendar(delta: number) {
    setCalendarCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  function calendarToday() {
    const now = new Date();
    setCalendarCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  if (loading) {
    return (
      <div className="loading show">
        <div className="loading-box">กำลังอ่านข้อมูลจาก Supabase...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="icon"><Zap size={18} fill="currentColor" /></span>
          MKT Content
        </div>
        <div className="brand-sub">ระบบจัดการคอนเทนต์การตลาด</div>

        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-btn ${page === n.id ? 'active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span className="icon"><n.icon size={17} /></span>
            {n.label}
          </button>
        ))}

        <div className="user-box">
          <div className="user-email">{data?.me || 'ไม่พบอีเมลจาก Session'}</div>
          <div className="user-role">{data?.role === 'editor' ? 'บรรณาธิการ (editor)' : 'ครีเอทีฟ (creative)'}</div>
          <form action={signOut} style={{ marginTop: 8 }}>
            <button className="btn" type="submit" style={{ width: '100%', minHeight: 34, padding: '4px 8px', fontSize: 12 }}>
              <LogOut size={14} /> ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>

      <main className="main">
        <div className="mobile-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-btn ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              <span className="icon"><n.icon size={16} /></span>
              {n.short}
            </button>
          ))}
        </div>

        <div className="topbar">
          <input
            className="control search"
            placeholder="ค้นหาหัวเรื่อง แคปชัน แท็ก"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select className="control" value={rangePreset} onChange={(e) => setRangePreset(e.target.value as RangeValue)}>
            <option value="month">เดือนนี้</option>
            <option value="today">วันนี้</option>
            <option value="week">สัปดาห์นี้</option>
            <option value="next15">15 วันถัดไป</option>
            <option value="next30">30 วันถัดไป</option>
            <option value="custom">กำหนดเอง</option>
          </select>

          <div className={`custom-range ${rangePreset === 'custom' ? 'show' : ''}`}>
            <input type="date" className="control" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="control" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <select className="control" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            <option value="">ทุกช่องทาง</option>
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <button className="btn primary" onClick={openNewPost}><Plus size={16} /> คอนเทนต์ใหม่</button>
        </div>

        <div className="content">
          {error && <div className="error show">{error}</div>}

          {page === 'dashboard' && (
            <DashboardPage
              posts={filteredPosts}
              events={data?.events || []}
              leads={data?.leads || []}
              range={range}
              role={data?.role || 'creative'}
              target={target}
              onOpenPost={openPost}
              onApprove={doApprove}
            />
          )}

          {page === 'calendarPage' && (
            <CalendarPage
              posts={calendarPosts}
              cursor={calendarCursor}
              onMove={moveCalendar}
              onToday={calendarToday}
              onOpenPost={openPost}
            />
          )}

          {page === 'board' && <BoardPage posts={filteredPosts} onOpenPost={openPost} />}

          {page === 'tablePage' && <TablePage posts={filteredPosts} onOpenPost={openPost} />}

          {page === 'library' && (
            <LibraryPage
              tags={activeTags}
              ideas={data?.ideas || []}
              onAddTag={promptAddTag}
              onRemoveTag={confirmRemoveTag}
              onAddIdea={() => {
                setIdeaForm({ title: '', category: '', score: '5', note: '' });
                setIdeaModalOpen(true);
              }}
              onPromote={openPromoteIdea}
            />
          )}
        </div>
      </main>

      {postModalOpen && (
        <PostModal
          form={postForm}
          setForm={setPostForm}
          editingPost={editingPost}
          selectedTags={selectedTags}
          onToggleTag={toggleTag}
          tags={activeTags}
          role={data?.role || 'creative'}
          saving={saving}
          onClose={() => setPostModalOpen(false)}
          onSave={submitPost}
          onApprove={editingPost ? () => doApprove(editingPost.id) : undefined}
        />
      )}

      {promoteModalOpen && promoteIdeaTarget && (
        <PromoteModal
          form={promoteForm}
          setForm={setPromoteForm}
          saving={saving}
          onClose={() => setPromoteModalOpen(false)}
          onConfirm={confirmPromote}
        />
      )}

      {ideaModalOpen && (
        <IdeaModal
          form={ideaForm}
          setForm={setIdeaForm}
          saving={saving}
          onClose={() => setIdeaModalOpen(false)}
          onSave={submitIdea}
        />
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

function LinkCell({ url }: { url: string }) {
  if (!url) return <>-</>;
  return (
    <a href={attrUrl(url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      เปิด
    </a>
  );
}

function DashboardPage({
  posts,
  events,
  leads,
  range,
  role,
  target,
  onOpenPost,
  onApprove,
}: {
  posts: Post[];
  events: { date: string; name: string }[];
  leads: Lead[];
  range: { start: Date | null; end: Date | null; label: string };
  role: string;
  target: (key: string, fallback: number) => number;
  onOpenPost: (p: Post) => void;
  onApprove: (id: string) => void;
}) {
  const tContent = target('content', 20);
  const tVideo = target('video', 20);
  const tImage = target('image', 20);
  const tEvents = target('events', 2);

  const video = posts.filter((p) => p.format === 'วิดีโอ').length;
  const image = posts.filter((p) => p.format === 'ภาพ').length;

  const filteredEvents = events.filter((e) => {
    const d = parseDate(e.date);
    return d && (!range.start || (d >= range.start && (!range.end || d <= range.end)));
  });

  // นับลีดไม่ซ้ำเบอร์โทร ภายในช่วงวันที่ที่กรองไว้ (เหมือนระบบเดิม)
  const seenPhones = new Set<string>();
  const filteredLeads = leads.filter((l) => {
    const d = parseDate(l.created_date);
    if (range.start && (!d || d < range.start || (range.end && d > range.end))) return false;
    const phone = (l.phone_number || '').trim();
    if (phone) {
      if (seenPhones.has(phone)) return false;
      seenPhones.add(phone);
    }
    return true;
  });

  function countBy(rows: Lead[], key: 'source' | 'interested_model') {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      const name = (r[key] || '').trim() || '(ไม่ระบุ)';
      map[name] = (map[name] || 0) + 1;
    });
    const total = rows.length;
    return Object.keys(map)
      .map((name) => ({ name, count: map[name], pct: total ? Math.round((map[name] / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.count - a.count);
  }

  const leadSources = countBy(filteredLeads, 'source');
  const leadModels = countBy(filteredLeads, 'interested_model').slice(0, 8);

  function countTable(rows: { name: string; count: number; pct: number }[], label: string) {
    if (!rows.length) return <Empty text="ยังไม่มีข้อมูลในช่วงนี้" />;
    return (
      <table>
        <thead><tr><th>{label}</th><th>จำนวน</th><th>สัดส่วน</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}><td>{r.name}</td><td className="num">{r.count}</td><td className="num">{r.pct}%</td></tr>
          ))}
        </tbody>
      </table>
    );
  }

  const tagMap: Record<string, number> = {};
  posts.forEach((p) => csvTags(p.tags).forEach((t) => (tagMap[t] = (tagMap[t] || 0) + 1)));
  const totalTagUses = Object.values(tagMap).reduce((s, n) => s + n, 0);
  const tagRows = Object.keys(tagMap)
    .map((name) => ({ name, count: tagMap[name], pct: totalTagUses ? Math.round((tagMap[name] / totalTagUses) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);

  const pending = posts.filter((p) => p.status === 'REVIEW').sort(sortPostDate);
  const now = new Date();
  const queue = posts
    .filter((p) => {
      const d = postDateTime(p);
      return d && d >= now && p.status !== 'PUBLISHED';
    })
    .sort(sortPostDate)
    .slice(0, 6);

  function kpiCard(
    title: string,
    value: number,
    targetValue: number,
    icon: ReactNode,
    extra?: ReactNode
  ) {
    const pct = targetValue ? Math.round((value / targetValue) * 100) : 0;
    const bar = Math.min(pct, 100);
    return (
      <div className="card" key={title}>
        <div className="kpi-title">
          {title}
          <span className="kpi-icon">{icon}</span>
        </div>
        <div className="kpi-value num">{value} / {targetValue}</div>
        <div className="progress"><span style={{ width: `${bar}%` }} /></div>
        <div className="kpi-foot num">{pct}% ของเป้าหมาย</div>
        {extra}
      </div>
    );
  }

  function miniProgress(label: string, value: number, targetValue: number, icon: ReactNode) {
    const pct = targetValue ? Math.round((value / targetValue) * 100) : 0;
    return (
      <div className="mini-row" key={label}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label}</span>
        <div className="progress"><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
        <b className="num">{value}</b>
      </div>
    );
  }

  return (
    <>
      <h1>แดชบอร์ด KPI</h1>
      <div className="period-label">ช่วงข้อมูล: {range.label}</div>

      <div className="grid3">
        {kpiCard('Lead Generation', filteredLeads.length, target('leads', 150), <PhoneCall size={17} />)}
        {kpiCard(
          'คอนเทนต์ที่ผลิต',
          posts.length,
          tContent,
          <FileText size={17} />,
          <div className="mini-progress">
            {miniProgress('วิดีโอ', video, tVideo, <Video size={12} />)}
            {miniProgress('ภาพ', image, tImage, <ImageIcon size={12} />)}
          </div>
        )}
        {kpiCard('Event Test Drive', filteredEvents.length, tEvents, <Car size={17} />)}
      </div>

      <div className="two-col">
        <div className="card">
          <h2>แหล่งที่มาของลีด</h2>
          {countTable(leadSources, 'Source')}
        </div>
        <div className="card">
          <h2>รุ่นที่ลูกค้าสนใจ</h2>
          {countTable(leadModels, 'รุ่นรถ')}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h2>คอนเทนต์แยกตามแท็ก</h2>
          {tagRows.length ? (
            <table>
              <thead><tr><th>แท็ก</th><th>จำนวน</th><th>สัดส่วน</th></tr></thead>
              <tbody>
                {tagRows.map((r) => (
                  <tr key={r.name}><td>{r.name}</td><td className="num">{r.count}</td><td className="num">{r.pct}%</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text="ยังไม่มีข้อมูลในช่วงนี้" />
          )}
        </div>
        <div className="card">
          <h2>งานรออนุมัติ</h2>
          {pending.length ? (
            pending.map((p) => (
              <div className="queue-item" key={p.id} onClick={() => onOpenPost(p)}>
                <div>
                  <div className="queue-title">{p.title}</div>
                  <div className="meta">{p.channel} · {displayDate(p.date)} {p.time} · {p.owner}</div>
                </div>
                {role === 'editor' && (
                  <button className="btn" onClick={(e) => { e.stopPropagation(); onApprove(p.id); }}>อนุมัติ</button>
                )}
              </div>
            ))
          ) : (
            <Empty text="ไม่มีงานรออนุมัติ" />
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2>คิวเผยแพร่ 6 รายการถัดไป</h2>
        {queue.length ? (
          queue.map((p) => (
            <div className="queue-item" key={p.id} onClick={() => onOpenPost(p)}>
              <div>
                <div className="queue-title">{displayDate(p.date)} · {p.time} — {p.title}</div>
                <div className="meta">{p.channel} · {p.owner}</div>
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))
        ) : (
          <Empty text="ไม่มีคิวเผยแพร่ในช่วงนี้" />
        )}
      </div>
    </>
  );
}

function CalendarPage({
  posts,
  cursor,
  onMove,
  onToday,
  onOpenPost,
}: {
  posts: Post[];
  cursor: Date;
  onMove: (d: number) => void;
  onToday: () => void;
  onOpenPost: (p: Post) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startCell = new Date(year, month, 1 - first.getDay());
  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(startCell, i);
    cells.push(d);
    if (i >= 34 && d >= last && d.getDay() === 6) break;
  }

  return (
    <>
      <div className="calendar-head">
        <div>
          <h1 style={{ marginBottom: 2 }}>ปฏิทินคอนเทนต์</h1>
          <div className="meta">{MONTHS_TH[month]} {year + 543}</div>
        </div>
        <div className="calendar-actions">
          <button className="btn" onClick={() => onMove(-1)}>ก่อนหน้า</button>
          <button className="btn" onClick={onToday}>เดือนนี้</button>
          <button className="btn" onClick={() => onMove(1)}>ถัดไป</button>
        </div>
      </div>
      <div className="card calendar-wrap">
        <div className="calendar">
          {dayNames.map((d) => <div className="day-name" key={d}>{d}</div>)}
          {cells.map((d, i) => {
            const outside = d.getMonth() !== month;
            const key = ymd(d);
            const dayPosts = posts.filter((p) => ymd(parseDate(p.date)) === key).sort(sortPostDate);
            return (
              <div className={`day ${outside ? 'outside' : ''}`} key={i}>
                <div className="daynum">{d.getDate()}</div>
                {dayPosts.map((p) => (
                  <div className={`chip ${statusClass(p.status)}`} key={p.id} onClick={() => onOpenPost(p)}>
                    {p.time} {p.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function BoardPage({ posts, onOpenPost }: { posts: Post[]; onOpenPost: (p: Post) => void }) {
  return (
    <>
      <h1>บอร์ดคิวงาน</h1>
      <div className="kanban">
        {STATUSES.map((status) => {
          const items = posts.filter((p) => p.status === status).sort(sortPostDate);
          return (
            <div className="kanban-col" key={status}>
              <div className="kanban-title">{statusLabel(status)} <span className="num">({items.length})</span></div>
              {items.length ? (
                items.map((p) => (
                  <div className="task" key={p.id} onClick={() => onOpenPost(p)}>
                    <div className="task-title">{p.title}</div>
                    <div className="meta">{p.channel} · {displayDate(p.date)} {p.time}</div>
                    <div>{csvTags(p.tags).map((t) => <span className="tag" key={t}>{t}</span>)}</div>
                    <div className="meta" style={{ marginTop: 6 }}>{p.owner}</div>
                  </div>
                ))
              ) : (
                <Empty text="ไม่มีงาน" />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TablePage({ posts, onOpenPost }: { posts: Post[]; onOpenPost: (p: Post) => void }) {
  const rows = [...posts].sort(sortPostDate);
  return (
    <>
      <h1>ตารางคอนเทนต์</h1>
      <div className="card" style={{ overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>วันที่</th><th>เวลา</th><th>ช่องทาง</th><th>หัวเรื่อง</th>
              <th>รูปแบบ</th><th>สถานะ</th><th>ผู้รับผิดชอบ</th>
              <th>สื่อที่ได้รับ</th><th>งานเสร็จ</th><th>ลิงก์โพสต์</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10}><Empty text="ไม่มีคอนเทนต์ในช่วงนี้" /></td></tr>
            )}
            {rows.map((p) => (
              <tr className="clickable" key={p.id} onClick={() => onOpenPost(p)}>
                <td>{displayDate(p.date)}</td>
                <td>{p.time}</td>
                <td>{p.channel}</td>
                <td>{p.title}</td>
                <td>{p.format}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{p.owner}</td>
                <td><LinkCell url={p.src_link} /></td>
                <td><LinkCell url={p.final_link} /></td>
                <td><LinkCell url={p.post_url} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LibraryPage({
  tags,
  ideas,
  onAddTag,
  onRemoveTag,
  onAddIdea,
  onPromote,
}: {
  tags: { tag: string }[];
  ideas: Idea[];
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onAddIdea: () => void;
  onPromote: (idea: Idea) => void;
}) {
  const sortedIdeas = [...ideas].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  return (
    <>
      <h1>คลัง & แท็ก</h1>
      <div className="two-col">
        <div className="card">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>แท็ก</h2>
            <button className="btn" onClick={onAddTag}>+ เพิ่มแท็ก</button>
          </div>
          <div className="tags-grid">
            {tags.length ? (
              tags.map((t) => (
                <button key={t.tag} className="tag-btn" title="กดเพื่อลบแท็ก" onClick={() => onRemoveTag(t.tag)}>
                  {t.tag} ×
                </button>
              ))
            ) : (
              <Empty text="ยังไม่มีแท็ก" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>คลังไอเดีย</h2>
            <button className="btn" onClick={onAddIdea}>+ ไอเดีย</button>
          </div>
          {sortedIdeas.length ? (
            sortedIdeas.map((i) => (
              <div className="idea" key={i.id}>
                <div>
                  <div className="queue-title">{i.title}</div>
                  <div className="meta">{i.category || 'ไม่ระบุหมวด'} · คะแนน <span className="num">{Number(i.score || 0)}</span>/10</div>
                </div>
                {i.promoted_post_id ? (
                  <span className="badge approved">เข้าปฏิทินแล้ว</span>
                ) : (
                  <button className="btn" onClick={() => onPromote(i)}>ส่งเข้าปฏิทิน</button>
                )}
              </div>
            ))
          ) : (
            <Empty text="ยังไม่มีไอเดีย" />
          )}
        </div>
      </div>
    </>
  );
}

function PostModal({
  form,
  setForm,
  editingPost,
  selectedTags,
  onToggleTag,
  tags,
  role,
  saving,
  onClose,
  onSave,
  onApprove,
}: {
  form: PostForm;
  setForm: Dispatch<SetStateAction<PostForm>>;
  editingPost: Post | null;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  tags: { tag: string }[];
  role: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onApprove?: () => void;
}) {
  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canApprove = role === 'editor' && editingPost && editingPost.status !== 'APPROVED' && editingPost.status !== 'PUBLISHED';

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="toolbar">
          <div>
            <h2 style={{ margin: 0 }}>{editingPost ? 'รายละเอียดคอนเทนต์' : 'คอนเทนต์ใหม่'}</h2>
            <div className="meta">{editingPost?.id || ''}</div>
          </div>
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>

        <div className="modal-grid">
          <div className="field"><label>หัวเรื่อง</label><input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
          <div className="field"><label>ผู้รับผิดชอบ</label><input value={form.owner} onChange={(e) => set('owner', e.target.value)} /></div>
          <div className="field"><label>วันที่</label><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
          <div className="field"><label>เวลา</label><input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} /></div>
          <div className="field">
            <label>ช่องทาง</label>
            <select value={form.channel} onChange={(e) => set('channel', e.target.value)}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>รูปแบบ</label>
            <select value={form.format} onChange={(e) => set('format', e.target.value)}>
              <option>ภาพ</option><option>วิดีโอ</option>
            </select>
          </div>
          <div className="field">
            <label>สถานะ</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value as PostStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div className="field"><label>ลิงก์โพสต์</label><input value={form.post_url} onChange={(e) => set('post_url', e.target.value)} placeholder="https://..." /></div>
        </div>

        <div className="field" style={{ marginTop: 11 }}>
          <label>สื่อที่ได้รับ / โฟลเดอร์ต้นฉบับ</label>
          <div className="link-row">
            <input value={form.src_link} onChange={(e) => set('src_link', e.target.value)} placeholder="Google Drive URL" />
            <button className="btn" onClick={() => form.src_link && window.open(form.src_link, '_blank', 'noopener')}>เปิด Drive</button>
          </div>
        </div>

        <div className="field" style={{ marginTop: 11 }}>
          <label>งานที่เสร็จแล้ว</label>
          <div className="link-row">
            <input value={form.final_link} onChange={(e) => set('final_link', e.target.value)} placeholder="Google Drive URL" />
            <button className="btn" onClick={() => form.final_link && window.open(form.final_link, '_blank', 'noopener')}>เปิด Drive</button>
          </div>
        </div>

        <div className="field" style={{ marginTop: 11 }}>
          <label>แท็ก</label>
          <div className="tags-grid">
            {tags.length ? tags.map((t) => (
              <button
                key={t.tag}
                className={`tag-btn ${selectedTags.includes(t.tag) ? 'selected' : ''}`}
                onClick={() => onToggleTag(t.tag)}
              >
                {t.tag}
              </button>
            )) : <span className="meta">ยังไม่มีแท็ก</span>}
          </div>
        </div>

        <div className="field" style={{ marginTop: 11 }}>
          <label>แคปชัน</label>
          <textarea value={form.caption} onChange={(e) => set('caption', e.target.value)} />
        </div>

        <div className="field" style={{ marginTop: 11 }}>
          <label>คอมเมนต์ / บันทึกลง Log</label>
          <textarea value={form.comment} onChange={(e) => set('comment', e.target.value)} placeholder="เช่น แก้หัวเรื่องให้สั้นลง / เช็กภาพปกอีกครั้ง" />
        </div>

        {(editingPost?.approved_by || editingPost?.approved_at) && (
          <div className="notice" style={{ marginTop: 11 }}>
            อนุมัติโดย {editingPost.approved_by || '-'} · {editingPost.approved_at ? displayDateTime(editingPost.approved_at) : '-'}
          </div>
        )}

        <div className="modal-actions">
          {canApprove && onApprove && <button className="btn" disabled={saving} onClick={onApprove}>อนุมัติ</button>}
          <button className="btn primary" disabled={saving} onClick={onSave}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        </div>
      </div>
    </div>
  );
}

function PromoteModal({
  form,
  setForm,
  saving,
  onClose,
  onConfirm,
}: {
  form: { title: string; date: string; time: string; channel: string; format: string };
  setForm: Dispatch<SetStateAction<{ title: string; date: string; time: string; channel: string; format: string }>>;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ width: 'min(560px,100%)' }}>
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>ส่งไอเดียเข้าปฏิทิน</h2>
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>
        <div className="field"><label>ไอเดีย</label><input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="modal-grid" style={{ marginTop: 10 }}>
          <div className="field"><label>วันที่</label><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
          <div className="field"><label>เวลา</label><input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} /></div>
          <div className="field">
            <label>ช่องทาง</label>
            <select value={form.channel} onChange={(e) => set('channel', e.target.value)}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>รูปแบบ</label>
            <select value={form.format} onChange={(e) => set('format', e.target.value)}>
              <option>ภาพ</option><option>วิดีโอ</option>
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn primary" disabled={saving} onClick={onConfirm}>{saving ? 'กำลังบันทึก...' : 'สร้างเป็นร่าง'}</button>
        </div>
      </div>
    </div>
  );
}

function IdeaModal({
  form,
  setForm,
  saving,
  onClose,
  onSave,
}: {
  form: { title: string; category: string; score: string; note: string };
  setForm: Dispatch<SetStateAction<{ title: string; category: string; score: string; note: string }>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ width: 'min(560px,100%)' }}>
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>เพิ่มไอเดีย</h2>
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>
        <div className="field"><label>ชื่อไอเดีย</label><input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="modal-grid" style={{ marginTop: 10 }}>
          <div className="field"><label>หมวดหมู่</label><input value={form.category} onChange={(e) => set('category', e.target.value)} /></div>
          <div className="field"><label>คะแนน</label><input type="number" min={0} max={10} value={form.score} onChange={(e) => set('score', e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>โน้ต</label><textarea value={form.note} onChange={(e) => set('note', e.target.value)} /></div>
        <div className="modal-actions">
          <button className="btn primary" disabled={saving} onClick={onSave}>{saving ? 'กำลังบันทึก...' : 'บันทึกไอเดีย'}</button>
        </div>
      </div>
    </div>
  );
}
