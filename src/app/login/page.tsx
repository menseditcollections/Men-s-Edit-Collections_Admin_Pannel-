"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useToast } from "@/components/ui";
import { Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch (err: any) {
      toast(err.message || "Login failed", "error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl animate-fade-up">
      <div className="flex items-center gap-3 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mens-edit-logo.png" alt="MEN'S EDIT" className="w-11 h-11 rounded-xl object-contain" />
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-tight">MEN&apos;S EDIT</h1>
          <p className="text-xs text-neutral-500 tracking-widest uppercase">Collections · Admin</p>
        </div>
      </div>
      <label className="block text-sm font-medium mb-1.5">Username</label>
      <input
        type="text" value={username} onChange={(e) => setUsername(e.target.value)}
        autoFocus required autoComplete="username" placeholder="Enter username"
        className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 text-base mb-3"
      />
      <label className="block text-sm font-medium mb-1.5">Password</label>
      <div className="relative">
        <input
          type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
          required autoComplete="current-password" placeholder="Enter password"
          className="w-full px-4 py-3 pr-11 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 text-base"
        />
        <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
          aria-label={showPw ? "Hide password" : "Show password"}>
          {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <button disabled={loading}
        className="mt-4 w-full py-3 rounded-xl bg-neutral-950 text-white font-semibold text-sm hover:bg-neutral-800 transition disabled:opacity-50">
        {loading ? "Signing in..." : "Sign In"}
      </button>
      <p className="mt-4 text-xs text-neutral-400 text-center">Authorized admins only</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
