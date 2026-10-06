import type { PlanItem } from "./calls";
import type { DaySteps } from "./polar";

// Checks agreed movement against the Loop's step data. Breathing and similar items can't be checked.
const MOVEMENT = /\b(walk|run|jog|workout|exercise|stretch|bodyweight|park|cycle|bike|swim|move|steps|school run|play)\b/i;
export const isMovement = (action: string) => MOVEMENT.test(action);

export type Check =
  | { kind: "seen"; steps: number }
  | { kind: "not-seen"; steps: number }
  | { kind: "not-synced" }
  | { kind: "unchecked" };

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function checkItem(item: PlanItem, day: DaySteps | null, opts: { minSteps: number; before: number; after: number }): Check {
  if (!isMovement(item.action) || !day) return { kind: "unchecked" };
  if (!item.time || !/^\d{2}:\d{2}$/.test(item.time)) return { kind: "unchecked" };
  const t = toMin(item.time);
  const from = t - opts.before;
  const to = t + opts.after;
  if (day.syncedTo === null || day.syncedTo < to) return { kind: "not-synced" };
  const steps = day.samples.filter((s) => s.min >= from && s.min <= to).reduce((a, s) => a + s.steps, 0);
  return steps >= opts.minSteps ? { kind: "seen", steps } : { kind: "not-seen", steps };
}

export function describe(item: PlanItem, c: Check, windowLabel: string): string {
  const what = `${item.time ?? "any time"} ${item.action}`;
  switch (c.kind) {
    case "seen": return `${what}: Loop shows ${c.steps} steps ${windowLabel}, so it looks done.`;
    case "not-seen": return `${what}: Loop shows only ${c.steps} steps ${windowLabel}; no sign of it.`;
    case "not-synced": return `${what}: Loop data for that time hasn't synced yet.`;
    default: return `${what}: can't be checked from the Loop.`;
  }
}
