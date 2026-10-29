#!/usr/bin/env node
/**
 * แปลง LOGGING_2_WULING.xlsx (SHEET_1_TEL, ACTIVITY_LOG, SHEET_1_MES) เป็นไฟล์ SQL สำหรับ schema `crm`
 * ไม่เชื่อมฐานข้อมูล ไม่แก้ไฟล์ต้นฉบับ — แค่สร้างไฟล์ .sql + รายงาน (ไม่มีชื่อ/เบอร์ลูกค้าในรายงาน)
 *
 *   node import-legacy.mjs <file.xlsx> [--out ./out] [--include-mes-only] [--dormant-days 30] [--now 2026-10-29T12:00:00+07:00]
 */
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!file) { console.error('usage: node import-legacy.mjs <file.xlsx> [--out dir] [--include-mes-only] [--dormant-days N]'); process.exit(1); }
const OUT = opt('out', './out');
const INCLUDE_MES_ONLY = args.includes('--include-mes-only');
const DORMANT_DAYS = Number(opt('dormant-days', '30'));
const NOW = new Date(opt('now', new Date().toISOString()));
const CHUNK_BYTES = 200_000;

const PROFILE_KEYS = ['Customer_Email','Customer_Line_ID','Customer_Address','Customer_Province','Customer_District','Customer_Postal_Code',
  'Occupation','Interested_Brand','Variant','Preferred_Color','Preferred_Variant','Purchase_Type','Budget','Vehicle_Price','Down_Payment',
  'Interest_Rate','Monthly_Payment','Loan_Term','Financing_Required','Financing_Status','Finance_Amount','Finance_Note','Financing_Bank',
  'Has_Trade_In','Trade_In_Brand','Trade_In_Model','Trade_In_Year','Trade_In_Expected_Price','Trade_In_Appraised_Price','Trade_In_Status',
  'Promotion_Name','Discount_Amount','Free_Items','Closing_Condition','Test_Drive_Date','Quotation_Date','Quotation_Amount','Competitor','Notes'];
const STAGES = ['NEW','CONTACTED','FOLLOW_UP','APPOINTMENT','TEST_DRIVE','QUOTATION','BOOKING','FINANCE_APPROVED','WON','LOST'];
const STAGE_ALIAS = { PROSPECT: 'CONTACTED' };   // AI เคยสร้างค่านี้เอง (ไม่อยู่ใน prompt) — แมปเป็น CONTACTED + ติดธง DQ
const TERMINAL = new Set(['WON', 'LOST']);

// ---------- helpers ----------
const clean = (v) => (v === null || v === undefined ? '' : String(v).replace(/\u0000/g, '').trim());
const p2 = (n) => String(n).padStart(2, '0');
function cellVal(c) { // exceljs: rich text / formula / hyperlink -> plain
  if (c && typeof c === 'object' && !(c instanceof Date)) {
    if ('result' in c) return cellVal(c.result);
    if ('richText' in c) return c.richText.map((r) => r.text).join('');
    if ('text' in c) return c.text;
    if ('error' in c) return null;
  }
  return c;
}
// เวลาในชีตคือเวลาไทย (wall time) — exceljs ให้ Date ที่ component แบบ UTC เท่ากับ wall time
function wall(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  let y = d.getUTCFullYear(); if (y > 2400) y -= 543;                 // ปี พ.ศ. ที่ Excel อ่านเป็น ค.ศ.
  return { y, mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
function stamp(dateCell, timeCell) {
  const a = wall(dateCell); if (!a) return null;
  const t = timeCell instanceof Date ? wall(timeCell) : null;
  const h = t ? t.h : a.h, mi = t ? t.mi : a.mi, s = t ? t.s : a.s;
  return `${a.y}-${p2(a.mo)}-${p2(a.d)}T${p2(h)}:${p2(mi)}:${p2(s)}+07:00`;
}
const ms = (iso) => (iso ? Date.parse(iso) : NaN);
function normPhone(raw) { // ต้องเหมือน crm.normalize_phone ใน SQL
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (/^66/.test(d) && (d.length === 11 || d.length === 10)) d = '0' + d.slice(2);
  if (d.length === 9 && /^[2-9]/.test(d)) d = '0' + d;
  return /^0([689][0-9]{8}|[2-7][0-9]{7})$/.test(d) ? d : null;
}
function fbId(v) { // ตัวเลขทศนิยม = Excel ปัดทอนเลข 17 หลักไปแล้ว ใช้ไม่ได้
  if (typeof v === 'number') return { id: null, lost: true };
  const s = clean(v); return { id: s || null, lost: false };
}

async function readSheet(wb, name) {
  const ws = wb.getWorksheet(name); if (!ws) throw new Error(`ไม่พบชีต ${name}`);
  const head = []; ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { head[i] = clean(cellVal(c.value)); });
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const o = {}; let any = false;
    head.forEach((h, i) => { if (!h) return; const v = cellVal(row.getCell(i).value); o[h] = v; if (v !== null && v !== undefined && v !== '') any = true; });
    if (any) rows.push(o);
  });
  return rows;
}

