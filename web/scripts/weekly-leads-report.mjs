#!/usr/bin/env node
/**
 * สรุปผลลีดรายสัปดาห์ (สัปดาห์นี้ vs สัปดาห์ก่อน) จากตาราง leads ใน Supabase
 * พิมพ์ผลเป็น JSON บรรทัดเดียวลง stdout (คั่นด้วย marker) เพื่อให้อ่านจาก log ของ GitHub Actions ได้ง่าย
 *
 * ต้องมี environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */
import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`ขาด environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeekMonday(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = x.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseSecretKey = requireEnv('SUPABASE_SECRET_KEY');
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ใช้เวลาไทย (UTC+7) ในการตัดสัปดาห์
  const nowUtc = new Date();
  const nowTh = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const thisWeekStart = startOfWeekMonday(nowTh);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);

  const { data, error } = await supabase
    .from('leads')
    .select('lead_id, created_date, interested_model, source, assigned_sales, lead_status, lead_temperature')
    .gte('created_date', ymd(lastWeekStart))
    .lte('created_date', ymd(thisWeekEnd));

  if (error) {
    console.error('ดึงข้อมูลล้มเหลว:', error.message);
    process.exit(1);
  }

  const leads = data || [];
  const inRange = (row, start, end) => {
    if (!row.created_date) return false;
    const d = row.created_date; // YYYY-MM-DD string, lexicographically comparable
    return d >= ymd(start) && d <= ymd(end);
  };

  const thisWeek = leads.filter((l) => inRange(l, thisWeekStart, thisWeekEnd));
  const lastWeek = leads.filter((l) => inRange(l, lastWeekStart, lastWeekEnd));

  function byDay(rows, start) {
    const map = {};
    for (let i = 0; i < 7; i++) map[ymd(addDays(start, i))] = 0;
    rows.forEach((r) => {
      if (map[r.created_date] !== undefined) map[r.created_date] += 1;
    });
    return map;
  }

  function countBy(rows, field) {
    const map = {};
    rows.forEach((r) => {
      const k = r[field] || 'ไม่ระบุ';
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }

  const result = {
    generated_at: nowUtc.toISOString(),
    range: {
      this_week: { start: ymd(thisWeekStart), end: ymd(thisWeekEnd) },
      last_week: { start: ymd(lastWeekStart), end: ymd(lastWeekEnd) },
    },
    this_week_total: thisWeek.length,
    last_week_total: lastWeek.length,
    this_week_by_day: byDay(thisWeek, thisWeekStart),
    last_week_by_day: byDay(lastWeek, lastWeekStart),
    this_week_by_status: countBy(thisWeek, 'lead_status'),
    this_week_by_temperature: countBy(thisWeek, 'lead_temperature'),
    this_week_by_sales: countBy(thisWeek, 'assigned_sales'),
    this_week_by_model: countBy(thisWeek, 'interested_model'),
  };

  console.log('WEEKLY_LEADS_REPORT_JSON_START');
  console.log(JSON.stringify(result));
  console.log('WEEKLY_LEADS_REPORT_JSON_END');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
