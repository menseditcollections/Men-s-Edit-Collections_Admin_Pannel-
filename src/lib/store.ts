import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import type {
  Admin, Category, DailySale, DashboardStats, DayClosure, DayClosureItem, Movement, MovementType, Product, Size,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Backend selection: Supabase when env vars exist, else local JSON.  */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

let supabase: SupabaseClient | null = null;
if (useSupabase) {
  supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { persistSession: false },
  });
}

const DB_FILE = path.join(process.cwd(), ".data", "db.json");

interface LocalDB {
  products: Product[];
  dailySales: DailySale[];
  movements: Movement[];
  dayClosures: DayClosure[];
  admins: Admin[];
}

// Seed admins for the local JSON fallback only (Supabase admins come from the admins table)
const LOCAL_ADMIN_SEED = [
  { username: "Jayaprasanna", password: "jaya2005" },
  { username: "Kalaiarasan", password: "kalai2005" },
  { username: "Manikandan", password: "mani2003" },
];

function localAdminHash(password: string) {
  // same formula as src/lib/auth.ts hashPassword
  const secret = process.env.AUTH_SECRET || "mens-edit-dev-secret";
  return createHash("sha256").update(`mec:${password}:${secret}`).digest("hex");
}

function loadLocal(): LocalDB {
  try {
    const d = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Partial<LocalDB>;
    return {
      products: d.products ?? [],
      dailySales: d.dailySales ?? [],
      movements: d.movements ?? [],
      dayClosures: d.dayClosures ?? [],
      admins: d.admins ?? [],
    };
  } catch {
    return { products: [], dailySales: [], movements: [], dayClosures: [], admins: [] };
  }
}

function saveLocal(db: LocalDB) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
/** ISO timestamp on a given YYYY-MM-DD date, keeping the current UTC time-of-day. */
const saleTs = (date: string) => `${date}T${now().slice(11)}`;

/* ================================================================== */
/*  SUPABASE IMPLEMENTATION                                            */
/* ================================================================== */

async function sb<T>(q: any): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as T;
}

