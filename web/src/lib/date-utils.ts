import type { Post } from '@/lib/types';

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

export function ymd(d: Date | null | undefined): string {
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getTime());

  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateTH(d: Date | null): string {
  if (!d) return '-';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + 543}`;
}

export function displayDate(v: string): string {
  const d = parseDate(v);
  return d ? formatDateTH(d) : v || '';
}

export function displayDateTime(v: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${formatDateTH(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function postDateTime(p: Post): Date | null {
  const d = parseDate(p.date);
  if (!d) return null;
  const m = String(p.time || '00:00').match(/(\d{1,2}):(\d{2})/);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

export function sortPostDate(a: Post, b: Post): number {
  const da = postDateTime(a);
  const db = postDateTime(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}

export function csvTags(v: string | null | undefined): string[] {
  return String(v || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export const MONTHS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export type RangeValue = 'today' | 'week' | 'month' | 'lastMonth' | 'next15' | 'next30' | 'custom';

export function getRange(
  preset: RangeValue,
  customFrom: string,
  customTo: string
): { start: Date | null; end: Date | null; label: string } {
  const now = stripTime(new Date());
  let start: Date;
  let end: Date;

  if (preset === 'today') {
    start = new Date(now);
    end = new Date(now);
  } else if (preset === 'week') {
    const dow = now.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    start = addDays(now, diff);
    end = addDays(start, 6);
  } else if (preset === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (preset === 'next15') {
    start = new Date(now);
    end = addDays(now, 14);
  } else if (preset === 'next30') {
    start = new Date(now);
    end = addDays(now, 29);
  } else if (preset === 'custom') {
    const s = parseDate(customFrom);
    const e = parseDate(customTo);
    if (!s || !e) return { start: null, end: null, label: 'กำหนดช่วงวันที่' };
    start = s;
    end = e;
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  end.setHours(23, 59, 59, 999);
  return { start, end, label: `${formatDateTH(start)} – ${formatDateTH(end)}` };
}
