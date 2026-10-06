import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { authorizeUrl } from "@/lib/polar";

export async function GET(req: Request) {
  if (!(await getUser())) return NextResponse.redirect(new URL("/login", req.url));
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("polar_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
