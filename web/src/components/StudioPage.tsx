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

/* ---------- ตัวละคร (วาดใหม่ทั้งหมด · ยืนที่จุด 0,0 = เท้า) ---------- */

const INK = '#2b2d3a';

function Rabbit() {
  return (
    <g>
      {/* หู */}
      <ellipse cx="-11" cy="-118" rx="7" ry="22" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <ellipse cx="11" cy="-118" rx="7" ry="22" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <ellipse cx="-11" cy="-116" rx="3" ry="14" fill="#f6b8c8" />
      <ellipse cx="11" cy="-116" rx="3" ry="14" fill="#f6b8c8" />
      {/* ขา */}
      <g className="st-legs">
        <rect x="-12" y="-22" width="9" height="22" rx="4" fill="#7c7fb8" stroke={INK} strokeWidth="2.5" />
        <rect x="3" y="-22" width="9" height="22" rx="4" fill="#7c7fb8" stroke={INK} strokeWidth="2.5" />
      </g>
      {/* ตัว */}
      <rect x="-20" y="-58" width="40" height="40" rx="14" fill="#c9b8f0" stroke={INK} strokeWidth="2.5" />
      <path d="M-14 -56 L0 -44 L14 -56" fill="none" stroke={INK} strokeWidth="2" />
      {/* หัว */}
      <circle cx="0" cy="-80" r="24" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="-8" cy="-82" r="2.6" fill={INK} />
      <circle cx="8" cy="-82" r="2.6" fill={INK} />
      <circle cx="-14" cy="-74" r="4" fill="#f9c6d3" />
      <circle cx="14" cy="-74" r="4" fill="#f9c6d3" />
      <path d="M-3 -74 Q0 -71 3 -74" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      {/* ผ้าพันคอ */}
      <path d="M-18 -58 Q0 -50 18 -58" fill="none" stroke="#f08aa6" strokeWidth="6" strokeLinecap="round" />
    </g>
  );
}

function Cat() {
  return (
    <g>
      {/* ขา */}
      <g className="st-legs">
        <rect x="-12" y="-22" width="9" height="22" rx="4" fill="#4a5677" stroke={INK} strokeWidth="2.5" />
        <rect x="3" y="-22" width="9" height="22" rx="4" fill="#4a5677" stroke={INK} strokeWidth="2.5" />
      </g>
      {/* ฮู้ด */}
      <rect x="-21" y="-58" width="42" height="40" rx="14" fill="#8fc3ea" stroke={INK} strokeWidth="2.5" />
      <rect x="-8" y="-40" width="16" height="10" rx="3" fill="#7ab2dc" stroke={INK} strokeWidth="2" />
      {/* หู */}
      <path d="M-22 -92 L-16 -114 L-4 -100 Z" fill="#cfd3dc" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 -92 L16 -114 L4 -100 Z" fill="#cfd3dc" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* หัว */}
      <circle cx="0" cy="-80" r="24" fill="#e6e8ee" stroke={INK} strokeWidth="2.5" />
      <path d="M-24 -84 Q-10 -96 0 -86 Q10 -96 24 -84" fill="#b5bac7" stroke="none" />
      <circle cx="-8" cy="-80" r="2.6" fill={INK} />
      <circle cx="8" cy="-80" r="2.6" fill={INK} />
      <path d="M-4 -72 Q-2 -70 0 -72 Q2 -70 4 -72" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M-22 -74 L-30 -76 M-22 -71 L-30 -70 M22 -74 L30 -76 M22 -71 L30 -70" stroke={INK} strokeWidth="1.5" />
      {/* หูฟัง */}
      <path d="M-25 -84 Q0 -116 25 -84" fill="none" stroke="#f2a33a" strokeWidth="5" strokeLinecap="round" />
      <rect x="-31" y="-90" width="10" height="16" rx="4" fill="#f2a33a" stroke={INK} strokeWidth="2" />
      <rect x="21" y="-90" width="10" height="16" rx="4" fill="#f2a33a" stroke={INK} strokeWidth="2" />
    </g>
  );
}

