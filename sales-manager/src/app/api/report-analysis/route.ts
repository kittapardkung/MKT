import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// สร้างบทวิเคราะห์ AI จากตัวเลขสรุป (ไม่มีชื่อ/เบอร์ลูกค้า) — เฉพาะผู้จัดการ/ผู้บริหารที่ล็อกอิน
// ใช้สิทธิ์ผู้ใช้ (JWT) กับ Supabase เท่านั้น ไม่มี service key; ANTHROPIC_API_KEY อยู่ฝั่งเซิร์ฟเวอร์ใน Vercel env
export const maxDuration = 120;

const MODEL = "claude-opus-5-5";
const COOLDOWN_MS = 10 * 60 * 1000;   // กันกดซ้ำ/ใช้ค่า API เกินจำเป็น

const SYSTEM = `คุณคือที่ปรึกษาฝ่ายขายของศูนย์รถยนต์ไฟฟ้า WULING Chonburi เขียนบทวิเคราะห์รายงานฝ่ายขายให้ผู้จัดการ/เจ้าของ
ข้อมูลที่ได้รับเป็น JSON ตัวเลขรวมจากระบบ Sale Lead (ไม่มีชื่อหรือเบอร์ลูกค้า) เวลาในข้อมูลเป็น UTC เวลาไทย = UTC+7
ตารางตัวเลขและสถานะไฟแสดงในแอปอยู่แล้ว หน้าที่ของคุณคือบอกว่าตัวเลขหมายความว่าอะไรและควรทำอะไร ห้ามเล่าตัวเลขซ้ำยาวๆ

กติกา
1. ใช้เฉพาะตัวเลขใน JSON ห้ามเดา ข้อมูลไม่พอให้บอกว่าขาดอะไร
2. ห้ามตัดสินเรื่องการค้า (ราคา ส่วนลด เปลี่ยนเจ้าของลีด อนุมัติ) ให้เสนอเป็น "ข้อเสนอให้ผู้จัดการพิจารณา" เท่านั้น
3. ห้ามใส่ชื่อ/เบอร์ลูกค้า อ้างลีดด้วย lead_code เท่านั้น
4. ห้ามสรุปว่าเซลล์คนไหนดีหรือแย่จากตัวเลขเดียว เทียบโดยดูจำนวนลีด สัดส่วนลีด HOT และช่วงเวลาที่ลีดเข้า
5. จอง/สินเชื่อ/ส่งมอบ/ปิดการขาย นับเฉพาะรายการที่ยืนยันแล้ว
6. ตัวเลขบันทึกผลติดต่อคือที่บันทึกในระบบ ไม่ใช่จำนวนสายจริง บันทึกน้อยให้เขียนว่า "ยังไม่ได้บันทึก" ไม่ใช่ "ไม่ทำงาน"
7. งานค้างลีดเก่า (ก่อน 3 พ.ย. 2026) แยกจากลีดใหม่ ให้ประเมินวินัยจากลีดใหม่เป็นหลัก
8. ภาษาไทย ประโยคสั้น น้ำเสียงให้เกียรติ ใช้เพื่อพัฒนาคน ไม่ใช้อีโมจิและ markdown

รูปแบบคำตอบ: ทุกหัวข้อเป็น bullet สั้น แต่ละข้อ 1 ประโยค ไม่เกิน 110 ตัวอักษร บอก "ข้อเท็จจริง + ความหมาย" พร้อมตัวเลขและหน่วย ห้ามเขียนเป็นย่อหน้ายาว ห้ามซ้ำตัวเลขเดียวกันหลายข้อ
- overview.headline: 1 ประโยคสรุปสถานการณ์ทีม
- overview.observations: 4-5 ข้อ "สิ่งที่เห็น"
- overview.decisions: 3 ข้อ เรียงตามความสำคัญ action = สิ่งที่ควรทำ, owner = ผู้รับผิดชอบ (เช่น "ผู้จัดการ", "เจ้าของ", หรือ code เซลล์)
- overview.gaps: 0-2 ข้อ ข้อมูลที่ขาดหรือน่าสงสัย (ไม่มีให้ส่งอาร์เรย์ว่าง)
- people: เซลล์ละ 1 รายการ code ตรงกับ sales[].code
  quant 3 ข้อ (ปริมาณงานเทียบทีมและช่วงก่อนหน้า) | quality 4 ข้อ จาก sales_quality เช่น ความเร็วตอบสนอง สัดส่วนติดต่อสำเร็จต่อไม่รับสาย ความต่อเนื่องรายวัน การตั้งนัดติดตามต่อ การไล่ระดับความร้อนของลีด การเลื่อนสถานะ
  strengths 2 ข้อ | improve 2 ข้อ | coaching 3 ข้อ (สิ่งที่ผู้จัดการควรคุยหรือช่วย ไม่ใช่คำสั่ง)
  follow_leads: lead_code ไม่เกิน 5 รายการจาก risk_leads ของเซลล์นั้น (ไม่มีให้ส่งอาร์เรย์ว่าง)`;

