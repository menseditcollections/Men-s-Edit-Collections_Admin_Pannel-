"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Package, IndianRupee, History, Plus, LogOut, Settings, Sun, Moon, User } from "lucide-react";
import { useTheme } from "@/lib/theme";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/sales", label: "Daily Sales", icon: IndianRupee },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)mec_user=([^;]*)/);
    if (m) setAdminName(decodeURIComponent(m[1]));
  }, []);

  // Auto-logout after 2 minutes of inactivity (covers screen-off / tab hidden)
  const lastActive = useRef(Date.now());
  useEffect(() => {
    const IDLE_LIMIT = 2 * 60 * 1000;
    const mark = () => { lastActive.current = Date.now(); };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));

    async function forceLogout() {
      try { await fetch("/api/logout", { method: "POST" }); } catch {}
      router.replace("/login");
      router.refresh();
    }

    const check = () => {
      if (Date.now() - lastActive.current > IDLE_LIMIT) forceLogout();
    };
    const timer = setInterval(check, 15000);
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-neutral-950 text-white z-40">
        <div className="px-5 py-6 flex items-center gap-3 border-b border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mens-edit-logo.png" alt="MEN'S EDIT" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <p className="font-bold text-sm leading-tight">MEN&apos;S EDIT</p>
            <p className="text-[10px] tracking-[0.2em] text-neutral-400 uppercase">Collections</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${isActive(n.href) ? "bg-white text-neutral-950" : "text-neutral-300 hover:bg-white/10 hover:text-white"}`}>
              <n.icon size={18} /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-5 space-y-1">
          {adminName && (
            <p className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-400">
              <User size={13} /> {adminName}
            </p>
          )}
          <Link href="/products/new"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition">
            <Plus size={18} /> Add Product
          </Link>
          <button onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:bg-white/10 hover:text-white transition">
            {dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? "Light mode" : "Dark mode"}
          </button>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:bg-white/10 hover:text-white transition">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 bg-neutral-950 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mens-edit-logo.png" alt="MEN'S EDIT" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <p className="font-bold text-sm leading-tight">MEN&apos;S EDIT</p>
            <p className="text-[9px] tracking-[0.2em] text-neutral-400 uppercase">Collections</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="text-neutral-400 hover:text-white p-1.5" aria-label="Toggle theme">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={logout} className="text-neutral-400 hover:text-white p-1.5" aria-label="Sign out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="app-main md:pl-60 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 py-5 md:py-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${isActive(n.href) ? "text-neutral-950 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"}`}>
              <n.icon size={20} strokeWidth={isActive(n.href) ? 2.4 : 1.8} />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile FAB: add product */}
      <Link href="/products/new"
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-neutral-950 text-white shadow-xl flex items-center justify-center active:scale-95 transition dark:bg-neutral-100 dark:text-neutral-900">
        <Plus size={26} />
      </Link>
    </div>
  );
}
