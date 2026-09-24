import { createClient } from '@/lib/supabase/client';
import type { Bootstrap, Idea, Lead, Post, PostStatus, Role, Tag } from '@/lib/types';

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function getRole(email: string): Promise<Role> {
  const supabase = createClient();
  const { data } = await supabase
    .from('team_members')
    .select('role')
    .ilike('email', email)
    .maybeSingle();
  return data?.role === 'editor' ? 'editor' : 'creative';
}

export async function fetchBootstrap(): Promise<Bootstrap> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // TODO(auth-testing-bypass): ยังไม่ได้ล็อกอิน (ปิดบังคับล็อกอินไว้ชั่วคราว) — สมมติเป็น editor เพื่อทดสอบปุ่มอนุมัติได้
  const me = user?.email || 'ทดสอบระบบ (ยังไม่ได้ล็อกอิน)';

  const [role, postsRes, tagsRes, ideasRes, eventsRes, targetsRes, leadsRes] = await Promise.all([
    user ? getRole(me) : Promise.resolve<Role>('editor'),
    supabase.from('posts').select('*').order('date', { ascending: true }),
    supabase.from('tags').select('tag, active').order('tag'),
    supabase.from('ideas').select('*').order('created_at', { ascending: false }),
    supabase.from('events').select('date, name'),
    supabase.from('targets').select('key, label, target, period'),
    // ตาราง leads อาจยังไม่ถูกสร้าง (ต้องรัน schema_leads.sql ก่อน) — ไม่ให้ล้มทั้งหน้าถ้ายังไม่มี
    supabase
      .from('leads')
      .select('lead_id, created_date, phone_number, interested_model, source, lead_status'),
  ]);

  if (postsRes.error) throw postsRes.error;
  if (tagsRes.error) throw tagsRes.error;
  if (ideasRes.error) throw ideasRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (targetsRes.error) throw targetsRes.error;

  return {
    me,
    role,
    posts: (postsRes.data || []) as Post[],
    tags: (tagsRes.data || []) as Tag[],
    ideas: (ideasRes.data || []) as Idea[],
    events: eventsRes.data || [],
    targets: targetsRes.data || [],
    leads: (leadsRes.data || []) as Lead[],
  };
}

async function log(
  postId: string | null,
  action: string,
  fromStatus: string,
  toStatus: string,
  comment: string,
  who: string
) {
  const supabase = createClient();
  await supabase.from('log').insert({
    post_id: postId,
    action,
    from_status: fromStatus || null,
    to_status: toStatus || null,
    comment: comment || null,
    who: who || null,
  });
}

export type PostInput = {
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
  tags: string;
  content_type: string | null;
  is_viral: boolean;
  comment?: string;
};

export async function createPost(input: PostInput, who: string): Promise<void> {
  const supabase = createClient();
  const id = newId('P');
  const { comment, ...fields } = input;

  const { error } = await supabase.from('posts').insert({ id, ...fields });
  if (error) throw error;

  await log(id, 'CREATE', '', input.status, comment || '', who);
}

export async function savePost(id: string, input: PostInput, who: string): Promise<void> {
  const supabase = createClient();

  const { data: before, error: beforeErr } = await supabase
    .from('posts')
    .select('status')
    .eq('id', id)
    .single();
  if (beforeErr) throw beforeErr;

  const { comment, ...fields } = input;
  const { error } = await supabase.from('posts').update(fields).eq('id', id);
  if (error) throw error;

  if (before.status !== input.status) {
    await log(id, 'STATUS_CHANGE', before.status, input.status, comment || '', who);
  } else if (comment) {
    await log(id, 'COMMENT', '', '', comment, who);
  } else {
    await log(id, 'UPDATE', '', '', '', who);
  }
}

export async function approvePost(id: string, role: Role, who: string): Promise<void> {
  if (role !== 'editor') throw new Error('บัญชีนี้ไม่มีสิทธิ์อนุมัติคอนเทนต์');

  const supabase = createClient();
  const { data: before, error: beforeErr } = await supabase
    .from('posts')
    .select('status')
    .eq('id', id)
    .single();
  if (beforeErr) throw beforeErr;

  const { error } = await supabase
    .from('posts')
    .update({ status: 'APPROVED', approved_by: who, approved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  await log(id, 'APPROVE', before.status, 'APPROVED', '', who);
}

export async function deletePost(id: string, who: string): Promise<void> {
  const supabase = createClient();
  const { data: before, error: beforeErr } = await supabase
    .from('posts')
    .select('status')
    .eq('id', id)
    .single();
  if (beforeErr) throw beforeErr;

  await log(id, 'DELETE', before.status, '', '', who);

  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export async function addTag(tag: string): Promise<void> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from('tags')
    .select('tag')
    .ilike('tag', tag)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('tags').update({ active: true }).eq('tag', existing.tag);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('tags').insert({ tag, active: true });
    if (error) throw error;
  }
}

export async function removeTag(tag: string): Promise<void> {
  const supabase = createClient();

  const { error: tagErr } = await supabase.from('tags').update({ active: false }).eq('tag', tag);
  if (tagErr) throw tagErr;

  const { data: posts, error: postsErr } = await supabase
    .from('posts')
    .select('id, tags')
    .ilike('tags', `%${tag}%`);
  if (postsErr) throw postsErr;

  for (const p of posts || []) {
    const list = String(p.tags || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const next = list.filter((t) => t !== tag);
    if (next.length !== list.length) {
      const { error } = await supabase.from('posts').update({ tags: next.join(', ') }).eq('id', p.id);
      if (error) throw error;
    }
  }
}

export async function addIdea(input: {
  title: string;
  category: string;
  note: string;
  score: number;
}): Promise<void> {
  const supabase = createClient();
  const id = newId('I');
  const { error } = await supabase.from('ideas').insert({ id, ...input, promoted_post_id: null });
  if (error) throw error;
}

export async function promoteIdea(
  idea: Idea,
  input: { date: string; time: string; channel: string; format: string },
  who: string
): Promise<void> {
  const supabase = createClient();
  const postId = newId('P');

  const { error: postErr } = await supabase.from('posts').insert({
    id: postId,
    date: input.date,
    time: input.time || '09:00',
    channel: input.channel || 'Facebook',
    title: idea.title,
    format: input.format || 'ภาพ',
    status: 'DRAFT',
    owner: who,
    caption: '',
    tags: idea.category || '',
    src_link: '',
    final_link: '',
    approved_by: '',
    approved_at: null,
    post_url: '',
  });
  if (postErr) throw postErr;

  const { error: ideaErr } = await supabase
    .from('ideas')
    .update({ promoted_post_id: postId })
    .eq('id', idea.id);
  if (ideaErr) throw ideaErr;

  await log(postId, 'PROMOTE_IDEA', '', 'DRAFT', idea.title, who);
}
