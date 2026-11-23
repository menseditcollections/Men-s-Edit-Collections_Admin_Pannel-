import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function DELETE() {
  try {
    await store.restore({
      version: 1,
      exportedAt: new Date().toISOString(),
      backend: store.backend,
      products: [],
      dailySales: [],
      movements: [],
      dayClosures: [],
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Clear failed" }, { status: 500 });
  }
}
