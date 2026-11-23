import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export interface DayTotal {
  date: string;
  itemTotal: number;
  manualTotal: number;
  grandTotal: number;
  saleCount: number;
  closed: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month") || "";
    const fromP = req.nextUrl.searchParams.get("from") || "";
    const toP = req.nextUrl.searchParams.get("to") || "";
    const isMonth = /^\d{4}-\d{2}$/.test(month);
    const isRange = /^\d{4}-\d{2}-\d{2}$/.test(fromP) && /^\d{4}-\d{2}-\d{2}$/.test(toP);
    if (!isMonth && !isRange) {
      return NextResponse.json({ error: "month=YYYY-MM or from/to=YYYY-MM-DD is required" }, { status: 400 });
    }
    const from = isMonth ? `${month}-01` : fromP;
    const to = isMonth
      ? (() => { const [y, m] = month.split("-").map(Number); return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`; })()
      : toP;

    const [movements, sales, closures] = await Promise.all([
      store.movements.list({ from, to, all: true }),
      store.dailySales.list(),
      store.dayClosures.list(),
    ]);
    const closedDates = new Set(closures.map((c) => c.date));

    const map = new Map<string, DayTotal>();
    const get = (date: string) => {
      let d = map.get(date);
      if (!d) {
        d = { date, itemTotal: 0, manualTotal: 0, grandTotal: 0, saleCount: 0, closed: closedDates.has(date) };
        map.set(date, d);
      }
      return d;
    };

    for (const mv of movements) {
      const d = mv.createdAt.slice(0, 10);
      if (d < from || d > to) continue;
      const day = get(d);
      if (mv.type === "sale") {
        day.itemTotal += mv.amount ?? 0;
        day.saleCount += 1;
      } else if (mv.type === "retrieve") {
        day.itemTotal -= Math.abs(mv.amount ?? 0);
      }
    }
    for (const s of sales) {
      if (s.date >= from && s.date <= to) get(s.date).manualTotal += s.amount;
    }
    for (const d of map.values()) {
      d.itemTotal = Math.max(0, d.itemTotal);
      d.grandTotal = d.itemTotal + d.manualTotal;
    }

    if (isRange) {
      const days = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
      return NextResponse.json({ from, to, days });
    }
    const days: DayTotal[] = [];
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let i = 1; i <= lastDay; i++) {
      const date = `${month}-${String(i).padStart(2, "0")}`;
      days.push(map.get(date) ?? { date, itemTotal: 0, manualTotal: 0, grandTotal: 0, saleCount: 0, closed: closedDates.has(date) });
    }
    return NextResponse.json({ month, days });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
