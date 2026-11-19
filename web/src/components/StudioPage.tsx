'use client';

import type { AgentReport } from '@/lib/types';
import { displayDateTime } from '@/lib/date-utils';

/* ===================================================================
   ห้องทำงาน AI — ภาพเคลื่อนไหวของ TikTok Content Pipeline
   Susan (กระต่าย · ศูนย์สั่งงาน) → ตู้ Google Drive → edit (แมว · คอมปัน)
   → รายงานกลับ → Susan → สรุปเข้ามือถือปัน
   ข้อมูลสถานะอ่านจาก agent_reports (agent TIKTOK · section "studio")
   ถ้ายังไม่มี จะใช้ค่าตั้งต้น FALLBACK ด้านล่าง
   =================================================================== */

type StudioItem = {
  label: string;
  value: string;
  note?: string;
  actor?: string;
  state?: string;
};

const FALLBACK: StudioItem[] = [
  { actor: 'pan', label: 'ปัน', value: 'รออัดเสียง', note: 'อัด VO บรีฟ TT-20261118-01 (ถังน้ำมัน 200 ลิตร)', state: 'waiting' },
  { actor: 'susan', label: 'Susan', value: 'ออกใบงานแล้ว', note: 'บรีฟ TT-20261118-01 พร้อม · ใบงาน EDIT-20261118-02 อยู่ในคิว', state: 'done' },
  { actor: 'edit', label: 'edit', value: 'รอเช็กคิว', note: 'EDIT-20261118-02: จัด 00_assets · ทำแม่แบบปก · LUT', state: 'waiting' },
  { actor: 'alex', label: 'Alex', value: 'รายงานเช้านี้เสร็จ', note: 'พ.ย. ใช้ไป ฿19,044 (42% ของ ฿45,000) · PORTA ฿153/แชท · Darion ฿74/แชท', state: 'done' },
  { actor: 'beary', label: 'Beary', value: 'เสนองบ รออนุมัติ', note: 'ข้อเสนอปรับงบอยู่ในหน้า ADS · ปันกดอนุมัติ', state: 'waiting' },
  { actor: 'queue_todo', label: 'TODO', value: '1' },
  { actor: 'queue_doing', label: 'DOING', value: '0' },
  { actor: 'queue_done', label: 'DONE', value: '1' },
];

const STATE_LABEL: Record<string, { text: string; cls: string }> = {
  working: { text: 'กำลังทำ', cls: 'st-pill-working' },
  waiting: { text: 'รอ', cls: 'st-pill-waiting' },
  done: { text: 'เสร็จ', cls: 'st-pill-done' },
  blocked: { text: 'ติด', cls: 'st-pill-blocked' },
  idle: { text: 'ว่าง', cls: 'st-pill-idle' },
};

function short(s: string | undefined, n: number) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/* ---------- ฉาก (ภาพจาก Higgsfield · Nano Banana Pro · เตรียมโดย edit EDIT-20261118-03) ----------
   ฉากหลัง bg.webp 2520×1069 → viewBox 1260×535 (สเกล ½) · เส้นพื้น y≈415
   ตัวละครสูง 480 px → แสดงสูง H · เท้าอยู่ที่ (0,0) ของแต่ละกลุ่ม
   ท่า idle / walk สลับกันด้วย opacity ตาม keyframes · เดินกลับซ้ายใช้ภาพเดียวกันกลับด้าน */

const INK = '#2b2d3a';
const SRC = '/studio/';
const H = 150;

const SPRITE: Record<string, [number, number]> = {
  susan_idle: [193, 480], susan_walk: [255, 480],
  edit_idle: [281, 480], edit_walk: [358, 480], edit_work: [397, 480],
  alex_idle: [286, 480], alex_walk: [356, 480],
  beary_idle: [271, 480], pan_idle: [231, 480], pan_notify: [229, 480],
};

function Sprite({ name, h = H, flip = false, className }: { name: string; h?: number; flip?: boolean; className?: string }) {
  const [w0, h0] = SPRITE[name];
  const w = (w0 / h0) * h;
  return (
    <g className={className}>
      <g transform={flip ? 'scale(-1 1)' : undefined}>
        <image href={`${SRC}${name}.png`} x={-w / 2} y={-h} width={w} height={h} preserveAspectRatio="xMidYMax meet" />
      </g>
    </g>
  );
}

