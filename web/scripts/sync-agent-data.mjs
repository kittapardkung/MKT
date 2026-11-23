#!/usr/bin/env node
/**
 * อ่านไฟล์ JSON ที่ data/agent-sync/*.json (คอมมิตไว้ในโค้ด repo — ดู README ในโฟลเดอร์นั้น)
 * แล้ว upsert เข้า Supabase:
 *   - scout / ads / almanac / tiktok.json → ตาราง agent_reports
 *   - susan.json → agent_reports (signals, positioning, pps, roadmap, video_orders)
 *                  + ตาราง ideas (คลัง Hook: แต่ละ hook = 1 แถว, id = susan-<code>)
 *   (COMPASS + SPARK ถูกรวมเข้า SUSAN แล้ว — ไม่ sync compass.json / spark.json อีก)
 *
 * ต้องมี environment variables ต่อไปนี้ตอนรัน:
 *   NEXT_PUBLIC_SUPABASE_URL — Project URL ของ Supabase
 *   SUPABASE_SECRET_KEY      — secret key (สิทธิ์เต็ม bypass RLS)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'agent-sync');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`ขาด environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function syncReport(supabase, agent, idPrefix, doc) {
  const rows = [];
  let sortOrder = 1;
  for (const [section, block] of Object.entries(doc)) {
    if (section === 'agent' || section === 'generated_at') continue;
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
    rows.push({
      id: `${idPrefix}-${section}`,
      agent,
      section,
      title: block.title || section,
      body: block.body || '',
      data: block.columns
        ? block.groups
          ? { kind: 'table', columns: block.columns, groups: block.groups }
          : block.rows?.[0] && !Array.isArray(block.rows[0])
            ? { kind: 'drilldown', columns: block.columns, rows: block.rows }
            : { kind: 'table', columns: block.columns, rows: block.rows }
        : block.items
          ? {
              kind:
                typeof block.items[0] === 'string'
                  ? 'list'
                  : 'goal' in block.items[0]
                    ? 'todo'
                    : typeof block.items[0]?.value === 'number'
                      ? 'bar'
                      : 'kpi',
              items: block.items,
            }
          : block.rows
            ? { kind: 'scorecard', rows: block.rows }
            : null,
      sort_order: sortOrder++,
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return 0;
  const { error } = await supabase.from('agent_reports').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

// คลัง Hook ของ Susan → ตาราง ideas · ไม่ส่ง interest/promoted_post_id เพื่อไม่ทับสิ่งที่ทีมกดไว้ในแอป
async function syncSusanHooks(supabase, doc) {
  const hooks = doc.hooks || [];
  if (!hooks.length) return 0;
  const rows = hooks.map((h) => ({
    id: `susan-${h.code}`,
    title: h.title,
    category: `${h.type} · ${h.product}`,
    note: [
      `Body: ${h.body}`,
      `CTA: ${h.cta}`,
      `กลุ่มเป้าหมาย: ${h.audience}`,
      h.evidence ? `อิงผล Meta Ads: ${h.evidence}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    code: h.code,
    product: h.product || '',
    type: h.type || '',
    formula: h.formula || null,
    score: Number(h.score || 7),
    agent: 'SUSAN',
    suggested_date: h.suggested_date || null,
    suggested_channel: 'TikTok',
    suggested_format: 'วิดีโอ',
  }));
  const { error } = await supabase.from('ideas').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseSecretKey = requireEnv('SUPABASE_SECRET_KEY');
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const scout = readJsonIfExists(join(DATA_DIR, 'scout.json'));
  const susan = readJsonIfExists(join(DATA_DIR, 'susan.json'));
  const ads = readJsonIfExists(join(DATA_DIR, 'ads.json'));
  const almanac = readJsonIfExists(join(DATA_DIR, 'almanac.json'));
  const tiktok = readJsonIfExists(join(DATA_DIR, 'tiktok.json'));

  if (scout) console.log(`SCOUT: sync ${await syncReport(supabase, 'SCOUT', 'scout', scout)} rows`);
  if (susan) {
    console.log(`SUSAN: sync ${await syncReport(supabase, 'SUSAN', 'susan', susan)} rows`);
    console.log(`SUSAN: sync ${await syncSusanHooks(supabase, susan)} hooks`);
  }
  if (ads) console.log(`ADS: sync ${await syncReport(supabase, 'ADS', 'ads', ads)} rows`);
  if (almanac) console.log(`ALMANAC: sync ${await syncReport(supabase, 'ALMANAC', 'almanac', almanac)} rows`);
  if (tiktok) console.log(`TIKTOK: sync ${await syncReport(supabase, 'TIKTOK', 'tiktok', tiktok)} rows`);

  if (!scout && !susan && !ads && !almanac && !tiktok) {
    console.log('ไม่พบไฟล์ agent-sync ใดๆ ใน data/agent-sync/ — ไม่มีอะไรให้ sync');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
