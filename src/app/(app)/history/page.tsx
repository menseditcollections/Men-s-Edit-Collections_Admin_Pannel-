"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, ShoppingBag, Undo2, Package, ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2, IndianRupee, Download } from "lucide-react";
import { api, money, fmtDateTime, useToast } from "@/components/ui";
import type { Movement, MovementType, Product } from "@/lib/types";

const TYPE_META: Record<MovementType, { label: string; icon: any; cls: string }> = {
  sale: { label: "Sold", icon: ShoppingBag, cls: "bg-emerald-100 text-emerald-700" },
  retrieve: { label: "Retrieved", icon: Undo2, cls: "bg-sky-100 text-sky-700" },
  stock_in: { label: "Stock In", icon: ArrowDownToLine, cls: "bg-neutral-200 text-neutral-700" },
  stock_out: { label: "Stock Out", icon: ArrowUpFromLine, cls: "bg-neutral-200 text-neutral-700" },
  product_created: { label: "Product Added", icon: Package, cls: "bg-neutral-900 text-white" },
  product_updated: { label: "Product Edited", icon: Pencil, cls: "bg-neutral-200 text-neutral-700" },
  product_deleted: { label: "Product Deleted", icon: Trash2, cls: "bg-red-100 text-red-700" },
  size_added: { label: "Size Added", icon: Package, cls: "bg-neutral-200 text-neutral-700" },
  size_removed: { label: "Size Removed", icon: Trash2, cls: "bg-red-100 text-red-700" },
  daily_sale: { label: "Daily Sales", icon: IndianRupee, cls: "bg-violet-100 text-violet-700" },
};

const TYPES = ["", "sale", "retrieve", "product_created", "product_updated", "product_deleted", "size_added", "size_removed", "daily_sale"] as const;

export default function HistoryPage() {
  const toast = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("");
  const [productId, setProductId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<{ products: Product[] }>("/api/products").then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (type) sp.set("type", type);
      if (productId) sp.set("productId", productId);
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      if (q) sp.set("q", q);
      const d = await api<{ movements: Movement[] }>(`/api/movements?${sp}`);
      setMovements(d.movements);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [type, productId, from, to, q, toast]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const sold = movements.filter((m) => m.type === "sale").reduce((n, m) => n + (m.amount ?? 0), 0);
    const retrieved = movements.filter((m) => m.type === "retrieve").reduce((n, m) => n + Math.abs(m.amount ?? 0), 0);
    return { sold, retrieved };
  }, [movements]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock History</h1>
          <p className="text-sm text-neutral-500">Every stock movement, sale, retrieval and edit — with date & time.</p>
        </div>
        <a
          href={(() => {
            const p = new URLSearchParams({ kind: "movements" });
            if (type) p.set("type", type);
            if (productId) p.set("productId", productId);
            if (from) p.set("from", from);
            if (to) p.set("to", to);
            if (q) p.set("q", q);
            return `/api/export?${p}`;
          })()}
          title="Export filtered history CSV"
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 border border-neutral-200 rounded-xl bg-white text-sm font-semibold hover:bg-neutral-50 transition">
          <Download size={15} /><span className="hidden sm:inline">CSV</span>
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500 font-medium">Sold (filtered)</p>
          <p className="text-xl font-bold text-emerald-600">{money(totals.sold)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500 font-medium">Retrieved (filtered)</p>
          <p className="text-xl font-bold text-sky-600">{money(totals.retrieved)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-3 space-y-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product name..."
          className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        <div className="grid grid-cols-2 gap-2">
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white">
            <option value="">All Products</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white">
            {TYPES.map((t) => <option key={t} value={t}>{t === "" ? "All Activity" : TYPE_META[t as MovementType].label}</option>)}
          </select>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm" />
          </div>
        </div>
        {(type || productId || from || to || q) && (
          <button onClick={() => { setType(""); setProductId(""); setFrom(""); setTo(""); setQ(""); }}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900">
            Clear all filters
          </button>
        )}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-neutral-200 rounded-2xl animate-pulse" />)}</div>
      ) : movements.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
          <History size={40} className="mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-500 font-medium">No activity recorded yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
          {movements.map((m) => {
            const meta = TYPE_META[m.type] ?? TYPE_META.product_updated;
            return (
              <div key={m.id} className="flex items-start gap-3 p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.cls}`}>
                  <meta.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{m.note || meta.label}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{fmtDateTime(m.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{meta.label}</span>
                  {m.amount != null && m.amount !== 0 && (
                    <p className={`text-xs font-bold mt-1 ${m.amount > 0 ? "text-emerald-600" : "text-neutral-500"}`}>
                      {m.amount > 0 ? "+" : ""}{money(m.amount)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
