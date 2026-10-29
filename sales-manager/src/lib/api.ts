import { createDemoApi } from "./demo";
import { createLiveApi } from "./live";
import type { Api } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// ไม่ตั้ง env = โหมดสาธิต (ข้อมูลตัวอย่าง)
export const api: Api = url && key ? createLiveApi(url, key) : createDemoApi();
