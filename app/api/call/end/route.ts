import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { saveCall, type CallRecord } from "@/lib/calls";
import type { Msg } from "@/lib/openrouter";

export const maxDuration = 30;

// Saves the call and returns the agreed plan and stress rating for the end screen.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json()) as { startedAt: number; durationS: number; messages: Msg[]; turnsMs: CallRecord["turnsMs"] };
  if (!Array.isArray(body.messages) || !body.messages.length) return NextResponse.json({ plan: [], stress: null, summary: "" });
  try {
    return NextResponse.json(await saveCall(user.uid, body));
  } catch (e) {
    console.error("save call", e);
    return NextResponse.json({ error: "Could not save this call." }, { status: 500 });
  }
}
