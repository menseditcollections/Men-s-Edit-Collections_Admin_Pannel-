import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const product = await store.products.get(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: any = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
      patch.name = name;
    }
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      patch.category = body.category as Category;
    }
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
      patch.price = price;
    }
    if (body.sku !== undefined) patch.sku = body.sku;
    if (body.purchasePrice !== undefined) patch.purchasePrice = body.purchasePrice === "" ? null : Number(body.purchasePrice);
    if (body.description !== undefined) patch.description = body.description;
    if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl;
    const product = await store.products.update(id, patch);
    return NextResponse.json({ product });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await store.products.remove(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 500 });
  }
}