const sbProducts = {
  async list(): Promise<Product[]> {
    const products = await sb<any[]>(
      supabase!.from("products").select("*, sizes(*)").order("created_at", { ascending: false })
    );
    return products.map(mapSbProduct);
  },
  async get(id: string): Promise<Product | null> {
    const rows = await sb<any[]>(
      supabase!.from("products").select("*, sizes(*)").eq("id", id).limit(1)
    );
    return rows[0] ? mapSbProduct(rows[0]) : null;
  },
  async create(input: ProductInput): Promise<Product> {
    const p = await sb<any>(
      supabase!.from("products").insert({
        name: input.name, sku: input.sku || null, category: input.category,
        price: input.price, purchase_price: input.purchasePrice ?? null,
        description: input.description || null, image_url: input.imageUrl || null,
      }).select().single()
    );
    const sizes = input.sizes?.length ? input.sizes : ["M", "L", "XL"];
    const sizeRows = sizes.map((label, i) => ({
      product_id: p.id, label, sort_order: i,
    }));
    await sb(supabase!.from("sizes").insert(sizeRows));
    await sb(supabase!.from("movements").insert({
      product_id: p.id, product_name: p.name, type: "product_created",
      note: `Product "${p.name}" created with sizes: ${sizes.join(", ")}`,
    }));
    return (await sbProducts.get(p.id))!;
  },
  async update(id: string, input: Partial<ProductInput>): Promise<Product> {
    const patch: any = { updated_at: now() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.sku !== undefined) patch.sku = input.sku || null;
    if (input.category !== undefined) patch.category = input.category;
    if (input.price !== undefined) patch.price = input.price;
    if (input.purchasePrice !== undefined) patch.purchase_price = input.purchasePrice ?? null;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.imageUrl !== undefined) patch.image_url = input.imageUrl || null;
    await sb(supabase!.from("products").update(patch).eq("id", id));
    const product = await sbProducts.get(id);
    await sb(supabase!.from("movements").insert({
      product_id: id, product_name: product?.name ?? null,
      type: "product_updated", note: `Product "${product?.name}" updated`,
    }));
    return product!;
  },
  async remove(id: string): Promise<void> {
    const p = await sbProducts.get(id);
    await sb(supabase!.from("products").delete().eq("id", id));
    await sb(supabase!.from("movements").insert({
      product_id: id, product_name: p?.name ?? null, type: "product_deleted",
      note: `Product "${p?.name}" deleted`,
    }));
  },
  async addSize(productId: string, label: string): Promise<Size> {
    const product = await sbProducts.get(productId);
    if (product?.sizes.some((s) => s.label.toLowerCase() === label.toLowerCase()))
      throw new Error(`Size ${label} already exists`);
    const maxOrder = Math.max(0, ...(product?.sizes.map((s) => s.sortOrder) ?? [0]));
    const row = await sb<any>(
      supabase!.from("sizes").insert({
        product_id: productId, label, sort_order: maxOrder + 1,
      }).select().single()
    );
    await sb(supabase!.from("movements").insert({
      product_id: productId, product_name: product?.name ?? null,
      size_id: row.id, size_label: label, type: "size_added",
      note: `Size ${label} added to "${product?.name}"`,
    }));
    return mapSbSize(row);
  },
  async updateSize(id: string, patch: { label?: string; sortOrder?: number }): Promise<Size> {
    if (patch.label !== undefined) {
      const rows = await sb<any[]>(supabase!.from("sizes").select("product_id, products(name, sizes(id, label))").eq("id", id).limit(1));
      const s = rows[0];
      const siblings = ((s?.products?.sizes ?? []) as { id: string; label: string }[]).filter((x) => x.id !== id);
      if (siblings.some((x) => x.label.toLowerCase() === String(patch.label).toLowerCase()))
        throw new Error(`Size ${patch.label} already exists`);
    }
    const data: any = {};
    if (patch.label !== undefined) data.label = patch.label;
    if (patch.sortOrder !== undefined) data.sort_order = patch.sortOrder;
    return mapSbSize(await sb<any>(supabase!.from("sizes").update(data).eq("id", id).select().single()));
  },
  async removeSize(id: string): Promise<void> {
    const rows = await sb<any[]>(supabase!.from("sizes").select("*, products(name)").eq("id", id).limit(1));
    const s = rows[0];
    await sb(supabase!.from("sizes").delete().eq("id", id));
    if (s) {
      await sb(supabase!.from("movements").insert({
        product_id: s.product_id, product_name: s.products?.name ?? null,
        size_id: id, size_label: s.label, type: "size_removed",
        quantity: s.stock, note: `Size ${s.label} removed (${s.stock} stock, ${s.sold} sold)`,
      }));
    }
  },
  async setStock(sizeId: string, stock: number): Promise<Size> {
    const row = await sb<any>(
      supabase!.from("sizes").update({ stock: Math.max(0, stock) }).eq("id", sizeId).select().single()
    );
    return mapSbSize(row);
  },
  async sell(sizeId: string, saleDate?: string): Promise<Size> {
    const rows = await sb<any[]>(supabase!.from("sizes").select("*").eq("id", sizeId).limit(1));
    const s = rows[0];
    if (!s) throw new Error("Size not found");
    if (s.stock <= 0) throw new Error("Out of stock");
    const upd = await supabase!.from("sizes")
      .update({ stock: s.stock - 1, sold: s.sold + 1 })
      .eq("id", sizeId).eq("stock", s.stock).select().single();
    if (upd.error || !upd.data) throw new Error("Stock changed, please retry");
    const product = await sb<any>(supabase!.from("products").select("name, price").eq("id", s.product_id).single());
    await sb(supabase!.from("movements").insert({
      product_id: s.product_id, product_name: product.name,
      size_id: sizeId, size_label: s.label, type: "sale",
      quantity: 1, amount: Number(product.price),
      note: `Sold 1 x ${s.label}`,
      ...(saleDate ? { created_at: saleTs(saleDate) } : {}),
    }));
    return mapSbSize(upd.data);
  },
  async retrieve(sizeId: string, saleDate?: string): Promise<Size> {
    const rows = await sb<any[]>(supabase!.from("sizes").select("*").eq("id", sizeId).limit(1));
    const s = rows[0];
    if (!s) throw new Error("Size not found");
    if (s.sold <= 0) throw new Error("No sold items to retrieve");
    const upd = await supabase!.from("sizes")
      .update({ stock: s.stock + 1, sold: s.sold - 1 })
      .eq("id", sizeId).eq("sold", s.sold).select().single();
    if (upd.error || !upd.data) throw new Error("Data changed, please retry");
    const product = await sb<any>(supabase!.from("products").select("name, price").eq("id", s.product_id).single());
    await sb(supabase!.from("movements").insert({
      product_id: s.product_id, product_name: product.name,
      size_id: sizeId, size_label: s.label, type: "retrieve",
      quantity: 1, amount: -Number(product.price),
      note: `Retrieved 1 x ${s.label}`,
      ...(saleDate ? { created_at: saleTs(saleDate) } : {}),
    }));
    return mapSbSize(upd.data);
  },
  dailySales: {
    async list(): Promise<DailySale[]> {
      return (await sb<any[]>(supabase!.from("daily_sales").select("*").order("sale_date", { ascending: false })))
        .map((r) => ({ id: r.id, date: r.sale_date, amount: Number(r.amount), note: r.note, createdAt: r.created_at }));
    },
    async upsert(date: string, amount: number, note?: string | null): Promise<DailySale> {
      const row = await sb<any>(
        supabase!.from("daily_sales").upsert({ sale_date: date, amount, note: note || null }, { onConflict: "sale_date" }).select().single()
      );
      await sb(supabase!.from("movements").insert({
        type: "daily_sale", amount, note: `Manual daily sales entry for ${date}${note ? ` — ${note}` : ""}`,
      }));
      return { id: row.id, date: row.sale_date, amount: Number(row.amount), note: row.note, createdAt: row.created_at };
    },
    async update(id: string, amount: number, note?: string | null, date?: string): Promise<DailySale> {
      const patch: any = { amount, note: note || null };
      if (date) patch.sale_date = date;
      const row = await sb<any>(supabase!.from("daily_sales").update(patch).eq("id", id).select().single());
      return { id: row.id, date: row.sale_date, amount: Number(row.amount), note: row.note, createdAt: row.created_at };
    },
    async remove(id: string): Promise<void> {
      await sb(supabase!.from("daily_sales").delete().eq("id", id));
    },
  },
  movements: {
    async list(filters: { productId?: string; type?: string; from?: string; to?: string; q?: string; all?: boolean } = {}): Promise<Movement[]> {
      let query = supabase!.from("movements").select("*").order("created_at", { ascending: false });
      if (!filters.all) query = query.limit(500);
      if (filters.productId) query = query.eq("product_id", filters.productId);
      if (filters.type) query = query.eq("type", filters.type);
      if (filters.from) query = query.gte("created_at", filters.from);
      if (filters.to) query = query.lte("created_at", filters.to + "T23:59:59.999Z");
      if (filters.q) query = query.ilike("product_name", `%${filters.q}%`);
      return (await sb<any[]>(query)).map(mapSbMovement);
    },
    async remove(id: string): Promise<void> {
      await sb(supabase!.from("movements").delete().eq("id", id));
    },
  },
};

