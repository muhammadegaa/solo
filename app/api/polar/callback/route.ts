import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { exchangeCode, registerUser } from "@/lib/polar";
import { savePolarLink } from "@/lib/store";

const back = (req: NextRequest, status: string) => {
  const res = NextResponse.redirect(new URL(`/dashboard?polar=${status}`, req.url));
  res.cookies.delete("polar_state");
  return res;
};

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back(req, "denied");
  if (!q.get("state") || q.get("state") !== req.cookies.get("polar_state")?.value) return back(req, "expired");
  const code = q.get("code");
  if (!code) return back(req, "failed");

  try {
    const { access_token, x_user_id } = await exchangeCode(code);
    await registerUser(access_token, user.uid);
    await savePolarLink(user.uid, { polarUserId: x_user_id, accessToken: access_token });
    return back(req, "connected");
  } catch (e) {
    console.error("polar callback", e);
    return back(req, "failed");
  }
}