const strs = { type: "array", items: { type: "string" } } as const;
const SCHEMA = {
  type: "object",
  properties: {
    overview: {
      type: "object",
      properties: {
        headline: { type: "string" }, observations: strs,
        decisions: { type: "array", items: { type: "object", properties: { action: { type: "string" }, owner: { type: "string" } }, required: ["action", "owner"], additionalProperties: false } },
        gaps: strs,
      },
      required: ["headline", "observations", "decisions", "gaps"], additionalProperties: false,
    },
    people: {
      type: "array",
      items: {
        type: "object",
        properties: { code: { type: "string" }, quant: strs, quality: strs, strengths: strs, improve: strs, coaching: strs, follow_leads: strs },
        required: ["code", "quant", "quality", "strengths", "improve", "coaching", "follow_leads"], additionalProperties: false,
      },
    },
  },
  required: ["overview", "people"],
  additionalProperties: false,
} as const;

type Parsed = { overview: { headline: string; observations: string[]; decisions: Array<{ action: string; owner: string }>; gaps: string[] }; people: Array<Record<string, unknown> & { code: string }> };
const list = (v: unknown, n = 8): string[] => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 300)).slice(0, n) : []);

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return json({ error: "ไม่ได้ตั้งค่า Supabase" }, 503);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Vercel" }, 503);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "ต้องเข้าสู่ระบบก่อน" }, 401);
  let days = 7;
  try { const b = await req.json(); days = Math.min(90, Math.max(1, Number(b?.days) || 7)); } catch { /* ใช้ค่าเริ่มต้น */ }

  const sb = createClient(url, key, { db: { schema: "crm" }, auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });

  // สิทธิ์: get_weekly_report ปฏิเสธถ้าไม่ใช่ผู้จัดการ/ผู้บริหาร/แอดมิน
  const rep = await sb.rpc("get_weekly_report", { p_days: days });
  if (rep.error) return json({ error: rep.error.message.includes("forbidden") ? "เฉพาะผู้จัดการ/ผู้บริหารเท่านั้น" : rep.error.message }, rep.error.message.includes("forbidden") ? 403 : 500);
  const report = rep.data as { sales?: Array<{ code: string }> };

  // กันกดซ้ำ: ถ้าเพิ่งสร้างไม่ถึง 10 นาที ให้ใช้ของเดิม
  const last = await sb.from("report_snapshots").select("*").order("generated_at", { ascending: false }).limit(1).maybeSingle();
  if (last.data && Date.now() - new Date(last.data.generated_at).getTime() < COOLDOWN_MS && last.data.overview_text) return json({ snapshot: last.data, cached: true });

  const anthropic = new Anthropic();
  let parsed: Parsed;
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `ช่วงรายงาน ${days} วันล่าสุด\n\nข้อมูล JSON:\n${JSON.stringify(report)}` }],
    });
    if (msg.stop_reason === "refusal") return json({ error: "AI ปฏิเสธการสร้างบทวิเคราะห์ ลองใหม่อีกครั้ง" }, 502);
    const text = msg.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    parsed = JSON.parse(text);
  } catch (e) {
    const m = e instanceof Anthropic.APIError ? `AI error ${e.status}` : "สร้างบทวิเคราะห์ไม่สำเร็จ";
    return json({ error: m }, 502);
  }

  const known = new Set((report.sales ?? []).map((x) => x.code));
  const ov = parsed.overview;
  // เก็บบทวิเคราะห์เป็นโครงสร้างใน person_texts (jsonb) — คีย์ _overview = ภาพรวม; overview_text = หัวข้อสั้น (ใช้กับรายงานรุ่นเก่า/ค้นหา)
  const persons: Record<string, unknown> = {
    _overview: { headline: String(ov.headline ?? "").slice(0, 400), observations: list(ov.observations), decisions: (ov.decisions ?? []).slice(0, 5).map((d) => ({ action: String(d.action).slice(0, 300), owner: String(d.owner).slice(0, 60) })), gaps: list(ov.gaps, 4) },
  };
  for (const p of parsed.people ?? []) {
    if (known.has(p.code)) persons[p.code] = { quant: list(p.quant), quality: list(p.quality), strengths: list(p.strengths, 4), improve: list(p.improve, 4), coaching: list(p.coaching, 5), follow_leads: list(p.follow_leads, 8) };
  }

  const saved = await sb.rpc("save_report_snapshot", { p_days: days, p_report: report, p_overview: String(ov.headline ?? "").slice(0, 400), p_person_texts: persons });
  if (saved.error) return json({ error: saved.error.message }, 500);
  const snap = await sb.from("report_snapshots").select("*").eq("id", saved.data).maybeSingle();
  return json({ snapshot: snap.data, cached: false });
}
