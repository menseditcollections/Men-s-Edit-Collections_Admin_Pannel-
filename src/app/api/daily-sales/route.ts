import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  try {
    return NextResponse.json({ sales: await store.dailySales.list() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    const date = String(body.date || new Date().toISOString().slice(0, 10));
    const dd = new Date(date + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(+dd) || dd.toISOString().slice(0, 10) !== date) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    if (await store.dayClosures.getByDate(date)) {
      return NextResponse.json({ error: "This day is closed — use Edit Closed Day to change it" }, { status: 409 });
    }
    const sale = await store.dailySales.upsert(date, amount, body.note);
    return NextResponse.json({ sale }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Save failed" }, { status: 500 });
  }
}
