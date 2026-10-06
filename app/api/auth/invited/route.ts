import { NextRequest, NextResponse } from "next/server";
import { isInvited } from "@/lib/store";

// Checked before creating an account, so uninvited people get a clear message instead of an orphan account.
export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string };
  if (!email) return NextResponse.json({ invited: false });
  return NextResponse.json({ invited: await isInvited(email) });
}
