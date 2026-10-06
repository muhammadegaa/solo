import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { config } from "./config";
import { db } from "./firebase-admin";

// users/{uid}/pushSubs/{hash of endpoint}: one per device that turned notifications on.
const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

export async function saveSubscription(uid: string, sub: PushSubscription): Promise<void> {
  await db().doc(`users/${uid}/pushSubs/${subId(sub.endpoint)}`).set({ sub, savedAt: new Date() });
}

export async function deleteSubscription(uid: string, endpoint: string): Promise<void> {
  await db().doc(`users/${uid}/pushSubs/${subId(endpoint)}`).delete();
}

export async function hasSubscription(uid: string): Promise<boolean> {
  return !(await db().collection(`users/${uid}/pushSubs`).limit(1).get()).empty;
}

export type Push = { title: string; body: string; url: string; tag: string };

// Sends to every device; drops subscriptions the push service says are gone. Returns how many were delivered.
export async function sendToUser(uid: string, push: Push): Promise<number> {
  webpush.setVapidDetails(config.vapidSubject(), config.vapidPublicKey(), config.vapidPrivateKey());
  const subs = await db().collection(`users/${uid}/pushSubs`).get();
  let sent = 0;
  for (const d of subs.docs) {
    try {
      await webpush.sendNotification(d.data().sub, JSON.stringify(push), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await d.ref.delete();
      else console.error("push send", code, (e as Error).message);
    }
  }
  return sent;
}
