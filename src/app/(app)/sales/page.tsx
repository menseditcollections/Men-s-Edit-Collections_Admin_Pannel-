"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, IndianRupee, Wallet, CalendarDays, TrendingUp, Download, CalendarCheck, ChevronRight, ChevronLeft, Lock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api, money, fmtDate, fmtDateTime, useToast, ConfirmDialog } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import type { DailySale, DayClosure, Movement } from "@/lib/types";

function SalesInner() {
  const toast = useToast();
  const sp = useSearchParams();
  const { dark } = useTheme();
  const chart = {
    grid: dark ? "#2e2e2e" : "#e5e5e5",
    cursor: dark ? "#262626" : "#f5f5f5",
    bar: dark ? "#a78bfa" : "#7c3aed",
    tick: dark ? "#a3a3a3" : "#666666",
  };
  const [sales, setSales] = useState<DailySale[]>([]);
  const [itemTotals, setItemTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DailySale | null>(null);
  const [deleting, setDeleting] = useState<DailySale | null>(null);

  // Day closing state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selDate, setSelDate] = useState(() => {
    const d = sp.get("date");
    const valid = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr;
    return valid > todayStr ? todayStr : valid;
  });
  const [dayReport, setDayReport] = useState<Omit<DayClosure, "id"> | null>(null);
  const [dayClosed, setDayClosed] = useState<DayClosure | null>(null);
  const [closures, setClosures] = useState<DayClosure[]>([]);
  const [viewing, setViewing] = useState<DayClosure | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState<DayClosure | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [qaAmount, setQaAmount] = useState("");
  const [qaNote, setQaNote] = useState("");
  const [qaSaving, setQaSaving] = useState(false);

  // Closed-day editing + graph period
  const [graphMode, setGraphMode] = useState<"day" | "week" | "month" | "overall">("day");
  const [editDay, setEditDay] = useState(false);
  const [editAmt, setEditAmt] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [dayMovs, setDayMovs] = useState<Movement[]>([]);
  const [delMove, setDelMove] = useState<Movement | null>(null);
  const [delMoveSaving, setDelMoveSaving] = useState(false);

  const shiftDay = (d: string, delta: number) => {
    const t = new Date(d + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() + delta);
    return t.toISOString().slice(0, 10);
  };

  const load = useCallback(async () => {
    try {
      const d = await api<{ sales: DailySale[] }>("/api/daily-sales");
      setSales(d.sales);
      const t = await api<{ days: { date: string; itemTotal: number }[] }>(`/api/daily-totals?from=2000-01-01&to=${todayStr}`);
      const map: Record<string, number> = {};
      t.days.forEach((x) => { map[x.date] = x.itemTotal; });
      setItemTotals(map);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const loadClosures = useCallback(async () => {
    try {
      const d = await api<{ closures: DayClosure[] }>("/api/day-closures");
      setClosures(d.closures);
    } catch {}
  }, []);

  const loadDay = useCallback(async (date: string) => {
    try {
      const d = await api<{ preview: Omit<DayClosure, "id">; closure: DayClosure | null }>(`/api/day-closures?date=${date}`);
      setDayReport(d.preview);
      setDayClosed(d.closure);
    } catch {}
  }, []);

  useEffect(() => { loadClosures(); }, [loadClosures]);
  useEffect(() => { loadDay(selDate); }, [selDate, loadDay]);

  // Reset quick-add fields whenever the selected day changes
  useEffect(() => {
    setQuickAdd(false);
    setQaAmount("");
    setQaNote("");
  }, [selDate]);

  async function closeSelected() {
    setClosing(true);
    try {
      await api("/api/day-closures", { method: "POST", body: JSON.stringify({ date: selDate }) });
      toast("Day closed — report saved permanently");
      setConfirmClose(false);
      setQuickAdd(false);
      setQaAmount("");
      setQaNote("");
      await loadClosures();
      // Auto-advance to the next day so a fresh report is ready
      if (selDate < todayStr) setSelDate(shiftDay(selDate, 1));
      else await loadDay(selDate);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setClosing(false);
    }
  }

  async function saveQuickSale(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(qaAmount);
    if (!Number.isFinite(amt) || amt < 0) return toast("Enter a valid amount", "error");
    setQaSaving(true);
    try {
      await api("/api/daily-sales", { method: "POST", body: JSON.stringify({ amount: amt, date: selDate, note: qaNote.trim() || undefined }) });
      toast(`Sale of ${money(amt)} added for ${fmtDate(selDate + "T00:00:00")}`);
      setQaAmount(""); setQaNote(""); setQuickAdd(false);
      await Promise.all([load(), loadDay(selDate), loadClosures()]);
    } catch (err: any) {
      toast(err.message || "Save failed", "error");
    } finally {
      setQaSaving(false);
    }
  }

  async function confirmReopen() {
    if (!reopening) return;
    try {
      await api(`/api/day-closures?id=${reopening.id}`, { method: "DELETE" });
      toast("Day reopened — saved report deleted");
      setReopening(null);
      setViewing(null);
      await loadClosures();
      await loadDay(selDate);
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  async function refreshViewing(date: string) {
    try {
      const d = await api<{ closure: DayClosure | null }>(`/api/day-closures?date=${date}`);
      if (d.closure) setViewing(d.closure);
      const mv = await api<{ movements: Movement[] }>(`/api/movements?from=${date}&to=${date}`);
      setDayMovs(mv.movements.filter((m) => m.type === "sale" || m.type === "retrieve"));
      await Promise.all([loadClosures(), loadDay(date)]);
    } catch {}
  }

  function startEditDay() {
    if (!viewing) return;
    setEditAmt(String(viewing.manualAmount || ""));
    setEditNote(viewing.manualNote ?? "");
    setEditDay(true);
    refreshViewing(viewing.date);
  }

  async function saveClosedDayEdit() {
    if (!viewing) return;
    const amt = Number(editAmt);
    if (editAmt !== "" && (!Number.isFinite(amt) || amt < 0)) return toast("Enter a valid amount", "error");
    setEditSaving(true);
    try {
      await api("/api/day-closures", {
        method: "PUT",
        body: JSON.stringify({ date: viewing.date, manualAmount: editAmt === "" ? 0 : amt, manualNote: editNote.trim() || null }),
      });
      toast("Closed day updated");
      setEditDay(false);
      await refreshViewing(viewing.date);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDeleteMove() {
    if (!delMove || !viewing) return;
    setDelMoveSaving(true);
    try {
      await api(`/api/movements?id=${delMove.id}`, { method: "DELETE" });
      toast(`${delMove.type === "sale" ? "Sale" : "Retrieve"} entry deleted — stock adjusted`);
      setDelMove(null);
      await refreshViewing(viewing.date);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setDelMoveSaving(false);
    }
  }

  const totals = useMemo(() => {
    // Week = Sun–Sat containing the selected date; Month = whole month containing it
    const dow = new Date(selDate + "T00:00:00").getDay();
    const weekStart = shiftDay(selDate, -dow);
    const weekEnd = shiftDay(weekStart, 6);
    const monthStart = `${selDate.slice(0, 7)}-01`;
    const [my, mm] = selDate.slice(0, 7).split("-").map(Number);
    const monthEnd = `${selDate.slice(0, 7)}-${String(new Date(Date.UTC(my, mm, 0)).getUTCDate()).padStart(2, "0")}`;
    const manualSum = (from?: string, to?: string) =>
      sales.filter((s) => (!from || s.date >= from) && (!to || s.date <= to)).reduce((n, s) => n + s.amount, 0);
    const itemSum = (from?: string, to?: string) =>
      Object.entries(itemTotals).filter(([d]) => (!from || d >= from) && (!to || d <= to)).reduce((n, [, v]) => n + v, 0);
    const combined = (from?: string, to?: string) => manualSum(from, to) + itemSum(from, to);
    return {
      day: combined(selDate, selDate),
      week: combined(weekStart, weekEnd),
      month: combined(monthStart, monthEnd),
      overall: combined(),
    };
  }, [sales, itemTotals, selDate]);

  const graphData = useMemo(() => {
    const manualMap = new Map<string, number>();
    sales.forEach((s) => manualMap.set(s.date, (manualMap.get(s.date) ?? 0) + s.amount));
    const dates = new Set<string>([...Object.keys(itemTotals), ...manualMap.keys()]);
    const parts = (d: string) => ({ item: itemTotals[d] ?? 0, manual: manualMap.get(d) ?? 0 });

    const labelDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const labelWeek = (d: string) => `Wk ${labelDay(d)}`;
    const labelMonth = (d: string) => new Date(d + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

    const bucket = (keyFn: (d: string) => string, labelFn: (k: string) => string) => {
      const map = new Map<string, { item: number; manual: number }>();
      dates.forEach((d) => {
        const k = keyFn(d);
        const b = map.get(k) ?? { item: 0, manual: 0 };
        const v = parts(d);
        b.item += v.item; b.manual += v.manual;
        map.set(k, b);
      });
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ key: k, label: labelFn(k), item: v.item, manual: v.manual, total: v.item + v.manual }));
    };

    const weekKey = (d: string) => shiftDay(d, -new Date(d + "T00:00:00").getDay());
    const monthKey = (d: string) => d.slice(0, 7);

    switch (graphMode) {
      case "week":
        return bucket(weekKey, labelWeek).slice(-8);
      case "month":
        return bucket(monthKey, labelMonth).slice(-6);
      case "overall":
        return bucket(monthKey, labelMonth);
      default: {
        // Daily — dense last 14 days
        const rows = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
          const v = parts(d);
          rows.push({ key: d, label: labelDay(d), item: v.item, manual: v.manual, total: v.item + v.manual });
        }
        return rows;
      }
    }
  }, [sales, itemTotals, graphMode]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return toast("Enter a valid amount", "error");
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/daily-sales/${editing.id}`, { method: "PATCH", body: JSON.stringify({ amount: amt, date, note }) });
        toast("Entry updated");
      } else {
        await api("/api/daily-sales", { method: "POST", body: JSON.stringify({ amount: amt, date, note }) });
        toast("Daily sales saved");
      }
      setAmount(""); setNote(""); setEditing(null);
      setDate(new Date().toISOString().slice(0, 10));
      await load();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/daily-sales/${deleting.id}`, { method: "DELETE" });
      toast("Entry deleted");
      setDeleting(null);
      await load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  function startEdit(s: DailySale) {
    setEditing(s);
    setAmount(String(s.amount));
    setDate(s.date);
    setNote(s.note ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onEntryDateChange(d: string) {
    setDate(d);
    if (!editing) {
      setAmount("");
      setNote("");
    }
  }

  const closedDates = useMemo(() => new Set(closures.map((c) => c.date)), [closures]);
  const entryDateClosed = closedDates.has(date);

  const summary = [
    { label: selDate === todayStr ? "Today" : "Selected Day", value: totals.day, icon: CalendarDays },
    { label: "Week (7 days)", value: totals.week, icon: TrendingUp },
    { label: new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { month: "long" }), value: totals.month, icon: Wallet },
    { label: "Overall", value: totals.overall, icon: IndianRupee },
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Sales</h1>
          <p className="text-sm text-neutral-500">Daily revenue — item sales at selling price plus manual entries.</p>
        </div>
        <a href="/api/export?kind=daily-sales" title="Export daily sales CSV"
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 border border-neutral-200 rounded-xl bg-white text-sm font-semibold hover:bg-neutral-50 transition">
          <Download size={15} /><span className="hidden sm:inline">CSV</span>
        </a>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-neutral-500 mb-1">
              <s.icon size={14} />
              <p className="text-xs font-medium">{s.label}</p>
            </div>
            <p className="text-xl font-bold">{money(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Day Closing */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold flex items-center gap-2"><CalendarCheck size={17} /> Day Closing</h2>
          {dayClosed && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">
              <Lock size={11} /> DAY CLOSED
            </span>
          )}
        </div>

        {/* Day selector */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <button onClick={() => setSelDate(shiftDay(selDate, -1))}
            className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition" aria-label="Previous day">
            <ChevronLeft size={17} />
          </button>
          <div className="text-center">
            <p className="font-bold text-sm">{fmtDate(selDate + "T00:00:00")}</p>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wide">
              {selDate === todayStr ? "Today" : "Past day"}
            </p>
          </div>
          <button onClick={() => setSelDate(shiftDay(selDate, 1))} disabled={selDate >= todayStr}
            className="w-9 h-9 rounded-xl border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Next day">
            <ChevronRight size={17} />
          </button>
        </div>

        {(() => {
          const day = dayClosed ?? dayReport;
          if (!day) return <p className="text-sm text-neutral-400 py-2">Loading day&apos;s report…</p>;
          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="rounded-xl bg-neutral-50 p-3 text-center">
                  <p className="text-[11px] text-neutral-500 font-medium">Items Sold</p>
                  <p className="text-lg font-bold">{day.saleCount}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3 text-center">
                  <p className="text-[11px] text-neutral-500 font-medium">Retrieved</p>
                  <p className="text-lg font-bold">{day.retrievedCount}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3 text-center">
                  <p className="text-[11px] text-neutral-500 font-medium">Item Sales</p>
                  <p className="text-lg font-bold">{money(day.itemSalesTotal)}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3 text-center">
                  <p className="text-[11px] text-neutral-500 font-medium">Manual Sales</p>
                  <p className="text-lg font-bold">{money(day.manualAmount)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-neutral-950 text-white px-4 py-3.5">
                <span className="text-sm font-medium">Day Total</span>
                <span className="text-xl font-bold">{money(day.grandTotal)}</span>
              </div>
              <div className="flex gap-2 mt-4">
                {dayClosed ? (
                  <button onClick={() => setViewing(dayClosed)}
                    className="flex-1 py-3 rounded-xl border border-neutral-200 text-sm font-bold hover:bg-neutral-50 transition">
                    View Closed Report
                  </button>
                ) : (
                  <>
                    <button onClick={() => setConfirmClose(true)} disabled={closing}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-50">
                      {closing ? "Closing…" : `Close ${selDate === todayStr ? "Today" : "Day"}`}
                    </button>
                    <button onClick={() => setQuickAdd(!quickAdd)}
                      className="px-4 py-3 rounded-xl border border-neutral-200 text-sm font-bold hover:bg-neutral-50 transition">
                      + Sale
                    </button>
                  </>
                )}
              </div>

              {quickAdd && !dayClosed && (
                <form onSubmit={saveQuickSale} className="mt-3 flex flex-wrap gap-2">
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={qaAmount}
                    onChange={(e) => setQaAmount(e.target.value)} required placeholder="Amount ₹"
                    className="w-28 px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                  <input value={qaNote} onChange={(e) => setQaNote(e.target.value)} placeholder="Note (optional)"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                  <button disabled={qaSaving}
                    className="px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition disabled:opacity-50">
                    {qaSaving ? "…" : "Add"}
                  </button>
                </form>
              )}
            </>
          );
        })()}
      </section>

      {/* Closed days history */}
      {closures.length > 0 && (
        <section className="bg-white rounded-2xl border border-neutral-200 p-5">
          <h2 className="font-semibold mb-2">Closed Days</h2>
          <p className="text-xs text-neutral-500 mb-2">Permanent end-of-day sales reports — tap to view details.</p>
          <div className="divide-y divide-neutral-100">
            {closures.map((c) => (
              <div key={c.id} className="flex items-center gap-1 py-1">
                <button onClick={() => setViewing(c)}
                  className="flex-1 min-w-0 flex items-center gap-3 py-2 text-left hover:bg-neutral-50 -mx-2 px-2 rounded-lg transition">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      {fmtDate(c.date + "T00:00:00")}
                      <Lock size={11} className="text-emerald-600" />
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">Closed</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      {c.saleCount} item{c.saleCount === 1 ? "" : "s"} sold
                      {c.retrievedCount > 0 ? ` · ${c.retrievedCount} retrieved` : ""}
                      {c.manualAmount > 0 ? ` · +${money(c.manualAmount)} manual` : ""}
                    </p>
                  </div>
                  <p className="font-bold">{money(c.grandTotal)}</p>
                  <ChevronRight size={16} className="text-neutral-300" />
                </button>
                <button onClick={() => setReopening(c)} title="Delete this day's closed report"
                  className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Entry form */}
      <form onSubmit={save} className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
        <h2 className="font-semibold">{editing ? "Edit Entry" : "New Entry"}</h2>
        {entryDateClosed && (
          <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            This date is CLOSED — sales entries are locked. Open the day&apos;s closed report and use Edit Closed Day to make changes.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Date</label>
            <input type="date" value={date} onChange={(e) => onEntryDateChange(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Amount (₹) *</label>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} required placeholder="0"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash / UPI collection"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div className="flex gap-2">
          <button disabled={saving || entryDateClosed}
            className="flex-1 py-3.5 rounded-xl bg-neutral-950 text-white font-bold text-sm hover:bg-neutral-800 transition disabled:opacity-50">
            {saving ? "Saving..." : editing ? "Update Entry" : "Save Daily Sales"}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setAmount(""); setNote(""); setDate(new Date().toISOString().slice(0, 10)); }}
              className="px-5 rounded-xl border border-neutral-200 text-sm font-semibold">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold">Sales Graph</h2>
          <div className="flex rounded-xl border border-neutral-200 overflow-hidden text-[11px] font-semibold">
            {([["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["overall", "Overall"]] as const).map(([m, label]) => (
              <button key={m} onClick={() => setGraphMode(m)}
                className={`px-3 py-1.5 transition ${graphMode === m ? "bg-neutral-950 text-white" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-neutral-500 mb-2">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: chart.bar }} />Item Sales</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: dark ? "#fbbf24" : "#d97706" }} />Manual</span>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={graphData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: chart.tick }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: any, name: any) => [money(Number(v)), name === "item" ? "Item Sales" : "Manual"]}
                labelFormatter={(l: any) => l}
                cursor={{ fill: chart.cursor }} />
              <Bar dataKey="item" name="item" fill={chart.bar} radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="manual" name="manual" fill={dark ? "#fbbf24" : "#d97706"} radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Entries list */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="font-semibold mb-4">Saved Entries</h2>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-neutral-100 rounded-xl animate-pulse" />)}</div>
        ) : sales.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">No sales entries yet.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {sales.map((s) => {
              const locked = closedDates.has(s.date);
              return (
              <div key={s.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold flex items-center gap-1.5">
                    {money(s.amount)}
                    {locked && <Lock size={11} className="text-emerald-600" />}
                  </p>
                  <p className="text-xs text-neutral-500">{fmtDate(s.date + "T00:00:00")}{s.note ? ` · ${s.note}` : ""}{locked ? " · day closed" : ""}</p>
                </div>
                <button onClick={() => startEdit(s)} disabled={locked} title={locked ? "Day is closed" : "Edit"}
                  className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 disabled:opacity-30 disabled:hover:bg-transparent"><Pencil size={16} /></button>
                <button onClick={() => setDeleting(s)} disabled={locked} title={locked ? "Day is closed" : "Delete"}
                  className="p-2 rounded-lg hover:bg-red-50 text-neutral-500 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500"><Trash2 size={16} /></button>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete sales entry?"
        message={`This will delete the ${deleting ? money(deleting.amount) : ""} entry for ${deleting ? fmtDate(deleting.date + "T00:00:00") : ""}.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={confirmClose}
        title={`Close ${fmtDate(selDate + "T00:00:00")}?`}
        message={dayReport
          ? `This saves the report for ${fmtDate(selDate + "T00:00:00")} permanently: ${dayReport.saleCount} items sold (${money(dayReport.itemSalesTotal)}), ${money(dayReport.manualAmount)} manual, day total ${money(dayReport.grandTotal)}. You can still view it later under Closed Days.`
          : "Close this day"}
        confirmLabel="Close Day"
        onConfirm={closeSelected}
        onCancel={() => setConfirmClose(false)}
        loading={closing}
      />

      <ConfirmDialog
        open={!!reopening}
        title="Reopen this day?"
        message={`This deletes the saved report for ${reopening ? fmtDate(reopening.date + "T00:00:00") : ""}. The day's movements stay in history, but the closed report will be gone.`}
        confirmLabel="Reopen"
        danger
        onConfirm={confirmReopen}
        onCancel={() => setReopening(null)}
      />

      <ConfirmDialog
        open={!!delMove}
        title={`Delete ${delMove?.type === "sale" ? "sale" : "retrieve"}?`}
        message={delMove
          ? `"${delMove.productName}"${delMove.sizeLabel ? ` size ${delMove.sizeLabel}` : ""} will be removed from ${fmtDate(viewing?.date + "T00:00:00")}'s records and stock will be adjusted automatically.`
          : ""}
        confirmLabel="Delete"
        danger
        loading={delMoveSaving}
        onConfirm={confirmDeleteMove}
        onCancel={() => setDelMove(null)}
      />

      {/* Day report modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-neutral-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">Day Report</h3>
                  <p className="text-sm text-neutral-500">
                    {fmtDate(viewing.date + "T00:00:00")} · closed {fmtDateTime(viewing.closedAt)}
                  </p>
                </div>
                <Lock size={18} className="text-emerald-600 mt-1" />
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Totals */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[11px] text-neutral-500 font-medium">Items Sold</p>
                  <p className="font-bold">{viewing.saleCount}{viewing.retrievedCount > 0 ? ` (−${viewing.retrievedCount} retrieved)` : ""}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[11px] text-neutral-500 font-medium">Item Sales</p>
                  <p className="font-bold">{money(viewing.itemSalesTotal)}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[11px] text-neutral-500 font-medium">Manual Sales</p>
                  <p className="font-bold">{money(viewing.manualAmount)}{viewing.manualNote ? ` · ${viewing.manualNote}` : ""}</p>
                </div>
                <div className="rounded-xl bg-neutral-950 text-white p-3">
                  <p className="text-[11px] text-neutral-400 font-medium">Day Total</p>
                  <p className="font-bold">{money(viewing.grandTotal)}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-2">Products Sold</h4>
                {viewing.items.length === 0 ? (
                  <p className="text-sm text-neutral-400 py-2">No item sales recorded this day.</p>
                ) : (
                  <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100 max-h-56 overflow-y-auto">
                    {viewing.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{it.productName}</p>
                          <p className="text-xs text-neutral-500">{it.sizeLabel ? `Size ${it.sizeLabel}` : "No size"}</p>
                        </div>
                        <p className="font-semibold shrink-0">{money(it.price)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit mode */}
              {editDay && (
                <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Edit Closed Day</p>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Manual Sales Amount (₹)</label>
                    <input type="number" inputMode="decimal" min="0" step="0.01" value={editAmt}
                      onChange={(e) => setEditAmt(e.target.value)} placeholder="0"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Manual Sales Note</label>
                    <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="e.g. Other Sales"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                  </div>
                  <p className="text-xs text-neutral-500">
                    New day total preview: <span className="font-bold text-neutral-800">{money(viewing.itemSalesTotal + (Number(editAmt) || 0))}</span>
                  </p>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-2">Day Transactions — tap trash to remove</h4>
                    {dayMovs.length === 0 ? (
                      <p className="text-sm text-neutral-400 py-1">No item transactions this day.</p>
                    ) : (
                      <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100 bg-white max-h-48 overflow-y-auto">
                        {dayMovs.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{m.productName ?? "Manual entry"}</p>
                              <p className="text-xs text-neutral-500">
                                {m.type === "sale" ? "Sale" : "Retrieve"}{m.sizeLabel ? ` · Size ${m.sizeLabel}` : ""}
                              </p>
                            </div>
                            <p className={`font-semibold shrink-0 ${m.type === "retrieve" ? "text-red-500" : ""}`}>
                              {m.type === "retrieve" ? "−" : ""}{money(Math.abs(m.amount ?? 0))}
                            </p>
                            <button onClick={() => setDelMove(m)} title="Delete this transaction"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-neutral-400 mt-1.5">Deleting a sale returns the item to stock; deleting a retrieve removes it from stock.</p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={saveClosedDayEdit} disabled={editSaving}
                      className="flex-1 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition disabled:opacity-50">
                      {editSaving ? "Saving…" : "Save Changes"}
                    </button>
                    <button onClick={() => setEditDay(false)}
                      className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 p-5 pt-0">
              {!editDay && (
                <>
                  <button onClick={() => setReopening(viewing)}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition">
                    Reopen Day
                  </button>
                  <button onClick={startEditDay}
                    className="flex-1 py-2.5 rounded-xl border border-amber-300 text-amber-700 text-sm font-bold hover:bg-amber-50 transition">
                    Edit Closed Day
                  </button>
                </>
              )}
              <button onClick={() => { setViewing(null); setEditDay(false); }}
                className="flex-1 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesPage() {
  return (
    <Suspense>
      <SalesInner />
    </Suspense>
  );
}
