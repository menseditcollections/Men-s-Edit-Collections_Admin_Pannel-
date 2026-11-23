import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (d: string) => {
  if (!DATE_RE.test(d)) return false;
  const t = new Date(d + "T00:00:00Z");
  return !isNaN(+t) && t.toISOString().slice(0, 10) === d;
};

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date");
    if (date) {
      if (!validDate(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      const [preview, closure] = await Promise.all([
        store.dayReport(date),
        store.dayClosures.getByDate(date),
      ]);
      return NextResponse.json({ preview, closure });
    }
    return NextResponse.json({ closures: await store.dayClosures.list() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const date = String(body?.date || "");
    if (!validDate(date)) return NextResponse.json({ error: "Valid date (YYYY-MM-DD) is required" }, { status: 400 });
    const closure = await store.closeDay(date);
    return NextResponse.json({ closure }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to close day" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const date = String(body?.date || "");
    if (!validDate(date)) return NextResponse.json({ error: "Valid date (YYYY-MM-DD) is required" }, { status: 400 });
    const existing = await store.dayClosures.getByDate(date);
    if (!existing) return NextResponse.json({ error: "Day is not closed" }, { status: 404 });
    const closure = await store.setClosedDayManual(date, Number(body?.manualAmount) || 0, body?.manualNote ?? null);
    return NextResponse.json({ closure });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await store.dayClosures.remove(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 500 });
  }
}
