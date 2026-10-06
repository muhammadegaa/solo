import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { parseSettings, saveSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const s = parseSettings(await req.json());
  if (!s) return NextResponse.json({ error: "Use times like 07:30, and at most 4 check-ins." }, { status: 400 });
  await saveSettings(user.uid, s);
  return NextResponse.json({ ok: true, settings: s });
}
