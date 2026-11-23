import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const size = await store.products.updateSize(id, {
      label: body.label !== undefined ? String(body.label).trim() : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    return NextResponse.json({ size });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await store.products.removeSize(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  // PUT /api/sizes/[id] -> { action: "sell" | "retrieve" | "set_stock", ... }
  try {
    const { id } = await params;
    const body = await req.json();
    const isSaleAction = body.action === "sell" || body.action === "retrieve";
    const saleDate = isSaleAction && body.date ? String(body.date) : undefined;
    if (isSaleAction) {
      const today = new Date().toISOString().slice(0, 10);
      const effectiveDate = saleDate || today;
      if (saleDate) {
        const d = new Date(saleDate + "T00:00:00Z");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || isNaN(+d) || d.toISOString().slice(0, 10) !== saleDate) {
          return NextResponse.json({ error: "Invalid sale date" }, { status: 400 });
        }
        if (saleDate > today) {
          return NextResponse.json({ error: "Sale date cannot be in the future" }, { status: 400 });
        }
      }
      if (await store.dayClosures.getByDate(effectiveDate)) {
        return NextResponse.json({ error: `${effectiveDate} is closed — sales are locked for this date` }, { status: 409 });
      }
    }
    let size;
    if (body.action === "sell") size = await store.products.sell(id, saleDate);
    else if (body.action === "retrieve") size = await store.products.retrieve(id, saleDate);
    else if (body.action === "set_stock") size = await store.products.setStock(id, Number(body.stock));
    else if (body.action === "adjust_stock") {
      const cur = await findSize(id);
      size = await store.products.setStock(id, cur.stock + Number(body.delta));
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ size });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Action failed" }, { status: 400 });
  }
}

async function findSize(id: string) {
  const products = await store.products.list();
  for (const p of products) {
    const s = p.sizes.find((x) => x.id === id);
    if (s) return s;
  }
  throw new Error("Size not found");
}
