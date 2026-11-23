"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { api, money } from "@/components/ui";

interface DayTotal {
  date: string;
  itemTotal: number;
  manualTotal: number;
  grandTotal: number;
  saleCount: number;
  closed: boolean;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function SalesCalendar() {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM (UTC)
  const [days, setDays] = useState<DayTotal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const d = await api<{ days: DayTotal[] }>(`/api/daily-totals?month=${m}`);
      setDays(d.days);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(t.toISOString().slice(0, 7));
  };

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const byDate = new Map(days.map((d) => [d.date, d]));

  // leading blanks so day 1 lands on the right weekday (UTC)
  const firstDow = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  const cells: (DayTotal | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...days,
  ];

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Sales Calendar</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center" aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold w-32 text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} disabled={month >= currentMonth}
            className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-neutral-400 uppercase mb-1">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">{Array.from({ length: 35 }).map((_, i) => <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} className="h-12" />;
            const isToday = d.date === today;
            const hasSales = d.grandTotal > 0 || d.saleCount > 0;
            return (
              <button key={d.date} onClick={() => router.push(`/sales?date=${d.date}`)}
                title={`${d.date} — ${money(d.grandTotal)}${d.closed ? " (closed)" : ""}`}
                className={`relative h-12 rounded-lg flex flex-col items-center justify-center text-xs transition hover:ring-2 hover:ring-neutral-300 ${
                  isToday ? "bg-neutral-950 text-white" : hasSales ? "bg-neutral-50" : ""
                }`}>
                <span className={`font-semibold ${isToday ? "" : "text-neutral-700"}`}>{Number(d.date.slice(8))}</span>
                {hasSales && !isToday && (
                  <span className="text-[9px] font-bold text-neutral-500 leading-none mt-0.5">
                    {d.grandTotal >= 1000 ? `₹${(d.grandTotal / 1000).toFixed(1)}k` : money(d.grandTotal)}
                  </span>
                )}
                {d.closed && (
                  <Lock size={8} className={`absolute top-1 right-1 ${isToday ? "text-neutral-300" : "text-emerald-600"}`} />
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-neutral-400 mt-3">Tap a day to open its sales report. 🔒 = day closed.</p>
    </div>
  );
}
