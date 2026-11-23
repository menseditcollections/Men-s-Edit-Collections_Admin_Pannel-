import { NextResponse } from "next/server";
import { store, type BackupData } from "@/lib/store";

export async function GET() {
  try {
    const data = await store.backup();
    const stamp = data.exportedAt.slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mens-edit-backup-${stamp}.json"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Backup failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as BackupData;
    const hasData =
      Array.isArray(data?.products) ||
      Array.isArray(data?.dailySales) ||
      Array.isArray(data?.movements);
    if (!hasData) {
      return NextResponse.json({ error: "Invalid backup file" }, { status: 400 });
    }
    await store.restore({
      version: 1,
      exportedAt: data.exportedAt || new Date().toISOString(),
      backend: store.backend,
      products: Array.isArray(data.products) ? data.products : [],
      dailySales: Array.isArray(data.dailySales) ? data.dailySales : [],
      movements: Array.isArray(data.movements) ? data.movements : [],
      dayClosures: Array.isArray(data.dayClosures) ? data.dayClosures : [],
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Restore failed" }, { status: 500 });
  }
}
