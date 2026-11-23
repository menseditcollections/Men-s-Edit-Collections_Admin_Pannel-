import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    const sales = await store.dailySales.list();
    const existing = sales.find((s) => s.id === id);
    const targetDate = body.date || existing?.date;
    if (targetDate && await store.dayClosures.getByDate(targetDate)) {
      return NextResponse.json({ error: "This day is closed — use Edit Closed Day to change it" }, { status: 409 });
    }
    const sale = await store.dailySales.update(id, amount, body.note, body.date);
    return NextResponse.json({ sale });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = (await store.dailySales.list()).find((s) => s.id === id);
    if (existing?.date && await store.dayClosures.getByDate(existing.date)) {
      return NextResponse.json({ error: "This day is closed — use Edit Closed Day to change it" }, { status: 409 });
    }
    await store.dailySales.remove(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 500 });
  }
}