function Paper({ className, x = 0, y = 0 }: { className: string; x?: number; y?: number }) {
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <rect x="-12" y="-9" width="24" height="16" rx="2" fill="#fff" stroke={INK} strokeWidth="2" transform="rotate(-6)" />
      <path d="M-7 -4 H6 M-7 1 H3" stroke="#9aa0b4" strokeWidth="1.6" transform="rotate(-6)" />
    </g>
  );
}

function Bubble({ text, tone, dy = -H - 26, dx = 0 }: { text: string; tone: string; dy?: number; dx?: number }) {
  const w = Math.max(70, Math.min(190, text.length * 8.5 + 20));
  return (
    <g transform={`translate(${dx} ${dy})`}>
      <rect x={-w / 2} y="-18" width={w} height="28" rx="14" fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M-6 10 L0 18 L6 10" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <rect x={-w / 2 + 3} y="9" width={w - 6} height="3" fill="#fff" />
      <circle cx={-w / 2 + 14} cy="-4" r="4" className={`st-dot-${tone}`} />
      <text x={-w / 2 + 24} y="1" fontSize="12.5" fill={INK} fontWeight="600">
        {text}
      </text>
    </g>
  );
}

function Tag({ x, y, text, w }: { x: number; y: number; text: string; w?: number }) {
  const ww = w ?? text.length * 7.6 + 18;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-ww / 2} y="-11" width={ww} height="22" rx="11" fill="#fff" stroke={INK} strokeWidth="2" />
      <text x="0" y="4.5" fontSize="12" textAnchor="middle" fontWeight="800" fill={INK}>{text}</text>
    </g>
  );
}

function Scene({ pan, susan, edit, alex, beary, q }: { pan: StudioItem; susan: StudioItem; edit: StudioItem; alex: StudioItem; beary: StudioItem; q: [string, string, string] }) {
  const FEET = 508;
  return (
    <svg viewBox="0 0 1260 535" className="st-svg" role="img" aria-label="ห้องทำงาน AI: Susan ส่งใบงานผ่านตู้ Drive ให้ edit ตัดต่อ แล้วส่งรายงานกลับ · ทีม Ads Alex ส่งรายงานให้ Beary เสนองบ">
      <image href={`${SRC}bg.webp`} x="0" y="0" width="1260" height="535" preserveAspectRatio="none" />

      {/* ป้าย */}
      <g transform="translate(16 14)">
        <rect width="250" height="34" rx="10" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <text x="14" y="23" fontSize="14" fontWeight="800" fill={INK}>WULING CHONBURI · AI Studio</text>
      </g>
      <g transform="translate(1000 14)">
        <rect width="150" height="34" rx="10" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <text x="14" y="23" fontSize="14" fontWeight="800" fill={INK}>ทีม Ads · Meta</text>
      </g>

      {/* ตู้ Drive: ป้ายคิว + กระดาษในถาด */}
      <Tag x={409} y={118} text="Google Drive" />
      <Tag x={409} y={198} text={`TODO ${q[0]}`} w={86} />
      <Tag x={409} y={284} text={`DOING ${q[1]}`} w={86} />
      <Tag x={409} y={370} text={`DONE ${q[2]}`} w={86} />
      <Paper className="st-tray-todo" x={430} y={160} />
      <Paper className="st-tray-done" x={430} y={332} />

      {/* แถบความคืบหน้าบนจอตัดต่อ */}
      <rect x="606" y="262" width="104" height="6" rx="3" fill="#1d2133" />
      <rect x="606" y="262" width="104" height="6" rx="3" fill="#8bc542" className="st-progress" />
      <Tag x={652} y={150} text="คอมปัน · edit" />
      <Tag x={155} y={235} text="ศูนย์สั่งงาน · Susan" />

      {/* ปัน */}
      <g transform={`translate(48 ${FEET})`}>
        <Sprite name="pan_idle" h={140} className="st-pan-idle" />
        <Sprite name="pan_notify" h={140} className="st-pan-notify" />
        <Bubble text={short(pan.value, 18)} tone={pan.state || 'idle'} dy={-208} dx={40} />
        <Tag x={0} y={16} text="ปัน" />
      </g>

      {/* Susan: เดินไปตู้ Drive (+140) */}
      <g transform={`translate(190 ${FEET})`}>
        <g className="st-walk-susan">
          <g className="st-bob">
            <Sprite name="susan_idle" className="st-susan-idle" />
            <Sprite name="susan_walk" className="st-susan-right" />
            <Sprite name="susan_walk" flip className="st-susan-left" />
          </g>
          <Bubble text={short(susan.value, 18)} tone={susan.state || 'idle'} />
          <Tag x={0} y={16} text="Susan" />
        </g>
      </g>

      {/* edit: เดินไปตู้ Drive (−150) · นั่งตัดต่อ */}
      <g transform={`translate(660 ${FEET})`}>
        <g className="st-walk-edit">
          <g className="st-bob st-bob-edit">
            <Sprite name="edit_idle" className="st-edit-idle" />
            <Sprite name="edit_walk" flip className="st-edit-left" />
            <Sprite name="edit_walk" className="st-edit-right" />
            <Sprite name="edit_work" className="st-edit-work" />
          </g>
          <Bubble text={short(edit.value, 18)} tone={edit.state || 'idle'} />
          <Tag x={0} y={16} text="edit" />
        </g>
      </g>

      {/* Alex: เดินเอารายงานให้ Beary (+110) */}
      <g transform={`translate(985 ${FEET})`}>
        <g className="st-walk-alex">
          <g className="st-bob">
            <Sprite name="alex_idle" className="st-alex-idle" />
            <Sprite name="alex_walk" className="st-alex-right" />
            <Sprite name="alex_walk" flip className="st-alex-left" />
          </g>
          <Bubble text={short(alex.value, 18)} tone={alex.state || 'idle'} dx={20} />
          <Tag x={0} y={16} text="Alex" />
        </g>
      </g>

      {/* Beary */}
      <g transform={`translate(1180 ${FEET})`}>
        <g className="st-bob st-bob-edit">
          <Sprite name="beary_idle" />
        </g>
        <Bubble text={short(beary.value, 18)} tone={beary.state || 'idle'} dy={-H - 62} dx={-40} />
        <Tag x={0} y={16} text="Beary" />
      </g>
    </svg>
  );
}