function Fox() {
  return (
    <g>
      <g className="st-legs">
        <rect x="-12" y="-22" width="9" height="22" rx="4" fill="#5b4a3f" stroke={INK} strokeWidth="2.5" />
        <rect x="3" y="-22" width="9" height="22" rx="4" fill="#5b4a3f" stroke={INK} strokeWidth="2.5" />
      </g>
      <path d="M18 -30 Q44 -40 34 -64 Q26 -46 16 -44 Z" fill="#f29b4b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M34 -64 Q38 -56 32 -50" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <rect x="-20" y="-58" width="40" height="40" rx="14" fill="#fff4dc" stroke={INK} strokeWidth="2.5" />
      <path d="M-6 -58 L0 -40 L6 -58" fill="#5b5bd6" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-22 -92 L-18 -116 L-4 -100 Z" fill="#f29b4b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 -92 L18 -116 L4 -100 Z" fill="#f29b4b" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="0" cy="-80" r="24" fill="#f29b4b" stroke={INK} strokeWidth="2.5" />
      <path d="M-18 -72 Q0 -60 18 -72 Q14 -60 0 -57 Q-14 -60 -18 -72 Z" fill="#fff" />
      <circle cx="-9" cy="-82" r="7" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx="9" cy="-82" r="7" fill="#fff" stroke={INK} strokeWidth="2" />
      <line x1="-2" y1="-82" x2="2" y2="-82" stroke={INK} strokeWidth="2" />
      <circle cx="-9" cy="-82" r="2.4" fill={INK} />
      <circle cx="9" cy="-82" r="2.4" fill={INK} />
      <circle cx="0" cy="-70" r="2.6" fill={INK} />
    </g>
  );
}

