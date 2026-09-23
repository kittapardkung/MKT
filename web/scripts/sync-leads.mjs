#!/usr/bin/env node
/**
 * ดึงข้อมูลลีดจาก Google Sheet "LOGGING_2_WULING" แท็บ SHEET_1_TEL แล้ว upsert เข้าตาราง
 * leads ใน Supabase — รันผ่าน GitHub Actions ตามตารางเวลา (ดู .github/workflows/sync-leads.yml)
 *
 * ต้องมี environment variables ต่อไปนี้ตอนรัน:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — service account key แบบ JSON ทั้งไฟล์ (string เดียว)
 *   LEADS_SPREADSHEET_ID         — ID ของ Google Sheet (จาก URL)
 *   NEXT_PUBLIC_SUPABASE_URL     — Project URL ของ Supabase
 *   SUPABASE_SECRET_KEY          — secret key (สิทธิ์เต็ม bypass RLS)
 */

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_NAME = 'SHEET_1_TEL';
const COLUMNS = [
  'Lead_ID',
  'Created_Date',
  'Created_Time',
  'Customer_Name',
  'Phone_Number',
  'Interested_Model',
  'Source',
  'Assigned_Sales',
  'Lead_Status',
  'Lead_Temperature',
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`ขาด environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

function toIsoDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function main() {
  const serviceAccountJson = requireEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  const spreadsheetId = requireEnv('LEADS_SPREADSHEET_ID');
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseSecretKey = requireEnv('SUPABASE_SECRET_KEY');

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:BB`,
  });

  const rows = res.data.values || [];
  if (rows.length < 2) {
    console.log('ไม่พบข้อมูลในชีต');
    return;
  }

  const headers = rows[0].map((h) => String(h || '').trim());
  const colIndex = Object.fromEntries(COLUMNS.map((c) => [c, headers.indexOf(c)]));

  const missing = COLUMNS.filter((c) => colIndex[c] === -1);
  if (missing.length) {
    console.error('ไม่พบคอลัมน์ในชีต:', missing.join(', '));
    process.exit(1);
  }

  const leads = rows
    .slice(1)
    .filter((r) => r.some((c) => String(c || '').trim() !== ''))
    .map((r) => ({
      lead_id: String(r[colIndex.Lead_ID] || '').trim(),
      created_date: toIsoDate(r[colIndex.Created_Date]),
      created_time: String(r[colIndex.Created_Time] || '').trim() || null,
      customer_name: String(r[colIndex.Customer_Name] || '').trim() || null,
      phone_number: String(r[colIndex.Phone_Number] || '').trim(),
      interested_model: String(r[colIndex.Interested_Model] || '').trim() || null,
      source: String(r[colIndex.Source] || '').trim() || null,
      assigned_sales: String(r[colIndex.Assigned_Sales] || '').trim() || null,
      lead_status: String(r[colIndex.Lead_Status] || '').trim() || null,
      lead_temperature: String(r[colIndex.Lead_Temperature] || '').trim() || null,
      synced_at: new Date().toISOString(),
    }))
    .filter((l) => l.lead_id);

  console.log(`อ่านได้ ${leads.length} แถวจากชีต`);

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const BATCH = 500;
  for (let i = 0; i < leads.length; i += BATCH) {
    const chunk = leads.slice(i, i + BATCH);
    const { error } = await supabase.from('leads').upsert(chunk, { onConflict: 'lead_id' });
    if (error) {
      console.error('upsert ล้มเหลว:', error.message);
      process.exit(1);
    }
  }

  console.log(`ซิงก์สำเร็จ: ${leads.length} leads`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
