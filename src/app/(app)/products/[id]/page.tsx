"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Package, Pencil, Trash2, Plus, Minus, ShoppingBag,
  Undo2, AlertTriangle,
} from "lucide-react";
import { api, money, fmtDateTime, useToast, ConfirmDialog } from "@/components/ui";
import Receipt, { type ReceiptData } from "@/components/Receipt";
import type { Product } from "@/lib/types";

type Pending = { kind: "sell" | "retrieve" | "delete"; sizeId?: string; label?: string; date?: string } | null;
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [newSize, setNewSize] = useState("");
  const [editStock, setEditStock] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [closedDates, setClosedDates] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const d = await api<{ product: Product }>(`/api/products/${id}`);
      setProduct(d.product);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api<{ closures: { date: string }[] }>("/api/day-closures")
      .then((d) => setClosedDates(new Set(d.closures.map((c) => c.date))))
      .catch(() => {});
  }, []);

  async function act(action: string, sizeId: string, sizeLabel?: string, saleDate?: string) {
    setBusy(sizeId + action);
    try {
      await api(`/api/sizes/${sizeId}`, { method: "PUT", body: JSON.stringify({ action, ...(saleDate ? { date: saleDate } : {}) }) });
      await load();
      if (action === "sell" && product) {
        setReceipt({
          productName: product.name, category: product.category, sku: product.sku,
          sizeLabel: sizeLabel ?? "", price: product.price,
          date: saleDate ? new Date(saleDate + "T00:00:00") : new Date(),
        });
        toast("Marked as sold");
      } else {
        toast("Stock retrieved");
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
      setPending(null);
    }
  }

  function openSell(sizeId: string, label: string) {
    setPending({ kind: "sell", sizeId, label, date: todayStr() });
  }

  function updatePendingDate(d: string) {
    setPending((p) => (p ? { ...p, date: d } : p));
  }

  async function confirmPending() {
    if (!pending) return;
    if (pending.kind === "delete") {
      setBusy("delete");
      try {
        await api(`/api/products/${id}`, { method: "DELETE" });
        toast("Product deleted");
        router.push("/products");
      } catch (e: any) {
        toast(e.message, "error");
        setBusy(null);
      }
    } else if (pending.sizeId) {
      if (pending.kind === "sell" && pending.date && closedDates.has(pending.date)) {
        toast("That day is closed — sales are locked for this date", "error");
        return;
      }
      await act(pending.kind, pending.sizeId, pending.label, pending.kind === "sell" ? pending.date : undefined);
    }
  }

  async function addSize() {
    const label = newSize.trim();
    if (!label) return;
    try {
      await api(`/api/products/${id}/sizes`, { method: "POST", body: JSON.stringify({ label }) });
      setNewSize("");
      await load();
      toast(`Size ${label} added`);
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  async function removeSize(sizeId: string, label: string) {
    try {
      await api(`/api/sizes/${sizeId}`, { method: "DELETE" });
      await load();
      toast(`Size ${label} removed`);
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  function stepStock(sizeId: string, current: number, delta: number) {
    const base = editStock[sizeId] !== undefined ? Number(editStock[sizeId]) : current;
    const next = Math.max(0, (Number.isFinite(base) ? base : current) + delta);
    setEditStock((x) => ({ ...x, [sizeId]: String(next) }));
  }

  async function saveStock(sizeId: string) {
    const v = Number(editStock[sizeId]);
    if (!Number.isFinite(v) || v < 0) return toast("Enter a valid quantity", "error");
    try {
      await api(`/api/sizes/${sizeId}`, { method: "PUT", body: JSON.stringify({ action: "set_stock", stock: v }) });
      setEditStock((s) => ({ ...s, [sizeId]: "" }));
      await load();
      toast("Stock updated");
    } catch (e: any) {
      toast(e.message, "error");
    }
  }

  if (loading) {
    return <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-neutral-200 rounded-lg" />
      <div className="h-64 bg-neutral-200 rounded-2xl" />
    </div>;
  }
  if (!product) return <p className="text-center text-neutral-500 py-20">Product not found.</p>;

  const totalStock = product.sizes.reduce((n, s) => n + s.stock, 0);
  const totalSold = product.sizes.reduce((n, s) => n + s.sold, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href="/products" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft size={16} /> All Products
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 flex gap-4">
        <div className="relative w-24 h-24 rounded-xl bg-neutral-100 overflow-hidden flex items-center justify-center text-neutral-400 shrink-0">
          {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="96px" className="object-cover" /> : <Package size={32} />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{product.name}</h1>
          <p className="text-sm text-neutral-500">{product.category}{product.sku ? ` · SKU: ${product.sku}` : ""}</p>
          <p className="text-2xl font-bold mt-1">{money(product.price)}</p>
          {product.purchasePrice != null && <p className="text-xs text-neutral-400">Cost: {money(product.purchasePrice)}</p>}
          {product.description && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{product.description}</p>}
          <div className="flex gap-2 mt-3">
            <Link href={`/products/${id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold hover:bg-neutral-50">
              <Pencil size={13} /> Edit
            </Link>
            <button onClick={() => setPending({ kind: "delete" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Stock summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <p className="text-xs text-neutral-500 font-medium">Available Stock</p>
          <p className="text-3xl font-bold">{totalStock}</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 text-center">
          <p className="text-xs text-neutral-500 font-medium">Total Sold</p>
          <p className="text-3xl font-bold">{totalSold}</p>
        </div>
      </div>

      {/* Size cards */}
      <div className="space-y-3">
        <h2 className="font-semibold">Stock by Size</h2>
        {product.sizes.length === 0 && <p className="text-sm text-neutral-400">No sizes yet.</p>}
        {product.sizes.map((s) => {
          const isBusy = busy === s.id + "sell" || busy === s.id + "retrieve";
          const out = s.stock <= 0;
          const low = s.stock > 0 && s.stock <= 3;
          return (
            <div key={s.id} className={`bg-white rounded-2xl border p-4 ${out ? "border-neutral-200 opacity-80" : low ? "border-amber-200" : "border-neutral-200"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-11 h-11 rounded-xl bg-neutral-950 text-white flex items-center justify-center font-bold">{s.label}</span>
                  <div>
                    <p className="text-sm font-semibold">Size {s.label}</p>
                    <p className="text-xs text-neutral-500">
                      {out && s.sold > 0 ? "Out of stock" : `${s.stock} available · ${s.sold} sold`}
                    </p>
                  </div>
                </div>
                {low && !out && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    <AlertTriangle size={10} /> LOW
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => out ? undefined : openSell(s.id, s.label)}
                  disabled={out || isBusy}
                  className="py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <ShoppingBag size={17} /> {isBusy ? "..." : "SELL"}
                </button>
                <button
                  onClick={() => s.sold <= 0 ? undefined : setPending({ kind: "retrieve", sizeId: s.id, label: s.label })}
                  disabled={s.sold <= 0 || isBusy}
                  className="py-3.5 rounded-xl bg-sky-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-sky-700 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Undo2 size={17} /> {isBusy ? "..." : `RETRIEVE (${s.sold})`}
                </button>
              </div>

              {/* Manual stock adjust */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden">
                  <button onClick={() => stepStock(s.id, s.stock, -1)}
                    className="w-10 h-9 flex items-center justify-center hover:bg-neutral-100"><Minus size={15} /></button>
                  <input value={editStock[s.id] ?? String(s.stock)} inputMode="numeric"
                    onChange={(e) => setEditStock((x) => ({ ...x, [s.id]: e.target.value.replace(/\D/g, "") }))}
                    className="w-14 h-9 text-center text-sm font-semibold border-x border-neutral-200 focus:outline-none" />
                  <button onClick={() => stepStock(s.id, s.stock, 1)}
                    className="w-10 h-9 flex items-center justify-center hover:bg-neutral-100"><Plus size={15} /></button>
                </div>
                <button onClick={() => saveStock(s.id)}
                  className="flex-1 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-bold transition">
                  SET STOCK
                </button>
                <button onClick={() => removeSize(s.id, s.label)} title="Remove size"
                  className="w-9 h-9 rounded-xl border border-neutral-200 text-neutral-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add size */}
        <div className="flex gap-2">
          <input value={newSize} onChange={(e) => setNewSize(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSize())}
            placeholder="Add size (S, XXL, 30...)"
            className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          <button onClick={addSize}
            className="px-5 rounded-xl bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition">
            + Size
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        title={pending?.kind === "sell" ? `Sell size ${pending.label}?` : pending?.kind === "retrieve" ? `Retrieve size ${pending.label}?` : "Delete product?"}
        message={
          pending?.kind === "sell" ? "This will mark 1 item as sold and reduce available stock by 1. This sale will be recorded in history."
          : pending?.kind === "retrieve" ? "This will return 1 sold item back to available stock."
          : `This will permanently delete "${product.name}" and all its size stock data. This cannot be undone.`
        }
        confirmLabel={pending?.kind === "sell" ? "Mark Sold" : pending?.kind === "retrieve" ? "Retrieve" : "Delete"}
        danger={pending?.kind === "delete"}
        loading={busy === "delete"}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === "sell" && pending.date && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Sale Date</label>
            <input type="date" value={pending.date} max={todayStr()}
              onChange={(e) => updatePendingDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            {pending.date !== todayStr() && (
              <p className="text-[11px] text-neutral-400 mt-1">Backdated sale — recorded under {pending.date}.</p>
            )}
            {closedDates.has(pending.date) && (
              <p className="text-[11px] font-semibold text-red-600 mt-1">
                {pending.date} is CLOSED — this sale cannot be recorded. Pick an open date.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>

      <Receipt data={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
