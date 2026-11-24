'use client';

import type { AgentReport } from '@/lib/types';
import type { ReactNode } from 'react';
import { displayDateTime, formatDateTH } from '@/lib/date-utils';

/* ===================================================================
   ห้องทำงาน AI — ทีม AI 4 แผนก + ห้องปันตรงกลาง
   ข่าวกรองคู่แข่ง (SCOUT) · กลยุทธ์ & คอนเทนต์ (Susan + edit) · [ปัน]
   · โฆษณา Meta (Alex + Beary) · วางแผน & โพสต์ (ALMANAC — ยังไม่เริ่มงาน)
   ข้อมูลสถานะอ่านจาก agent_reports (agent TIKTOK · section "studio")
   ถ้ายังไม่มี จะใช้ค่าตั้งต้น FALLBACK ด้านล่าง · SCOUT ใช้วันที่ของรายงาน SCOUT ล่าสุด
   =================================================================== */

type StudioItem = {
  label: string;
  value: string;
  note?: string;
  actor?: string;
  state?: string;
  at?: string;
};

const FALLBACK: StudioItem[] = [
  { actor: 'pan', label: 'ปัน', value: 'รออัดเสียง', note: 'อัด VO บรีฟ TT-20261118-01 (ถังน้ำมัน 200 ลิตร)', state: 'waiting' },
  { actor: 'susan', label: 'Susan', value: 'ออกใบงานแล้ว', note: 'บรีฟ TT-20261118-01 พร้อม · ใบงาน EDIT-20261118-02 อยู่ในคิว', state: 'done' },
  { actor: 'edit', label: 'edit', value: 'รอเช็กคิว', note: 'EDIT-20261118-02: จัด 00_assets · ทำแม่แบบปก · LUT', state: 'waiting' },
  { actor: 'alex', label: 'Alex', value: 'รายงานเช้านี้เสร็จ', note: 'ผลวิเคราะห์ Meta Ads อยู่ในหน้า ADS', state: 'done' },
  { actor: 'beary', label: 'Beary', value: 'เสนองบ รออนุมัติ', note: 'ข้อเสนอปรับงบอยู่ในหน้า ADS · ปันกดอนุมัติ', state: 'waiting' },
  { actor: 'almanac', label: 'ALMANAC', value: 'รอเริ่มงาน', note: 'เริ่มเมื่องาน Susan + edit ผ่าน · จะคิดแคปชั่น โพสต์ และยิงโฆษณา', state: 'idle' },
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

/* ---------- ตัวละคร (ภาพจาก Higgsfield · Nano Banana Pro · เตรียมโดย edit EDIT-20261118-03) ----------
   ตัวละครสูง 480 px → แสดงสูง H · เท้าอยู่ที่ (0,0) ของแต่ละกลุ่ม
   ท่า idle / walk สลับกันด้วย opacity ตาม keyframes · เดินกลับซ้ายใช้ภาพเดียวกันกลับด้าน
   SCOUT (เมียร์แคท) / ALMANAC (นกฮูก) เพิ่ม 23 พ.ย. 2569 จาก Drive โฟลเดอร์ 07_STUDIO ASSETS */

const INK = '#2b2d3a';
const SRC = '/studio/';
const H = 150;

const SPRITE: Record<string, [number, number]> = {
  susan_idle: [193, 480], susan_walk: [255, 480],
  edit_idle: [281, 480], edit_walk: [358, 480], edit_work: [397, 480],
  alex_idle: [286, 480], alex_walk: [356, 480],
  beary_idle: [271, 480], pan_idle: [231, 480], pan_notify: [229, 480],
  scout_idle: [309, 480], scout_walk: [327, 480],
  almanac_idle: [343, 480], almanac_walk: [343, 480],
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

/* ---------- ฉากแบ่งแผนก (วาดด้วย SVG) · viewBox 1600×560 · ผนัง 40–430 · พื้น 430 ---------- */

const W = 1600;
const VH = 560;
const FLOOR = 430;
const FEET = 522;

type Room = { x: number; w: number; wall: string; title: string; sub: string };
const ROOMS: Room[] = [
  { x: 0, w: 270, wall: '#dbeafe', title: 'ข่าวกรองคู่แข่ง', sub: 'SCOUT' },
  { x: 270, w: 530, wall: '#ede9fe', title: 'กลยุทธ์ & คอนเทนต์', sub: 'Susan · edit' },
  { x: 800, w: 200, wall: '#fef3c7', title: 'ห้องปัน', sub: 'รับรายงาน · อนุมัติ' },
  { x: 1000, w: 360, wall: '#fce7f3', title: 'โฆษณา Meta', sub: 'Alex · Beary' },
  { x: 1360, w: 240, wall: '#dcfce7', title: 'วางแผน & โพสต์', sub: 'ALMANAC · เร็วๆ นี้' },
];

function Desk({ x, w }: { x: number; w: number }) {
  return (
    <g>
      <rect x={x + 10} y={366} width={w - 20} height={FLOOR - 366} fill="#c98a55" stroke={INK} strokeWidth="2.5" />
      <rect x={x} y={352} width={w} height={16} rx="3" fill="#e5a873" stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

function Monitor({ cx, w = 96, h = 64, children }: { cx: number; w?: number; h?: number; children?: ReactNode }) {
  const x = cx - w / 2;
  const y = 352 - 18 - h;
  return (
    <g>
      <rect x={cx - 6} y={352 - 20} width="12" height="20" fill="#cbd5e1" stroke={INK} strokeWidth="2" />
      <rect x={cx - 22} y={348} width="44" height="6" rx="3" fill="#cbd5e1" stroke={INK} strokeWidth="2" />
      <rect x={x} y={y} width={w} height={h} rx="6" fill="#334155" stroke={INK} strokeWidth="2.5" />
      <g transform={`translate(${x + 5} ${y + 5})`}>
        <rect width={w - 10} height={h - 10} rx="3" fill="#e2e8f0" />
        {children}
      </g>
    </g>
  );
}

function Backdrop({ q }: { q: [string, string, string] }) {
  return (
    <g>
      {ROOMS.map((r) => (
        <rect key={r.title} x={r.x} y={0} width={r.w} height={FLOOR} fill={r.wall} />
      ))}
      {/* เพดาน + ชื่อสตูดิโอ */}
      <rect x="0" y="0" width={W} height="36" fill="#f8fafc" stroke={INK} strokeWidth="2.5" />
      <text x="16" y="24" fontSize="14" fontWeight="800" fill={INK}>WULING CHONBURI · AI Studio · ทีม AI 4 แผนก</text>
      {/* พื้น */}
      <rect x="0" y={FLOOR} width={W} height={VH - FLOOR} fill="#f6dcb4" />
      <rect x="0" y={FLOOR - 10} width={W} height="10" fill="#cbd5e1" />
      <line x1="0" y1={FLOOR} x2={W} y2={FLOOR} stroke={INK} strokeWidth="3" />
      {/* เสากั้นแผนก */}
      {ROOMS.slice(1).map((r) => (
        <rect key={r.title} x={r.x - 6} y="36" width="12" height={FLOOR - 36} fill="#fff" stroke={INK} strokeWidth="2.5" />
      ))}
      {/* ป้ายแผนก */}
      {ROOMS.map((r) => {
        const sw = Math.min(r.w - 36, 220);
        return (
          <g key={r.title} transform={`translate(${r.x + r.w / 2} 52)`}>
            <rect x={-sw / 2} y="0" width={sw} height="48" rx="12" fill="#fff" stroke={INK} strokeWidth="2.5" />
            <text x="0" y="21" fontSize="15" fontWeight="800" textAnchor="middle" fill={INK}>{r.title}</text>
            <text x="0" y="38" fontSize="11.5" fontWeight="600" textAnchor="middle" fill="#64748b">{r.sub}</text>
          </g>
        );
      })}

      {/* ---- SCOUT: แผนที่คู่แข่งบนผนัง + จอเรดาร์ ---- */}
      <g transform="translate(40 128)">
        <rect width="190" height="110" rx="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <path d="M14 80 Q50 40 90 62 T176 36" fill="none" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
        {[[40, 56, '#ef4444'], [96, 64, '#f59e0b'], [140, 44, '#8b5cf6'], [62, 88, '#22c55e']].map(([x, y, c]) => (
          <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r="7" fill={c as string} stroke={INK} strokeWidth="2" />
        ))}
        <text x="95" y="22" fontSize="11.5" fontWeight="700" textAnchor="middle" fill={INK}>โฆษณาคู่แข่ง ชลบุรี·ระยอง</text>
      </g>
      <Desk x={36} w={200} />
      <Monitor cx={196} w={70} h={56}>
        <circle cx="30" cy="23" r="19" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
        <circle cx="30" cy="23" r="9" fill="none" stroke="#16a34a" strokeWidth="1.5" />
        <g className="st-radar" style={{ transformOrigin: '30px 23px' }}>
          <line x1="30" y1="23" x2="30" y2="5" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </Monitor>

      {/* ---- กลยุทธ์ & คอนเทนต์: ศูนย์สั่งงาน Susan · ตู้ Drive · คอมตัดต่อ edit ---- */}
      <Desk x={282} w={130} />
      <g transform="translate(300 312)">
        <rect width="60" height="40" rx="4" fill="#94a3b8" stroke={INK} strokeWidth="2.5" />
        <circle cx="30" cy="20" r="5" fill="#fff" />
      </g>
      <g transform="translate(372 326)">
        <rect width="22" height="26" rx="5" fill="#bae6fd" stroke={INK} strokeWidth="2.5" />
      </g>
      <Tag x={347} y={244} text="ศูนย์สั่งงาน · Susan" />

      <g transform="translate(455 214)">
        <rect width="120" height={FLOOR - 214} rx="6" fill="#a7f3d0" stroke={INK} strokeWidth="2.5" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x="12" y={16 + i * 70} width="96" height="56" rx="6" fill="#d1fae5" stroke={INK} strokeWidth="2.5" />
        ))}
      </g>
      <Tag x={515} y={200} text="Google Drive" />
      <Tag x={515} y={258} text={`TODO ${q[0]}`} w={86} />
      <Tag x={515} y={328} text={`DOING ${q[1]}`} w={86} />
      <Tag x={515} y={398} text={`DONE ${q[2]}`} w={86} />
      <Paper className="st-tray-todo" x={540} y={242} />
      <Paper className="st-tray-done" x={540} y={382} />

      <Desk x={650} w={140} />
      <Monitor cx={720} w={110} h={72}>
        <rect x="6" y="6" width="34" height="24" rx="2" fill="#c4b5fd" />
        <polygon points="18,12 18,24 28,18" fill="#fff" />
        <rect x="46" y="8" width="46" height="5" rx="2" fill="#94a3b8" />
        <rect x="46" y="18" width="34" height="5" rx="2" fill="#94a3b8" />
        <rect x="6" y="40" width="88" height="6" rx="3" fill="#1d2133" />
        <rect x="6" y="40" width="88" height="6" rx="3" fill="#8bc542" className="st-progress" />
      </Monitor>
      <Tag x={720} y={248} text="คอมปัน · edit" />

      {/* ---- ห้องปัน: โต๊ะ + มือถือรับสรุป ---- */}
      <Desk x={826} w={148} />
      <g transform="translate(884 316)">
        <rect width="22" height="36" rx="5" fill="#1e293b" stroke={INK} strokeWidth="2.5" />
        <rect x="4" y="5" width="14" height="22" rx="2" fill="#a5f3fc" className="st-phone" />
      </g>
      <g transform="translate(838 140)">
        <rect width="124" height="80" rx="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <text x="62" y="24" fontSize="12" fontWeight="800" textAnchor="middle" fill={INK}>รออนุมัติ</text>
        <path d="M18 40 h88 M18 54 h70 M18 68 h80" stroke="#cbd5e1" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* ---- โฆษณา Meta: กราฟบนผนัง · โต๊ะ Alex · โต๊ะ Beary ---- */}
      <g transform="translate(1120 128)">
        <rect width="200" height="108" rx="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
        {[[22, 50], [58, 34], [94, 62], [130, 46], [166, 78]].map(([x, h]) => (
          <rect key={x} x={x} y={92 - h} width="22" height={h} rx="3" fill="#f9a8d4" stroke={INK} strokeWidth="2" />
        ))}
        <text x="100" y="20" fontSize="11.5" fontWeight="700" textAnchor="middle" fill={INK}>งบ vs ลีด · Meta</text>
      </g>
      <Desk x={1018} w={130} />
      <Monitor cx={1083} w={84} h={58}>
        <circle cx="22" cy="24" r="15" fill="#fbcfe8" />
        <path d="M22 24 L22 9 A15 15 0 0 1 36 28 Z" fill="#ec4899" />
        <rect x="44" y="12" width="26" height="5" rx="2" fill="#94a3b8" />
        <rect x="44" y="24" width="20" height="5" rx="2" fill="#94a3b8" />
      </Monitor>
      <Desk x={1220} w={128} />
      <g transform="translate(1250 320)">
        <rect width="36" height="32" rx="3" fill="#fde68a" stroke={INK} strokeWidth="2.5" />
        <text x="18" y="22" fontSize="14" fontWeight="800" textAnchor="middle" fill={INK}>฿</text>
      </g>

      {/* ---- วางแผน & โพสต์: ปฏิทินบนผนัง (ยังไม่เริ่มงาน) ---- */}
      <g transform="translate(1400 124)">
        <rect width="160" height="120" rx="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <rect width="160" height="26" rx="8" fill="#86efac" stroke={INK} strokeWidth="2.5" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={14 + (i % 4) * 34} y={38 + Math.floor(i / 4) * 26} width="26" height="18" rx="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
        ))}
      </g>
      <Desk x={1386} w={188} />
      <rect x={1366} y={36} width={234} height={VH - 36} fill="#fff" opacity="0.38" />
      <Tag x={1480} y={290} text="เริ่มงานหลัง Susan + edit ผ่าน" />
    </g>
  );
}

