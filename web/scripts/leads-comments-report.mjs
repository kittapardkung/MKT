#!/usr/bin/env node
/**
 * ดึงคอมเมนต์ของเซลล์ (Sales_Reply, Follow_Up_Note) จาก Google Sheet "LOGGING_2_WULING"
 * แท็บ SHEET_1_TEL พร้อม Lead_Status/Lead_Temperature ของแต่ละลีด เพื่อใช้วิเคราะห์เชิงคุณภาพ
 * พิมพ์ผลเป็น JSON บรรทัดเดียวลง stdout (คั่นด้วย marker) เพื่อให้อ่านจาก log ของ GitHub Actions ได้ง่าย
 *
 * ต้องมี environment variables ต่อไปนี้ตอนรัน:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — service account key แบบ JSON ทั้งไฟล์ (string เดียว)
 *   LEADS_SPREADSHEET_ID         — ID ของ Google Sheet (จาก URL)
 */
import { google } from 'googleapis';

const SHEET_NAME = 'SHEET_1_TEL';
const COLUMNS = [
  'Lead_ID',
  'Created_Date',
  'Lead_Status',
  'Lead_Temperature',
  'Sales_Reply',
  'Follow_Up_Note',
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`ขาด environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const serviceAccountJson = requireEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  const spreadsheetId = requireEnv('LEADS_SPREADSHEET_ID');

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

  const items = rows
    .slice(1)
    .filter((r) => r.some((c) => String(c || '').trim() !== ''))
    .map((r) => ({
      lead_id: String(r[colIndex.Lead_ID] || '').trim(),
      created_date: String(r[colIndex.Created_Date] || '').trim(),
      lead_status: String(r[colIndex.Lead_Status] || '').trim() || null,
      lead_temperature: String(r[colIndex.Lead_Temperature] || '').trim() || null,
      sales_reply: String(r[colIndex.Sales_Reply] || '').trim() || null,
      follow_up_note: String(r[colIndex.Follow_Up_Note] || '').trim() || null,
    }))
    .filter((l) => l.lead_id && (l.sales_reply || l.follow_up_note));

  console.log(`พบคอมเมนต์เซลล์ ${items.length} รายการ จากทั้งหมด ${rows.length - 1} ลีด`);
  console.log('LEADS_COMMENTS_JSON_START');
  console.log(JSON.stringify(items));
  console.log('LEADS_COMMENTS_JSON_END');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