/* opacity สลับท่า: v = ช่วง [เริ่ม,จบ] ที่แสดง (เป็น %) */
function showKF(name: string, ranges: [number, number][]) {
  const pts: string[] = [];
  const e = 0.01;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  pts.push(`0%{opacity:${sorted[0][0] === 0 ? 1 : 0}}`);
  for (const [a, b] of sorted) {
    if (a > 0) pts.push(`${(a - e).toFixed(2)}%{opacity:0}`, `${a}%{opacity:1}`);
    if (b < 100) pts.push(`${b}%{opacity:1}`, `${(b + e).toFixed(2)}%{opacity:0}`);
  }
  pts.push(`100%{opacity:${sorted[sorted.length - 1][1] === 100 ? 1 : 0}}`);
  return `@keyframes ${name}{${pts.join('')}}`;
}

const SUSAN_R: [number, number][] = [[10, 20], [80, 88.3]];
const SUSAN_L: [number, number][] = [[23.3, 33.3], [90, 98]];
const SUSAN_I: [number, number][] = [[0, 10], [20, 23.3], [33.3, 80], [88.3, 90], [98, 100]];
const EDIT_L: [number, number][] = [[33.3, 43.3], [70, 76.7]];
const EDIT_R: [number, number][] = [[46.7, 56.7], [80, 86.7]];
const EDIT_W: [number, number][] = [[56.7, 70]];
const EDIT_I: [number, number][] = [[0, 33.3], [43.3, 46.7], [76.7, 80], [86.7, 100]];
const ALEX_R: [number, number][] = [[20, 35]];
const ALEX_L: [number, number][] = [[40, 55]];
const ALEX_I: [number, number][] = [[0, 20], [35, 40], [55, 100]];
const PAN_N: [number, number][] = [[96.9, 100]];
const PAN_I: [number, number][] = [[0, 96.9]];

