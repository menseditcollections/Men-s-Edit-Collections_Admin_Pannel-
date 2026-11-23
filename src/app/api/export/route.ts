import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

function cell(v: any): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(headers: string[], rows: any[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

function attachment(filename: string, body: string, type: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  try {
    const kind = req.nextUrl.searchParams.get("kind") || "";
    const sp = req.nextUrl.searchParams;

    if (kind === "products") {
      const list = await store.products.list();
      const rows: any[][] = [];
      for (const p of list) {
        if (p.sizes.length === 0) {
          rows.push([p.name, p.sku, p.category, "", "", "", p.price, p.purchasePrice, p.imageUrl, p.createdAt]);
        } else {
          for (const s of p.sizes) {
            rows.push([p.name, p.sku, p.category, s.label, s.stock, s.sold, p.price, p.purchasePrice, p.imageUrl, p.createdAt]);
          }
        }
      }
      const body = csv(
        ["Product", "SKU", "Category", "Size", "Stock", "Sold", "Price", "Cost", "Image URL", "Created"],
        rows
      );
      return attachment(`products-${stamp()}.csv`, body, "text/csv; charset=utf-8");
    }

    if (kind === "movements") {
      const movements = await store.movements.list({
        productId: sp.get("productId") || undefined,
        type: sp.get("type") || undefined,
        from: sp.get("from") || undefined,
        to: sp.get("to") || undefined,
        q: sp.get("q") || undefined,
        all: true,
      });
      const body = csv(
        ["Date", "Type", "Product", "Size", "Qty", "Amount", "Note"],
        movements.map((m) => [m.createdAt, m.type, m.productName, m.sizeLabel, m.quantity, m.amount, m.note])
      );
      return attachment(`sales-history-${stamp()}.csv`, body, "text/csv; charset=utf-8");
    }

    if (kind === "daily-sales") {
      const sales = await store.dailySales.list();
      const body = csv(
        ["Date", "Amount", "Note", "Created"],
        sales.map((s) => [s.date, s.amount, s.note, s.createdAt])
      );
      return attachment(`daily-sales-${stamp()}.csv`, body, "text/csv; charset=utf-8");
    }

    if (kind === "day-closures") {
      const closures = await store.dayClosures.list();
      const body = csv(
        ["Date", "Items Sold", "Retrieved", "Item Sales Total", "Manual Sales", "Grand Total", "Closed At"],
        closures.map((c) => [c.date, c.saleCount, c.retrievedCount, c.itemSalesTotal, c.manualAmount, c.grandTotal, c.closedAt])
      );
      return attachment(`day-closures-${stamp()}.csv`, body, "text/csv; charset=utf-8");
    }

    return NextResponse.json({ error: "Unknown export kind" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Export failed" }, { status: 500 });
  }
}
