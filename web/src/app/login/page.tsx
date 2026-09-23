'use client';

import { useActionState } from 'react';
import { signInWithMagicLink } from '@/lib/actions/auth';

const initialState = { error: null as string | null, sent: false };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInWithMagicLink, initialState);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">MKT Content</div>
        <div className="brand-sub">ระบบจัดการคอนเทนต์การตลาด</div>

        {state.sent ? (
          <div className="notice" style={{ marginTop: 18 }}>
            ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว — เปิดอีเมลแล้วกดลิงก์เพื่อเข้าใช้งาน
          </div>
        ) : (
          <form action={formAction} style={{ marginTop: 18 }}>
            <div className="field">
              <label>อีเมล</label>
              <input type="email" name="email" placeholder="name@company.com" required autoFocus />
            </div>
            {state.error && (
              <div className="error show" style={{ marginTop: 11 }}>{state.error}</div>
            )}
            <button className="btn primary" type="submit" disabled={pending} style={{ width: '100%', marginTop: 14 }}>
              {pending ? 'กำลังส่ง...' : 'ส่งลิงก์เข้าสู่ระบบ'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