function mapSbProduct(r: any): Product {
  return {
    id: r.id, name: r.name, sku: r.sku, category: r.category,
    price: Number(r.price), purchasePrice: r.purchase_price == null ? null : Number(r.purchase_price),
    description: r.description, imageUrl: r.image_url,
    createdAt: r.created_at, updatedAt: r.updated_at,
    sizes: ((r.sizes ?? []) as any[]).map(mapSbSize).sort((a: Size, b: Size) => a.sortOrder - b.sortOrder),
  };
}
function mapSbSize(r: any): Size {
  return {
    id: r.id, productId: r.product_id, label: r.label,
    stock: r.stock, sold: r.sold, sortOrder: r.sort_order ?? 0, createdAt: r.created_at,
  };
}
function mapSbMovement(r: any): Movement {
  return {
    id: r.id, productId: r.product_id, productName: r.product_name,
    sizeId: r.size_id, sizeLabel: r.size_label, type: r.type,
    quantity: r.quantity ?? 0, amount: r.amount == null ? null : Number(r.amount),
    note: r.note, createdAt: r.created_at,
  };
}

/* ================================================================== */
/*  LOCAL JSON IMPLEMENTATION                                          */
/* ================================================================== */

function localMovement(partial: Partial<Movement> & { type: MovementType }): Movement {
  const m: Movement = {
    id: uid(), productId: null, productName: null, sizeId: null, sizeLabel: null,
    quantity: 0, amount: null, note: null, createdAt: now(), ...partial,
  };
  const db = loadLocal();
  db.movements.unshift(m);
  saveLocal(db);
  return m;
}

