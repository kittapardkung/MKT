import type { Stage } from "./types";

const TZ = "Asia/Bangkok";
export const STAGE_TH: Record<Stage, string> = {
  NEW: "ใหม่", CONTACTED: "ติดต่อแล้ว", FOLLOW_UP: "ติดตาม", APPOINTMENT: "นัดหมาย", TEST_DRIVE: "ทดลองขับ",
  QUOTATION: "เสนอราคา", NEGOTIATION: "ต่อรอง", BOOKING: "จองแล้ว", FINANCE_PENDING: "รอผลสินเชื่อ",
  FINANCE_APPROVED: "สินเชื่ออนุมัติ", READY_TO_DELIVER: "พร้อมส่งมอบ", WON: "ปิดการขาย", LOST: "เสียโอกาส",
};
export const STAGE_ORDER: Stage[] = ["NEW", "CONTACTED", "FOLLOW_UP", "APPOINTMENT", "TEST_DRIVE", "QUOTATION", "NEGOTIATION", "BOOKING", "FINANCE_PENDING", "FINANCE_APPROVED", "READY_TO_DELIVER", "WON", "LOST"];

/** คู่มือความหมายสถานะ — แสดงตอนเลือกสถานะ เพื่อกันเซลล์เลือกผิด */
export interface StatusGuide { meaning: string; todo: string; notWhen: string; evidence?: string }
export const STATUS_GUIDE: Record<Stage, StatusGuide> = {
  NEW: { meaning: "ลูกค้าใหม่เข้าระบบ ยังไม่ได้ติดต่อ", todo: "รับ Lead และติดต่อทันที", notWhen: "ถ้าติดต่อลูกค้าได้แล้ว ให้เปลี่ยนเป็น “ติดต่อแล้ว”" },
  CONTACTED: { meaning: "ติดต่อหรือสนทนากับลูกค้าได้แล้ว", todo: "เก็บข้อมูลความต้องการ", notWhen: "โทรแล้วไม่รับสาย ยังไม่นับเป็นติดต่อแล้ว — ให้บันทึกเป็นพยายามติดต่อ" },
  FOLLOW_UP: { meaning: "ลูกค้ายังไม่ตัดสินใจ อยู่ระหว่างติดตาม", todo: "กำหนดวันติดตามครั้งถัดไป", notWhen: "ถ้าลูกค้านัดวันเข้าศูนย์แล้ว ให้ใช้ “นัดหมาย”" },
  APPOINTMENT: { meaning: "ลูกค้านัดหมายเข้าศูนย์หรือพบฝ่ายขายแล้ว", todo: "ยืนยันวัน เวลา และสถานที่", notWhen: "ต้องมีวันนัดที่ชัดเจน — ลูกค้าบอกว่า “จะแวะไป” ยังไม่ใช่นัดหมาย" },
  TEST_DRIVE: { meaning: "ลูกค้าได้ทดลองขับรถแล้ว", todo: "สอบถามความพึงพอใจและเสนอราคา", notWhen: "ยังไม่ได้ขับจริง ให้ใช้ “นัดหมาย” (แม้จะนัดทดลองขับไว้ก็ตาม)" },
  QUOTATION: { meaning: "ส่งใบเสนอราคา เงื่อนไขผ่อน หรือข้อเสนอให้ลูกค้าแล้ว", todo: "ติดตามผลการพิจารณา", notWhen: "ถ้าลูกค้ากำลังต่อรองราคา/โปรโมชั่น ให้ใช้ “ต่อรอง”" },
  NEGOTIATION: { meaning: "อยู่ระหว่างต่อรองราคา โปรโมชั่น หรือเงื่อนไข", todo: "เจรจาเพื่อปิดการขาย", notWhen: "ถ้าลูกค้าตกลงและวางเงินจองแล้ว ให้กด “จองแล้ว”" },
  BOOKING: { meaning: "ลูกค้ายืนยันจองรถแล้ว (มีใบจองและเงินจอง)", todo: "บันทึกใบจองและรับเงินจอง", notWhen: "ลูกค้าบอกว่า “จะจอง” แต่ยังไม่วางเงิน ยังไม่ใช่จอง — ใช้ “ต่อรอง”",
    evidence: "ต้องกดปุ่ม “จองแล้ว” พร้อมเลขที่ใบจอง และผู้จัดการตรวจสอบหลักฐาน" },
  FINANCE_PENDING: { meaning: "ยื่นสินเชื่อแล้ว รอผลพิจารณา", todo: "ติดตามไฟแนนซ์และเอกสาร", notWhen: "ลูกค้าซื้อเงินสด ไม่ต้องใช้สถานะนี้", evidence: "ต้องมีการจองที่ผู้จัดการตรวจสอบแล้ว" },
  FINANCE_APPROVED: { meaning: "สินเชื่อได้รับอนุมัติแล้ว", todo: "ยืนยันเงื่อนไขและเตรียมรถ", notWhen: "ยังรอผลอยู่ ให้ใช้ “รอผลสินเชื่อ”", evidence: "ต้องมีการจองที่ผู้จัดการตรวจสอบแล้ว" },
  READY_TO_DELIVER: { meaning: "รถและเอกสารพร้อมส่งมอบ", todo: "นัดหมายวันรับรถ", notWhen: "รถหรือเอกสารยังไม่พร้อม ให้คงสถานะเดิม", evidence: "ต้องมีการจองที่ผู้จัดการตรวจสอบแล้ว" },
  WON: { meaning: "ส่งมอบรถสำเร็จ ปิดการขาย", todo: "บันทึกยอดขายและดูแลหลังการขาย", notWhen: "ยังไม่ได้ส่งมอบรถ ห้ามใช้ — ใช้ “พร้อมส่งมอบ”", evidence: "ต้องมีการจองที่ผู้จัดการตรวจสอบแล้ว" },
  LOST: { meaning: "ไม่สามารถปิดการขายได้", todo: "บันทึกเหตุผลที่เสียลูกค้า", notWhen: "แค่ลูกค้ายังไม่รับสายหรือยังไม่ตอบ ห้ามใช้ — คง “ติดตาม” ไว้", evidence: "ต้องระบุเหตุผล" },
};

/** แปลข้อความ error ของฐานข้อมูลเป็นภาษาที่เซลล์เข้าใจ */
export function friendlyError(msg: string): string {
  if (msg.startsWith("evidence_required")) return "สถานะนี้ต้องมีการจองที่ผู้จัดการตรวจสอบแล้วก่อน — กดปุ่ม “จองแล้ว” ให้ครบ แล้วให้ผู้จัดการตรวจสอบหลักฐาน";
  if (msg.startsWith("lost_reason_required")) return "ต้องระบุเหตุผลที่เสียลูกค้า";
  if (msg.startsWith("forbidden")) return "คุณไม่มีสิทธิ์ทำรายการนี้กับลีดนี้";
  if (msg.startsWith("lead_closed")) return "ลีดนี้ปิดการขายแล้ว (WON) — ติดต่อผู้จัดการเพื่อแก้ไข";
  if (msg.startsWith("phone_invalid")) return "เบอร์โทรไม่ถูกต้อง (ต้องเป็นเบอร์ไทย 9–10 หลัก)";
  if (msg.startsWith("phone_duplicate")) return "เบอร์นี้มีอยู่ในลีดอื่นแล้ว";
  return msg.replace(/^[a-z_]+: /, "");
}

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
