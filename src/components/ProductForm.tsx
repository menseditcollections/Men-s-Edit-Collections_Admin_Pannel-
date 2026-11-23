"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ImagePlus, Camera, Images, X } from "lucide-react";
import { api, useToast } from "@/components/ui";
import { CATEGORIES, type Category, type Product } from "@/lib/types";

const inputCls = "w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white";
const labelCls = "block text-sm font-medium mb-1.5";

export default function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [category, setCategory] = useState<Category>(product?.category ?? "Shirt");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [purchasePrice, setPurchasePrice] = useState(product?.purchasePrice != null ? String(product.purchasePrice) : "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [sizes, setSizes] = useState<string[]>(product?.sizes.map((s) => s.label) ?? ["M", "L", "XL"]);
  const [newSize, setNewSize] = useState("");

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);
      toast("Image uploaded");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  }

  function addSize() {
    const s = newSize.trim();
    if (!s) return;
    if (sizes.some((x) => x.toLowerCase() === s.toLowerCase())) {
      toast(`Size ${s} already added`, "error");
      return;
    }
    setSizes([...sizes, s]);
    setNewSize("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast("Product name is required", "error");
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) return toast("Enter a valid selling price", "error");
    if (sizes.length === 0) return toast("Add at least one size", "error");
    setLoading(true);
    try {
      const payload = {
        name: name.trim(), sku: sku.trim() || undefined, category, price: p,
        purchasePrice: purchasePrice === "" ? null : Number(purchasePrice),
        description: description.trim() || undefined, imageUrl: imageUrl || undefined,
        sizes,
      };
      if (product) {
        const { name: n, sku: sk, category: cat, price: pr, purchasePrice: pp, description: d, imageUrl: img } = payload;
        await api(`/api/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: n, sku: sk, category: cat, price: pr, purchasePrice: pp, description: d, imageUrl: img }),
        });
        toast("Product updated");
      } else {
        await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
        toast("Product added");
      }
      router.push("/products");
      router.refresh();
    } catch (err: any) {
      toast(err.message || "Save failed", "error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Image */}
      <div>
        <span className={labelCls}>Product Image</span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
        {imageUrl ? (
          <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-neutral-100">
            <Image src={imageUrl} alt="Product" fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
            <button type="button" onClick={() => setImageUrl("")}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        ) : showSourcePicker ? (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setShowSourcePicker(false); cameraRef.current?.click(); }} disabled={uploading}
              className="h-32 rounded-2xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center gap-2 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 transition disabled:opacity-50">
              <Camera size={24} />
              <span className="text-sm font-medium">Take Photo</span>
              <span className="text-xs text-neutral-400">Uses camera</span>
            </button>
            <button type="button" onClick={() => { setShowSourcePicker(false); fileRef.current?.click(); }} disabled={uploading}
              className="h-32 rounded-2xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center gap-2 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 transition disabled:opacity-50">
              <Images size={24} />
              <span className="text-sm font-medium">Gallery</span>
              <span className="text-xs text-neutral-400">Choose file</span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowSourcePicker(true)} disabled={uploading}
            className="w-full h-32 rounded-2xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center gap-2 text-neutral-500 hover:border-neutral-500 hover:text-neutral-700 transition disabled:opacity-50">
            <ImagePlus size={24} />
            <span className="text-sm font-medium">{uploading ? "Uploading..." : "Tap to upload photo"}</span>
            <span className="text-xs text-neutral-400">Camera or gallery</span>
          </button>
        )}
      </div>

      <div>
        <label className={labelCls}>Product Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Black Casual Shirt"
          className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Category *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>SKU / Code</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Selling Price (₹) *</label>
          <input type="number" inputMode="decimal" min="0" step="0.01" value={price}
            onChange={(e) => setPrice(e.target.value)} required placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Purchase Price (₹)</label>
          <input type="number" inputMode="decimal" min="0" step="0.01" value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)} placeholder="Optional" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          placeholder="Optional notes..." className={`${inputCls} resize-none`} />
      </div>

      {/* Sizes */}
      <div>
        <span className={labelCls}>Sizes *</span>
        <p className="text-xs text-neutral-500 mb-2">Stock is tracked separately for each size. Add custom sizes anytime.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {sizes.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold">
              {s}
              <button type="button" onClick={() => setSizes(sizes.filter((x) => x !== s))}
                className="w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center" aria-label={`Remove ${s}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newSize} onChange={(e) => setNewSize(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(); } }}
            placeholder="Add size (e.g. S, XXL, 32)" className={`${inputCls} flex-1`} />
          <button type="button" onClick={addSize}
            className="px-4 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-sm font-semibold flex items-center gap-1 transition">
            <Plus size={16} /> Add
          </button>
        </div>
        {product && (
          <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1">
            <Trash2 size={11} /> Edit page manages details only — add/remove sizes & stock on the product page.
          </p>
        )}
      </div>

      <button disabled={loading || uploading}
        className="w-full py-4 rounded-2xl bg-neutral-950 text-white font-bold text-sm tracking-wide hover:bg-neutral-800 transition disabled:opacity-50">
        {loading ? "Saving..." : product ? "Save Changes" : "Add Product"}
      </button>
    </form>
  );
}
