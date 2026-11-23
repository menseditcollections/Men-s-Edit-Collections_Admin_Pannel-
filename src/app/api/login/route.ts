import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { AUTH_COOKIE, USER_COOKIE, hashPassword, sessionValue } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "").trim();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }
    const admins = await store.admins.list();
    const admin = admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
    if (!admin || admin.passwordHash !== hashPassword(password)) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, username: admin.username });
    const maxAge = 60 * 60 * 24 * 30;
    res.cookies.set(AUTH_COOKIE, sessionValue(admin.id), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge,
    });
    res.cookies.set(USER_COOKIE, encodeURIComponent(admin.username), {
      sameSite: "lax", path: "/", maxAge,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
