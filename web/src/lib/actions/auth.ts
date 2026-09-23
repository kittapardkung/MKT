'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function signInWithMagicLink(
  _prevState: { error: string | null; sent: boolean },
  formData: FormData
): Promise<{ error: string | null; sent: boolean }> {
  const email = String(formData.get('email') || '').trim();
  if (!email) return { error: 'กรุณากรอกอีเมล', sent: false };

  const origin = (await headers()).get('origin');
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) return { error: error.message, sent: false };
  return { error: null, sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