const localProducts = {
  async list(): Promise<Product[]> {
    const db = loadLocal();
    return [...db.products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async get(id: string) {
    const db = loadLocal();
    const p = db.products.find((x) => x.id === id);
    return p ? { ...p, sizes: [...p.sizes].sort((a, b) => a.sortOrder - b.sortOrder) } : null;
  },
  async create(input: ProductInput): Promise<Product> {
    const db = loadLocal();
    const ts = now();
    const p: Product = {
      id: uid(), name: input.name, sku: input.sku || null, category: input.category,
      price: input.price, purchasePrice: input.purchasePrice ?? null,
      description: input.description || null, imageUrl: input.imageUrl || null,
      createdAt: ts, updatedAt: ts, sizes: [],
    };
    const labels = input.sizes?.length ? input.sizes : ["M", "L", "XL"];
    p.sizes = labels.map((label, i) => ({
      id: uid(), productId: p.id, label, stock: 0, sold: 0, sortOrder: i, createdAt: ts,
    }));
    db.products.unshift(p);
    saveLocal(db);
    localMovement({
      productId: p.id, productName: p.name, type: "product_created",
      note: `Product "${p.name}" created with sizes: ${labels.join(", ")}`,
    });
    return p;
  },
  async update(id: string, input: Partial<ProductInput>): Promise<Product> {
    const db = loadLocal();
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new Error("Product not found");
    Object.assign(p, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.sku !== undefined && { sku: input.sku || null }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.purchasePrice !== undefined && { purchasePrice: input.purchasePrice ?? null }),
      ...(input.description !== undefined && { description: input.description || null }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl || null }),
      updatedAt: now(),
    });
    saveLocal(db);
    localMovement({
      productId: p.id, productName: p.name, type: "product_updated",
      note: `Product "${p.name}" updated`,
    });
    return p;
  },
  async remove(id: string): Promise<void> {
    const db = loadLocal();
    const p = db.products.find((x) => x.id === id);
    db.products = db.products.filter((x) => x.id !== id);
    saveLocal(db);
    if (p) localMovement({
      productId: id, productName: p.name, type: "product_deleted",
      note: `Product "${p.name}" deleted`,
    });
  },
  async addSize(productId: string, label: string): Promise<Size> {
    const db = loadLocal();
    const p = db.products.find((x) => x.id === productId);
    if (!p) throw new Error("Product not found");
    if (p.sizes.some((s) => s.label.toLowerCase() === label.toLowerCase()))
      throw new Error(`Size ${label} already exists`);
    const s: Size = {
      id: uid(), productId, label, stock: 0, sold: 0,
      sortOrder: Math.max(0, ...p.sizes.map((x) => x.sortOrder)) + 1, createdAt: now(),
    };
    p.sizes.push(s);
    p.updatedAt = now();
    saveLocal(db);
    localMovement({
      productId, productName: p.name, sizeId: s.id, sizeLabel: label,
      type: "size_added", note: `Size ${label} added to "${p.name}"`,
    });
    return s;
  },
  async updateSize(id: string, patch: { label?: string; sortOrder?: number }): Promise<Size> {
    const db = loadLocal();
    for (const p of db.products) {
      const s = p.sizes.find((x) => x.id === id);
      if (s) {
        if (patch.label) s.label = patch.label;
        if (patch.sortOrder !== undefined) s.sortOrder = patch.sortOrder;
        saveLocal(db);
        return s;
      }
    }
    throw new Error("Size not found");
  },
  async removeSize(id: string): Promise<void> {
    const db = loadLocal();
    for (const p of db.products) {
      const i = p.sizes.findIndex((x) => x.id === id);
      if (i >= 0) {
        const [s] = p.sizes.splice(i, 1);
        p.updatedAt = now();
        saveLocal(db);
        localMovement({
          productId: p.id, productName: p.name, sizeId: id, sizeLabel: s.label,
          type: "size_removed", quantity: s.stock,
          note: `Size ${s.label} removed (${s.stock} stock, ${s.sold} sold)`,
        });
        return;
      }
    }
    throw new Error("Size not found");
  },
  async setStock(sizeId: string, stock: number): Promise<Size> {
    const db = loadLocal();
    for (const p of db.products) {
      const s = p.sizes.find((x) => x.id === sizeId);
      if (s) {
        s.stock = Math.max(0, stock);
        saveLocal(db);
        return s;
      }
    }
    throw new Error("Size not found");
  },
  async sell(sizeId: string, saleDate?: string): Promise<Size> {
    const db = loadLocal();
    for (const p of db.products) {
      const s = p.sizes.find((x) => x.id === sizeId);
      if (s) {
        if (s.stock <= 0) throw new Error("Out of stock");
        s.stock -= 1;
        s.sold += 1;
        p.updatedAt = now();
        saveLocal(db);
        localMovement({
          productId: p.id, productName: p.name, sizeId, sizeLabel: s.label,
          type: "sale", quantity: 1, amount: p.price, note: `Sold 1 x ${s.label}`,
          ...(saleDate ? { createdAt: saleTs(saleDate) } : {}),
        });
        return s;
      }
    }
    throw new Error("Size not found");
  },
  async retrieve(sizeId: string, saleDate?: string): Promise<Size> {
    const db = loadLocal();
    for (const p of db.products) {
      const s = p.sizes.find((x) => x.id === sizeId);
      if (s) {
        if (s.sold <= 0) throw new Error("No sold items to retrieve");
        s.sold -= 1;
        s.stock += 1;
        p.updatedAt = now();
        saveLocal(db);
        localMovement({
          productId: p.id, productName: p.name, sizeId, sizeLabel: s.label,
          type: "retrieve", quantity: 1, amount: -p.price, note: `Retrieved 1 x ${s.label}`,
          ...(saleDate ? { createdAt: saleTs(saleDate) } : {}),
        });
        return s;
      }
    }
    throw new Error("Size not found");
  },
  dailySales: {
    async list(): Promise<DailySale[]> {
      return [...loadLocal().dailySales].sort((a, b) => b.date.localeCompare(a.date));
    },
    async upsert(date: string, amount: number, note?: string | null): Promise<DailySale> {
      const db = loadLocal();
      const existing = db.dailySales.find((d) => d.date === date);
      const sale: DailySale = existing
        ? { ...existing, amount, note: note || null }
        : { id: uid(), date, amount, note: note || null, createdAt: now() };
      if (existing) Object.assign(existing, sale);
      else db.dailySales.push(sale);
      saveLocal(db);
      localMovement({
        type: "daily_sale", amount, note: `Manual daily sales entry for ${date}${note ? ` — ${note}` : ""}`,
      });
      return sale;
    },
    async update(id: string, amount: number, note?: string | null, date?: string): Promise<DailySale> {
      const db = loadLocal();
      const s = db.dailySales.find((d) => d.id === id);
      if (!s) throw new Error("Entry not found");
      s.amount = amount;
      s.note = note || null;
      if (date) s.date = date;
      saveLocal(db);
      return s;
    },
    async remove(id: string): Promise<void> {
      const db = loadLocal();
      db.dailySales = db.dailySales.filter((d) => d.id !== id);
      saveLocal(db);
    },
  },
  movements: {
    async list(filters: { productId?: string; type?: string; from?: string; to?: string; q?: string; all?: boolean } = {}): Promise<Movement[]> {
      let list = loadLocal().movements;
      if (filters.productId) list = list.filter((m) => m.productId === filters.productId);
      if (filters.type) list = list.filter((m) => m.type === filters.type);
      if (filters.from) list = list.filter((m) => m.createdAt >= filters.from!);
      if (filters.to) list = list.filter((m) => m.createdAt <= filters.to! + "T23:59:59.999Z");
      if (filters.q) list = list.filter((m) => (m.productName ?? "").toLowerCase().includes(filters.q!.toLowerCase()));
      return filters.all ? list : list.slice(0, 500);
    },
    async remove(id: string): Promise<void> {
      const db = loadLocal();
      db.movements = db.movements.filter((m) => m.id !== id);
      saveLocal(db);
    },
  },
};

