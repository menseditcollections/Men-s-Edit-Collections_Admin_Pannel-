"use client";

import { createPortal } from "react-dom";
import { X, Printer } from "lucide-react";
import { money, fmtDateTime } from "@/components/ui";

export interface ReceiptData {
  productName: string;
  category: string;
  sku?: string | null;
  sizeLabel: string;
  price: number;
  date: Date;
}

export default function Receipt({ data, onClose }: { data: ReceiptData | null; onClose: () => void }) {
  if (!data || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        id="receipt-print"
        className="bg-white text-neutral-900 rounded-2xl w-full max-w-xs shadow-2xl animate-fade-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Store header */}
        <div className="text-center px-5 pt-6 pb-4 border-b border-dashed border-neutral-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mens-edit-logo.png" alt="MEN'S EDIT" className="w-14 h-14 mx-auto object-contain" />
          <p className="font-bold tracking-wide mt-2">MEN&apos;S EDIT COLLECTIONS</p>
          <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-500">Sales Receipt</p>
        </div>

        {/* Items */}
        <div className="px-5 py-4">
          <div className="flex justify-between text-[11px] uppercase tracking-wide text-neutral-400 pb-2 border-b border-neutral-200">
            <span>Item</span><span>Qty</span><span className="text-right">Amount</span>
          </div>
          <div className="py-3 space-y-1">
            <p className="text-sm font-semibold leading-snug">{data.productName}</p>
            <p className="text-xs text-neutral-500">
              {data.category} · Size {data.sizeLabel}{data.sku ? ` · ${data.sku}` : ""}
            </p>
          </div>
          <div className="flex justify-between text-sm py-2 border-t border-dashed border-neutral-300">
            <span>1 × {money(data.price)}</span>
            <span className="font-bold">{money(data.price)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2">
            <span>Total</span>
            <span>{money(data.price)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 text-center">
          <p className="text-[10px] text-neutral-400">{fmtDateTime(data.date.toISOString())}</p>
          <p className="text-xs font-medium mt-1">Thank you for shopping with us!</p>
        </div>

        {/* Actions (hidden in print) */}
        <div className="no-print flex gap-2 px-5 pb-5">
          <button onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition">
            <Printer size={15} /> Print Receipt
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold hover:bg-neutral-50 transition">
            <X size={15} className="inline -mt-0.5" /> Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
