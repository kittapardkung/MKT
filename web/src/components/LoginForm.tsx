'use client';

import { useActionState, useState } from 'react';
import { Zap } from 'lucide-react';
import { signInWithMagicLink } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm({ initialError }: { initialError: string | null }) {
  const [state, formAction, pending] = useActionState(signInWithMagicLink, {
    error: initialError,
    sent: false,
  });
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setGooglePending(true);
    setGoogleError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) {
      setGoogleError(error.message);
      setGooglePending(false);
    }
    // สำเร็จ: เบราว์เซอร์จะถูกพาไปหน้า Google ให้เลือกบัญชีเอง ไม่ต้องทำอะไรต่อ
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <span className="icon"><Zap size={18} fill="currentColor" /></span>
          MKT Content
        </div>
        <div className="brand-sub">ระบบจัดการคอนเทนต์การตลาด</div>

        {state.sent ? (
          <div className="notice" style={{ marginTop: 18 }}>
            ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว — เปิดอีเมลแล้วกดลิงก์เพื่อเข้าใช้งาน
          </div>
        ) : (
          <>
            <button
              type="button"
              className="btn"
              onClick={signInWithGoogle}
              disabled={googlePending}
              style={{ width: '100%', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <GoogleIcon />
              {googlePending ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}
            </button>
            {googleError && (
              <div className="error show" style={{ marginTop: 11 }}>{googleError}</div>
            )}

            <div className="login-divider"><span>หรือ</span></div>

            <form action={formAction}>
              <div className="field">
                <label>อีเมล</label>
                <input type="email" name="email" placeholder="name@company.com" required />
              </div>
              {state.error && (
                <div className="error show" style={{ marginTop: 11 }}>{state.error}</div>
              )}
              <button className="btn primary" type="submit" disabled={pending} style={{ width: '100%', marginTop: 14 }}>
                {pending ? 'กำลังส่ง...' : 'ส่งลิงก์เข้าสู่ระบบ'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.8-.4-4.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.5 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 15.6 3 8.4 7.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 36 26.9 37 24 37c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C8.4 40.1 15.6 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.6 5.6C41.6 36.5 45 30.9 45 24c0-1.4-.1-2.8-.4-4.5z" />
    </svg>
  );
}
