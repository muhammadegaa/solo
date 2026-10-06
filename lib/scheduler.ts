import { recentCalls } from "./calls";
import { config } from "./config";
import { db } from "./firebase-admin";
import { isMovement } from "./plancheck";
import { fetchDaySteps } from "./polar";
import { hasSubscription, sendToUser, type Push } from "./push";
import { getSettings, type Settings } from "./settings";
import { getPolarLink } from "./store";

export type Slot = { id: string; kind: "morning" | "nudge"; min: number };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function slotsFor(s: Settings): Slot[] {
  return [{ id: `morning-${s.morning}`, kind: "morning" as const, min: toMin(s.morning) }, ...s.nudges.map((t) => ({ id: `nudge-${t}`, kind: "nudge" as const, min: toMin(t) }))];
}

// Due once its time has passed, for up to `lateMin` minutes, if not already handled today.
export const dueSlots = (slots: Slot[], nowMin: number, handled: Set<string>, lateMin: number) =>
  slots.filter((s) => nowMin >= s.min && nowMin < s.min + lateMin && !handled.has(s.id));

export function localNow(timeZone: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
}

async function decide(uid: string, slot: Slot, date: string, nowMin: number): Promise<Push | string> {
  const today = (await recentCalls(uid, 1)).filter((c) => c.localDate === date);
  if (slot.kind === "morning") {
    if (today.length) return "skipped: already called today";
    return { title: "Morning check-in", body: "About 2 minutes. Tap to talk.", url: "/call", tag: "morning" };
  }
  const link = await getPolarLink(uid);
  if (link) {
    const day = await fetchDaySteps(link.accessToken, date).catch(() => null);
    if (day && day.syncedTo !== null && day.syncedTo >= nowMin - 30) {
      const recent = day.samples.filter((s) => s.min > nowMin - 60 && s.min <= nowMin).reduce((a, s) => a + s.steps, 0);
      if (recent >= config.nudgeMovedSteps) return `skipped: ${recent} steps in the last hour`;
    }
  }
  const items = today.flatMap((c) => c.plan).filter((p) => isMovement(p.action));
  const near = items.find((p) => p.time && Math.abs(toMin(p.time) - slot.min) <= 120) ?? items[0];
  return { title: "Solo", body: near ? `Time for: ${near.action}` : "A short walk outside? Even 10 minutes counts.", url: "/dashboard", tag: slot.id };
}

// Called every ~15 minutes by the scheduler. Safe to call more often: each slot is handled once per day.
export async function tick(now = new Date()) {
  const { date, min } = localNow(config.timeZone, now);
  const users = await db().collection("users").select().get();
  const report: Record<string, string[]> = {};
  for (const u of users.docs) {
    if (!(await hasSubscription(u.id))) continue;
    const logRef = db().doc(`users/${u.id}/pushLog/${date}`);
    const handled = new Set(Object.keys((await logRef.get()).data()?.slots ?? {}));
    for (const slot of dueSlots(slotsFor(await getSettings(u.id)), min, handled, config.pushLateMin)) {
      const d = await decide(u.id, slot, date, min);
      const outcome = typeof d === "string" ? d : `sent to ${await sendToUser(u.id, d)} device(s)`;
      await logRef.set({ slots: { [slot.id]: { outcome, at: now } } }, { merge: true });
      (report[u.id] ??= []).push(`${slot.id}: ${outcome}`);
    }
  }
  return { date, localTime: `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`, report };
}
