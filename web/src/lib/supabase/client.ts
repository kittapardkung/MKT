import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client สำหรับฝั่ง browser — ใช้ publishable key เท่านั้น
 * ข้อมูลที่อ่าน/เขียนผ่านตัวนี้ถูกคุมด้วย RLS policy เสมอ
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
