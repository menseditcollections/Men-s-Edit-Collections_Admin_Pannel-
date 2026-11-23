import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const movements = await store.movements.list({
      productId: sp.get("productId") || undefined,
      type: sp.get("type") || undefined,
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
      q: sp.get("q") || undefined,
    });
    return NextResponse.json({ movements });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await store.deleteMovement(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 500 });
  }
}
