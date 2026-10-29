import type { LeadRow, Stage } from "./types";

const TZ = "Asia/Bangkok";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const labelFmt = new Intl.DateTimeFormat("th-TH", { timeZone: TZ, day: "numeric", month: "short" });
export const dayKey = (d: Date | string) => dayFmt.format(typeof d === "string" ? new Date(d) : d);

export interface DayPoint { key: string; label: string; value: number }

/** ลีดใหม่ต่อวัน ย้อนหลัง `days` วัน (นับตามวันที่สร้างลีด เวลาไทย) */
export function leadsPerDay(leads: LeadRow[], days: number, now = new Date()): DayPoint[] {
  const counts = new Map<string, number>();
  for (const l of leads) { const k = dayKey(l.created_at); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = dayKey(d);
    out.push({ key, label: labelFmt.format(d), value: counts.get(key) ?? 0 });
  }
  return out;
}

export const cumulative = (pts: DayPoint[], base = 0): DayPoint[] => {
  let s = base; return pts.map((p) => ({ ...p, value: (s += p.value) }));
};

export function countBetween(leads: LeadRow[], fromDaysAgo: number, toDaysAgo: number, now = new Date()) {
  const a = now.getTime() - fromDaysAgo * 86400000, b = now.getTime() - toDaysAgo * 86400000;
  return leads.filter((l) => { const t = Date.parse(l.created_at); return t >= a && t < b; }).length;
}

export function modelOf(l: LeadRow): string {
  const s = (l.interested_model ?? "").toLowerCase();
  if (/darion|daion|dar[i]?on|ดาเรียน|ดาริออน/.test(s)) return "Darion";
  if (/porta|พอร์ต/.test(s)) return "Porta";
  if (/bingo|บิงโก/.test(s)) return "Bingo";
  return "อื่นๆ / ไม่ระบุ";
}

export interface StageGroup { key: string; label: string; color: string; stages: Stage[] }
export const STAGE_GROUPS: StageGroup[] = [
  { key: "early", label: "ใหม่ / ติดต่อแล้ว", color: "#fbbf24", stages: ["NEW", "CONTACTED"] },
  { key: "follow", label: "ติดตาม", color: "#f59e0b", stages: ["FOLLOW_UP"] },
  { key: "appt", label: "นัดหมาย / ทดลองขับ", color: "#ea580c", stages: ["APPOINTMENT", "TEST_DRIVE"] },
  { key: "deal", label: "เสนอราคา / ต่อรอง", color: "#b45309", stages: ["QUOTATION", "NEGOTIATION"] },
  { key: "booked", label: "จองแล้ว / สินเชื่อ / รอส่งมอบ", color: "#7c2d12", stages: ["BOOKING", "FINANCE_PENDING", "FINANCE_APPROVED", "READY_TO_DELIVER"] },
  { key: "won", label: "ปิดการขาย", color: "#16a34a", stages: ["WON"] },
  { key: "lost", label: "เสียโอกาส", color: "#52525b", stages: ["LOST"] },
];
export function stageBreakdown(leads: LeadRow[]) {
  return STAGE_GROUPS.map((g) => ({ ...g, value: leads.filter((l) => g.stages.includes(l.stage)).length }));
}

export const initials = (s: string | null) => (s ?? "?").trim().replace(/^คุณ\s*/, "").slice(0, 2).toUpperCase();