/* ================================================================== */
/*  BACKUP / RESTORE                                                   */
/* ================================================================== */

export interface BackupData {
  version: 1;
  exportedAt: string;
  backend: "supabase" | "local";
  products: Product[];
  dailySales: DailySale[];
  movements: Movement[];
  dayClosures: DayClosure[];
}

async function sbExportAll(): Promise<BackupData> {
  const [products, dailySales, movements, dayClosures] = await Promise.all([
    sbProducts.list(), sbProducts.dailySales.list(), sbProducts.movements.list({ all: true }),
    sbDayClosures.list(),
  ]);
  return { version: 1, exportedAt: now(), backend: "supabase", products, dailySales, movements, dayClosures };
}

async function sbRestoreAll(data: BackupData) {
  const products = Array.isArray(data.products) ? data.products : [];
  const dailySales = Array.isArray(data.dailySales) ? data.dailySales : [];
  const movements = Array.isArray(data.movements) ? data.movements : [];

  const epoch = "1970-01-01T00:00:00.000Z";
  await sb(supabase!.from("movements").delete().gte("created_at", epoch));
  await sb(supabase!.from("daily_sales").delete().gte("created_at", epoch));
  await sb(supabase!.from("day_closures").delete().gte("closed_at", epoch));
  await sb(supabase!.from("products").delete().gte("created_at", epoch)); // cascades sizes

  const idMap = new Map<string, string>();
  for (const p of products) {
    const row = await sb<any>(
      supabase!.from("products").insert({
        name: p.name, sku: p.sku ?? null, category: p.category,
        price: p.price, purchase_price: p.purchasePrice ?? null,
        description: p.description ?? null, image_url: p.imageUrl ?? null,
        created_at: p.createdAt, updated_at: p.updatedAt,
      }).select("id").single()
    );
    idMap.set(p.id, row.id);
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    if (sizes.length) {
      for (let i = 0; i < sizes.length; i += 500) {
        await sb(supabase!.from("sizes").insert(sizes.slice(i, i + 500).map((s) => ({
          product_id: row.id, label: s.label,
          stock: Math.max(0, Math.trunc(Number(s.stock) || 0)),
          sold: Math.max(0, Math.trunc(Number(s.sold) || 0)),
          sort_order: Number(s.sortOrder) || 0, created_at: s.createdAt,
        }))));
      }
    }
  }

  for (let i = 0; i < dailySales.length; i += 500) {
    await sb(supabase!.from("daily_sales").insert(dailySales.slice(i, i + 500).map((d) => ({
      sale_date: d.date, amount: Number(d.amount) || 0, note: d.note ?? null, created_at: d.createdAt,
    }))));
  }
  for (let i = 0; i < movements.length; i += 500) {
    await sb(supabase!.from("movements").insert(movements.slice(i, i + 500).map((m) => ({
      product_id: m.productId ? (idMap.get(m.productId) ?? null) : null,
      product_name: m.productName ?? null,
      size_id: m.sizeId ?? null, size_label: m.sizeLabel ?? null,
      type: m.type, quantity: Number(m.quantity) || 0, amount: m.amount ?? null,
      note: m.note ?? null, created_at: m.createdAt,
    }))));
  }

  const closures = Array.isArray(data.dayClosures) ? data.dayClosures : [];
  for (let i = 0; i < closures.length; i += 500) {
    await sb(supabase!.from("day_closures").insert(closures.slice(i, i + 500).map((c) => ({
      closure_date: c.date, closed_at: c.closedAt, payload: c,
    }))));
  }
}

