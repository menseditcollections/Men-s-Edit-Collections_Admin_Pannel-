import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/types";

export async function GET() {
  try {
    return NextResponse.json({ products: await store.products.list(), backend: store.backend });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "") as Category;
    const price = Number(body.price);
    if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    if (!CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Valid price is required" }, { status: 400 });

    const product = await store.products.create({
      name,
      sku: body.sku ? String(body.sku).trim() : undefined,
      category,
      price,
      purchasePrice: body.purchasePrice === "" || body.purchasePrice == null ? null : Number(body.purchasePrice),
      description: body.description ? String(body.description).trim() : undefined,
      imageUrl: body.imageUrl || undefined,
      sizes: Array.isArray(body.sizes) ? body.sizes.map((s: any) => String(s).trim()).filter(Boolean) : undefined,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create product" }, { status: 500 });
  }
}