// ---------- load ----------
const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
const tel = await readSheet(wb, 'SHEET_1_TEL');
const act = await readSheet(wb, 'ACTIVITY_LOG');
const mes = await readSheet(wb, 'SHEET_1_MES');

const report = { counts: {}, dq: {}, notes: [] };
const dq = []; // {lead_code, code, severity, detail}
const addDq = (lead_code, code, severity, detail) => { dq.push({ lead_code, code, severity, detail }); report.dq[code] = (report.dq[code] || 0) + 1; };

// ---------- activity by lead ----------
const actBy = new Map();
for (const r of act) {
  const id = clean(r.Lead_ID); if (!id) continue;
  const at = stamp(r.Activity_Date, r.Activity_Time);
  (actBy.get(id) || actBy.set(id, []).get(id)).push({ r, at });
}
for (const v of actBy.values()) v.sort((a, b) => ms(a.at) - ms(b.at));

// ---------- MES by fb user ----------
const mesByFb = new Map(); let mesFloat = 0;
for (const r of mes) {
  const f = fbId(r.Facebook_User_ID); if (f.lost) { mesFloat++; continue; }
  if (!f.id) continue;
  (mesByFb.get(f.id) || mesByFb.set(f.id, []).get(f.id)).push(r);
}

// ---------- leads ----------
const leads = []; const events = []; const usedPhone = new Map(); const usedFb = new Map(); const fbToLead = new Map();
for (const t of tel) {
  const code = clean(t.Lead_ID); if (!code) continue;
  const created = stamp(t.Created_Date, t.Created_Time);
  const acts = actBy.get(code) || [];
  const f = fbId(t.Facebook_User_ID);
  let fb = f.id;
  if (f.lost) addDq(code, 'FB_ID_PRECISION_LOST', 'WARN', 'Facebook ID เป็นตัวเลขที่ Excel ปัดทอนแล้ว ใช้จับคู่ไม่ได้');
  if (fb && usedFb.has(fb)) { addDq(code, 'FB_ID_DUPLICATE', 'INFO', `Facebook ID เดียวกับลีด ${usedFb.get(fb)}`); fb = null; }
  if (fb) { usedFb.set(fb, code); fbToLead.set(fb, code); }

  const phoneRaw = clean(t.Phone_Number);
  let usePhone = true; const norm = normPhone(phoneRaw);
  if (phoneRaw && !norm) addDq(code, 'PHONE_INVALID', 'WARN', `เบอร์รูปแบบไม่ถูกต้อง (${phoneRaw.length} หลัก)`);
  if (norm) { if (usedPhone.has(norm)) { usePhone = false; addDq(code, 'PHONE_DUPLICATE', 'WARN', `เบอร์ซ้ำกับลีด ${usedPhone.get(norm)}`); } else usedPhone.set(norm, code); }

  const ownerM = clean(t.Assigned_Sales).match(/^(SA\d{4})/);
  const ownerCode = ownerM ? ownerM[1] : null;
  if (!ownerCode) addDq(code, 'UNKNOWN_OWNER', 'WARN', `ผู้รับผิดชอบเดิม "${clean(t.Assigned_Sales)}" ไม่ตรงกับทีมขายในระบบ`);

  let stageRaw = clean(t.Lead_Status).toUpperCase(); let stage = STAGE_ALIAS[stageRaw] || stageRaw;
  if (!STAGES.includes(stage)) { addDq(code, 'UNKNOWN_LEGACY_STATUS', 'WARN', `สถานะเดิม "${stageRaw}" ไม่รู้จัก → NEW`); stage = 'NEW'; }
  else if (STAGE_ALIAS[stageRaw]) addDq(code, 'UNKNOWN_LEGACY_STATUS', 'INFO', `สถานะเดิม "${stageRaw}" แมปเป็น ${stage}`);

  const temp = ['HOT', 'WARM', 'COLD'].includes(clean(t.Lead_Temperature).toUpperCase()) ? clean(t.Lead_Temperature).toUpperCase() : null;

  const replyActs = acts.filter((a) => (clean(a.r.Sales_Reply) || clean(a.r.Follow_Up_Note)) && clean(a.r.Lead_Status).toUpperCase() !== 'NEW');
  // เวลาติดต่อครั้งแรก: ข้อความเซลล์ครั้งแรก → ไม่มีก็ใช้แถวแรกที่สถานะเลย NEW → ไม่มีก็ใช้เวลารับลีด (ลีดสถานะ NEW = ยังไม่ติดต่อ)
  const progressActs = acts.filter((a) => clean(a.r.Lead_Status).toUpperCase() !== 'NEW');
  const evidenceActs = replyActs.length ? replyActs : progressActs;
  const accTs = (() => { if (!(t.Accepted_Time instanceof Date)) return null; const w = wall(t.Accepted_Time); return `${w.y}-${p2(w.mo)}-${p2(w.d)}T${p2(w.h)}:${p2(w.mi)}:${p2(w.s)}+07:00`; })();
  const firstContact = stage === 'NEW' ? null : (evidenceActs.length ? evidenceActs[0].at : accTs);
  const lastContact = stage === 'NEW' ? null : (evidenceActs.length ? evidenceActs[evidenceActs.length - 1].at : accTs);

  let accepted = null; if (t.Accepted_Time instanceof Date) { const w = wall(t.Accepted_Time); accepted = `${w.y}-${p2(w.mo)}-${p2(w.d)}T${p2(w.h)}:${p2(w.mi)}:${p2(w.s)}+07:00`; }
  if (accepted && ms(accepted) < ms(created)) { addDq(code, 'ACCEPTED_BEFORE_CREATED', 'ERROR', 'เวลารับลีดก่อนเวลาสร้างลีด'); }

  let nextFu = null;
  if (t.Next_Follow_Up instanceof Date) {
    const w = wall(t.Next_Follow_Up); const iso = `${w.y}-${p2(w.mo)}-${p2(w.d)}T${p2(w.h || 9)}:${p2(w.mi)}:00+07:00`;
    if (ms(iso) < ms(created) - 86400000) addDq(code, 'FOLLOWUP_BEFORE_CREATED', 'ERROR', `วันนัดติดตามเดิม ${iso.slice(0, 10)} อยู่ก่อนวันที่สร้างลีด — ไม่นำมาใช้`);
    else nextFu = iso;
  } else if (clean(t.Next_Follow_Up)) addDq(code, 'FOLLOWUP_UNPARSEABLE', 'WARN', 'วันนัดติดตามเดิมอ่านค่าไม่ได้ — ไม่นำมาใช้');

  let lostReason = null;
  if (stage === 'LOST') {
    const lr = [...acts].reverse().map((a) => clean(a.r.Lost_Reason)).find(Boolean);
    lostReason = lr || 'ไม่ระบุ (ข้อมูลเดิม)';
    if (!lr) addDq(code, 'LOST_REASON_MISSING', 'INFO', 'ลีด LOST ในข้อมูลเดิมไม่มีเหตุผล');
  }
  const rm = Number(clean(t.Response_Minutes)); if (clean(t.Response_Minutes) && rm < 0) addDq(code, 'NEGATIVE_RESPONSE_LEGACY', 'INFO', `Response_Minutes เดิม = ${rm} (บั๊ก timezone) — ไม่นำมาใช้`);

  const profile = {}; for (const k of PROFILE_KEYS) { const v = clean(t[k]); if (v) profile[k] = v; }
  if (t.Appointment_Date instanceof Date) { const w = wall(t.Appointment_Date); profile.Appointment_Date = `${w.y}-${p2(w.mo)}-${p2(w.d)}`; }
  const fmtLegacy = (v) => { const w = wall(v); if (!w) return null; const hms = `${p2(w.h)}:${p2(w.mi)}:${p2(w.s)}`;
    return v.getUTCFullYear() === 1899 ? hms : `${w.y}-${p2(w.mo)}-${p2(w.d)} ${hms}`; };   // เวลาล้วนใน Excel = 1899-12-30
  const legacy = {}; for (const [k, v] of Object.entries(t)) { if (v === null || v === undefined || v === '') continue; legacy[k] = v instanceof Date ? fmtLegacy(v) : clean(v); }

  const mesMsgs = fb ? (mesByFb.get(fb) || []) : [];
  const lastAt = Math.max(ms(created), ...acts.map((a) => ms(a.at)), ...mesMsgs.map((m) => ms(stamp(m.Created_Date, m.Created_Time))));
  const dormant = !TERMINAL.has(stage) && (NOW - lastAt) / 86400000 > DORMANT_DAYS;

  leads.push({ lead_code: code, fb_user_id: fb, phone_raw: phoneRaw || null, use_phone: usePhone, customer_name: clean(t.Customer_Name) || null,
    interested_model: clean(t.Interested_Model) || null, source: clean(t.Source) || 'Facebook Messenger', owner_code: ownerCode, created_at: created,
    assigned_at: ownerCode ? created : null, accepted_at: accepted, first_contact_at: firstContact, last_contact_at: lastContact, next_follow_up_at: nextFu,
    stage, temperature: temp, lost_reason: lostReason, profile, legacy, dormant });

  // events: ข้อความแรกของลูกค้า
  if (clean(t.Customer_Message)) events.push({ lead_code: code, type: 'CUSTOMER_MESSAGE', channel: 'FACEBOOK', body: clean(t.Customer_Message).slice(0, 2000), occurred_at: created, key: `legacy-tel:${code}`, evidence: { source: 'legacy_sheet_1_tel' } });
  // events: ประวัติจาก ACTIVITY_LOG
  let prev = 'NEW';
  for (const { r, at } of acts) {
    const aid = clean(r.Activity_ID); let st = clean(r.Lead_Status).toUpperCase(); st = STAGE_ALIAS[st] || st; if (!STAGES.includes(st)) st = prev;
    const body = clean(r.Sales_Reply) || clean(r.Follow_Up_Note);
    if (body) events.push({ lead_code: code, type: 'SALES_REPLY', channel: 'TELEGRAM', body: body.slice(0, 2000), occurred_at: at, key: `legacy:${aid}`,
      evidence: { source: 'legacy_activity_log', activity_id: aid, status: st, temperature: clean(r.Lead_Temperature) || null, accepted_by: clean(r.Accepted_By) || null } });
    if (st !== prev) { events.push({ lead_code: code, type: 'STAGE_CHANGE', channel: null, body: 'ตามประวัติเดิม (ACTIVITY_LOG)', occurred_at: at, key: `legacy-stage:${aid}`, evidence: { source: 'legacy_activity_log', from: prev, to: st } }); prev = st; }
  }
  // events: ข้อความลูกค้าจาก SHEET_1_MES ที่ผูกด้วย Facebook ID
  for (const m of mesMsgs) {
    const body = clean(m.Customer_Message); if (!body) continue;
    events.push({ lead_code: code, type: 'CUSTOMER_MESSAGE', channel: 'FACEBOOK', body: body.slice(0, 2000), occurred_at: stamp(m.Created_Date, m.Created_Time), key: `legacy-mes:${clean(m.Lead_ID)}`, evidence: { source: 'legacy_sheet_1_mes' } });
  }
}
report.counts.leads_from_tel = leads.length;