function localExportAll(): BackupData {
  const db = loadLocal();
  return {
    version: 1, exportedAt: now(), backend: "local",
    products: db.products, dailySales: db.dailySales, movements: db.movements,
    dayClosures: db.dayClosures,
  };
}

function localRestoreAll(data: BackupData) {
  saveLocal({
    products: Array.isArray(data.products) ? data.products : [],
    dailySales: Array.isArray(data.dailySales) ? data.dailySales : [],
    movements: Array.isArray(data.movements) ? data.movements : [],
    dayClosures: Array.isArray(data.dayClosures) ? data.dayClosures : [],
    admins: loadLocal().admins, // admins are config, not restorable data
  });
}

/* ================================================================== */
/*  PUBLIC API                                                         */
/* ================================================================== */

export interface ProductInput {
  name: string;
  sku?: string;
  category: Category;
  price: number;
  purchasePrice?: number | null;
  description?: string;
  imageUrl?: string;
  sizes?: string[];
}

interface MovementFilters {
  productId?: string;
  type?: string;
  from?: string;
  to?: string;
  q?: string;
  all?: boolean;
}

interface ProductStore {
  list(): Promise<Product[]>;
  get(id: string): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  update(id: string, input: Partial<ProductInput>): Promise<Product>;
  remove(id: string): Promise<void>;
  addSize(productId: string, label: string): Promise<Size>;
  updateSize(id: string, patch: { label?: string; sortOrder?: number }): Promise<Size>;
  removeSize(id: string): Promise<void>;
  setStock(sizeId: string, stock: number): Promise<Size>;
  sell(sizeId: string, saleDate?: string): Promise<Size>;
  retrieve(sizeId: string, saleDate?: string): Promise<Size>;
}

interface SalesStore {
  list(): Promise<DailySale[]>;
  upsert(date: string, amount: number, note?: string | null): Promise<DailySale>;
  update(id: string, amount: number, note?: string | null, date?: string): Promise<DailySale>;
  remove(id: string): Promise<void>;
}

interface MovementsStore {
  list(filters?: MovementFilters): Promise<Movement[]>;
  remove(id: string): Promise<void>;
}

const products: ProductStore = useSupabase ? sbProducts : localProducts;
const dailySales: SalesStore = useSupabase ? sbProducts.dailySales : localProducts.dailySales;
const movements: MovementsStore = useSupabase ? sbProducts.movements : localProducts.movements;

/* ================================================================== */
/*  DAY CLOSURES                                                       */
/* ================================================================== */

interface DayClosuresStore {
  list(): Promise<DayClosure[]>;
  getByDate(date: string): Promise<DayClosure | null>;
  save(c: DayClosure): Promise<DayClosure>;
  remove(id: string): Promise<void>;
}

/** Compute the live sales report for a date (YYYY-MM-DD) from movements + manual sales. */
async function computeDayReport(date: string): Promise<Omit<DayClosure, "id">> {
  const [movs, sales] = await Promise.all([
    movements.list({ from: date, to: date, all: true }),
    dailySales.list(),
  ]);
  const dayMovs = movs.filter((m) => m.createdAt.slice(0, 10) === date);
  const saleMovs = dayMovs.filter((m) => m.type === "sale");
  const retrieveMovs = dayMovs.filter((m) => m.type === "retrieve");

  const items: DayClosureItem[] = saleMovs.map((m) => ({
    productName: m.productName ?? "Unknown product",
    sizeLabel: m.sizeLabel,
    price: m.amount ?? 0,
    movementId: m.id,
  }));
  const saleTotal = saleMovs.reduce((n, m) => n + (m.amount ?? 0), 0);
  const retrieveTotal = retrieveMovs.reduce((n, m) => n + Math.abs(m.amount ?? 0), 0);
  const manual = sales.find((s) => s.date === date) ?? null;
  const itemSalesTotal = Math.max(0, saleTotal - retrieveTotal);

  return {
    date,
    closedAt: now(),
    items,
    saleCount: saleMovs.length,
    retrievedCount: retrieveMovs.length,
    itemSalesTotal,
    manualAmount: manual?.amount ?? 0,
    manualNote: manual?.note ?? null,
    grandTotal: itemSalesTotal + (manual?.amount ?? 0),
  };
}

