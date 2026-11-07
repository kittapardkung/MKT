"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Role, SettingRow, SlaPatch, SlaRule, SlaScope } from "@/lib/types";
import { friendlyError } from "@/lib/format";

const LABEL: Record<SlaScope, { name: string; help: string }> = {
  NEW: { name: "ลีดใหม่", help: "เวลาที่ต้องติดต่อครั้งแรกหลังได้รับมอบหมาย" },
  HOT: { name: "ลีด HOT", help: "ระยะห่างสูงสุดระหว่างการติดตามแต่ละครั้ง" },
  WARM: { name: "ลีด WARM", help: "ระยะห่างสูงสุดระหว่างการติดตามแต่ละครั้ง" },
  COLD: { name: "ลีด COLD", help: "ระยะห่างสูงสุดระหว่างการติดตามแต่ละครั้ง" },
};
const human = (m: number) => (m % 10080 === 0 ? `${m / 10080} สัปดาห์` : m % 1440 === 0 ? `${m / 1440} วัน` : m % 60 === 0 ? `${m / 60} ชม.` : `${m} นาที`);

export default function SlaView({ role }: { role: Role }) {
  const canEdit = role === "executive" || role === "admin";
  const [rules, setRules] = useState<SlaRule[] | null>(null);
  const [draft, setDraft] = useState<Record<string, SlaRule>>({});
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [sdraft, setSdraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([api.slaRules(), api.settings()]).then(([r, s]) => {
      if (!alive) return;
      setRules(r); setDraft(Object.fromEntries(r.map((x) => [x.scope, { ...x }]))); setSettings(s); setSdraft(Object.fromEntries(s.map((x) => [x.key, x.value])));
    }).catch((e) => { if (alive) setMsg({ ok: false, text: friendlyError(e instanceof Error ? e.message : String(e)) }); });
    return () => { alive = false; };
  }, [tick]);

  const dirty = (x: SlaRule) => { const o = rules?.find((r) => r.scope === x.scope); return !!o && (o.minutes !== x.minutes || o.business_hours_only !== x.business_hours_only || o.remind_before_minutes !== x.remind_before_minutes || o.escalate_after_minutes !== x.escalate_after_minutes); };
  const valid = (x: SlaRule) => x.minutes > 0 && x.remind_before_minutes >= 0 && x.escalate_after_minutes >= 0 && x.remind_before_minutes < x.minutes && Number.isInteger(x.minutes);
  const save = async (x: SlaRule) => {
    setBusy(x.scope); setMsg(null);
    const patch: SlaPatch = { minutes: x.minutes, business_hours_only: x.business_hours_only, remind_before_minutes: x.remind_before_minutes, escalate_after_minutes: x.escalate_after_minutes };
    try { await api.updateSla(x.scope, patch); setMsg({ ok: true, text: `บันทึก SLA ของ ${LABEL[x.scope].name} แล้ว` }); setTick((t) => t + 1); }
    catch (e) { setMsg({ ok: false, text: friendlyError(e instanceof Error ? e.message : String(e)) }); }
    finally { setBusy(null); }
  };
  const get = (k: string) => sdraft[k] ?? "";
  const saveSetting = async (k: string) => {
    setBusy(k); setMsg(null);
    try { await api.updateSetting(k, get(k)); setMsg({ ok: true, text: "บันทึกการตั้งค่าแล้ว" }); setTick((t) => t + 1); }
    catch (e) { setMsg({ ok: false, text: friendlyError(e instanceof Error ? e.message : String(e)) }); }
    finally { setBusy(null); }
  };
  const sDirty = (k: string) => settings.find((s) => s.key === k)?.value !== get(k);
  const hoursOk = Number.isInteger(Number(get("work_start_hour"))) && Number.isInteger(Number(get("work_end_hour"))) && Number(get("work_start_hour")) >= 0 && Number(get("work_end_hour")) <= 24 && Number(get("work_start_hour")) < Number(get("work_end_hour"));
  const alertsOn = settings.find((s) => s.key === "alerts_enabled")?.value === "true";
  const num = "min-h-10 w-28 rounded-lg border border-line bg-surface px-2 text-right num disabled:bg-bg disabled:text-muted";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{canEdit ? "ผู้บริหาร/ผู้ดูแลระบบแก้ได้ การเปลี่ยนแปลงถูกบันทึกในประวัติระบบ (audit) และมีผลกับการคำนวณกำหนดเวลาที่ระบบทำหลังจากนี้" : "คุณดูได้อย่างเดียว เฉพาะผู้บริหาร/ผู้ดูแลระบบที่แก้ SLA ได้"}</p>
      {msg && <div role={msg.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{msg.text}</div>}
      {!rules && !msg && <p className="text-sm text-muted">กำลังโหลด…</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.values(draft).map((x) => (
          <section key={x.scope} className="card space-y-3 p-4">
            <div><h3 className="text-sm font-bold">{LABEL[x.scope].name}</h3><p className="text-xs text-muted">{LABEL[x.scope].help}</p></div>
            <label className="flex items-center justify-between gap-3 text-sm"><span>กำหนดเวลา (นาที) <span className="text-xs text-muted">= {human(x.minutes)}</span></span>
              <input type="number" min={1} step={1} disabled={!canEdit} value={x.minutes} onChange={(e) => setDraft((d) => ({ ...d, [x.scope]: { ...x, minutes: Number(e.target.value) } }))} className={num} /></label>
            <label className="flex items-center justify-between gap-3 text-sm"><span>เตือนก่อนครบ (นาที)</span>
              <input type="number" min={0} step={1} disabled={!canEdit} value={x.remind_before_minutes} onChange={(e) => setDraft((d) => ({ ...d, [x.scope]: { ...x, remind_before_minutes: Number(e.target.value) } }))} className={num} /></label>
            <label className="flex items-center justify-between gap-3 text-sm"><span>แจ้งผู้จัดการเมื่อเลย (นาที)</span>
              <input type="number" min={0} step={1} disabled={!canEdit} value={x.escalate_after_minutes} onChange={(e) => setDraft((d) => ({ ...d, [x.scope]: { ...x, escalate_after_minutes: Number(e.target.value) } }))} className={num} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={x.business_hours_only} onChange={(e) => setDraft((d) => ({ ...d, [x.scope]: { ...x, business_hours_only: e.target.checked } }))} className="h-5 w-5" />นับเฉพาะเวลาทำการ</label>
            {!valid(x) && <p role="alert" className="text-xs text-danger">ค่าไม่ถูกต้อง: กำหนดเวลาต้องเป็นจำนวนเต็ม &gt; 0 และเวลาเตือนต้องน้อยกว่ากำหนดเวลา</p>}
            {canEdit && <button onClick={() => void save(x)} disabled={!dirty(x) || !valid(x) || busy !== null} className="btn-dark min-h-11 w-full text-sm disabled:opacity-40">{busy === x.scope ? "กำลังบันทึก…" : "บันทึก"}</button>}
          </section>
        ))}
      </div>

      <section className="card space-y-3 p-4">
        <h3 className="text-sm font-bold">เวลาทำการและค่าเริ่มต้น</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm"><span className="block text-xs text-muted">เริ่มงาน (ชั่วโมง 0–23)</span><input type="number" min={0} max={23} disabled={!canEdit} value={get("work_start_hour")} onChange={(e) => setSdraft((d) => ({ ...d, work_start_hour: e.target.value }))} className={num} /></label>
          <label className="text-sm"><span className="block text-xs text-muted">เลิกงาน (ชั่วโมง 1–24)</span><input type="number" min={1} max={24} disabled={!canEdit} value={get("work_end_hour")} onChange={(e) => setSdraft((d) => ({ ...d, work_end_hour: e.target.value }))} className={num} /></label>
          <label className="text-sm"><span className="block text-xs text-muted">ความร้อนเริ่มต้นของลีดที่ยังไม่ประเมิน</span>
            <select disabled={!canEdit} value={get("default_temperature")} onChange={(e) => setSdraft((d) => ({ ...d, default_temperature: e.target.value }))} className="min-h-10 rounded-lg border border-line bg-surface px-2 disabled:bg-bg"><option>HOT</option><option>WARM</option><option>COLD</option></select></label>
        </div>
        {!hoursOk && <p role="alert" className="text-xs text-danger">เวลาเริ่มต้องน้อยกว่าเวลาเลิกงาน</p>}
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {(["work_start_hour", "work_end_hour", "default_temperature"] as const).map((k) => sDirty(k) && (
              <button key={k} disabled={busy !== null || (k !== "default_temperature" && !hoursOk)} onClick={() => void saveSetting(k)} className="btn-dark min-h-10 px-4 text-sm disabled:opacity-40">บันทึก{k === "work_start_hour" ? "เวลาเริ่มงาน" : k === "work_end_hour" ? "เวลาเลิกงาน" : "ค่าเริ่มต้น"}</button>
            ))}
          </div>
        )}
        <div className="rounded-xl bg-bg p-3 text-sm">
          <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${alertsOn ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>แจ้งเตือนอัตโนมัติ: {alertsOn ? "เปิด" : "ปิดอยู่"}</span>
          <span className="text-muted">การเปิด/ปิดการแจ้งเตือนถึงเซลล์เป็นการตัดสินใจของเจ้าของ จึงไม่ให้สลับจากหน้านี้</span>
        </div>
      </section>
    </div>
  );
}
