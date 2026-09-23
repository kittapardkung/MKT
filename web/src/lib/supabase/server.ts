import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Supabase client สำหรับฝั่ง server (Server Components / Route Handlers / Server Actions)
 * ผูก session ของผู้ใช้ที่ล็อกอินผ่าน cookie — อ่าน/เขียนยังถูกคุมด้วย RLS ตาม role ของผู้ใช้คนนั้น
 * ใช้ publishable key เท่านั้น (ไม่ใช่ secret key)
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // เรียกจาก Server Component (ไม่ใช่ Server Action/Route Handler) จะ set cookie ไม่ได้
            // ปล่อยผ่านได้ เพราะ middleware จะรีเฟรช session ให้แทน
          }
        },
      },
    }
  );
}

/**
 * Supabase client สิทธิ์เต็ม (bypass RLS ทุกตาราง) — ใช้ได้เฉพาะใน Route Handler/Server Action
 * ที่ไม่ต้องอิง session ผู้ใช้ เช่น สคริปต์ย้ายข้อมูล, งานเบื้องหลัง, cron job
 * ห้าม import ไฟล์นี้จากฝั่ง client เด็ดขาด
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