function mapSbClosure(r: any): DayClosure {
  const p = (r.payload ?? {}) as Partial<DayClosure>;
  return {
    id: r.id,
    date: r.closure_date,
    closedAt: r.closed_at,
    items: p.items ?? [],
    saleCount: p.saleCount ?? 0,
    retrievedCount: p.retrievedCount ?? 0,
    itemSalesTotal: p.itemSalesTotal ?? 0,
    manualAmount: p.manualAmount ?? 0,
    manualNote: p.manualNote ?? null,
    grandTotal: p.grandTotal ?? 0,
  };
}

function mapSbAdmin(r: any): Admin {
  return { id: r.id, username: r.username, passwordHash: r.password_hash, createdAt: r.created_at };
}

const sbDayClosures: DayClosuresStore = {
  async list() {
    const rows = await sb<any[]>(
      supabase!.from("day_closures").select("*").order("closure_date", { ascending: false })
    );
    return rows.map(mapSbClosure);
  },
  async getByDate(date: string) {
    const rows = await sb<any[]>(
      supabase!.from("day_closures").select("*").eq("closure_date", date).limit(1)
    );
    return rows[0] ? mapSbClosure(rows[0]) : null;
  },
  async save(c: DayClosure) {
    const row = await sb<any>(
      supabase!.from("day_closures").upsert(
        { closure_date: c.date, closed_at: c.closedAt, payload: c },
        { onConflict: "closure_date" }
      ).select().single()
    );
    return mapSbClosure(row);
  },
  async remove(id: string) {
    await sb(supabase!.from("day_closures").delete().eq("id", id));
  },
};

const localDayClosures: DayClosuresStore = {
  async list() {
    return [...loadLocal().dayClosures].sort((a, b) => b.date.localeCompare(a.date));
  },
  async getByDate(date: string) {
    return loadLocal().dayClosures.find((c) => c.date === date) ?? null;
  },
  async save(c: DayClosure) {
    const db = loadLocal();
    const i = db.dayClosures.findIndex((x) => x.date === c.date);
    if (i >= 0) db.dayClosures[i] = c;
    else db.dayClosures.push(c);
    saveLocal(db);
    return c;
  },
  async remove(id: string) {
    const db = loadLocal();
    db.dayClosures = db.dayClosures.filter((c) => c.id !== id);
    saveLocal(db);
  },
};

const dayClosures: DayClosuresStore = useSupabase ? sbDayClosures : localDayClosures;

/** Reverse the stock/sold effect of a sale or retrieve movement (used when deleting it). */
async function reverseMovementStock(m: Movement): Promise<void> {
  const qty = Math.max(1, m.quantity || 1);
  if (useSupabase) {
    const rows = await sb<any[]>(supabase!.from("sizes").select("*").eq("id", m.sizeId!).limit(1));
    const s = rows[0];
    if (!s) return;
    const patch = m.type === "sale"
      ? { stock: s.stock + qty, sold: s.sold - qty }
      : { stock: s.stock - qty, sold: s.sold + qty };
    if (patch.stock < 0 || patch.sold < 0) throw new Error("Cannot delete — stock has changed since this sale");
    await sb(supabase!.from("sizes").update(patch).eq("id", m.sizeId!));
    return;
  }
  const db = loadLocal();
  for (const p of db.products) {
    const s = p.sizes.find((x) => x.id === m.sizeId);
    if (s) {
      const patch = m.type === "sale"
        ? { stock: s.stock + qty, sold: s.sold - qty }
        : { stock: s.stock - qty, sold: s.sold + qty };
      if (patch.stock < 0 || patch.sold < 0) throw new Error("Cannot delete — stock has changed since this sale");
      s.stock = patch.stock;
      s.sold = patch.sold;
      p.updatedAt = now();
      saveLocal(db);
      return;
    }
  }
}

