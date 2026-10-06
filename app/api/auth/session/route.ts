import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { config } from "@/lib/config";
import { adminAuth } from "@/lib/firebase-admin";
import { ensureUser, isInvited } from "@/lib/store";

// Exchange a fresh Firebase ID token for an httpOnly session cookie. Only invited emails get one.
export async function POST(req: NextRequest) {
  const { idToken } = (await req.json()) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  try {
    const t = await adminAuth().verifyIdToken(idToken, true);
    if (!t.email || !(await isInvited(t.email))) return NextResponse.json({ error: "This email has not been invited to Solo." }, { status: 403 });
    await ensureUser(t.uid, t.email);
    const expiresIn = config.sessionDays * 24 * 60 * 60 * 1000;
    const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, cookie, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", maxAge: expiresIn / 1000, path: "/" });
    return res;
  } catch {
    return NextResponse.json({ error: "Sign-in expired. Try again." }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
