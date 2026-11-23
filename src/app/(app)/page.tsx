"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package, Boxes, ShoppingBag, TrendingUp, Wallet, AlertTriangle,
  ArrowRight, Plus, IndianRupee,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api, money, fmtDateTime } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import SalesCalendar from "@/components/SalesCalendar";
import type { DashboardStats } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { dark } = useTheme();
  const chart = {
    grid: dark ? "#2e2e2e" : "#e5e5e5",
    cursor: dark ? "#262626" : "#f5f5f5",
    bar: dark ? "#e5e5e5" : "#171717",
    tick: dark ? "#a3a3a3" : "#666666",
  };

  useEffect(() => {
    api<DashboardStats>("/api/stats").then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;
  if (!stats) return <p className="text-center text-neutral-500 py-20">Could not load dashboard.</p>;

  const cards = [
    { label: "Total Products", value: stats.totalProducts, icon: Package, href: "/products" },
    { label: "Available Stock", value: stats.totalStock, icon: Boxes, href: "/products" },
    { label: "Items Sold", value: stats.totalSold, icon: ShoppingBag, href: "/history" },
    { label: "Today's Sales", value: money(stats.todaySales), icon: TrendingUp, href: "/history", sub: stats.todayManualSales ? `+ ${money(stats.todayManualSales)} manual` : undefined },
    { label: "Total Sales", value: money(stats.totalSales), icon: IndianRupee, href: "/sales", sub: `Manual total: ${money(stats.totalManualSales)}` },
    { label: "Low Stock Alerts", value: stats.lowStockCount, icon: AlertTriangle, href: "/products?low=1", warn: stats.lowStockCount > 0 },
  ];

  const chartData = stats.salesLast7Days.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-500">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <Link href="/products/new" className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-neutral-950 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <Link key={c.label} href={c.href}
            className={`animate-fade-up bg-white rounded-2xl border p-4 hover:shadow-md transition ${c.warn ? "border-amber-300" : "border-neutral-200"}`}
            style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-neutral-500 font-medium">{c.label}</p>
                <p className={`text-xl md:text-2xl font-bold mt-1 ${c.warn ? "text-amber-600" : ""}`}>{c.value}</p>
                {c.sub && <p className="text-[11px] text-neutral-400 mt-0.5">{c.sub}</p>}
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.warn ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-700"}`}>
                <c.icon size={18} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Sales chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-neutral-200 p-5">
          <h2 className="font-semibold mb-4">Item Sales — Last 7 Days</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: chart.tick }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => money(Number(v))} cursor={{ fill: chart.cursor }} />
                <Bar dataKey="amount" fill={chart.bar} radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 p-5">
          <h2 className="font-semibold mb-4">Products by Category</h2>
          <div className="space-y-3">
            {stats.categoryCounts.length === 0 && <p className="text-sm text-neutral-400">No products yet.</p>}
            {stats.categoryCounts.map((c) => {
              const pct = stats.totalProducts ? Math.round((c.count / stats.totalProducts) * 100) : 0;
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{c.category}s</span>
                    <span className="text-neutral-500">{c.count} · {pct}%</span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sales calendar */}
      <SalesCalendar />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent products */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recently Added</h2>
            <Link href="/products" className="text-xs font-medium text-neutral-500 flex items-center gap-1 hover:text-neutral-900">View all <ArrowRight size={12} /></Link>
          </div>
          {stats.recentProducts.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4 text-center">No products yet. <Link href="/products/new" className="underline">Add your first product</Link>.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentProducts.map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-neutral-50 transition">
                  <div className="relative w-11 h-11 rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center text-neutral-400 shrink-0">
                    {p.imageUrl ? <Image src={p.imageUrl} alt="" fill sizes="44px" className="object-cover" /> : <Package size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-neutral-500">{p.category} · {p.sizes.map((s) => `${s.label}:${s.stock}`).join("  ")}</p>
                  </div>
                  <p className="text-sm font-semibold">{money(p.price)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Activity</h2>
            <Link href="/history" className="text-xs font-medium text-neutral-500 flex items-center gap-1 hover:text-neutral-900">View all <ArrowRight size={12} /></Link>
          </div>
          {stats.recentMovements.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4 text-center">No activity yet.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.recentMovements.map((m) => (
                <div key={m.id} className="flex items-start gap-3 text-sm">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${m.type === "sale" ? "bg-emerald-500" : m.type === "retrieve" ? "bg-sky-500" : m.type === "daily_sale" ? "bg-violet-500" : "bg-neutral-300"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{m.note || m.type}</p>
                    <p className="text-xs text-neutral-400">{fmtDateTime(m.createdAt)}</p>
                  </div>
                  {m.amount != null && m.amount !== 0 && (
                    <span className={`text-xs font-semibold ${m.amount > 0 ? "text-emerald-600" : "text-neutral-500"}`}>
                      {m.amount > 0 ? "+" : ""}{money(m.amount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-neutral-200 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-neutral-200 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-neutral-200 rounded-2xl" />
    </div>
  );
}
