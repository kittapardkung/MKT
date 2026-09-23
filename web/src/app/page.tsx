import { createAdminClient } from "@/lib/supabase/server";

type Target = {
  key: string;
  label: string;
  target: number;
  period: string;
};

async function getTargets(): Promise<{ data: Target[] | null; error: string | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return { data: null, error: "ยังไม่ได้ตั้งค่า .env.local — ดูวิธีตั้งค่าใน .env.example" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("targets")
    .select("key, label, target, period")
    .order("key");

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export default async function Home() {
  const { data: targets, error } = await getTargets();

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          MKT Content Manager
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          ทดสอบการเชื่อมต่อ Supabase — ตาราง <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">targets</code>
        </p>

        {error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            เชื่อมต่อไม่สำเร็จ: {error}
          </div>
        )}

        {targets && (
          <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">เป้าหมาย</th>
                  <th className="px-4 py-2 font-medium">ค่า</th>
                  <th className="px-4 py-2 font-medium">ช่วงเวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {targets.map((t) => (
                  <tr key={t.key}>
                    <td className="px-4 py-2 text-black dark:text-zinc-50">{t.label}</td>
                    <td className="px-4 py-2 text-black dark:text-zinc-50">{t.target}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{t.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {targets && targets.length > 0 && (
          <p className="mt-6 text-sm text-green-700 dark:text-green-400">
            ✅ เชื่อมต่อ Supabase สำเร็จ — พบข้อมูล {targets.length} แถว
          </p>
        )}
      </main>
    </div>
  );
}
