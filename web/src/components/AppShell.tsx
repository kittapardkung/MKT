'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { signOut } from '@/lib/actions/auth';
import {
  addIdea,
  addTag,
  approvePost as approvePostFn,
  createPost,
  deletePost,
  fetchBootstrap,
  promoteIdea,
  removeTag,
  savePost,
  setIdeaInterest,
} from '@/lib/data-client';
import {
  MONTHS_TH,
  addDays,
  csvTags,
  displayDate,
  displayDateTime,
  getRange,
  parseDate,
  sortPostDate,
  ymd,
  type RangeValue,
} from '@/lib/date-utils';
import type { AgentId, Bootstrap, Idea, IdeaInterest, Lead, Post, PostStatus } from '@/lib/types';
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
  Radar,
  Compass,
  Sparkles,
  ListChecks,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import AgentReportPage from '@/components/AgentReportPage';
import SparkPage from '@/components/SparkPage';
import TimelinePage from '@/components/TimelinePage';

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

function statusDotColor(status: string) {
  if (status === 'REVIEW') return '#f59e0b';
  if (status === 'APPROVED') return '#22c55e';
  if (status === 'PUBLISHED') return '#16a34a';
  return '#9ca3af';
}

function channelClass(channel: string) {
  const c = (channel || '').toLowerCase();
  if (c.includes('facebook')) return 'channel-facebook';
  if (c.includes('instagram')) return 'channel-instagram';
  if (c.includes('tiktok')) return 'channel-tiktok';
  if (c.includes('youtube')) return 'channel-youtube';
  if (c.includes('line')) return 'channel-line';
  return 'channel-default';
}

function formatChipClass(format: string) {
  return format === 'วิดีโอ' ? 'chip-video' : 'chip-image';
}

function attrUrl(url: string) {
  const s = (url || '').trim();
  if (!/^https?:\/\//i.test(s)) return '#';
  return s;
}

type PageId =
  | 'scout'
  | 'compass'
  | 'spark'
  | 'ads'
  | 'dashboard'
  | 'timeline'
  | 'calendarPage'
  | 'board'
  | 'tablePage'
  | 'library';

type NavItem = { id: PageId; label: string; short: string; icon: LucideIcon };
type NavGroup = { agent: AgentId; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    agent: 'SCOUT',
    label: 'SCOUT · วิเคราะห์คู่แข่ง',
    items: [{ id: 'scout', label: 'ภาพรวมคู่แข่ง', short: 'SCOUT', icon: Radar }],
  },
  {
    agent: 'COMPASS',
    label: 'COMPASS · กลยุทธ์การตลาด',
    items: [{ id: 'compass', label: 'ภาพรวมกลยุทธ์', short: 'COMPASS', icon: Compass }],
  },
  {
    agent: 'SPARK',
    label: 'SPARK · Content Creator',
    items: [{ id: 'spark', label: 'คลังไอเดีย/Hook', short: 'SPARK', icon: Sparkles }],
  },
  {
    agent: 'ADS',
    label: 'ADS · ทีมโฆษณา Meta',
    items: [{ id: 'ads', label: 'ภาพรวมโฆษณา', short: 'ADS', icon: Megaphone }],
  },
  {
    agent: 'ALMANAC',
    label: 'ALMANAC · Content Planner',
    items: [
      { id: 'dashboard', label: 'แดชบอร์ด', short: 'แดชบอร์ด', icon: LayoutDashboard },
      { id: 'timeline', label: 'ไทม์ไลน์การผลิต', short: 'ไทม์ไลน์', icon: ListChecks },
      { id: 'calendarPage', label: 'ปฏิทินคอนเทนต์', short: 'ปฏิทิน', icon: CalendarDays },
      { id: 'board', label: 'บอร์ดคิวงาน', short: 'คิวงาน', icon: KanbanSquare },
      { id: 'tablePage', label: 'ตารางคอนเทนต์', short: 'ตาราง', icon: TableIcon },
      { id: 'library', label: 'คลัง & แท็ก', short: 'คลัง', icon: Library },
    ],
  },
];

const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

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
  content_type: string;
  is_viral: boolean;
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
  content_type: '',
  is_viral: false,
  comment: '',
});

