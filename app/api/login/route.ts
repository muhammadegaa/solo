import { NextRequest, NextResponse } from "next/server";
import { COOKIE, hashPasscode } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const ok = form.get("passcode") === process.env.APP_PASSCODE;
  const res = NextResponse.redirect(new URL(ok ? "/call" : "/login?wrong=1", req.url), 303);
  if (ok) res.cookies.set(COOKIE, hashPasscode(process.env.APP_PASSCODE!), { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}