// ---------- MES-only (ลูกค้าที่ยังไม่มีเบอร์) ----------
const mesOnly = [...mesByFb.keys()].filter((k) => !fbToLead.has(k));
report.counts.mes_only_users = mesOnly.length;
report.counts.mes_rows_float_id_skipped = mesFloat;
if (INCLUDE_MES_ONLY) {
  for (const fb of mesOnly) {
    const ms_ = mesByFb.get(fb).sort((a, b) => ms(stamp(a.Created_Date, a.Created_Time)) - ms(stamp(b.Created_Date, b.Created_Time)));
    const code = clean(ms_[0].Lead_ID); const created = stamp(ms_[0].Created_Date, ms_[0].Created_Time);
    leads.push({ lead_code: code, fb_user_id: fb, phone_raw: null, use_phone: false, customer_name: clean(ms_[0].Customer_Name) || null, interested_model: clean(ms_[0].Interested_Model) || null,
      source: 'Facebook Messenger', owner_code: null, created_at: created, assigned_at: null, accepted_at: null, first_contact_at: null, last_contact_at: null, next_follow_up_at: null,
      stage: 'NEW', temperature: null, lost_reason: null, profile: {}, legacy: { source_sheet: 'SHEET_1_MES' }, dormant: true });
    for (const m of ms_) { const body = clean(m.Customer_Message); if (body) events.push({ lead_code: code, type: 'CUSTOMER_MESSAGE', channel: 'FACEBOOK', body: body.slice(0, 2000), occurred_at: stamp(m.Created_Date, m.Created_Time), key: `legacy-mes:${clean(m.Lead_ID)}`, evidence: { source: 'legacy_sheet_1_mes' } }); }
  }
}
report.counts.leads_total = leads.length; report.counts.events = events.length;
report.counts.dormant = leads.filter((l) => l.dormant).length;
report.counts.by_stage = Object.fromEntries(STAGES.map((s) => [s, leads.filter((l) => l.stage === s).length]));
report.counts.legacy_won_booking_unverified = leads.filter((l) => ['BOOKING', 'FINANCE_APPROVED', 'WON'].includes(l.stage)).length;
report.counts.events_by_type = events.reduce((a, e) => ((a[e.type] = (a[e.type] || 0) + 1), a), {});

