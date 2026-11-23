import { createHash } from "crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "mec_auth";   // httpOnly session: "<adminId>.<sig>"
export const USER_COOKIE = "mec_user";   // display name (readable by the UI)

const SECRET = process.env.AUTH_SECRET || "mens-edit-dev-secret";

export function hashPassword(password: string) {
  return createHash("sha256").update(`mec:${password}:${SECRET}`).digest("hex");
}

function sessionSig(adminId: string) {
  return createHash("sha256").update(`mec-session:${adminId}:${SECRET}`).digest("hex");
}

export function sessionValue(adminId: string) {
  return `${adminId}.${sessionSig(adminId)}`;
}

export function adminIdFromSession(value?: string): string | null {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const id = value.slice(0, i);
  const sig = value.slice(i + 1);
  const expected = sessionSig(id);
  return sig.length === expected.length && sig === expected ? id : null;
}

export async function isAuthenticated() {
  const store = await cookies();
  return adminIdFromSession(store.get(AUTH_COOKIE)?.value) !== null;
}