const SPRITE_KF = [
  showKF('st-susan-idle', SUSAN_I), showKF('st-susan-right', SUSAN_R), showKF('st-susan-left', SUSAN_L),
  showKF('st-edit-idle', EDIT_I), showKF('st-edit-left', EDIT_L), showKF('st-edit-right', EDIT_R), showKF('st-edit-work', EDIT_W),
  showKF('st-alex-idle', ALEX_I), showKF('st-alex-right', ALEX_R), showKF('st-alex-left', ALEX_L),
  showKF('st-pan-idle', PAN_I), showKF('st-pan-notify', PAN_N),
].join('\n');

const SPRITE_CLS = ['susan-idle', 'susan-right', 'susan-left', 'edit-idle', 'edit-left', 'edit-right', 'edit-work', 'alex-idle', 'alex-right', 'alex-left', 'pan-idle', 'pan-notify'];

const CSS = `
.st-wrap{display:grid;gap:16px}
.st-stage{border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden}
.st-svg{display:block;width:100%;height:auto}
.st-progress{transform-box:fill-box}
.st-dot-working{fill:#38bdf8}.st-dot-waiting{fill:#f59e0b}.st-dot-done{fill:#22c55e}.st-dot-blocked{fill:#ef4444}.st-dot-idle{fill:#9ca3af}
/* ค่าตั้งต้นเมื่อไม่มีแอนิเมชัน: แสดงท่ายืน */
.st-susan-right,.st-susan-left,.st-edit-left,.st-edit-right,.st-edit-work,.st-alex-right,.st-alex-left,.st-pan-notify{opacity:0}
@media (prefers-reduced-motion: no-preference){
  .st-bob{animation:st-bob .5s ease-in-out infinite alternate}
  .st-bob-edit{animation-delay:.25s}
  .st-walk-susan{animation:st-susan 30s linear infinite}
  .st-walk-edit{animation:st-edit 30s linear infinite}
  .st-walk-alex{animation:st-alex 30s linear infinite}
  .st-tray-todo{animation:st-tray-todo 30s linear infinite}
  .st-tray-done{animation:st-tray-done 30s linear infinite}
  .st-progress{transform-origin:0 50%;animation:st-progress 30s linear infinite}
  ${SPRITE_CLS.map((c) => `.st-${c}{animation:st-${c} 30s linear infinite}`).join('\n  ')}
}
@media (prefers-reduced-motion: reduce){
  .st-tray-done{opacity:0}
}
@keyframes st-bob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
/* Susan: พิมพ์ 0–10% · เดินไปตู้ 10–20% · วางงาน 20–23% · กลับ 23–33% · รอ · ไปรับรายงาน 80–88% · กลับ 90–98% */
@keyframes st-susan{0%,10%{transform:translateX(0)}20%,23.3%{transform:translateX(140px)}33.3%,80%{transform:translateX(0)}88.3%,90%{transform:translateX(140px)}98%,100%{transform:translateX(0)}}
/* edit: รอ 0–33% · เดินไปตู้ 33–43% · หยิบ 43–47% · กลับ 47–57% · ตัดต่อ 57–70% · ไปส่ง 70–77% · วาง 77–80% · กลับ 80–87% */
@keyframes st-edit{0%,33.3%{transform:translateX(0)}43.3%,46.7%{transform:translateX(-150px)}56.7%,70%{transform:translateX(0)}76.7%,80%{transform:translateX(-150px)}86.7%,100%{transform:translateX(0)}}
/* Alex: ดูกราฟ 0–20% · เดินเอารายงานให้ Beary 20–35% · ส่ง 35–40% · กลับ 40–55% */
@keyframes st-alex{0%,20%{transform:translateX(0)}35%,40%{transform:translateX(110px)}55%,100%{transform:translateX(0)}}
@keyframes st-tray-todo{0%,21.6%{opacity:0}21.7%,44.9%{opacity:1}45%,100%{opacity:0}}
@keyframes st-tray-done{0%,78.2%{opacity:0}78.3%,89.9%{opacity:1}90%,100%{opacity:0}}
@keyframes st-progress{0%,56.7%{transform:scaleX(0)}70%,100%{transform:scaleX(1)}}
${SPRITE_KF}
.st-legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:12.5px;color:var(--muted);padding:10px 16px;border-top:1px solid var(--line);background:var(--bg)}
.st-legend b{color:var(--navy)}
.st-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.st-card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--surface)}
.st-card-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.st-card-head img{width:40px;height:52px;object-fit:contain;flex:none}
.st-card-head .st-card-id{flex:1;min-width:0}
.st-card-name{font-weight:800;color:var(--navy)}
.st-card-role{font-size:11.5px;color:var(--muted)}
.st-card-value{font-size:16px;font-weight:700;color:var(--navy)}
.st-card-note{font-size:13px;color:var(--muted);margin-top:4px}
.st-pill{font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;white-space:nowrap}
.st-pill-working{background:var(--info-soft);color:#0369a1}
.st-pill-waiting{background:var(--warning-soft);color:#b45309}
.st-pill-done{background:var(--success-soft);color:var(--success-dark)}
.st-pill-blocked{background:var(--danger-soft);color:#b91c1c}
.st-pill-idle{background:var(--gray-soft);color:#4b5563}
.st-meta{font-size:12px;color:var(--muted-soft)}
`;