// ---------- SQL ----------
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const head = `-- สร้างโดย import-legacy.mjs — รันซ้ำได้ (on conflict do nothing)\nselect set_config('crm.migration_mode', 'on', false);\n`;
const tail = `\nselect set_config('crm.migration_mode', 'off', false);\n`;
function chunks(rows, mk) {
  const out = []; let cur = [], size = 0;
  for (const r of rows) { const j = JSON.stringify(r); if (size + j.length > CHUNK_BYTES && cur.length) { out.push(cur); cur = []; size = 0; } cur.push(r); size += j.length; }
  if (cur.length) out.push(cur); return out.map(mk);
}
fs.mkdirSync(OUT, { recursive: true }); for (const f of fs.readdirSync(OUT)) if (/^\d{2}_.*\.sql$/.test(f)) fs.unlinkSync(path.join(OUT, f));
const files = [];
const write = (name, body) => { fs.writeFileSync(path.join(OUT, name), body); files.push(name); };

chunks(leads, (rows) => `${head}
insert into crm.leads (lead_code, fb_user_id, phone_raw, phone_norm, customer_name, interested_model, source, owner_id, assigned_at, accepted_at,
  first_contact_at, last_contact_at, next_follow_up_at, stage, temperature, lost_reason, profile, legacy, dormant, created_at)
select t.lead_code, t.fb_user_id, t.phone_raw, case when t.use_phone then crm.normalize_phone(t.phone_raw) end, t.customer_name, t.interested_model, t.source,
  s.id, t.assigned_at, t.accepted_at, t.first_contact_at, t.last_contact_at, t.next_follow_up_at, t.stage, t.temperature, t.lost_reason, t.profile, t.legacy, t.dormant, t.created_at
from jsonb_to_recordset(${lit(JSON.stringify(rows))}::jsonb) as t(lead_code text, fb_user_id text, phone_raw text, use_phone boolean, customer_name text, interested_model text,
  source text, owner_code text, assigned_at timestamptz, accepted_at timestamptz, first_contact_at timestamptz, last_contact_at timestamptz, next_follow_up_at timestamptz,
  stage text, temperature text, lost_reason text, profile jsonb, legacy jsonb, dormant boolean, created_at timestamptz)
left join crm.sales_team s on s.code = t.owner_code
on conflict (lead_code) do nothing;
${tail}`).forEach((sql, i) => write(`10_leads_${String(i + 1).padStart(2, '0')}.sql`, sql));

