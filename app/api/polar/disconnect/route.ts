import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { deregisterUser } from "@/lib/polar";
import { deletePolarLink, getPolarLink } from "@/lib/store";

// Removes Solo's access on Polar's side and deletes the stored token.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  const link = await getPolarLink(user.uid);
  if (link) {
    await deregisterUser(link.accessToken, link.polarUserId).catch((e) => console.error("polar deregister", e));
    await deletePolarLink(user.uid);
  }
  return NextResponse.redirect(new URL("/dashboard?polar=disconnected", req.url), 303);
}