function Bear() {
  return (
    <g>
      <g className="st-legs">
        <rect x="-13" y="-22" width="10" height="22" rx="4" fill="#3b4256" stroke={INK} strokeWidth="2.5" />
        <rect x="3" y="-22" width="10" height="22" rx="4" fill="#3b4256" stroke={INK} strokeWidth="2.5" />
      </g>
      <rect x="-23" y="-60" width="46" height="42" rx="15" fill="#f3f4f6" stroke={INK} strokeWidth="2.5" />
      <path d="M-3 -58 L3 -58 L5 -36 L0 -30 L-5 -36 Z" fill="#ef6b6b" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="-18" cy="-100" r="9" fill="#a8744f" stroke={INK} strokeWidth="2.5" />
      <circle cx="18" cy="-100" r="9" fill="#a8744f" stroke={INK} strokeWidth="2.5" />
      <circle cx="0" cy="-80" r="25" fill="#a8744f" stroke={INK} strokeWidth="2.5" />
      <ellipse cx="0" cy="-71" rx="11" ry="8" fill="#e7c49e" stroke={INK} strokeWidth="2" />
      <circle cx="0" cy="-74" r="2.8" fill={INK} />
      <circle cx="-9" cy="-84" r="2.6" fill={INK} />
      <circle cx="9" cy="-84" r="2.6" fill={INK} />
      <path d="M-3 -67 Q0 -64 3 -67" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Person() {
  return (
    <g>
      <rect x="-12" y="-24" width="10" height="24" rx="4" fill="#3b4256" stroke={INK} strokeWidth="2.5" />
      <rect x="2" y="-24" width="10" height="24" rx="4" fill="#3b4256" stroke={INK} strokeWidth="2.5" />
      <rect x="-21" y="-62" width="42" height="42" rx="14" fill="#8bc542" stroke={INK} strokeWidth="2.5" />
      <path d="M-8 -62 L0 -52 L8 -62" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="0" cy="-84" r="22" fill="#f6d2b4" stroke={INK} strokeWidth="2.5" />
      <path d="M-22 -86 Q-20 -108 0 -107 Q20 -108 22 -86 Q12 -96 0 -94 Q-12 -96 -22 -86 Z" fill={INK} />
      <circle cx="-7" cy="-82" r="2.4" fill={INK} />
      <circle cx="7" cy="-82" r="2.4" fill={INK} />
      <path d="M-4 -74 Q0 -71 4 -74" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      {/* มือถือ */}
      <g className="st-phone">
        <rect x="16" y="-56" width="14" height="22" rx="3" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <rect x="19" y="-52" width="8" height="12" rx="1" className="st-phone-screen" />
      </g>
    </g>
  );
}

function Paper({ className, x = 0, y = 0 }: { className: string; x?: number; y?: number }) {
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <rect x="-9" y="-12" width="18" height="22" rx="2" fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M-5 -6 H5 M-5 -1 H5 M-5 4 H2" stroke="#9aa0b4" strokeWidth="1.6" />
    </g>
  );
}

function Bubble({ text, tone, dy = -206, dx = 0 }: { text: string; tone: string; dy?: number; dx?: number }) {
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

/* ---------- ฉาก ---------- */

function Scene({ pan, susan, edit, alex, beary, q }: { pan: StudioItem; susan: StudioItem; edit: StudioItem; alex: StudioItem; beary: StudioItem; q: [string, string, string] }) {
  return (
    <svg viewBox="0 0 1260 520" className="st-svg" role="img" aria-label="ห้องทำงาน AI: Susan ส่งใบงานผ่านตู้ Drive ให้ edit ตัดต่อ แล้วส่งรายงานกลับ · ทีม Ads Alex ส่งรายงานให้ Beary เสนองบ">
      {/* ผนัง + พื้น */}
      <rect x="0" y="0" width="1260" height="330" fill="#fbfaf6" />
      <rect x="0" y="330" width="1260" height="190" fill="#f3ede1" />
      <line x1="0" y1="330" x2="1260" y2="330" stroke={INK} strokeWidth="2.5" />

      {/* หน้าต่าง */}
      <g transform="translate(330 40)">
        <rect width="300" height="150" rx="6" fill="#cfe9fb" stroke={INK} strokeWidth="2.5" />
        <circle cx="54" cy="46" r="18" fill="#ffd66b" stroke={INK} strokeWidth="2" />
        <g className="st-cloud">
          <path d="M120 60 q10 -22 30 -10 q14 -14 28 4 q18 0 14 16 h-74 q-10 -6 2 -10z" fill="#fff" stroke={INK} strokeWidth="2" />
        </g>
        <path d="M0 120 Q70 84 150 112 Q220 136 300 100 V150 H0Z" fill="#b9e2a0" stroke={INK} strokeWidth="2" />
        <line x1="150" y1="0" x2="150" y2="150" stroke={INK} strokeWidth="2.5" />
      </g>
      {/* ป้ายห้อง */}
      <g transform="translate(40 36)">
        <rect width="290" height="44" rx="10" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <text x="16" y="28" fontSize="16" fontWeight="800" fill={INK}>WULING CHONBURI · AI Studio</text>
      </g>
      {/* นาฬิกา */}
      <g transform="translate(720 90)">
        <circle r="34" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <text x="0" y="-18" fontSize="10" textAnchor="middle" fill={INK}>:00 edit</text>
        <text x="0" y="26" fontSize="10" textAnchor="middle" fill={INK}>:30 Susan</text>
        <line x1="0" y1="0" x2="0" y2="-22" stroke={INK} strokeWidth="3" strokeLinecap="round" className="st-hand" />
        <circle r="3" fill={INK} />
      </g>
      {/* ต้นไม้ */}
      <g transform="translate(880 330)">
        <rect x="-20" y="-40" width="40" height="40" rx="6" fill="#f4a4a0" stroke={INK} strokeWidth="2.5" />
        <path d="M0 -40 Q-40 -80 -18 -120 Q0 -90 0 -40 Q4 -100 30 -126 Q40 -80 0 -40" fill="#8fd18a" stroke={INK} strokeWidth="2.5" />
      </g>

      {/* โต๊ะ Susan */}
      <g transform="translate(70 300)">
        <rect x="0" y="40" width="210" height="16" rx="4" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="10" y="56" width="12" height="60" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="188" y="56" width="12" height="60" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="50" y="6" width="70" height="34" rx="4" fill="#cdd5f5" stroke={INK} strokeWidth="2.5" />
        <text x="105" y="-8" fontSize="12" textAnchor="middle" fill="#6b7280" fontWeight="700">ศูนย์สั่งงาน · บัญชี B</text>
        <path d="M60 18 H108 M60 26 H96" stroke="#7c7fb8" strokeWidth="2.5" className="st-typing" />
        <rect x="140" y="20" width="18" height="20" rx="3" fill="#fff" stroke={INK} strokeWidth="2" />
      </g>

      {/* ตู้ Drive */}
      <g transform="translate(410 200)">
        <rect x="0" y="0" width="140" height="232" rx="8" fill="#a9d6c6" stroke={INK} strokeWidth="2.5" />
        <text x="70" y="24" fontSize="13" textAnchor="middle" fontWeight="800" fill={INK}>Google Drive</text>
        {[
          ['TODO', q[0], 40],
          ['DOING', q[1], 102],
          ['DONE', q[2], 164],
        ].map(([lab, n, y]) => (
          <g key={lab as string} transform={`translate(12 ${y})`}>
            <rect width="116" height="52" rx="6" fill="#fff" stroke={INK} strokeWidth="2.2" />
            <text x="10" y="20" fontSize="11.5" fontWeight="800" fill={INK}>{lab}</text>
            <text x="104" y="20" fontSize="12" fontWeight="800" textAnchor="end" fill="#4b5563">{n}</text>
          </g>
        ))}
        <Paper className="st-tray-todo" x={70} y={72} />
        <Paper className="st-tray-done" x={70} y={196} />
      </g>

      {/* โต๊ะ edit + คอม */}
      <g transform="translate(640 300)">
        <rect x="0" y="40" width="230" height="16" rx="4" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="10" y="56" width="12" height="60" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="208" y="56" width="12" height="60" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="70" y="-52" width="120" height="82" rx="6" fill="#2f3550" stroke={INK} strokeWidth="2.5" />
        <rect x="78" y="-44" width="104" height="54" rx="3" fill="#121626" />
        <rect x="84" y="-36" width="60" height="6" rx="2" fill="#f2a33a" />
        <rect x="84" y="-26" width="80" height="6" rx="2" fill="#8fc3ea" />
        <rect x="84" y="-14" width="92" height="8" rx="2" fill="#2b3046" />
        <rect x="84" y="-14" width="92" height="8" rx="2" fill="#8bc542" className="st-progress" />
        <rect x="118" y="30" width="24" height="10" fill="#2f3550" stroke={INK} strokeWidth="2" />
        <text x="130" y="-62" fontSize="12" textAnchor="middle" fill="#6b7280" fontWeight="700">คอมของปัน · บัญชี frong</text>
      </g>

      {/* ปัน */}
      <g transform="translate(62 500)">
        <g transform="scale(1.25)">
          <Person />
          <g className="st-ping">
            <circle cx="23" cy="-45" r="10" fill="#8bc542" opacity=".35" />
          </g>
        </g>
        <Bubble text={short(`${pan.value}`, 18)} tone={pan.state || 'idle'} dy={-158} />
        <text x="0" y="16" fontSize="12" textAnchor="middle" fontWeight="800" fill={INK}>ปัน</text>
      </g>

      {/* Susan (เดินไปตู้ Drive) */}
      <g transform="translate(300 468)">
        <g className="st-walk-susan">
          <g className="st-bob">
            <g transform="scale(1.35)">
              <Rabbit />
              <Paper className="st-carry-susan" x={24} y={-40} />
            </g>
          </g>
          <Bubble text={short(susan.value, 18)} tone={susan.state || 'idle'} />
          <text x="0" y="20" fontSize="13" textAnchor="middle" fontWeight="800" fill={INK}>Susan</text>
        </g>
      </g>

      {/* edit (เดินไปตู้ Drive) */}
      <g transform="translate(670 468)">
        <g className="st-walk-edit">
          <g className="st-bob st-bob-edit">
            <g transform="scale(1.35)">
              <Cat />
              <Paper className="st-carry-edit" x={-26} y={-40} />
            </g>
          </g>
          <Bubble text={short(edit.value, 18)} tone={edit.state || 'idle'} />
          <text x="0" y="20" fontSize="13" textAnchor="middle" fontWeight="800" fill={INK}>edit</text>
        </g>
      </g>
      {/* ===== โซนทีม Ads ===== */}
      <rect x="950" y="0" width="310" height="520" fill="#f5f1ff" opacity=".55" />
      <line x1="950" y1="0" x2="950" y2="520" stroke={INK} strokeWidth="2.5" strokeDasharray="8 6" />
      <g transform="translate(975 36)">
        <rect width="190" height="44" rx="10" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <text x="16" y="28" fontSize="16" fontWeight="800" fill={INK}>ทีม Ads · Meta</text>
      </g>
      {/* กระดานกราฟ */}
      <g transform="translate(1000 94)">
        <rect width="220" height="120" rx="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <line x1="20" y1="100" x2="200" y2="100" stroke={INK} strokeWidth="2" />
        <rect x="34" y="62" width="22" height="38" fill="#c9b8f0" stroke={INK} strokeWidth="2" className="st-bar st-bar1" />
        <rect x="74" y="44" width="22" height="56" fill="#8fc3ea" stroke={INK} strokeWidth="2" className="st-bar st-bar2" />
        <rect x="114" y="30" width="22" height="70" fill="#8bc542" stroke={INK} strokeWidth="2" className="st-bar st-bar3" />
        <rect x="154" y="50" width="22" height="50" fill="#f2a33a" stroke={INK} strokeWidth="2" className="st-bar st-bar4" />
        <text x="110" y="20" fontSize="12" textAnchor="middle" fontWeight="700" fill="#6b7280">฿/แชท · เบอร์ · งบ</text>
      </g>
      {/* โต๊ะทีม Ads */}
      <g transform="translate(985 300)">
        <rect x="0" y="40" width="250" height="16" rx="4" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="10" y="56" width="12" height="60" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="228" y="56" width="12" height="60" fill="#e8d3b5" stroke={INK} strokeWidth="2.5" />
        <rect x="24" y="8" width="60" height="32" rx="4" fill="#2f3550" stroke={INK} strokeWidth="2.5" />
        <path d="M32 32 L44 22 L54 28 L72 14" fill="none" stroke="#8bc542" strokeWidth="3" strokeLinecap="round" />
        <rect x="170" y="18" width="40" height="22" rx="3" fill="#fff" stroke={INK} strokeWidth="2" />
        <text x="190" y="34" fontSize="11" textAnchor="middle" fontWeight="800" fill={INK}>฿</text>
      </g>

      {/* Alex (จิ้งจอก · วิเคราะห์) → เดินเอารายงานให้ Beary */}
      <g transform="translate(1010 468)">
        <g className="st-walk-alex">
          <g className="st-bob">
            <g transform="scale(1.3)">
              <Fox />
              <Paper className="st-carry-alex" x={24} y={-40} />
            </g>
          </g>
          <Bubble text={short(alex.value, 18)} tone={alex.state || 'idle'} dy={-232} dx={20} />
          <text x="0" y="20" fontSize="13" textAnchor="middle" fontWeight="800" fill={INK}>Alex</text>
        </g>
      </g>

      {/* Beary (หมี · วางงบ) */}
      <g transform="translate(1188 468)">
        <g className="st-bob st-bob-edit">
          <g transform="scale(1.3)">
            <Bear />
            <Paper className="st-hold-beary" x={-28} y={-40} />
          </g>
        </g>
        <Bubble text={short(beary.value, 18)} tone={beary.state || 'idle'} dy={-178} dx={-30} />
        <text x="0" y="20" fontSize="13" textAnchor="middle" fontWeight="800" fill={INK}>Beary</text>
      </g>
    </svg>
  );
}

const CSS = `
.st-wrap{display:grid;gap:16px}
.st-stage{border:1px solid var(--line);border-radius:16px;background:#fff;overflow:hidden}
.st-svg{display:block;width:100%;height:auto}
.st-hand,.st-ping,.st-progress,.st-bar{transform-box:fill-box}
.st-dot-working{fill:#38bdf8}.st-dot-waiting{fill:#f59e0b}.st-dot-done{fill:#22c55e}.st-dot-blocked{fill:#ef4444}.st-dot-idle{fill:#9ca3af}
.st-phone-screen{fill:#e5e7eb}
@media (prefers-reduced-motion: no-preference){
  .st-bob{animation:st-bob .5s ease-in-out infinite alternate}
  .st-bob-edit{animation-delay:.25s}
  .st-cloud{animation:st-cloud 14s ease-in-out infinite alternate}
  .st-hand{transform-origin:50% 100%;animation:st-spin 30s linear infinite}
  .st-typing{animation:st-blink 1s steps(2,end) infinite}
  .st-walk-susan{animation:st-susan 30s linear infinite}
  .st-walk-edit{animation:st-edit 30s linear infinite}
  .st-carry-susan{animation:st-carry-susan 30s linear infinite}
  .st-carry-edit{animation:st-carry-edit 30s linear infinite}
  .st-tray-todo{animation:st-tray-todo 30s linear infinite}
  .st-tray-done{animation:st-tray-done 30s linear infinite}
  .st-progress{transform-origin:0 50%;animation:st-progress 30s linear infinite}
  .st-ping{transform-origin:center;animation:st-ping 30s linear infinite}
  .st-phone-screen{animation:st-screen 30s linear infinite}
  .st-walk-alex{animation:st-alex 30s linear infinite}
  .st-carry-alex{animation:st-carry-alex 30s linear infinite}
  .st-hold-beary{animation:st-hold-beary 30s linear infinite}
  .st-bar{transform-origin:50% 100%;animation:st-bar 3s ease-in-out infinite alternate}
  .st-bar2{animation-delay:.4s}.st-bar3{animation-delay:.8s}.st-bar4{animation-delay:1.2s}
}
@media (prefers-reduced-motion: reduce){
  .st-carry-susan,.st-carry-edit,.st-tray-done,.st-ping,.st-carry-alex{opacity:0}
}
@keyframes st-bob{from{transform:translateY(0)}to{transform:translateY(-3px)}}
@keyframes st-cloud{from{transform:translateX(0)}to{transform:translateX(70px)}}
@keyframes st-spin{to{transform:rotate(360deg)}}
@keyframes st-blink{50%{opacity:.25}}
/* Susan: พิมพ์ 0–10% · เดินไปตู้ 10–20% · วางงาน 20–23% · กลับ 23–33% · รอ · ไปรับรายงาน 80–88% · กลับ 90–98% */
@keyframes st-susan{0%,10%{transform:translateX(0)}20%,23.3%{transform:translateX(100px)}33.3%,80%{transform:translateX(0)}88.3%,90%{transform:translateX(100px)}98%,100%{transform:translateX(0)}}
/* edit: รอ 0–33% · เดินไปตู้ 33–43% · หยิบ 43–47% · กลับ 47–57% · ตัดต่อ 57–70% · ไปส่ง 70–77% · วาง 77–80% · กลับ 80–87% */
@keyframes st-edit{0%,33.3%{transform:translateX(0)}43.3%,46.7%{transform:translateX(-100px)}56.7%,70%{transform:translateX(0)}76.7%,80%{transform:translateX(-100px)}86.7%,100%{transform:translateX(0)}}
@keyframes st-carry-susan{0%,9.9%{opacity:0}10%,21.6%{opacity:1}21.7%,89.9%{opacity:0}90%,97.9%{opacity:1}98%,100%{opacity:0}}
@keyframes st-tray-todo{0%,21.6%{opacity:0}21.7%,44.9%{opacity:1}45%,100%{opacity:0}}
@keyframes st-carry-edit{0%,44.9%{opacity:0}45%,56.6%{opacity:1}56.7%,69.9%{opacity:0}70%,78.2%{opacity:1}78.3%,100%{opacity:0}}
@keyframes st-tray-done{0%,78.2%{opacity:0}78.3%,89.9%{opacity:1}90%,100%{opacity:0}}
@keyframes st-progress{0%,56.7%{transform:scaleX(0)}70%,100%{transform:scaleX(1)}}
@keyframes st-ping{0%,96.9%{opacity:0;transform:scale(.6)}97%{opacity:1;transform:scale(.6)}100%{opacity:0;transform:scale(2.2)}}
/* Alex: ดูกราฟ 0–20% · เดินเอารายงานให้ Beary 20–35% · ส่ง 35–40% · กลับ 40–55% */
@keyframes st-alex{0%,20%{transform:translateX(0)}35%,40%{transform:translateX(80px)}55%,100%{transform:translateX(0)}}
@keyframes st-carry-alex{0%,19.9%{opacity:0}20%,37.4%{opacity:1}37.5%,100%{opacity:0}}
@keyframes st-hold-beary{0%,37.4%{opacity:0}37.5%,95%{opacity:1}95.1%,100%{opacity:0}}
@keyframes st-bar{from{transform:scaleY(.75)}to{transform:scaleY(1)}}
@keyframes st-screen{0%,96.9%{fill:#e5e7eb}97%,100%{fill:#8bc542}}
.st-legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:12.5px;color:var(--muted);padding:10px 16px;border-top:1px solid var(--line);background:var(--bg)}
.st-legend b{color:var(--navy)}
.st-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.st-card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--surface)}
.st-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
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
                <div>
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