chunks(events, (rows) => `${head}
insert into crm.lead_events (lead_id, type, channel, body, evidence, occurred_at, idempotency_key)
select l.id, t.type, t.channel, t.body, t.evidence, t.occurred_at, t.key
from jsonb_to_recordset(${lit(JSON.stringify(rows))}::jsonb) as t(lead_code text, type text, channel text, body text, occurred_at timestamptz, key text, evidence jsonb)
join crm.leads l on l.lead_code = t.lead_code
on conflict (idempotency_key) do nothing;
${tail}`).forEach((sql, i) => write(`20_events_${String(i + 1).padStart(2, '0')}.sql`, sql));

write('30_data_quality.sql', `${head}
insert into crm.data_quality_issues (entity, entity_id, code, severity, detail)
select 'lead', l.id::text, t.code, t.severity, t.detail
from jsonb_to_recordset(${lit(JSON.stringify(dq))}::jsonb) as t(lead_code text, code text, severity text, detail text)
join crm.leads l on l.lead_code = t.lead_code
on conflict (entity, entity_id, code) where status = 'OPEN' do nothing;
select crm.run_data_quality() as extra_dq_issues;
analyze crm.leads; analyze crm.lead_events; analyze crm.tasks; analyze crm.data_quality_issues; analyze crm.sales_team;
${tail}`);

