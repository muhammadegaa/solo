import { type CallRecord } from "./calls";
import { config } from "./config";
import { checkItem, describe, type Check } from "./plancheck";
import { fetchDaySteps, type DaySteps } from "./polar";

export type CheckedItem = { time: string | null; action: string; check: Check };
export type CheckedCall = { call: CallRecord; items: CheckedItem[] };

// Checks each saved plan against that day's Loop steps. One Polar request per distinct day.
export async function checkPlans(token: string | null, calls: CallRecord[]): Promise<CheckedCall[]> {
  const days = new Map<string, Promise<DaySteps | null>>();
  const day = (date: string) => {
    if (!token) return Promise.resolve(null);
    if (!days.has(date)) days.set(date, fetchDaySteps(token, date).catch(() => null));
    return days.get(date)!;
  };
  const opts = { minSteps: config.planCheckMinSteps, before: config.planCheckBeforeMin, after: config.planCheckAfterMin };
  return Promise.all(
    calls.map(async (call) => {
      const steps = await day(call.localDate);
      return { call, items: call.plan.map((p) => ({ ...p, check: checkItem(p, steps, opts) })) };
    }),
  );
}

const windowLabel = () => `between ${config.planCheckBeforeMin} min before and ${config.planCheckAfterMin} min after`;

export function followupLines(checked: CheckedCall[]): string[] {
  return checked.map(({ call, items }) => {
    const head = `${call.localDate} ${call.startedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: config.timeZone })} call (stress ${call.stress ?? "not given"}): ${call.summary || "no summary"}`;
    const plan = items.length ? items.map((i) => `  - ${describe(i, i.check, windowLabel())}`).join("\n") : "  - no plan agreed";
    return `${head}\n${plan}`;
  });
}
