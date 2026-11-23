import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  try {
    return NextResponse.json(await store.stats());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
