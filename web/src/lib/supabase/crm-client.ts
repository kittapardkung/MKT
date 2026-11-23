import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client สำหรับ CRM ลีด (โปรเจกต์ wuling-service-management) — ใช้ publishable key เท่านั้น
 * อ่านผ่าน view สาธารณะ public.leads_compat (ไม่ใช่ตาราง crm.leads ตรงๆ ซึ่งถูกจำกัดด้วย RLS เฉพาะทีมขาย)
 */
export function createCrmClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_CRM_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_CRM_SUPABASE_PUBLISHABLE_KEY!
  );
}
