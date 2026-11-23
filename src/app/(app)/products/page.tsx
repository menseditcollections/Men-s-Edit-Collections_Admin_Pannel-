"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Search, Package, Plus, AlertTriangle, ArrowUpDown, Download } from "lucide-react";
import { api, money } from "@/components/ui";
import type { Product as ProductT } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

type Sort = "newest" | "oldest" | "stock_desc" | "stock_asc";

function ProductsInner() {
  const [products, setProducts] = useState<ProductT[]>([]);
  const [loading, setLoading] = useState(true);
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [lowOnly, setLowOnly] = useState(sp.get("low") === "1");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    api<{ products: ProductT[] }>("/api/products").then((d) => setProducts(d.products)).finally(() => setLoading(false));
  }, []);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.sizes.forEach((s) => set.add(s.label)));
    return [...set].sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (q) {
      const t = q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(t) || (p.sku ?? "").toLowerCase().includes(t));
    }
    if (cat !== "all") list = list.filter((p) => p.category === cat);
    if (sizeFilter !== "all") list = list.filter((p) => p.sizes.some((s) => s.label === sizeFilter));
    if (lowOnly) list = list.filter((p) => p.sizes.some((s) => s.stock <= 3));
    const sorted = [...list];
    if (sort === "newest") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "oldest") sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (sort === "stock_desc") sorted.sort((a, b) => totalStock(b) - totalStock(a));
    if (sort === "stock_asc") sorted.sort((a, b) => totalStock(a) - totalStock(b));
    return sorted;
  }, [products, q, cat, sizeFilter, lowOnly, sort]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-neutral-500">{products.length} product{products.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/export?kind=products" title="Export products CSV"
            className="flex items-center gap-1.5 px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition">
            <Download size={15} /><span className="hidden sm:inline">CSV</span>
          </a>
          <Link href="/products/new" className="flex items-center gap-1.5 px-4 py-2.5 bg-neutral-950 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition">
            <Plus size={16} /> Add
          </Link>
        </div>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-3 space-y-3">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${cat === c ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
              {c === "all" ? "All" : c}
            </button>
          ))}
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border-0">
            <option value="all">All Sizes</option>
            {allSizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setLowOnly(!lowOnly)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${lowOnly ? "bg-amber-500 text-white" : "bg-neutral-100 text-neutral-600"}`}>
            <AlertTriangle size={12} /> Low Stock
          </button>
          <div className="flex items-center gap-1 ml-auto">
            <ArrowUpDown size={13} className="text-neutral-400" />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
              className="text-xs font-semibold bg-transparent border-0 text-neutral-600 py-1.5">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="stock_desc">Stock: High → Low</option>
              <option value="stock_asc">Stock: Low → High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-neutral-200 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
          <Package size={40} className="mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-500 font-medium">{products.length === 0 ? "No products yet" : "No products match your filters"}</p>
          {products.length === 0 && (
            <Link href="/products/new" className="inline-block mt-4 px-5 py-2.5 bg-neutral-950 text-white rounded-xl text-sm font-semibold">Add First Product</Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p, i) => <ProductRow key={p.id} p={p} index={i} />)}
        </div>
      )}
    </div>
  );
}

function totalStock(p: ProductT) {
  return p.sizes.reduce((n, s) => n + s.stock, 0);
}

function ProductRow({ p, index }: { p: ProductT; index: number }) {
  const stock = totalStock(p);
  const low = p.sizes.some((s) => s.stock <= 3);
  return (
    <Link href={`/products/${p.id}`}
      className="animate-fade-up flex items-center gap-4 bg-white rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="relative w-16 h-16 rounded-xl bg-neutral-100 overflow-hidden flex items-center justify-center text-neutral-400 shrink-0">
        {p.imageUrl ? <Image src={p.imageUrl} alt={p.name} fill sizes="64px" className="object-cover" /> : <Package size={24} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">{p.name}</h3>
          {low && <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><AlertTriangle size={10} /> LOW</span>}
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">{p.category}{p.sku ? ` · ${p.sku}` : ""}</p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {p.sizes.map((s) => (
            <span key={s.id} className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${s.stock <= 3 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-neutral-100 text-neutral-700"}`}>
              {s.label}: {s.stock}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold">{money(p.price)}</p>
        <p className="text-xs text-neutral-500">{stock} in stock</p>
      </div>
    </Link>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsInner />
    </Suspense>
  );
}
