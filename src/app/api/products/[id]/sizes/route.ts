import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const label = String(body.label ?? "").trim();
    if (!label) return NextResponse.json({ error: "Size label is required" }, { status: 400 });
    const size = await store.products.addSize(id, label);
    return NextResponse.json({ size }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to add size" }, { status: 500 });
  }
}
