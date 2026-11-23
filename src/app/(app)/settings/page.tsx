"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Sun, Moon, DatabaseBackup, History, FileSpreadsheet, AlertTriangle, Trash2 } from "lucide-react";
import { api, useToast, ConfirmDialog } from "@/components/ui";
import { useTheme } from "@/lib/theme";

export default function SettingsPage() {
  const toast = useToast();
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function confirmRestore() {
    if (!pendingFile) return;
    setRestoring(true);
    try {
      const data = JSON.parse(await pendingFile.text());
      await api("/api/backup", { method: "POST", body: JSON.stringify(data) });
      toast("Backup restored successfully");
      setPendingFile(null);
      router.refresh();
    } catch (e: any) {
      toast(e.message || "Restore failed — invalid backup file", "error");
    } finally {
      setRestoring(false);
    }
  }

  async function confirmClearAll() {
    setClearing(true);
    try {
      await api("/api/clear-data", { method: "DELETE" });
      toast("All data cleared");
      setConfirmClear(false);
      router.refresh();
    } catch (e: any) {
      toast(e.message || "Clear failed", "error");
    } finally {
      setClearing(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) setPendingFile(f);
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-500">Appearance, data export and backup.</p>
      </div>

      {/* Appearance */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="font-semibold mb-1">Appearance</h2>
        <p className="text-xs text-neutral-500 mb-4">Switch between light and dark theme.</p>
        <button onClick={toggle}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition w-full sm:w-auto">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          <span className="text-sm font-semibold">{dark ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
        </button>
      </section>

      {/* Export CSV */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="font-semibold mb-1 flex items-center gap-2"><FileSpreadsheet size={17} /> Export to CSV</h2>
        <p className="text-xs text-neutral-500 mb-4">Download data for accounting in Excel / Google Sheets.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?kind=products" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition">
            <Download size={15} /> Products
          </a>
          <a href="/api/export?kind=movements" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition">
            <Download size={15} /> Sales History
          </a>
          <a href="/api/export?kind=daily-sales" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition">
            <Download size={15} /> Daily Sales
          </a>
          <a href="/api/export?kind=day-closures" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 transition">
            <Download size={15} /> Day Closures
          </a>
        </div>
      </section>

      {/* Backup */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="font-semibold mb-1 flex items-center gap-2"><DatabaseBackup size={17} /> Backup &amp; Restore</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Download a full JSON backup of products, stock, sales history and daily sales — or restore from one.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/backup" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
            <Download size={15} /> Download Backup
          </a>
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold hover:bg-neutral-50 transition">
            <Upload size={15} /> Restore Backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </div>
        <p className="text-[11px] text-neutral-400 mt-3 flex items-center gap-1">
          <AlertTriangle size={11} /> Restoring replaces ALL current data. Download a backup first.
        </p>
      </section>

      {/* Danger zone */}
      <section className="bg-white rounded-2xl border border-red-200 p-5">
        <h2 className="font-semibold mb-1 flex items-center gap-2 text-red-600"><Trash2 size={17} /> Danger Zone</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Permanently delete ALL entered data — products, stock, sizes, sales history, daily sales and closed day reports.
          Download a backup first if you need it later.
        </p>
        <button onClick={() => setConfirmClear(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">
          <Trash2 size={15} /> Clear All Data
        </button>
      </section>

      {/* Info */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><History size={17} /> Data Notes</h2>
        <ul className="text-xs text-neutral-500 space-y-1.5 list-disc pl-4">
          <li>Item sales (SELL button) and manual Daily Sales entries are tracked separately to avoid double counting.</li>
          <li>Every action — sales, retrievals, stock changes, product edits — is recorded in History.</li>
          <li>CSV exports respect the filters applied on each page.</li>
        </ul>
      </section>

      <ConfirmDialog
        open={!!pendingFile}
        title="Restore backup?"
        message={`This will REPLACE all current data with "${pendingFile?.name}". This cannot be undone — download a fresh backup first if unsure.`}
        confirmLabel="Restore"
        danger
        loading={restoring}
        onConfirm={confirmRestore}
        onCancel={() => setPendingFile(null)}
      />
      <ConfirmDialog
        open={confirmClear}
        title="Clear all data?"
        message="This will permanently delete ALL products, stock, sales history, daily sales and closed day reports. This cannot be undone — download a backup first if unsure."
        confirmLabel="Delete Everything"
        danger
        loading={clearing}
        onConfirm={confirmClearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
