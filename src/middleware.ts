import { NextRequest, NextResponse } from "next/server";

const COOKIE = "mec_auth";
const SECRET = process.env.AUTH_SECRET || "mens-edit-dev-secret";

async function validSession(value?: string): Promise<boolean> {
  if (!value) return false;
  const i = value.lastIndexOf(".");
  if (i <= 0) return false;
  const id = value.slice(0, i);
  const sig = value.slice(i + 1);
  const data = new TextEncoder().encode(`mec-session:${id}:${SECRET}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const expected = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sig === expected;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = await validSession(req.cookies.get(COOKIE)?.value);

  if (!authed) {
    if (pathname === "/login") return NextResponse.next();
    if (pathname.startsWith("/api")) {
      if (pathname === "/api/login") return NextResponse.next();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
