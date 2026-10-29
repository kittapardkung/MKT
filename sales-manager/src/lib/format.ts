import type { Stage } from "./types";

const TZ = "Asia/Bangkok";
export const STAGE_TH: Record<Stage, string> = {
  NEW: "ใหม่", CONTACTED: "ติดต่อแล้ว", FOLLOW_UP: "ติดตาม", APPOINTMENT: "นัดหมาย", TEST_DRIVE: "ทดลองขับ",
  QUOTATION: "เสนอราคา", BOOKING: "จอง", FINANCE_APPROVED: "สินเชื่ออนุมัติ", WON: "ปิดการขาย", LOST: "เสียโอกาส",
};
export const FLAG_TH: Record<string, string> = {
  UNASSIGNED: "ยังไม่มีผู้รับผิดชอบ", NOT_ACCEPTED: "ยังไม่กดรับลีด", FIRST_CONTACT_OVERDUE: "เลยกำหนดติดต่อครั้งแรก",
  NO_NEXT_FOLLOWUP: "ไม่มีนัดติดตามครั้งถัดไป", OVERDUE_FOLLOWUP: "เลยกำหนดติดตาม", STALE: "ไม่มีความเคลื่อนไหวนาน",
  LOST_WITH_SIGNAL: "LOST แต่ลูกค้ายังทักมา", DATA_CONFLICT: "ข้อมูลขัดแย้ง",
};
export const EVENT_TH: Record<string, string> = {
  CUSTOMER_MESSAGE: "ลูกค้าส่งข้อความ", ASSIGNED: "มอบหมายลีด", ACCEPTED: "เซลล์กดรับลีด", CONTACT_ATTEMPT: "พยายามติดต่อ",
  CONTACT_SUCCESS: "ติดต่อสำเร็จ", STAGE_CHANGE: "เปลี่ยนสถานะ", NOTE: "บันทึก", REASSIGNED: "เปลี่ยนผู้รับผิดชอบ", AI: "AI แนะนำ",
};
export const OUTCOME_TH: Record<string, string> = {
  CONNECTED: "คุยได้", REPLIED: "ลูกค้าตอบกลับ", NO_ANSWER: "ไม่รับสาย", MESSAGE_SENT: "ส่งข้อความแล้ว (ยังไม่ตอบ)", WRONG_NUMBER: "เบอร์ผิด",
};

export const fmtDateTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

export function fmtOverdue(min: number) {
  if (min < 60) return `${min} นาที`;
  if (min < 1440) return `${Math.floor(min / 60)} ชม.`;
  return `${Math.floor(min / 1440)} วัน`;
}

export const maskPhone = (p: string | null) => (p ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : "—");
