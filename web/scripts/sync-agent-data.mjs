#!/usr/bin/env node
/**
 * อ่านไฟล์ JSON ที่ data/agent-sync/{scout,compass,spark}.json (คอมมิตไว้ในโค้ด repo
 * โดย Claude อ่านจาก Artifact ของ SCOUT/COMPASS/SPARK มาเอง เพราะ Routine เขียนเข้า
 * Supabase ตรงๆ ไม่ได้ — ดู README ในโฟลเดอร์นั้น) แล้ว upsert เข้า Supabase:
 *   - scout.json, compass.json → ตาราง agent_reports
 *   - spark.json               → ตาราง ideas (แต่ละ hook = 1 แถว, id = spark-<code>)
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
    if (!block || typeof block !== 'object') continue;
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

async function syncSparkHooks(supabase, doc) {
  const hooks = doc.hooks || [];
  if (!hooks.length) return 0;
  const rows = hooks.map((h) => ({
    id: `spark-${h.code}`,
    title: h.title,
    category: `${h.type} · ${h.product}`,
    note: `Body: ${h.body}\nCTA: ${h.cta}\nกลุ่มเป้าหมาย: ${h.audience}${h.formula ? `\nสูตร Hook: ${h.formula}` : ''}`,
    code: h.code,
    product: h.product || '',
    type: h.type || '',
    formula: h.formula || null,
    score: 7,
    promoted_post_id: null,
    agent: 'SPARK',
    suggested_date: null,
    suggested_channel: 'Facebook',
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
  const compass = readJsonIfExists(join(DATA_DIR, 'compass.json'));
  const spark = readJsonIfExists(join(DATA_DIR, 'spark.json'));

  if (scout) console.log(`SCOUT: sync ${await syncReport(supabase, 'SCOUT', 'scout', scout)} rows`);
  if (compass) console.log(`COMPASS: sync ${await syncReport(supabase, 'COMPASS', 'compass', compass)} rows`);
  if (spark) console.log(`SPARK: sync ${await syncSparkHooks(supabase, spark)} hooks`);

  if (!scout && !compass && !spark) {
    console.log('ไม่พบไฟล์ agent-sync ใดๆ ใน data/agent-sync/ — ไม่มีอะไรให้ sync');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