export const store = {
  backend: useSupabase ? ("supabase" as const) : ("local" as const),
  products,
  dailySales,
  movements,
  dayClosures,
  admins: {
    async list(): Promise<Admin[]> {
      const seed = (): Admin[] => LOCAL_ADMIN_SEED.map((a) => ({
        id: `seed-${a.username.toLowerCase()}`, username: a.username,
        passwordHash: localAdminHash(a.password), createdAt: now(),
      }));
      if (useSupabase) {
        try {
          const rows = await sb<any[]>(
            supabase!.from("admins").select("*").order("username", { ascending: true })
          );
          // table exists but empty → treat as unseeded and use defaults
          if (rows.length > 0) return rows.map(mapSbAdmin);
        } catch {
          // admins table not created yet → fall through to seed defaults
        }
        return seed();
      }
      const db = loadLocal();
      if (db.admins.length === 0) {
        db.admins = seed().map((a) => ({ ...a, id: uid() }));
        saveLocal(db);
      }
      return db.admins;
    },
  },

  async closeDay(date: string): Promise<DayClosure> {
    const report = await computeDayReport(date);
    return dayClosures.save({ id: uid(), ...report });
  },
  async dayReport(date: string) {
    return computeDayReport(date);
  },

  /** Recompute a closed day's snapshot from live data, preserving its id & closedAt. */
  async refreshClosedDay(date: string): Promise<DayClosure | null> {
    const existing = await dayClosures.getByDate(date);
    if (!existing) return null;
    const report = await computeDayReport(date);
    return dayClosures.save({ ...existing, ...report, id: existing.id, closedAt: existing.closedAt });
  },

  /** Edit the manual sales amount/note of a CLOSED day, then refresh its snapshot. */
  async setClosedDayManual(date: string, amount: number, note?: string | null): Promise<DayClosure | null> {
    const existing = (await dailySales.list()).find((s) => s.date === date);
    if (amount > 0) {
      if (existing) await dailySales.update(existing.id, amount, note ?? null);
      else await dailySales.upsert(date, amount, note ?? null);
    } else if (existing) {
      await dailySales.remove(existing.id);
    }
    return this.refreshClosedDay(date);
  },

  /** Delete a sale/retrieve movement, reverse its stock effect, refresh any closed-day snapshot. */
  async deleteMovement(id: string): Promise<void> {
    const all = await movements.list({ all: true });
    const m = all.find((x) => x.id === id);
    if (!m) throw new Error("Movement not found");
    if ((m.type === "sale" || m.type === "retrieve") && m.sizeId) {
      await reverseMovementStock(m);
    }
    await movements.remove(id);
    await this.refreshClosedDay(m.createdAt.slice(0, 10));
  },

  backup(): Promise<BackupData> {
    return useSupabase ? sbExportAll() : Promise.resolve(localExportAll());
  },
  async restore(data: BackupData) {
    if (useSupabase) await sbRestoreAll(data);
    else localRestoreAll(data);
  },

  async stats(): Promise<DashboardStats> {
    const [all, sales, movementsList] = await Promise.all([
      products.list(), salesList(), movements.list(),
    ]);
    const t = todayStr();
    const totalStock = all.reduce((n, p) => n + p.sizes.reduce((m, s) => m + s.stock, 0), 0);
    const totalSold = all.reduce((n, p) => n + p.sizes.reduce((m, s) => m + s.sold, 0), 0);
    const saleMovements = movementsList.filter((m) => m.type === "sale" || m.type === "retrieve");
    const isToday = (iso: string) => iso.slice(0, 10) === t;
    const todaySales = saleMovements.filter((m) => isToday(m.createdAt)).reduce((n, m) => n + (m.amount ?? 0), 0);
    const totalSales = saleMovements.reduce((n, m) => n + (m.amount ?? 0), 0);
    const todayManual = sales.filter((s) => s.date === t).reduce((n, s) => n + s.amount, 0);
    const totalManual = sales.reduce((n, s) => n + s.amount, 0);
    const lowStockCount = all.reduce(
      (n, p) => n + p.sizes.filter((s) => s.stock > 0 && s.stock <= 3).length +
        p.sizes.filter((s) => s.stock === 0 && s.sold > 0).length, 0
    );
    // last 7 days item-sale revenue
    const days: { date: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push({ date: d, amount: saleMovements.filter((m) => m.createdAt.slice(0, 10) === d).reduce((n, m) => n + (m.amount ?? 0), 0) });
    }
    const catMap = new Map<string, number>();
    all.forEach((p) => catMap.set(p.category, (catMap.get(p.category) ?? 0) + 1));
    return {
      totalProducts: all.length,
      totalStock,
      totalSold,
      todaySales: Math.max(0, todaySales),
      totalSales,
      todayManualSales: todayManual,
      totalManualSales: totalManual,
      lowStockCount,
      recentProducts: all.slice(0, 5),
      recentMovements: movementsList.slice(0, 8),
      salesLast7Days: days,
      categoryCounts: [...catMap.entries()].map(([category, count]) => ({ category, count })),
    };
  },
};

async function salesList(): Promise<DailySale[]> {
  return dailySales.list();
}