const ROLES: Record<string, string> = {
  pan: 'เจ้าของงาน · อัดเสียง · อนุมัติ',
  susan: 'บรีฟ · ออกใบงาน · สรุปผล (บัญชี B)',
  edit: 'ดัชนี · ตัดต่อ · ปก · โพสต์ (คอมปัน)',
  alex: 'วิเคราะห์ Meta Ads ทุกเช้า',
  beary: 'วางงบ · เสนอปรับโฆษณา (รอปันอนุมัติ)',
};

export default function StudioPage({ reports }: { reports: AgentReport[] }) {
  const report = reports.find((r) => r.agent === 'TIKTOK' && r.section === 'studio');
  const raw = report?.data && 'items' in report.data ? (report.data.items as unknown as StudioItem[]) : null;
  const items: StudioItem[] = raw && raw.length ? raw : FALLBACK;
  const get = (actor: string): StudioItem =>
    items.find((i) => i.actor === actor) || FALLBACK.find((i) => i.actor === actor) || { label: actor, value: '—' };

  const pan = get('pan');
  const susan = get('susan');
  const edit = get('edit');
  const alex = get('alex');
  const beary = get('beary');
  const q: [string, string, string] = [get('queue_todo').value, get('queue_doing').value, get('queue_done').value];

  return (
    <div className="st-wrap">
      <style>{CSS}</style>
      <div className="st-stage">
        <Scene pan={pan} susan={susan} edit={edit} alex={alex} beary={beary} q={q} />
        <div className="st-legend">
          <span><b>1</b> Susan เขียนบรีฟ + ใบงาน → วางในตู้ TODO</span>
          <span><b>2</b> edit เช็กคิวทุก :00 → หยิบงานไปทำบนคอม</span>
          <span><b>3</b> edit ส่งรายงานเข้า DONE</span>
          <span><b>4</b> Susan เช็กทุก :30 → สรุปเข้ามือถือปัน</span>
          <span><b>:00</b> edit · <b>:30</b> Susan</span>
          <span><b>Ads</b> Alex วิเคราะห์ Meta ทุกเช้า → Beary เสนองบ → ปันอนุมัติ · คลิป TikTok ที่ดูจบสูง → Beary ทำโฆษณา</span>
        </div>
      </div>

      <div className="st-cards">
        {[
          ['pan', pan],
          ['susan', susan],
          ['edit', edit],
          ['alex', alex],
          ['beary', beary],
        ].map(([key, it]) => {
          const item = it as StudioItem;
          const st = STATE_LABEL[item.state || 'idle'] || STATE_LABEL.idle;
          return (
            <div className="st-card" key={key as string}>
              <div className="st-card-head">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${SRC}${key}_idle.png`} alt="" />
                <div className="st-card-id">
                  <div className="st-card-name">{item.label}</div>
                  <div className="st-card-role">{ROLES[key as string]}</div>
                </div>
                <span className={`st-pill ${st.cls}`}>{st.text}</span>
              </div>
              <div className="st-card-value">{item.value}</div>
              {item.note && <div className="st-card-note">{item.note}</div>}
            </div>
          );
        })}
      </div>

      <div className="st-meta">
        {report
          ? `อัปเดตล่าสุด ${displayDateTime(report.updated_at)}${report.body ? ' · ' + report.body : ''}`
          : 'ยังไม่มีข้อมูล studio ใน Supabase — แสดงสถานะตั้งต้น (18 พ.ย. 2569)'}
      </div>
    </div>
  );
}
