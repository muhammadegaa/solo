import { config } from "./config";
import { db } from "./firebase-admin";

export type Settings = { morning: string; nudges: string[] };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getSettings(uid: string): Promise<Settings> {
  const s = (await db().doc(`users/${uid}`).get()).data()?.settings ?? {};
  return {
    morning: TIME.test(s.morning) ? s.morning : config.defaultMorning,
    nudges: Array.isArray(s.nudges) ? s.nudges.filter((t: string) => TIME.test(t)) : config.defaultNudges,
  };
}

export function parseSettings(input: { morning?: string; nudges?: string[] }): Settings | null {
  const nudges = (input.nudges ?? []).map((t) => t.trim()).filter(Boolean);
  if (!input.morning || !TIME.test(input.morning) || nudges.some((t) => !TIME.test(t)) || nudges.length > 4) return null;
  return { morning: input.morning, nudges: [...new Set(nudges)].sort() };
}

export async function saveSettings(uid: string, s: Settings): Promise<void> {
  await db().doc(`users/${uid}`).set({ settings: s }, { merge: true });
}
