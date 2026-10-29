"use client";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, ListChecks, LogOut, RefreshCw, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { ExecSummary, Funnel, LeadRow, Me, SalesPerf, TodayItem } from "@/lib/types";
import TodayView from "./TodayView";
import LeadsView from "./LeadsView";
import DashboardView from "./DashboardView";
import LeadSheet from "./LeadSheet";

type Tab = "today" | "leads" | "dash";

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold">AI Sales Manager</h1>
      <p className="mt-1 text-sm text-muted">WULING CHONBURI — เข้าสู่ระบบด้วยบัญชีทีมขาย</p>
      <form className="mt-6 space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr(null);
        const m = await api.signIn?.(email, pw); setBusy(false);
        if (m) setErr(m); else onDone();
      }}>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" autoComplete="username" className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" />
        <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="รหัสผ่าน" autoComplete="current-password" className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" />
        {err && <div role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{err}</div>}
        <button disabled={busy} className="min-h-11 w-full rounded-xl bg-brand font-semibold text-white disabled:opacity-60">{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
      </form>
    </main>
  );
}

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("today");
  const [today, setToday] = useState<TodayItem[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [perf, setPerf] = useState<SalesPerf[]>([]);
  const [summary, setSummary] = useState<ExecSummary | null>(null);
  const [funnel, setFunnel] = useState<Funnel[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, l, p, s, f] = await Promise.all([api.today(), api.leads(), api.performance(), api.summary(), api.funnel()]);
      setToday(t); setLeads(l); setPerf(p); setSummary(s); setFunnel(f); setError(null); setUpdatedAt(new Date());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  const boot = useCallback(async () => {
    const m = await api.me().catch(() => null);
    setMe(m);
    if (m) { setTab("today"); await refresh(); }
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    api.me().catch(() => null).then(async (m) => {
      if (!alive) return;
      setMe(m);
      if (m) await refresh();
    });
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 120000);   // รีเฟรชทุก 2 นาที
    return () => { alive = false; clearInterval(timer); };
  }, [refresh]);

  if (me === undefined) return <main className="grid min-h-screen place-items-center text-muted">กำลังโหลด…</main>;
  if (!me) return api.mode === "live" ? <Login onDone={boot} /> : <main className="p-6">ไม่พบข้อมูลผู้ใช้</main>;

  const leadership = me.role !== "sales";
  const opened = leads.find((l) => l.lead_id === openId) ?? null;
  const tabs: Array<[Tab, string, typeof Users]> = [["today", "วันนี้", ListChecks], ["leads", leadership ? "ลีดทั้งหมด" : "ลีดของฉัน", Users], ["dash", leadership ? "ภาพรวม" : "ผลงาน", BarChart3]];

  return (
    <div className="mx-auto min-h-screen max-w-3xl pb-24">
      {api.mode === "demo" && (
        <div className="bg-warn-soft px-4 py-2 text-center text-xs text-warn">โหมดสาธิต — ข้อมูลตัวอย่าง ไม่ใช่ข้อมูลลูกค้าจริง · ปุ่มออกจากระบบ = สลับมุมมองเซลล์/ผู้จัดการ</div>
      )}
      <header className="flex items-center justify-between px-4 py-3">
        <div><div className="font-bold">AI Sales Manager</div><div className="text-xs text-muted">{me.name} · {me.role === "sales" ? "พนักงานขาย" : me.role === "sales_manager" ? "ผู้จัดการฝ่ายขาย" : me.role === "executive" ? "ผู้บริหาร" : "ผู้ดูแลระบบ"}</div></div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted sm:inline">{updatedAt ? `อัปเดต ${updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}` : ""}</span>
          <button aria-label="รีเฟรชข้อมูล" onClick={() => void refresh()} className="grid h-11 w-11 place-items-center rounded-full border border-line"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
        <button aria-label="ออกจากระบบ / สลับมุมมอง" onClick={async () => { await api.signOut(); await boot(); }} className="grid h-11 w-11 place-items-center rounded-full border border-line"><LogOut size={18} /></button>
        </div>
      </header>
      <main className="px-4">
        {error && <div role="alert" className="mb-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">โหลดข้อมูลไม่สำเร็จ: {error}</div>}
        {tab === "today" && <TodayView items={today} onOpen={setOpenId} showOwner={leadership} />}
        {tab === "leads" && <LeadsView leads={leads} onOpen={setOpenId} showOwner={leadership} />}
        {tab === "dash" && <DashboardView summary={summary} perf={perf} funnel={funnel} leads={leads} leadership={leadership} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-3xl grid-cols-3">
          {tabs.map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${tab === k ? "font-semibold text-brand" : "text-muted"}`}>
              <Icon size={20} />{label}
            </button>
          ))}
        </div>
      </nav>
      {opened && <LeadSheet lead={opened} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </div>
  );
}
