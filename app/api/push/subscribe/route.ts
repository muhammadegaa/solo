import { NextRequest, NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import { getUser } from "@/lib/auth";
import { deleteSubscription, saveSubscription, sendToUser } from "@/lib/push";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { subscription } = (await req.json()) as { subscription?: PushSubscription };
  if (!subscription?.endpoint || !subscription.keys?.p256dh) return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  await saveSubscription(user.uid, subscription);
  const sent = await sendToUser(user.uid, { title: "Solo", body: "Notifications are on. Your morning check-in will arrive here.", url: "/dashboard", tag: "welcome" });
  return NextResponse.json({ ok: true, sent });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (endpoint) await deleteSubscription(user.uid, endpoint);
  return NextResponse.json({ ok: true });
}
