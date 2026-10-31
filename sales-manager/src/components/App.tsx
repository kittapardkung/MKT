"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, BookmarkCheck, ChevronDown, KanbanSquare, LayoutDashboard, ListChecks, LogOut, RefreshCw, Search, Settings, Sparkles, Star, Truck, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { Booking, DeliveryInput, DeliveryStep, ExecSummary, LeadRow, Me, SalesPerf, TodayItem } from "@/lib/types";
import { friendlyError } from "@/lib/format";
import TodayView from "./TodayView";
import LeadsView from "./LeadsView";
import DashboardView from "./DashboardView";
import LeadSheet from "./LeadSheet";
import NewLeadsView, { isFreshLead } from "./NewLeadsView";
import BookedView from "./BookedView";
import DeliveryView from "./DeliveryView";
import TargetsView from "./TargetsView";

type Tab = "dash" | "today" | "new" | "leads" | "targets" | "booked" | "delivery";
const ROLE_TH: Record<Me["role"], string> = { sales: "พนักงานขาย", sales_manager: "ผู้จัดการฝ่ายขาย", executive: "ผู้บริหาร", admin: "ผู้ดูแลระบบ" };

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex items-center gap-3"><Logo /><div><h1 className="text-xl font-bold">WULING Sale Lead</h1><p className="text-sm text-muted">WULING CHONBURI</p></div></div>
      <form className="card space-y-3 p-5" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr(null);
        const m = await api.signIn?.(email, pw); setBusy(false);
        if (m) setErr(m); else onDone();
      }}>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" autoComplete="username" className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" />
        <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="รหัสผ่าน" autoComplete="current-password" className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" />
        {err && <div role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{err}</div>}
        <button disabled={busy} className="btn-dark min-h-11 w-full disabled:opacity-60">{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
      </form>
    </main>
  );
}

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="grid h-10 w-11 place-items-center" aria-hidden="true"><img src="/logo-mark.svg" alt="" className="h-full w-full object-contain" /></span>;
}

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("today");
  const [today, setToday] = useState<TodayItem[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [perf, setPerf] = useState<SalesPerf[]>([]);
  const [summary, setSummary] = useState<ExecSummary | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(30);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, l, p, s, bk] = await Promise.all([api.today(), api.leads(), api.performance(), api.summary(), api.bookings()]);
      setToday(t); setLeads(l); setPerf(p); setSummary(s); setBookings(bk); setError(null); setUpdatedAt(new Date());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);

  const boot = useCallback(async () => {
    const m = await api.me().catch(() => null);
    setMe(m);
    if (m) { setTab(m.role === "sales" ? "today" : "dash"); await refresh(); }
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    api.me().catch(() => null).then(async (m) => {
      if (!alive) return;
      setMe(m);
      if (m) { setTab(m.role === "sales" ? "today" : "dash"); await refresh(); }
    });
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 120000);   // รีเฟรชทุก 2 นาที
    return () => { alive = false; clearInterval(timer); };
  }, [refresh]);

  if (me === undefined) return <main className="grid min-h-screen place-items-center text-muted">กำลังโหลด…</main>;
  if (!me) return api.mode === "live" ? <Login onDone={boot} /> : <main className="p-6">ไม่พบข้อมูลผู้ใช้</main>;

  const leadership = me.role !== "sales";
  const opened = leads.find((l) => l.lead_id === openId) ?? null;
  const overdue = today.filter((t) => t.overdue_minutes > 0).length;
  const freshCount = leads.filter((l) => isFreshLead(l) && !l.dormant).length;
  const pendingBookings = bookings.filter((b) => !b.verified).length;
  const nav: Array<{ k: Tab; label: string; short: string; Icon: typeof Users; badge?: number }> = [
    { k: "dash", label: leadership ? "ภาพรวม" : "ผลงาน", short: leadership ? "ภาพรวม" : "ผลงาน", Icon: LayoutDashboard },
    { k: "today", label: "วันนี้", short: "วันนี้", Icon: ListChecks, badge: overdue },
    { k: "new", label: "LEAD ใหม่", short: "ใหม่", Icon: UserPlus, badge: freshCount },
    { k: "leads", label: leadership ? "ลีดทั้งหมด" : "ลีดของฉัน", short: "ลีด", Icon: Users },
    { k: "targets", label: "ลูกค้าเป้าหมาย", short: "เป้าหมาย", Icon: Star },
    { k: "booked", label: "ลูกค้าจองแล้ว", short: "จองแล้ว", Icon: BookmarkCheck, badge: leadership ? pendingBookings : 0 },
    { k: "delivery", label: "สถานะส่งมอบ", short: "ส่งมอบ", Icon: Truck },
  ];
  const toggleStar = async (id: string, on: boolean, note?: string) => {
    try { await api.setStar(id, on, note); await refresh(); } catch (e) { setError(friendlyError(e instanceof Error ? e.message : String(e))); }
  };
  const deliveryStep = async (dealId: string, step: DeliveryStep, i?: DeliveryInput) => { await api.setDeliveryStep(dealId, step, i); await refresh(); };
  const verifyBooking = async (dealId: string) => { await api.verifyBooking(dealId); await refresh(); };
  const soon = [{ label: "Pipeline Kanban", Icon: KanbanSquare }, { label: "AI Insights", Icon: Sparkles }, { label: "ตั้งค่า SLA", Icon: Settings }];
  const go = (k: Tab) => setTab(k);
  const logout = async () => { await api.signOut(); await boot(); };
  const stamp = updatedAt ? updatedAt.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "";

  return (
    <div className="min-h-screen overflow-x-hidden lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-side p-4 text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex items-center gap-3 px-2 py-3"><Logo /><div><div className="text-lg font-bold leading-tight">Sale Lead</div><div className="text-xs text-white/60">WULING CHONBURI</div></div></div>
        <nav className="mt-4 space-y-1" aria-label="เมนูหลัก">
          {nav.map(({ k, label, Icon, badge }) => (
            <button key={k} onClick={() => go(k)} aria-current={tab === k ? "page" : undefined}
              className={`focus-ring flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ${tab === k ? "bg-white/10 font-semibold text-white" : "text-white/70 hover:bg-white/5"}`}>
              <Icon size={18} className={tab === k ? "text-accent" : ""} /><span className="flex-1">{label}</span>
              {!!badge && <span className="num rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-black">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">เร็วๆ นี้</div>
        <ul className="mt-1 space-y-1">{soon.map(({ label, Icon }) => (<li key={label} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-white/35"><Icon size={18} />{label}</li>))}</ul>
        <div className="mt-auto rounded-2xl bg-white/5 p-3">
          <div className="text-xs text-white/60">ข้อมูลล่าสุด {stamp || "—"}</div>
          <button onClick={() => void refresh()} className="focus-ring mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-black"><RefreshCw size={15} className={loading ? "animate-spin" : ""} />รีเฟรชข้อมูล</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-24 lg:pb-8">
        {api.mode === "demo" && <div className="bg-warn-soft px-4 py-2 text-center text-xs text-warn">โหมดสาธิต — ข้อมูลตัวอย่าง ไม่ใช่ข้อมูลลูกค้าจริง · ปุ่มออกจากระบบ = สลับมุมมองเซลล์/ผู้จัดการ</div>}
        <header className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 lg:px-8 lg:py-5">
          <div className="flex items-center gap-2 lg:hidden"><Logo /><span className="font-bold">Sale Lead</span></div>
          <label className="card focus-within:ring-2 focus-within:ring-accent hidden min-h-11 max-w-md flex-1 items-center gap-2 px-4 lg:flex">
            <Search size={16} className="text-muted" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setTab("leads"); }} placeholder="ค้นหาชื่อ เบอร์โทร รหัสลีด รุ่นรถ…" className="min-h-11 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <div className="ml-auto flex items-center gap-2">
            {tab === "dash" && (
              <label className="card relative hidden min-h-11 items-center pl-3 pr-8 text-sm sm:flex">
                <span className="sr-only">ช่วงเวลา</span>
                <select value={range} onChange={(e) => setRange(Number(e.target.value))} className="min-h-11 appearance-none bg-transparent pr-2 outline-none">
                  <option value={30}>30 วันล่าสุด</option><option value={60}>60 วันล่าสุด</option><option value={90}>90 วันล่าสุด</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 text-muted" />
              </label>
            )}
            <button aria-label="รีเฟรชข้อมูล" onClick={() => void refresh()} className="card focus-ring grid h-11 w-11 place-items-center lg:hidden"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
            <button aria-label={`แจ้งเตือน งานเลยกำหนด ${overdue} งาน`} onClick={() => go("today")} className="card focus-ring relative grid h-11 w-11 place-items-center">
              <Bell size={18} />{overdue > 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-surface" />}
            </button>
            <div className="card flex min-h-11 items-center gap-2 py-1 pl-1 pr-1 lg:pr-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-dark text-sm font-bold text-dark-ink">{me.name.slice(0, 1)}</span>
              <span className="hidden text-left leading-tight lg:block"><span className="block text-sm font-semibold">{me.name}</span><span className="block text-[11px] text-muted">{ROLE_TH[me.role]}</span></span>
              <button aria-label="ออกจากระบบ / สลับมุมมอง" onClick={logout} className="focus-ring grid h-9 w-9 place-items-center rounded-full text-muted"><LogOut size={16} /></button>
            </div>
          </div>
        </header>
        <main className="px-3 sm:px-4 lg:px-8">
          {error && <div role="alert" className="mb-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">โหลดข้อมูลไม่สำเร็จ: {error}</div>}
          {tab === "dash" && <DashboardView leads={leads} today={today} summary={summary} perf={perf} leadership={leadership} range={range} onOpen={setOpenId} onGo={go} />}
          {tab === "today" && <TodayView items={today} onOpen={setOpenId} showOwner={leadership} />}
          {tab === "new" && <NewLeadsView leads={leads} onOpen={setOpenId} showOwner={leadership} onStar={toggleStar} />}
          {tab === "leads" && <LeadsView leads={leads} onOpen={setOpenId} showOwner={leadership} q={q} setQ={setQ} onStar={toggleStar} />}
          {tab === "targets" && <TargetsView leads={leads} onOpen={setOpenId} showOwner={leadership} onStar={toggleStar} />}
          {tab === "delivery" && <DeliveryView bookings={bookings} onOpen={setOpenId} onStep={deliveryStep} />}
          {tab === "booked" && <BookedView bookings={bookings} canVerify={leadership} onOpen={setOpenId} onVerify={verifyBooking} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden" aria-label="เมนูหลัก">
        <div className="mx-auto grid max-w-3xl grid-cols-7">
          {nav.map(({ k, short, Icon, badge }) => (
            <button key={k} onClick={() => go(k)} aria-current={tab === k ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 ${tab === k ? "font-semibold text-ink" : "text-muted"}`}>
              <span className={`grid h-7 w-10 place-items-center rounded-full ${tab === k ? "bg-accent text-black" : ""}`}><Icon size={18} /></span><span className="text-[11px]">{short}</span>
              {!!badge && <span className="num absolute right-[14%] top-1 rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-black">{badge}</span>}
            </button>
          ))}
        </div>
      </nav>
      {opened && <LeadSheet lead={opened} onClose={() => setOpenId(null)} onChanged={refresh} isManager={leadership} onGoDelivery={() => setTab("delivery")} />}
    </div>
  );
}