write('99_verify.sql', `-- ตรวจผลหลังนำเข้า (ไม่แสดงข้อมูลส่วนบุคคล)
select 'leads' as item, count(*)::text as value from crm.leads
union all select 'leads stage ' || stage, count(*)::text from crm.leads group by stage
union all select 'events ' || type, count(*)::text from crm.lead_events group by type
union all select 'dormant', count(*)::text from crm.leads where dormant
union all select 'legacy_unverified (WON/BOOKING ไม่มีหลักฐาน)', count(*)::text from crm.leads where legacy_unverified
union all select 'owner null', count(*)::text from crm.leads where owner_id is null
union all select 'open tasks', count(*)::text from crm.tasks where status = 'OPEN'
union all select 'dq ' || code, count(*)::text from crm.data_quality_issues where status = 'OPEN' group by code
union all select 'flag ' || f, count(*)::text from (select unnest(flags) f from crm.v_lead_control_center) x group by f
union all select 'risk ' || risk_level, count(*)::text from crm.v_lead_control_center group by risk_level
order by 1;
`);

fs.writeFileSync(path.join(OUT, 'REPORT.txt'), JSON.stringify({ options: { includeMesOnly: INCLUDE_MES_ONLY, dormantDays: DORMANT_DAYS, now: NOW.toISOString() }, ...report, files }, null, 2));
console.log(JSON.stringify({ ...report, files }, null, 2));