function Scene({
  pan, susan, edit, alex, beary, scout, almanac, q,
}: {
  pan: StudioItem; susan: StudioItem; edit: StudioItem; alex: StudioItem; beary: StudioItem;
  scout: StudioItem; almanac: StudioItem; q: [string, string, string];
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${VH}`}
      className="st-svg"
      role="img"
      aria-label="ห้องทำงาน AI 4 แผนก: SCOUT ข่าวกรองคู่แข่ง · Susan ส่งใบงานผ่านตู้ Drive ให้ edit ตัดต่อ · ปันรับรายงานและอนุมัติ · Alex ส่งรายงานให้ Beary เสนองบ · ALMANAC รอเริ่มงาน"
    >
      <Backdrop q={q} />

      {/* SCOUT */}
      <g transform={`translate(110 ${FEET})`}>
        <g className="st-walk-scout">
          <g className="st-bob">
            <Sprite name="scout_idle" className="st-scout-idle" />
            <Sprite name="scout_walk" className="st-scout-right" />
            <Sprite name="scout_walk" flip className="st-scout-left" />
          </g>
          <Paper className="st-scout-paper" x={34} y={-70} />
          <Tag x={0} y={16} text="SCOUT" />
        </g>
        <Bubble text={short(scout.value, 18)} tone={scout.state || 'idle'} dx={20} />
      </g>

      {/* Susan: เดินไปตู้ Drive (+140) */}
      <g transform={`translate(295 ${FEET})`}>
        <g className="st-walk-susan">
          <g className="st-bob">
            <Sprite name="susan_idle" className="st-susan-idle" />
            <Sprite name="susan_walk" className="st-susan-right" />
            <Sprite name="susan_walk" flip className="st-susan-left" />
          </g>
          <Bubble text={short(susan.value, 18)} tone={susan.state || 'idle'} dx={30} />
          <Tag x={0} y={16} text="Susan" />
        </g>
      </g>

      {/* edit: เดินไปตู้ Drive (−150) · นั่งตัดต่อ */}
      <g transform={`translate(745 ${FEET})`}>
        <g className="st-walk-edit">
          <g className="st-bob st-bob-edit">
            <Sprite name="edit_idle" className="st-edit-idle" />
            <Sprite name="edit_walk" flip className="st-edit-left" />
            <Sprite name="edit_walk" className="st-edit-right" />
            <Sprite name="edit_work" className="st-edit-work" />
          </g>
          <Bubble text={short(edit.value, 18)} tone={edit.state || 'idle'} dx={-20} />
          <Tag x={0} y={16} text="edit" />
        </g>
      </g>

      {/* ปัน */}
      <g transform={`translate(900 ${FEET})`}>
        <Sprite name="pan_idle" h={140} className="st-pan-idle" />
        <Sprite name="pan_notify" h={140} className="st-pan-notify" />
        <Bubble text={short(pan.value, 18)} tone={pan.state || 'idle'} dy={-170} />
        <Tag x={0} y={16} text="ปัน" />
      </g>

      {/* Alex: เดินเอารายงานให้ Beary (+110) */}
      <g transform={`translate(1075 ${FEET})`}>
        <g className="st-walk-alex">
          <g className="st-bob">
            <Sprite name="alex_idle" className="st-alex-idle" />
            <Sprite name="alex_walk" className="st-alex-right" />
            <Sprite name="alex_walk" flip className="st-alex-left" />
          </g>
          <Bubble text={short(alex.value, 18)} tone={alex.state || 'idle'} dx={10} />
          <Tag x={0} y={16} text="Alex" />
        </g>
      </g>

      {/* Beary */}
      <g transform={`translate(1290 ${FEET})`}>
        <g className="st-bob st-bob-edit">
          <Sprite name="beary_idle" />
        </g>
        <Bubble text={short(beary.value, 18)} tone={beary.state || 'idle'} dy={-H - 62} dx={-10} />
        <Tag x={0} y={16} text="Beary" />
      </g>

      {/* ALMANAC (ยังไม่เริ่มงาน) */}
      <g transform={`translate(1480 ${FEET})`} opacity="0.75">
        <Sprite name="almanac_idle" />
        <Bubble text={short(almanac.value, 18)} tone={almanac.state || 'idle'} dy={-H - 30} />
        <Tag x={0} y={16} text="ALMANAC" />
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
const SCOUT_R: [number, number][] = [[60, 68]];
const SCOUT_L: [number, number][] = [[72, 80]];
const SCOUT_I: [number, number][] = [[0, 60], [68, 72], [80, 100]];
const PAN_N: [number, number][] = [[96.9, 100]];
const PAN_I: [number, number][] = [[0, 96.9]];

const SPRITE_KF = [
  showKF('st-susan-idle', SUSAN_I), showKF('st-susan-right', SUSAN_R), showKF('st-susan-left', SUSAN_L),
  showKF('st-edit-idle', EDIT_I), showKF('st-edit-left', EDIT_L), showKF('st-edit-right', EDIT_R), showKF('st-edit-work', EDIT_W),
  showKF('st-alex-idle', ALEX_I), showKF('st-alex-right', ALEX_R), showKF('st-alex-left', ALEX_L),
  showKF('st-scout-idle', SCOUT_I), showKF('st-scout-right', SCOUT_R), showKF('st-scout-left', SCOUT_L),
  showKF('st-pan-idle', PAN_I), showKF('st-pan-notify', PAN_N),
].join('\n');

const SPRITE_CLS = ['susan-idle', 'susan-right', 'susan-left', 'edit-idle', 'edit-left', 'edit-right', 'edit-work', 'alex-idle', 'alex-right', 'alex-left', 'scout-idle', 'scout-right', 'scout-left', 'pan-idle', 'pan-notify'];

const CSS = `
.st-wrap{display:grid;gap:16px}
.st-stage{border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden}
.st-scroll{overflow-x:auto}
.st-svg{display:block;width:100%;min-width:900px;height:auto}
.st-progress{transform-box:fill-box}
.st-dot-working{fill:#38bdf8}.st-dot-waiting{fill:#f59e0b}.st-dot-done{fill:#22c55e}.st-dot-blocked{fill:#ef4444}.st-dot-idle{fill:#9ca3af}
/* ค่าตั้งต้นเมื่อไม่มีแอนิเมชัน: แสดงท่ายืน */
.st-susan-right,.st-susan-left,.st-edit-left,.st-edit-right,.st-edit-work,.st-alex-right,.st-alex-left,.st-scout-right,.st-scout-left,.st-scout-paper,.st-pan-notify{opacity:0}
@media (prefers-reduced-motion: no-preference){
  .st-bob{animation:st-bob .5s ease-in-out infinite alternate}
  .st-bob-edit{animation-delay:.25s}
  .st-walk-susan{animation:st-susan 30s linear infinite}
  .st-walk-edit{animation:st-edit 30s linear infinite}
  .st-walk-alex{animation:st-alex 30s linear infinite}
  .st-walk-scout{animation:st-scout 30s linear infinite}
  .st-scout-paper{animation:st-scout-paper 30s linear infinite}
  .st-tray-todo{animation:st-tray-todo 30s linear infinite}
  .st-tray-done{animation:st-tray-done 30s linear infinite}
  .st-progress{transform-origin:0 50%;animation:st-progress 30s linear infinite}
  .st-radar{animation:st-radar 3s linear infinite}
  .st-phone{animation:st-phone 30s linear infinite}
  ${SPRITE_CLS.map((c) => `.st-${c}{animation:st-${c} 30s linear infinite}`).join('\n  ')}
}
@media (prefers-reduced-motion: reduce){
  .st-tray-done{opacity:0}
}
@keyframes st-bob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
@keyframes st-radar{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes st-phone{0%,96.8%{fill:#a5f3fc}97%,100%{fill:#fde047}}
/* Susan: พิมพ์ 0–10% · เดินไปตู้ 10–20% · วางงาน 20–23% · กลับ 23–33% · รอ · ไปรับรายงาน 80–88% · กลับ 90–98% */
@keyframes st-susan{0%,10%{transform:translateX(0)}20%,23.3%{transform:translateX(140px)}33.3%,80%{transform:translateX(0)}88.3%,90%{transform:translateX(140px)}98%,100%{transform:translateX(0)}}
/* edit: รอ 0–33% · เดินไปตู้ 33–43% · หยิบ 43–47% · กลับ 47–57% · ตัดต่อ 57–70% · ไปส่ง 70–77% · วาง 77–80% · กลับ 80–87% */
@keyframes st-edit{0%,33.3%{transform:translateX(0)}43.3%,46.7%{transform:translateX(-150px)}56.7%,70%{transform:translateX(0)}76.7%,80%{transform:translateX(-150px)}86.7%,100%{transform:translateX(0)}}
/* Alex: ดูกราฟ 0–20% · เดินเอารายงานให้ Beary 20–35% · ส่ง 35–40% · กลับ 40–55% */
@keyframes st-alex{0%,20%{transform:translateX(0)}35%,40%{transform:translateX(110px)}55%,100%{transform:translateX(0)}}
/* SCOUT: ดูเรดาร์ 0–60% · เดินเอาผลสแกนไปส่งให้ Susan 60–68% · ส่ง 68–72% · กลับ 72–80% */
@keyframes st-scout{0%,60%{transform:translateX(0)}68%,72%{transform:translateX(95px)}80%,100%{transform:translateX(0)}}
@keyframes st-scout-paper{0%,59.9%{opacity:0}60%,70.9%{opacity:1}71%,100%{opacity:0}}
@keyframes st-tray-todo{0%,21.6%{opacity:0}21.7%,44.9%{opacity:1}45%,100%{opacity:0}}
@keyframes st-tray-done{0%,78.2%{opacity:0}78.3%,89.9%{opacity:1}90%,100%{opacity:0}}
@keyframes st-progress{0%,56.7%{transform:scaleX(0)}70%,100%{transform:scaleX(1)}}
${SPRITE_KF}
.st-legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:12.5px;color:var(--muted);padding:10px 16px;border-top:1px solid var(--line);background:var(--bg)}
.st-legend b{color:var(--navy)}
.st-depts{display:grid;gap:14px}
.st-dept-head{display:flex;align-items:baseline;gap:8px;margin:0 0 8px}
.st-dept-head h3{margin:0;font-size:15px;color:var(--navy)}
.st-dept-head span{font-size:12px;color:var(--muted)}
.st-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.st-card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--surface)}
.st-card-upd{margin-top:8px;font-size:11.5px;color:var(--muted,#6b7280)}
.st-card-stale{color:#b45309;font-weight:600}
.st-card-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.st-card-head img,.st-card-head svg{width:40px;height:52px;object-fit:contain;flex:none}
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
  scout: 'สแกนโฆษณาคู่แข่ง จ./พ./ศ. 03:00 · ส่งข้อมูลให้ Susan',
  susan: 'กลยุทธ์ · คลัง Hook · บรีฟ · ออกใบงาน (บัญชี B)',
  edit: 'ดัชนี · ตัดต่อ · ปก · โพสต์ (คอมปัน)',
  alex: 'วิเคราะห์ Meta Ads ทุกเช้า',
  beary: 'วางงบ · เสนอปรับโฆษณา (รอปันอนุมัติ)',
  almanac: 'อนาคต: คิดแคปชั่น · โพสต์ · ยิงโฆษณา',
};

const DEPTS: { title: string; sub: string; members: string[] }[] = [
  { title: 'ห้องปัน', sub: 'รับรายงานจากทุกแผนก · อนุมัติ', members: ['pan'] },
  { title: 'ข่าวกรองคู่แข่ง', sub: 'ดูว่าคู่แข่งยิงโฆษณาอะไร', members: ['scout'] },
  { title: 'กลยุทธ์ & คอนเทนต์', sub: 'วางแผน PPS → บรีฟ → ตัดต่อคลิป', members: ['susan', 'edit'] },
  { title: 'โฆษณา Meta', sub: 'วิเคราะห์ผล → เสนองบ → ปันอนุมัติ', members: ['alex', 'beary'] },
  { title: 'วางแผน & โพสต์', sub: 'ยังไม่เริ่มงาน — รอให้งาน Susan + edit ผ่านก่อน', members: ['almanac'] },
];

function Avatar({ actor }: { actor: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${SRC}${actor}_idle.png`} alt="" />;
}

export default function StudioPage({ reports }: { reports: AgentReport[] }) {
  const report = reports.find((r) => r.agent === 'TIKTOK' && r.section === 'studio');
  const raw = report?.data && 'items' in report.data ? (report.data.items as unknown as StudioItem[]) : null;
  const items: StudioItem[] = raw && raw.length ? raw : FALLBACK;
  const get = (actor: string): StudioItem =>
    items.find((i) => i.actor === actor) || FALLBACK.find((i) => i.actor === actor) || { label: actor, value: '—' };

  /* สถานะแต่ละตัวอ่านจากรายงานล่าสุดของทีมนั้นเอง (อัปเดตทุกคืนผ่าน sync) แทนการพึ่งการ์ด studio ที่เขียนมือ
     ตัวไหนไม่มีรายงานของตัวเอง (edit) จะใช้การ์ด studio + แสดงวันที่ ถ้าเก่ากว่า 2 วันจะขึ้น "ข้อมูลเก่า" */
  const latest = (agent: string, section?: string) =>
    reports
      .filter((r) => r.agent === agent && (!section || r.section === section))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const studioAt = report?.updated_at;
  const withAt = (i: StudioItem, at?: string): StudioItem => ({ ...i, at: at ?? i.at ?? studioAt });
  const itemsOf = (r?: AgentReport): string[] =>
    r?.data && 'items' in r.data && Array.isArray(r.data.items)
      ? (r.data.items as unknown[]).map((x) => (typeof x === 'string' ? x : (x as { label?: string; value?: string }).label + ' ' + ((x as { value?: string }).value ?? '')))
      : [];
  const rowsOf = (r?: AgentReport): number =>
    r?.data && 'rows' in r.data && Array.isArray(r.data.rows) ? r.data.rows.length : 0;

  const scoutReport = latest('SCOUT');
  const scout: StudioItem = scoutReport
    ? { actor: 'scout', label: 'SCOUT', value: `สแกนรอบ ${formatDateTH(new Date(scoutReport.updated_at))}`, note: 'ผลสแกนคู่แข่งอยู่ในหน้า SCOUT · ส่งต่อให้ Susan ใช้วางกลยุทธ์', state: 'done', at: scoutReport.updated_at }
    : withAt(get('scout'));

  const alexR = latest('ADS', 'alex');
  const alex: StudioItem = alexR
    ? { actor: 'alex', label: 'Alex', value: short(alexR.title.replace(/^วิเคราะห์ผล Meta Ads ประจำวัน\s*/, 'รายงานเสร็จ '), 40), note: short(alexR.body, 150), state: 'done', at: alexR.updated_at }
    : withAt(get('alex'));

  const bearyR = latest('ADS', 'beary');
  const nProp = rowsOf(bearyR);
  const beary: StudioItem = bearyR
    ? { actor: 'beary', label: 'Beary', value: nProp ? `เสนอ ${nProp} เรื่อง รอปันอนุมัติ` : 'ไม่มีข้อเสนอค้าง', note: short(bearyR.body, 150), state: nProp ? 'waiting' : 'done', at: bearyR.updated_at }
    : withAt(get('beary'));

  const todoR = latest('ADS', 'pan_todo');
  const todos = itemsOf(todoR);
  const panStudio = get('pan');
  const pan: StudioItem = todos.length
    ? { actor: 'pan', label: 'ปัน', value: `มีงานรอ ${todos.length} เรื่อง`, note: short(todos[0], 150), state: 'waiting', at: todoR!.updated_at }
    : withAt(panStudio);

  const susanR = latest('SUSAN');
  const susan: StudioItem = susanR
    ? { actor: 'susan', label: 'Susan', value: `อัปเดตกลยุทธ์ ${formatDateTH(new Date(susanR.updated_at))}`, note: 'สัญญาณ · PPS · คลัง Hook · สั่งทำวิดีโอ อยู่ในหน้า SUSAN', state: 'done', at: susanR.updated_at }
    : withAt(get('susan'));

  const byActor: Record<string, StudioItem> = {
    pan,
    scout,
    susan,
    edit: withAt(get('edit')),
    alex,
    beary,
    almanac: { ...get('almanac'), at: undefined }, // ยังไม่เริ่มงาน — ไม่ต้องเตือนข้อมูลเก่า
  };
  // เทียบกับรายงานใหม่สุดในระบบ (รอบ sync ล่าสุด) — ถ้าเก่ากว่านั้นเกิน 2 วันถือว่าข้อมูลเก่า
  const newest = reports.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), '');
  const isStale = (at?: string) => !!at && !!newest && new Date(newest).getTime() - new Date(at).getTime() > 2 * 86400000;
  const q: [string, string, string] = [get('queue_todo').value, get('queue_doing').value, get('queue_done').value];

  return (
    <div className="st-wrap">
      <style>{CSS}</style>
      <div className="st-stage">
        <div className="st-scroll">
          <Scene {...(byActor as Record<'pan' | 'scout' | 'susan' | 'edit' | 'alex' | 'beary' | 'almanac', StudioItem>)} q={q} />
        </div>
        <div className="st-legend">
          <span><b>ข่าวกรอง</b> SCOUT สแกนคู่แข่ง จ./พ./ศ. → ส่งให้ Susan</span>
          <span><b>คอนเทนต์</b> Susan วางบรีฟในตู้ TODO → edit หยิบไปตัดต่อ (:00) → ส่งเข้า DONE → Susan สรุปเข้ามือถือปัน (:30)</span>
          <span><b>โฆษณา</b> Alex วิเคราะห์ Meta ทุกเช้า → Beary เสนองบ → ปันอนุมัติ</span>
          <span><b>วางแผน & โพสต์</b> ALMANAC เริ่มเมื่องาน Susan + edit ผ่าน</span>
        </div>
      </div>

      <div className="st-depts">
        {DEPTS.map((d) => (
          <section key={d.title}>
            <div className="st-dept-head">
              <h3>{d.title}</h3>
              <span>{d.sub}</span>
            </div>
            <div className="st-cards">
              {d.members.map((key) => {
                const item = byActor[key];
                const st = STATE_LABEL[item.state || 'idle'] || STATE_LABEL.idle;
                return (
                  <div className="st-card" key={key}>
                    <div className="st-card-head">
                      <Avatar actor={key} />
                      <div className="st-card-id">
                        <div className="st-card-name">{item.label}</div>
                        <div className="st-card-role">{ROLES[key]}</div>
                      </div>
                      <span className={`st-pill ${st.cls}`}>{st.text}</span>
                    </div>
                    <div className="st-card-value">{item.value}</div>
                    {item.note && <div className="st-card-note">{item.note}</div>}
                    {item.at && (
                      <div className={`st-card-upd${isStale(item.at) ? ' st-card-stale' : ''}`}>
                        {isStale(item.at) ? '⚠ ข้อมูลเก่า · ' : ''}อัปเดต {displayDateTime(item.at)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="st-meta">
        {report
          ? `ตัวละครแต่ละตัวอ่านสถานะจากรายงานล่าสุดของทีมตัวเอง · การ์ด studio (edit/คิวงาน) อัปเดต ${displayDateTime(report.updated_at)}`
          : 'ยังไม่มีข้อมูล studio ใน Supabase — แสดงสถานะตั้งต้น (18 พ.ย. 2569)'}
      </div>
    </div>
  );
}
