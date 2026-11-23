"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

/* ---------------- Toast ---------------- */

interface Toast { id: number; msg: string; kind: "success" | "error"; }
const ToastCtx = createContext<(msg: string, kind?: "success" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((t) => (
          <div key={t.id} className={`animate-toast pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white ${t.kind === "success" ? "bg-neutral-900" : "bg-red-600"}`}>
            {t.kind === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Confirm dialog ---------------- */

export function ConfirmDialog({
  open, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel, loading, children,
}: {
  open: boolean; title: string; message: string; confirmLabel?: string;
  danger?: boolean; onConfirm: () => void; onCancel: () => void; loading?: boolean;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-neutral-500 mt-1">{message}</p>
        {children}
        <div className="flex gap-2 mt-5">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${danger ? "bg-red-600" : "bg-neutral-900"}`}>
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Misc ---------------- */

export const money = (n: number) =>
  "₹" + (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export async function api<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
