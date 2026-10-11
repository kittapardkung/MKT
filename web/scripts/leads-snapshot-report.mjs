#!/usr/bin/env node
/**
 * สรุปภาพรวมลีดทั้งหมดจากตาราง leads ใน Supabase — จำนวน/สัดส่วนตาม lead_status และ
 * lead_temperature ทั้งหมด พร้อมจำนวน/สัดส่วนลีดใหม่ตั้งแต่ต้นเดือนถึงวันนี้ (เวลาไทย)
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

function countBy(rows, field) {
  const map = {};
  rows.forEach((r) => {
    const k = r[field] || 'ไม่ระบุ';
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseSecretKey = requireEnv('SUPABASE_SECRET_KEY');
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowUtc = new Date();
  const nowTh = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(nowTh.getUTCFullYear(), nowTh.getUTCMonth(), 1));

  const { data, error } = await supabase
    .from('leads')
    .select('lead_id, created_date, lead_status, lead_temperature');

  if (error) {
    console.error('ดึงข้อมูลล้มเหลว:', error.message);
    process.exit(1);
  }

  const leads = data || [];
  const total = leads.length;

  const newThisMonth = leads.filter((l) => l.created_date && l.created_date >= ymd(monthStart));

  const result = {
    generated_at: nowUtc.toISOString(),
    month_start: ymd(monthStart),
    today: ymd(nowTh),
    total_leads: total,
    by_status: countBy(leads, 'lead_status'),
    by_temperature: countBy(leads, 'lead_temperature'),
    new_this_month_count: newThisMonth.length,
    new_this_month_pct: total ? Math.round((newThisMonth.length / total) * 1000) / 10 : 0,
  };

  console.log('LEADS_SNAPSHOT_JSON_START');
  console.log(JSON.stringify(result));
  console.log('LEADS_SNAPSHOT_JSON_END');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