export default function AppShell() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState<PageId>('calendarPage');

  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [rangePreset, setRangePreset] = useState<RangeValue>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarStatusFilter, setCalendarStatusFilter] = useState('');
  const [calendarPpsFilter, setCalendarPpsFilter] = useState('');

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
  const [ideaForm, setIdeaForm] = useState({
    title: '',
    category: '',
    score: '5',
    note: '',
    suggested_date: '',
    suggested_channel: 'Facebook',
    suggested_format: 'ภาพ',
  });

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
      if (calendarStatusFilter && p.status !== calendarStatusFilter) return false;
      if (calendarPpsFilter && (p.content_type || '') !== calendarPpsFilter) return false;
      if (q) {
        const hay = [p.title, p.caption, p.tags, p.owner, p.channel].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }, [data, search, channelFilter, calendarStatusFilter, calendarPpsFilter]);

  const activeTags = useMemo(() => (data?.tags || []).filter((t) => t.active !== false), [data]);

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
      content_type: p.content_type || '',
      is_viral: !!p.is_viral,
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
      content_type: postForm.content_type || null,
      is_viral: postForm.content_type === 'Push' ? postForm.is_viral : false,
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

  function doDelete(id: string) {
    if (!confirm('ยืนยันลบคอนเทนต์นี้? การลบไม่สามารถย้อนกลับได้')) return;
    runAction(() => deletePost(id, data?.me || ''));
  }

  function openPromoteIdea(idea: Idea) {
    setPromoteIdeaTarget(idea);
    setPromoteForm({
      title: idea.title,
      date: idea.suggested_date || ymd(new Date()),
      time: '09:00',
      channel: idea.suggested_channel || 'Facebook',
      format: idea.suggested_format || 'ภาพ',
    });
    setPromoteModalOpen(true);
  }

  function confirmPromote() {
    if (!promoteIdeaTarget) return;
    if (!promoteForm.date) return alert('กรุณาเลือกวันที่');
    runAction(() => promoteIdea(promoteIdeaTarget, promoteForm, data?.me || ''));
  }

  function rejectPromote() {
    if (!promoteIdeaTarget) return;
    if (!confirm('ไม่อนุมัติไอเดียนี้? จะถูกย้ายไปหน้า "ไม่สนใจ" ในหน้า SPARK')) return;
    runAction(() => setIdeaInterest(promoteIdeaTarget.id, 'not_interested'));
  }

  function submitIdea() {
    if (!ideaForm.title.trim()) return alert('กรุณาระบุชื่อไอเดีย');
    runAction(() =>
      addIdea({
        title: ideaForm.title.trim(),
        category: ideaForm.category.trim(),
        score: Number(ideaForm.score || 0),
        note: ideaForm.note,
        agent: 'SPARK' as AgentId,
        suggested_date: ideaForm.suggested_date || null,
        suggested_channel: ideaForm.suggested_channel || null,
        suggested_format: ideaForm.suggested_format || null,
      })
    );
  }

  function doSetInterest(idea: Idea, interest: IdeaInterest) {
    runAction(() => setIdeaInterest(idea.id, interest));
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
        <div className="brand-sub">ระบบจัดการคอนเทนต์การตลาด · Workflow 4 AI</div>

        <nav className="nav-scroll">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.agent}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((n) => (
                <button
                  key={n.id}
                  className={`nav-btn ${page === n.id ? 'active' : ''}`}
                  onClick={() => setPage(n.id)}
                >
                  <span className="icon"><n.icon size={17} /></span>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

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

          {page === 'scout' && <AgentReportPage agent="SCOUT" reports={data?.agentReports || []} />}

          {page === 'compass' && <AgentReportPage agent="COMPASS" reports={data?.agentReports || []} />}

          {page === 'ads' && <AgentReportPage agent="ADS" reports={data?.agentReports || []} />}

          {page === 'spark' && (
            <SparkPage
              ideas={data?.ideas || []}
              reports={data?.agentReports || []}
              onSetInterest={doSetInterest}
              onAddIdea={() => {
                setIdeaForm({
                  title: '',
                  category: '',
                  score: '5',
                  note: '',
                  suggested_date: '',
                  suggested_channel: 'Facebook',
                  suggested_format: 'ภาพ',
                });
                setIdeaModalOpen(true);
              }}
            />
          )}

          {page === 'timeline' && (
            <TimelinePage ideas={data?.ideas || []} role={data?.role || 'creative'} onApprove={openPromoteIdea} />
          )}

          {page === 'dashboard' && <DashboardPage posts={data?.posts || []} leads={data?.leads || []} onOpenPost={openPost} />}

          {page === 'calendarPage' && (
            <CalendarPage
              posts={calendarPosts}
              cursor={calendarCursor}
              onMove={moveCalendar}
              onToday={calendarToday}
              onOpenPost={openPost}
              statusFilter={calendarStatusFilter}
              onStatusFilterChange={setCalendarStatusFilter}
              ppsFilter={calendarPpsFilter}
              onPpsFilterChange={setCalendarPpsFilter}
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
                setIdeaForm({
                  title: '',
                  category: '',
                  score: '5',
                  note: '',
                  suggested_date: '',
                  suggested_channel: 'Facebook',
                  suggested_format: 'ภาพ',
                });
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
          onDelete={editingPost ? () => doDelete(editingPost.id) : undefined}
        />
      )}

      {promoteModalOpen && promoteIdeaTarget && (
        <PromoteModal
          idea={promoteIdeaTarget}
          form={promoteForm}
          setForm={setPromoteForm}
          saving={saving}
          onClose={() => setPromoteModalOpen(false)}
          onConfirm={confirmPromote}
          onReject={rejectPromote}
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

const MONTHS_TH_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function niceMax(n: number) {
  if (n <= 0) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const step = pow <= 1 ? 1 : pow / 2;
  return Math.ceil(n / step) * step;
}

function MonthlyStatusChart({ posts }: { posts: Post[] }) {
  const months = useMemo(() => {
    const now = new Date();
    const list: { key: string; label: string; counts: Record<PostStatus, number>; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push({
        key: monthKey(d),
        label: `${MONTHS_TH_SHORT[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`,
        counts: { DRAFT: 0, REVIEW: 0, APPROVED: 0, PUBLISHED: 0 },
        total: 0,
      });
    }
    const byKey = Object.fromEntries(list.map((m) => [m.key, m]));
    posts.forEach((p) => {
      const d = parseDate(p.date);
      if (!d) return;
      const m = byKey[monthKey(d)];
      if (!m) return;
      const s = (p.status || 'DRAFT') as PostStatus;
      m.counts[s] = (m.counts[s] || 0) + 1;
      m.total += 1;
    });
    return list;
  }, [posts]);

  const maxTotal = niceMax(Math.max(...months.map((m) => m.total), 0));
  const chartH = 230;
  const barW = 56;
  const gap = 40;
  const chartW = months.length * (barW + gap) + gap;
  const svgH = chartH + 34;

  return (
    <div className="card">
      <h2>จำนวนคอนเทนต์ที่ลงในแต่ละเดือน (6 เดือนล่าสุด)</h2>
      <div className="chart-legend">
        {STATUSES.map((s) => (
          <span className="chart-legend-item" key={s}>
            <span className="chart-dot" style={{ background: statusDotColor(s) }} />
            {statusLabel(s)}
          </span>
        ))}
      </div>
      <div style={{ width: '100%', maxWidth: 1000, margin: '0 auto', aspectRatio: `${chartW} / ${svgH}` }}>
      <svg viewBox={`0 0 ${chartW} ${svgH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible', display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={0} x2={chartW}
            y1={chartH - chartH * t} y2={chartH - chartH * t}
            className="chart-grid"
          />
        ))}
        {months.map((m, i) => {
          const x = gap + i * (barW + gap);
          let y = chartH;
          return (
            <g key={m.key}>
              {STATUSES.map((s, si) => {
                const v = m.counts[s];
                if (!v) return null;
                const h = Math.max((v / maxTotal) * chartH - 2, 0);
                y -= h + 2;
                const isTop = STATUSES.slice(si + 1).every((later) => !m.counts[later]);
                return (
                  <rect
                    key={s}
                    x={x} y={y} width={barW} height={h}
                    fill={statusDotColor(s)}
                    rx={isTop ? 4 : 0}
                  >
                    <title>{`${m.label} · ${statusLabel(s)}: ${v}`}</title>
                  </rect>
                );
              })}
              {m.total > 0 && (
                <text x={x + barW / 2} y={chartH - (m.total / maxTotal) * chartH - 8} textAnchor="middle" className="chart-value">
                  {m.total}
                </text>
              )}
              <text x={x + barW / 2} y={chartH + 20} textAnchor="middle" className="chart-axis-label">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

const FORMATS: Post['format'][] = ['ภาพ', 'วิดีโอ'];

function formatColor(format: string) {
  return format === 'วิดีโอ' ? '#ef4444' : '#22c55e';
}

function DailyVolumeChart({ posts, start, end }: { posts: Post[]; start: Date; end: Date }) {
  const days = useMemo(() => {
    const list: Date[] = [];
    let cur = stripTimeLocal(start);
    const last = stripTimeLocal(end);
    let guard = 0;
    while (cur <= last && guard < 400) {
      list.push(cur);
      cur = addDays(cur, 1);
      guard += 1;
    }
    return list;
  }, [start, end]);

  const byDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    posts.forEach((p) => {
      const d = parseDate(p.date);
      if (!d) return;
      const key = ymd(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return map;
  }, [posts]);

  const counts = days.map((d) => (byDay.get(ymd(d)) || []).length);
  const maxCount = niceMax(Math.max(...counts, 0));
  const chartH = 170;
  const padTop = 14;
  const marginLeft = 34;
  const barW = days.length > 40 ? 8 : 20;
  const gap = days.length > 40 ? 3 : 10;
  const plotW = Math.max(days.length * (barW + gap) + gap, 280);
  const chartW = plotW + marginLeft;
  const showLabelEvery = Math.max(1, Math.ceil(days.length / 14));
  const tickFracs = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="card">
      <h2>จำนวนคอนเทนต์ที่ดำเนินการอยู่รายวัน แยกตามชนิดคอนเทนต์</h2>
      <div className="chart-legend">
        {FORMATS.map((f) => (
          <span className="chart-legend-item" key={f}>
            <span className="chart-dot" style={{ background: formatColor(f) }} />
            {f}
          </span>
        ))}
      </div>
      <div className="calendar-wrap">
        <svg viewBox={`0 0 ${chartW} ${chartH + padTop + 30}`} width={chartW} style={{ minWidth: '100%', overflow: 'visible' }}>
          {tickFracs.map((t) => {
            const y = padTop + chartH - chartH * t;
            return (
              <g key={t}>
                <line x1={marginLeft} x2={chartW} y1={y} y2={y} className="chart-grid" />
                <text x={marginLeft - 8} y={y} textAnchor="end" dominantBaseline="middle" className="chart-axis-label">
                  {Math.round(maxCount * t)}
                </text>
              </g>
            );
          })}
          {days.map((d, i) => {
            const key = ymd(d);
            const dayPosts = byDay.get(key) || [];
            const v = dayPosts.length;
            const x = marginLeft + gap + i * (barW + gap);
            const titles = dayPosts.slice(0, 5).map((p) => p.title).join(', ');
            const more = dayPosts.length > 5 ? ` +${dayPosts.length - 5} อื่นๆ` : '';
            let y = padTop + chartH;
            return (
              <g key={key}>
                {FORMATS.map((f) => {
                  const fCount = dayPosts.filter((p) => (p.format || 'ภาพ') === f).length;
                  if (!fCount) return null;
                  const h = maxCount ? Math.max((fCount / maxCount) * chartH, 3) : 0;
                  y -= h;
                  return (
                    <rect key={f} x={x} y={y} width={barW} height={h} fill={formatColor(f)}>
                      <title>{`${displayDate(key)} · ${f}: ${fCount} (รวมวันนี้ ${v}: ${titles}${more})`}</title>
                    </rect>
                  );
                })}
                {i % showLabelEvery === 0 && (
                  <>
                    <line
                      x1={x + barW / 2}
                      x2={x + barW / 2}
                      y1={padTop + chartH}
                      y2={padTop + chartH + 5}
                      className="chart-axis-tick"
                    />
                    <text x={x + barW / 2} y={padTop + chartH + 18} textAnchor="middle" className="chart-axis-label">
                      {d.getDate()}/{d.getMonth() + 1}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function stripTimeLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const LEAD_STATUS_PALETTE = ['#5b5bd6', '#22c55e', '#f59e0b', '#38bdf8', '#ef4444', '#8b5cf6', '#14b8a6', '#9ca3af'];

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'ลีดใหม่',
  CONTACTED: 'ติดต่อแล้ว',
  FOLLOW_UP: 'ติดตามต่อ',
  TEST_DRIVE: 'นัดทดลองขับ',
  LOST: 'เสียโอกาส',
  WON: 'ปิดการขาย',
};

function leadStatusLabel(status: string) {
  return LEAD_STATUS_LABELS[status] || status || 'ไม่ระบุสถานะ';
}

function LeadsDailyChart({
  leads,
  start,
  end,
  statusOrder,
  statusColor,
}: {
  leads: Lead[];
  start: Date;
  end: Date;
  statusOrder: string[];
  statusColor: (status: string) => string;
}) {
  const days = useMemo(() => {
    const list: Date[] = [];
    let cur = stripTimeLocal(start);
    const last = stripTimeLocal(end);
    let guard = 0;
    while (cur <= last && guard < 400) {
      list.push(cur);
      cur = addDays(cur, 1);
      guard += 1;
    }
    return list;
  }, [start, end]);

  const byDay = useMemo(() => {
    const map = new Map<string, Lead[]>();
    leads.forEach((l) => {
      const d = parseDate(l.created_date || '');
      if (!d) return;
      const key = ymd(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return map;
  }, [leads]);

  const counts = days.map((d) => (byDay.get(ymd(d)) || []).length);
  const maxCount = niceMax(Math.max(...counts, 0));
  const chartH = 170;
  const padTop = 14;
  const marginLeft = 34;
  const barW = days.length > 40 ? 8 : 20;
  const gap = days.length > 40 ? 3 : 10;
  const plotW = Math.max(days.length * (barW + gap) + gap, 280);
  const chartW = plotW + marginLeft;
  const showLabelEvery = Math.max(1, Math.ceil(days.length / 14));
  const tickFracs = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="card">
      <h2>จำนวนลีด (เบอร์ลูกค้า) รายวัน แยกตามสถานะ</h2>
      <div className="chart-legend">
        {statusOrder.map((s) => (
          <span className="chart-legend-item" key={s}>
            <span className="chart-dot" style={{ background: statusColor(s) }} />
            {leadStatusLabel(s)}
          </span>
        ))}
      </div>
      <div className="calendar-wrap">
        <svg viewBox={`0 0 ${chartW} ${chartH + padTop + 30}`} width={chartW} style={{ minWidth: '100%', overflow: 'visible' }}>
          {tickFracs.map((t) => {
            const y = padTop + chartH - chartH * t;
            return (
              <g key={t}>
                <line x1={marginLeft} x2={chartW} y1={y} y2={y} className="chart-grid" />
                <text x={marginLeft - 8} y={y} textAnchor="end" dominantBaseline="middle" className="chart-axis-label">
                  {Math.round(maxCount * t)}
                </text>
              </g>
            );
          })}
          {days.map((d, i) => {
            const key = ymd(d);
            const dayLeads = byDay.get(key) || [];
            const v = dayLeads.length;
            const x = marginLeft + gap + i * (barW + gap);
            let y = padTop + chartH;
            return (
              <g key={key}>
                {statusOrder.map((s) => {
                  const sCount = dayLeads.filter((l) => (l.lead_status || 'ไม่ระบุ') === s).length;
                  if (!sCount) return null;
                  const h = maxCount ? Math.max((sCount / maxCount) * chartH, 3) : 0;
                  y -= h;
                  return (
                    <rect key={s} x={x} y={y} width={barW} height={h} fill={statusColor(s)}>
                      <title>{`${displayDate(key)} · ${leadStatusLabel(s)}: ${sCount} (รวมวันนี้ ${v} เบอร์)`}</title>
                    </rect>
                  );
                })}
                {i % showLabelEvery === 0 && (
                  <>
                    <line
                      x1={x + barW / 2}
                      x2={x + barW / 2}
                      y1={padTop + chartH}
                      y2={padTop + chartH + 5}
                      className="chart-axis-tick"
                    />
                    <text x={x + barW / 2} y={padTop + chartH + 18} textAnchor="middle" className="chart-axis-label">
                      {d.getDate()}/{d.getMonth() + 1}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
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

function LeadsStatusBySalesCard({
  leads,
  statusOrder,
  statusColor,
}: {
  leads: Lead[];
  statusOrder: string[];
  statusColor: (status: string) => string;
}) {
  const overall = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const s = l.lead_status || 'ไม่ระบุ';
      map.set(s, (map.get(s) || 0) + 1);
    });
    return statusOrder
      .map((s) => ({ status: s, count: map.get(s) || 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [leads, statusOrder]);

  const total = overall.reduce((sum, b) => sum + b.count, 0);

  const slices = useMemo(() => {
    return overall.reduce<Array<(typeof overall)[number] & { startAngle: number; endAngle: number; pct: number }>>(
      (acc, b) => {
        const prevEnd = acc.length ? acc[acc.length - 1].endAngle : 0;
        const frac = total ? b.count / total : 0;
        const sweep = Math.min(frac * 360, 359.99);
        acc.push({ ...b, startAngle: prevEnd, endAngle: prevEnd + sweep, pct: Math.round(frac * 100) });
        return acc;
      },
      []
    );
  }, [overall, total]);

  const bySales = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      const sales = l.assigned_sales || 'ไม่ระบุผู้ดูแล';
      map.set(sales, (map.get(sales) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([sales, count]) => ({ sales, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const salesColor = (sales: string) => {
    const idx = bySales.findIndex((b) => b.sales === sales);
    return LEAD_STATUS_PALETTE[idx >= 0 ? idx % LEAD_STATUS_PALETTE.length : LEAD_STATUS_PALETTE.length - 1];
  };

  const salesSlices = useMemo(() => {
    return bySales.reduce<Array<(typeof bySales)[number] & { startAngle: number; endAngle: number; pct: number }>>(
      (acc, b) => {
        const prevEnd = acc.length ? acc[acc.length - 1].endAngle : 0;
        const frac = total ? b.count / total : 0;
        const sweep = Math.min(frac * 360, 359.99);
        acc.push({ ...b, startAngle: prevEnd, endAngle: prevEnd + sweep, pct: Math.round(frac * 100) });
        return acc;
      },
      []
    );
  }, [bySales, total]);

  return (
    <div className="card">
      <h2>สถานะลูกค้า (Leads) และจำนวนต่อ Sale ในช่วงที่เลือก</h2>
      {!total ? (
        <Empty text="ยังไม่มีลีดในช่วงที่เลือก" />
      ) : (
        <div className="leads-split-wrap">
          <div className="pie-chart-wrap leads-split-col">
            <svg viewBox="0 0 200 200" className="pie-chart-svg">
              {slices.map((s) => (
                <path key={s.status} d={donutSlicePath(100, 100, 82, 48, s.startAngle, s.endAngle)} fill={statusColor(s.status)}>
                  <title>{`${leadStatusLabel(s.status)}: ${s.count} เบอร์ (${s.pct}%)`}</title>
                </path>
              ))}
              <circle cx="100" cy="100" r="47" fill="var(--surface)" />
              <text x="100" y="96" textAnchor="middle" className="pie-chart-total-num">{total}</text>
              <text x="100" y="115" textAnchor="middle" className="pie-chart-total-label">เบอร์ทั้งหมด</text>
            </svg>
            <div className="pie-chart-legend">
              {slices.map((s) => (
                <div className="pie-chart-legend-row" key={s.status}>
                  <span className="chart-dot" style={{ background: statusColor(s.status) }} />
                  <span className="pie-chart-legend-label">{leadStatusLabel(s.status)}</span>
                  <span className="pie-chart-legend-value num">{s.count} · {s.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pie-chart-wrap leads-split-col">
            <svg viewBox="0 0 200 200" className="pie-chart-svg">
              {salesSlices.map((s) => (
                <path key={s.sales} d={donutSlicePath(100, 100, 82, 48, s.startAngle, s.endAngle)} fill={salesColor(s.sales)}>
                  <title>{`${s.sales}: ${s.count} เบอร์ (${s.pct}%)`}</title>
                </path>
              ))}
              <circle cx="100" cy="100" r="47" fill="var(--surface)" />
              <text x="100" y="96" textAnchor="middle" className="pie-chart-total-num">{total}</text>
              <text x="100" y="115" textAnchor="middle" className="pie-chart-total-label">เบอร์ทั้งหมด</text>
            </svg>
            <div className="pie-chart-legend">
              {salesSlices.map((s) => (
                <div className="pie-chart-legend-row" key={s.sales}>
                  <span className="chart-dot" style={{ background: salesColor(s.sales) }} />
                  <span className="pie-chart-legend-label">{s.sales}</span>
                  <span className="pie-chart-legend-value num">{s.count} · {s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const LEAD_MONTHLY_TARGET = 100;

function LeadsTargetCard({ leads }: { leads: Lead[] }) {
  const now = useMemo(() => new Date(), []);
  const thisMonthLeads = useMemo(
    () =>
      leads.filter((l) => {
        const d = parseDate(l.created_date || '');
        return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }),
    [leads, now]
  );

  const actual = thisMonthLeads.length;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const expectedByNow = Math.round((LEAD_MONTHLY_TARGET * dayOfMonth) / daysInMonth);
  const pct = Math.min(100, Math.round((actual / LEAD_MONTHLY_TARGET) * 100));
  const onPace = actual >= expectedByNow;
  const remainingDays = daysInMonth - dayOfMonth;
  const remainingTarget = Math.max(LEAD_MONTHLY_TARGET - actual, 0);
  const neededPerDay = remainingDays > 0 ? Math.ceil(remainingTarget / remainingDays) : remainingTarget;
  const goalReached = actual >= LEAD_MONTHLY_TARGET;

  return (
    <div className="card lead-target-card">
      <div className="lead-target-head">
        <div>
          <div className="lead-target-label">เป้าหมายหลัก · Lead Generation</div>
          <h2 style={{ margin: '4px 0 0' }}>
            เบอร์ลูกค้าเดือน {MONTHS_TH[now.getMonth()]} {now.getFullYear() + 543}
          </h2>
        </div>
        <span className={`badge ${goalReached ? 'approved' : onPace ? 'approved' : 'pending'}`}>
          {goalReached ? 'ถึงเป้าหมายแล้ว 🎉' : onPace ? 'ตามจังหวะเป้าหมาย' : `ตามหลังเป้า ${expectedByNow - actual} เบอร์`}
        </span>
      </div>
      <div className="lead-target-value">
        <span className="lead-target-num">{actual}</span>
        <span className="lead-target-goal">/ {LEAD_MONTHLY_TARGET} เบอร์</span>
      </div>
      <div className="lead-target-track">
        <div className={`lead-target-fill ${onPace ? 'met' : ''}`} style={{ width: `${pct}%` }} />
        <div
          className="lead-target-pace-marker"
          style={{ left: `${Math.min((dayOfMonth / daysInMonth) * 100, 100)}%` }}
          title={`ตามจังหวะควรได้ ~${expectedByNow} เบอร์ ณ วันนี้ (วันที่ ${dayOfMonth}/${daysInMonth})`}
        />
      </div>
      <div className="meta" style={{ marginTop: 10 }}>
        วันนี้เป็นวันที่ {dayOfMonth} จาก {daysInMonth} วันของเดือน · ตามจังหวะควรได้ ~{expectedByNow} เบอร์
        {!goalReached && remainingDays > 0 && (
          <> · เหลืออีก {remainingTarget} เบอร์ ใน {remainingDays} วัน (เฉลี่ยวันละ {neededPerDay} เบอร์)</>
        )}
        {!goalReached && remainingDays <= 0 && <> · หมดเดือนแล้ว ยังขาดอีก {remainingTarget} เบอร์</>}
      </div>
    </div>
  );
}

const MARKETING_TARGETS = {
  video: 28,
  videoPush: 12,
  videoPull: 11,
  videoSell: 5,
  viralPush: 8,
  image: 12,
  event: 2,
  sellPctMax: 20,
};

function KpiTargetRow({
  label,
  actual,
  target,
  color,
  suffix = '',
}: {
  label: string;
  actual: number;
  target: number;
  color: string;
  suffix?: string;
}) {
  const pct = target ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const met = actual >= target;
  return (
    <div className="channel-breakdown-row">
      <span className="meta" style={{ minWidth: 170, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      <div className="progress channel-breakdown-bar">
        <span style={{ width: `${pct}%`, background: met ? 'var(--success-dark)' : color }} />
      </div>
      <span className="meta num" style={{ minWidth: 90, textAlign: 'right', color: met ? 'var(--success-dark)' : 'var(--muted)', fontWeight: met ? 700 : 400 }}>
        {actual}{suffix} / {target}{suffix}
      </span>
    </div>
  );
}

function MarketingKPICard({ posts }: { posts: Post[] }) {
  const now = useMemo(() => new Date(), []);
  const thisMonth = useMemo(
    () =>
      posts.filter((p) => {
        const d = parseDate(p.date);
        return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }),
    [posts, now]
  );

  const videos = thisMonth.filter((p) => p.format === 'วิดีโอ');
  const images = thisMonth.filter((p) => p.format === 'ภาพ');
  const videoPush = videos.filter((p) => p.content_type === 'Push');
  const videoPull = videos.filter((p) => p.content_type === 'Pull');
  const videoSell = videos.filter((p) => p.content_type === 'Sell');
  const viralPush = videoPush.filter((p) => p.is_viral);
  const events = thisMonth.filter((p) => p.content_type === 'Event');
  const sellAll = thisMonth.filter((p) => p.content_type === 'Sell').length;
  const sellPct = thisMonth.length ? Math.round((sellAll / thisMonth.length) * 100) : 0;
  const weekOfMonth = Math.ceil(now.getDate() / 7);

  return (
    <div className="card">
      <h2>KPI แผนก Marketing — PPS Content System ({MONTHS_TH[now.getMonth()]} {now.getFullYear() + 543})</h2>
      <div className="meta" style={{ marginBottom: 12 }}>
        เป้าหมาย Short Video ≥28 คลิป/เดือน (~7 คลิป/สัปดาห์ = Push 3 + Pull 3 + Sell 1, Push ต้องมี Viral ≥2 คลิป/สัปดาห์) · ตอนนี้อยู่สัปดาห์ที่ {weekOfMonth} ของเดือน
      </div>
      <div className="channel-breakdown">
        <KpiTargetRow label="Short Video (รวม)" actual={videos.length} target={MARKETING_TARGETS.video} color="var(--danger)" suffix=" คลิป" />
        <KpiTargetRow label="↳ Push (Awareness)" actual={videoPush.length} target={MARKETING_TARGETS.videoPush} color="var(--accent)" suffix=" คลิป" />
        <KpiTargetRow label="↳ Pull (Authority)" actual={videoPull.length} target={MARKETING_TARGETS.videoPull} color="var(--info)" suffix=" คลิป" />
        <KpiTargetRow label="↳ Sell (ปิดการขาย)" actual={videoSell.length} target={MARKETING_TARGETS.videoSell} color="var(--warning)" suffix=" คลิป" />
        <KpiTargetRow label="↳ Viral Content ใน Push" actual={viralPush.length} target={MARKETING_TARGETS.viralPush} color="var(--purple)" suffix=" คลิป" />
        <KpiTargetRow label="Image Content" actual={images.length} target={MARKETING_TARGETS.image} color="var(--success)" suffix=" ภาพ" />
        <KpiTargetRow label="Event / Test Drive" actual={events.length} target={MARKETING_TARGETS.event} color="var(--teal)" suffix=" งาน" />
      </div>
      <div className="notice" style={{ marginTop: 14 }}>
        สัดส่วน Sell เดือนนี้: <strong>{sellPct}%</strong> ของคอนเทนต์ทั้งหมด ({sellAll}/{thisMonth.length}) —
        {sellPct > MARKETING_TARGETS.sellPctMax
          ? ` เกินเป้าหมายที่แนะนำ (ไม่เกิน ${MARKETING_TARGETS.sellPctMax}%)`
          : ` อยู่ในเป้าหมาย (ไม่เกิน ${MARKETING_TARGETS.sellPctMax}%)`}
      </div>
    </div>
  );
}

function ChannelBreakdownCard({ breakdown }: { breakdown: { channel: string; count: number; pct: number }[] }) {
  return (
    <div className="card">
      <h2>ช่องทางที่ลง — จำนวนและสัดส่วน</h2>
      {breakdown.length ? (
        <div className="channel-breakdown">
          {breakdown.map((c) => (
            <div className="channel-breakdown-row" key={c.channel}>
              <span className={`channel-tag ${channelClass(c.channel)}`}>{c.channel}</span>
              <div className="progress channel-breakdown-bar">
                <span style={{ width: `${c.pct}%`, background: 'currentColor' }} className={channelClass(c.channel)} />
              </div>
              <span className="meta num" style={{ minWidth: 70, textAlign: 'right' }}>{c.count} ชิ้น · {c.pct}%</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="ยังไม่มีคอนเทนต์ในช่วงที่เลือก" />
      )}
    </div>
  );
}

function FormatPieChart({ posts }: { posts: Post[] }) {
  const total = posts.length;
  const breakdown = FORMATS.map((f) => ({
    format: f,
    count: posts.filter((p) => (p.format || 'ภาพ') === f).length,
  })).filter((b) => b.count > 0);

  const slices = breakdown.reduce<Array<(typeof breakdown)[number] & { startAngle: number; endAngle: number; pct: number }>>(
    (acc, b) => {
      const prevEnd = acc.length ? acc[acc.length - 1].endAngle : 0;
      const frac = total ? b.count / total : 0;
      const sweep = Math.min(frac * 360, 359.99);
      acc.push({ ...b, startAngle: prevEnd, endAngle: prevEnd + sweep, pct: Math.round(frac * 100) });
      return acc;
    },
    []
  );

  return (
    <div className="card">
      <h2>สัดส่วนประเภทสื่อที่ลง (ภาพ/วิดีโอ)</h2>
      {!total ? (
        <Empty text="ยังไม่มีคอนเทนต์ในช่วงที่เลือก" />
      ) : (
        <div className="pie-chart-wrap">
          <svg viewBox="0 0 200 200" className="pie-chart-svg">
            {slices.map((s) => (
              <path key={s.format} d={donutSlicePath(100, 100, 82, 48, s.startAngle, s.endAngle)} fill={formatColor(s.format)}>
                <title>{`${s.format}: ${s.count} ชิ้น (${s.pct}%)`}</title>
              </path>
            ))}
            <circle cx="100" cy="100" r="47" fill="var(--surface)" />
            <text x="100" y="96" textAnchor="middle" className="pie-chart-total-num">{total}</text>
            <text x="100" y="115" textAnchor="middle" className="pie-chart-total-label">ชิ้นทั้งหมด</text>
          </svg>
          <div className="pie-chart-legend">
            {slices.map((s) => (
              <div className="pie-chart-legend-row" key={s.format}>
                <span className="chart-dot" style={{ background: formatColor(s.format) }} />
                <span className="pie-chart-legend-label">{s.format}</span>
                <span className="pie-chart-legend-value num">{s.count} · {s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardPage({ posts, leads, onOpenPost }: { posts: Post[]; leads: Lead[]; onOpenPost: (p: Post) => void }) {
  const [dashTab, setDashTab] = useState<'marketing' | 'leads'>('marketing');
  const [preset, setPreset] = useState<RangeValue>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = useMemo(() => getRange(preset, from, to), [preset, from, to]);

  const inRange = useMemo(() => {
    if (!range.start || !range.end) return [];
    return posts.filter((p) => {
      const d = parseDate(p.date);
      return d && d >= range.start! && d <= range.end!;
    });
  }, [posts, range]);

  const leadsInRange = useMemo(() => {
    if (!range.start || !range.end) return [];
    return leads.filter((l) => {
      const d = parseDate(l.created_date || '');
      return d && d >= range.start! && d <= range.end!;
    });
  }, [leads, range]);

  const statusCounts = useMemo(() => {
    const map: Record<PostStatus, number> = { DRAFT: 0, REVIEW: 0, APPROVED: 0, PUBLISHED: 0 };
    inRange.forEach((p) => {
      const s = (p.status || 'DRAFT') as PostStatus;
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [inRange]);

  const formatCounts = useMemo(() => {
    const map: Record<string, number> = { ภาพ: 0, วิดีโอ: 0 };
    inRange.forEach((p) => {
      const f = p.format || 'ภาพ';
      map[f] = (map[f] || 0) + 1;
    });
    return map;
  }, [inRange]);

  const channelBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    inRange.forEach((p) => {
      csvTags(p.channel).forEach((c) => map.set(c, (map.get(c) || 0) + 1));
    });
    const totalHits = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([channel, count]) => ({ channel, count, pct: totalHits ? Math.round((count / totalHits) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [inRange]);

  const channelCount = channelBreakdown.length;

  const publishRate = inRange.length ? Math.round((statusCounts.PUBLISHED / inRange.length) * 100) : 0;

  const leadStatusOrder = useMemo(() => {
    const seen: string[] = [];
    leads.forEach((l) => {
      const s = l.lead_status || 'ไม่ระบุ';
      if (!seen.includes(s)) seen.push(s);
    });
    return seen;
  }, [leads]);

  const leadStatusColor = (status: string) => {
    const idx = leadStatusOrder.indexOf(status || 'ไม่ระบุ');
    return LEAD_STATUS_PALETTE[idx >= 0 ? idx % LEAD_STATUS_PALETTE.length : LEAD_STATUS_PALETTE.length - 1];
  };

  return (
    <>
      <LeadsTargetCard leads={leads} />

      <div className="calendar-head" style={{ marginTop: 14 }}>
        <h1 style={{ marginBottom: 0 }}>แดชบอร์ดคอนเทนต์</h1>
        <div className="calendar-actions">
          <select className="control" value={preset} onChange={(e) => setPreset(e.target.value as RangeValue)}>
            <option value="month">เดือนนี้</option>
            <option value="lastMonth">เดือนที่แล้ว</option>
            <option value="custom">กำหนดเอง</option>
          </select>
          {preset === 'custom' && (
            <div className="custom-range show">
              <input type="date" className="control" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" className="control" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
        </div>
      </div>
      <div className="period-label">ช่วงที่แสดง: {range.label} · รวม {inRange.length} คอนเทนต์ · {leadsInRange.length} เบอร์</div>

      <div className="spark-tabs">
        <button
          className={`spark-tab ${dashTab === 'marketing' ? 'active' : ''}`}
          onClick={() => setDashTab('marketing')}
        >
          📣 KPI แผนก Marketing — การผลิตสื่อ
        </button>
        <button
          className={`spark-tab ${dashTab === 'leads' ? 'active' : ''}`}
          onClick={() => setDashTab('leads')}
        >
          📞 KPI จำนวนลีด (เบอร์ลูกค้า)
        </button>
      </div>

      {dashTab === 'marketing' && (
      <>
      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <div className="card kpi-cell">
          <div className="kpi-title">
            รวมทั้งหมด
            <span className="kpi-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <span className="chart-dot" style={{ background: 'var(--accent)' }} />
            </span>
          </div>
          <div className="kpi-value">{inRange.length}</div>
        </div>
        {STATUSES.map((s) => (
          <div className="card kpi-cell" key={s}>
            <div className="kpi-title">
              {statusLabel(s)}
              <span className="kpi-icon" style={{ background: statusDotColor(s) + '22', color: statusDotColor(s) }}>
                <span className="chart-dot" style={{ background: statusDotColor(s) }} />
              </span>
            </div>
            <div className="kpi-value">{statusCounts[s]}</div>
          </div>
        ))}
        <div className="card kpi-cell">
          <div className="kpi-title">
            อัตราเผยแพร่
            <span className="kpi-icon" style={{ background: 'var(--success-soft)', color: 'var(--success-dark)' }}>
              <span className="chart-dot" style={{ background: 'var(--success-dark)' }} />
            </span>
          </div>
          <div className="kpi-value">{publishRate}%</div>
        </div>
        <div className="card kpi-cell">
          <div className="kpi-title">
            ภาพ / วิดีโอ
            <span className="kpi-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              <span className="chart-dot" style={{ background: 'var(--danger)' }} />
            </span>
          </div>
          <div className="kpi-value">{formatCounts['ภาพ']} / {formatCounts['วิดีโอ']}</div>
        </div>
        <div className="card kpi-cell">
          <div className="kpi-title">
            ช่องทางที่ใช้
            <span className="kpi-icon" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              <span className="chart-dot" style={{ background: 'var(--info)' }} />
            </span>
          </div>
          <div className="kpi-value">{channelCount}</div>
          <div className="kpi-foot">
            {channelBreakdown.length ? channelBreakdown.map((c) => c.channel).join(', ') : 'ยังไม่มีข้อมูล'}
          </div>
        </div>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1fr', marginTop: 0, gap: 14 }}>
        <MarketingKPICard posts={posts} />
        <MonthlyStatusChart posts={posts} />
      </div>

      <div className="two-col">
        {range.start && range.end && <DailyVolumeChart posts={inRange} start={range.start} end={range.end} />}
        <FormatPieChart posts={inRange} />
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
        <ChannelBreakdownCard breakdown={channelBreakdown} />
      </div>

      {inRange.length > 0 && (
        <div className="card" style={{ marginTop: 14, overflow: 'auto' }}>
          <h2>คอนเทนต์ในช่วงที่เลือก</h2>
          <table>
            <thead>
              <tr><th>วันที่</th><th>หัวเรื่อง</th><th>ช่องทาง</th><th>สถานะ</th></tr>
            </thead>
            <tbody>
              {[...inRange].sort(sortPostDate).map((p) => (
                <tr className="clickable" key={p.id} onClick={() => onOpenPost(p)}>
                  <td>{displayDate(p.date)}</td>
                  <td>{p.title}</td>
                  <td><span className={`channel-tag ${channelClass(p.channel)}`}>{p.channel}</span></td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {dashTab === 'leads' && (
      <>
      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <div className="card kpi-cell">
          <div className="kpi-title">
            เบอร์ลูกค้าที่ได้ (ทั้งหมด)
            <span className="kpi-icon" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
              <span className="chart-dot" style={{ background: 'var(--purple)' }} />
            </span>
          </div>
          <div className="kpi-value">{leads.length}</div>
        </div>
        <div className="card kpi-cell">
          <div className="kpi-title">
            เบอร์ในช่วงที่เลือก
            <span className="kpi-icon" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
              <span className="chart-dot" style={{ background: 'var(--purple)' }} />
            </span>
          </div>
          <div className="kpi-value">{leadsInRange.length}</div>
          <div className="kpi-foot">{range.label}</div>
        </div>
        {leadStatusOrder.slice(0, 4).map((s) => (
          <div className="card kpi-cell" key={s}>
            <div className="kpi-title">
              {leadStatusLabel(s)}
              <span className="kpi-icon" style={{ background: `${leadStatusColor(s)}22`, color: leadStatusColor(s) }}>
                <span className="chart-dot" style={{ background: leadStatusColor(s) }} />
              </span>
            </div>
            <div className="kpi-value">{leadsInRange.filter((l) => (l.lead_status || 'ไม่ระบุ') === s).length}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1fr', marginTop: 0, gap: 14 }}>
        {range.start && range.end && (
          <LeadsDailyChart
            leads={leadsInRange}
            start={range.start}
            end={range.end}
            statusOrder={leadStatusOrder}
            statusColor={leadStatusColor}
          />
        )}
        <LeadsStatusBySalesCard leads={leadsInRange} statusOrder={leadStatusOrder} statusColor={leadStatusColor} />
      </div>
      </>
      )}
    </>
  );
}

function CalendarPage({
  posts,
  cursor,
  onMove,
  onToday,
  onOpenPost,
  statusFilter,
  onStatusFilterChange,
  ppsFilter,
  onPpsFilterChange,
}: {
  posts: Post[];
  cursor: Date;
  onMove: (d: number) => void;
  onToday: () => void;
  onOpenPost: (p: Post) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  ppsFilter: string;
  onPpsFilterChange: (v: string) => void;
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
          <select className="control" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select className="control" value={ppsFilter} onChange={(e) => onPpsFilterChange(e.target.value)}>
            <option value="">ทุกหมวด (PPS)</option>
            <option value="Push">Push (Awareness)</option>
            <option value="Pull">Pull (Authority)</option>
            <option value="Sell">Sell (ปิดการขาย)</option>
            <option value="Event">Event / Test Drive</option>
          </select>
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
            const isToday = key === ymd(new Date());
            const dayPosts = posts.filter((p) => ymd(parseDate(p.date)) === key).sort(sortPostDate);
            return (
              <div className={`day ${outside ? 'outside' : ''} ${isToday ? 'today' : ''}`} key={i}>
                <div className="daynum">{d.getDate()}</div>
                {dayPosts.map((p) => (
                  <div className={`chip ${formatChipClass(p.format)}`} key={p.id} onClick={() => onOpenPost(p)}>
                    <span className="dot" style={{ background: statusDotColor(p.status) }} />
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
            <div className={`kanban-col col-${statusClass(status)}`} key={status}>
              <div className="kanban-title">{statusLabel(status)} <span className="num">({items.length})</span></div>
              {items.length ? (
                items.map((p) => (
                  <div className="task" key={p.id} onClick={() => onOpenPost(p)}>
                    <div className="task-title">{p.title}</div>
                    <div className="meta" style={{ marginTop: 4 }}>
                      <span className={`channel-tag ${channelClass(p.channel)}`}>{p.channel}</span>
                    </div>
                    <div className="meta">{displayDate(p.date)} {p.time}</div>
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
                <td><span className={`channel-tag ${channelClass(p.channel)}`}>{p.channel}</span></td>
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
  onDelete,
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
  onDelete?: () => void;
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
          <div className="field">
            <label>ประเภทคอนเทนต์ (PPS)</label>
            <select value={form.content_type} onChange={(e) => set('content_type', e.target.value)}>
              <option value="">ไม่ระบุ</option>
              <option value="Push">Push (Awareness)</option>
              <option value="Pull">Pull (Authority)</option>
              <option value="Sell">Sell (ปิดการขาย)</option>
              <option value="Event">Event / Test Drive</option>
            </select>
          </div>
          {form.content_type === 'Push' && (
            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
              <input
                type="checkbox"
                id="is_viral"
                checked={form.is_viral}
                onChange={(e) => set('is_viral', e.target.checked)}
                style={{ width: 'auto' }}
              />
              <label htmlFor="is_viral" style={{ margin: 0 }}>เป็น Viral Content</label>
            </div>
          )}
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
          {onDelete && <button className="btn danger" disabled={saving} onClick={onDelete} style={{ marginRight: 'auto' }}>ลบคอนเทนต์</button>}
          {canApprove && onApprove && <button className="btn success" disabled={saving} onClick={onApprove}>อนุมัติ</button>}
          <button className="btn primary" disabled={saving} onClick={onSave}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        </div>
      </div>
    </div>
  );
}

function PromoteModal({
  idea,
  form,
  setForm,
  saving,
  onClose,
  onConfirm,
  onReject,
}: {
  idea: Idea;
  form: { title: string; date: string; time: string; channel: string; format: string };
  setForm: Dispatch<SetStateAction<{ title: string; date: string; time: string; channel: string; format: string }>>;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ width: 'min(560px,100%)' }}>
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>ส่งไอเดียเข้าปฏิทิน</h2>
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>
        {idea.note && (
          <div className="notice" style={{ whiteSpace: 'pre-wrap' }}>{idea.note}</div>
        )}
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
          <button className="btn danger" disabled={saving} onClick={onReject} style={{ marginRight: 'auto' }}>ไม่อนุมัติ</button>
          <button className="btn primary" disabled={saving} onClick={onConfirm}>{saving ? 'กำลังบันทึก...' : 'สร้างเป็นร่าง'}</button>
        </div>
      </div>
    </div>
  );
}

type IdeaForm = {
  title: string;
  category: string;
  score: string;
  note: string;
  suggested_date: string;
  suggested_channel: string;
  suggested_format: string;
};

function IdeaModal({
  form,
  setForm,
  saving,
  onClose,
  onSave,
}: {
  form: IdeaForm;
  setForm: Dispatch<SetStateAction<IdeaForm>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof IdeaForm>(k: K, v: IdeaForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ width: 'min(560px,100%)' }}>
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>เสนอไอเดีย/Hook ใหม่ (SPARK)</h2>
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>
        <div className="field"><label>ชื่อไอเดีย</label><input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="modal-grid" style={{ marginTop: 10 }}>
          <div className="field"><label>หมวดหมู่</label><input value={form.category} onChange={(e) => set('category', e.target.value)} /></div>
          <div className="field"><label>คะแนน</label><input type="number" min={0} max={10} value={form.score} onChange={(e) => set('score', e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}><label>โน้ต</label><textarea value={form.note} onChange={(e) => set('note', e.target.value)} /></div>
        <div className="notice" style={{ marginTop: 10 }}>เสนอวันที่ควรลง (ไม่บังคับ) — ALMANAC จะใช้ค่านี้เป็นค่าเริ่มต้นตอนอนุมัติเข้าปฏิทินในหน้าไทม์ไลน์การผลิต</div>
        <div className="modal-grid" style={{ marginTop: 10 }}>
          <div className="field"><label>วันที่เสนอ</label><input type="date" value={form.suggested_date} onChange={(e) => set('suggested_date', e.target.value)} /></div>
          <div className="field">
            <label>ช่องทางที่เสนอ</label>
            <select value={form.suggested_channel} onChange={(e) => set('suggested_channel', e.target.value)}>
              {CHANNELS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>รูปแบบที่เสนอ</label>
            <select value={form.suggested_format} onChange={(e) => set('suggested_format', e.target.value)}>
              <option>ภาพ</option><option>วิดีโอ</option>
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn primary" disabled={saving} onClick={onSave}>{saving ? 'กำลังบันทึก...' : 'บันทึกไอเดีย'}</button>
        </div>
      </div>
    </div>
  );
}
