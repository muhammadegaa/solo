// Pure: shape of one day from Polar's per-minute steps (minutes since local midnight).
import { config } from "./config";

export type DayShape = {
  amSteps: number; // before 12:00
  firstMoveMin: number | null; // first 10 minutes with config.firstMoveSteps+ steps, after 05:00
  longestStillMin: number; // longest run of minutes with < 5 steps, 08:00-21:00
  longestStillStart: number | null;
  syncedTo: number | null;
};

export function dayShape(samples: { min: number; steps: number }[]): DayShape {
  const by = new Map(samples.map((s) => [s.min, s.steps]));
  const syncedTo = samples.length ? samples[samples.length - 1].min : null;
  const amSteps = samples.filter((s) => s.min < 720).reduce((a, s) => a + s.steps, 0);

  let firstMoveMin: number | null = null;
  for (let m = 300; m <= 1430 && firstMoveMin === null; m++) {
    let t = 0;
    for (let k = 0; k < 10; k++) t += by.get(m + k) ?? 0;
    if (t >= config.firstMoveSteps) firstMoveMin = m;
  }

  let best = 0, bestStart: number | null = null, cur = 0, curStart = 480;
  const end = Math.min(1260, syncedTo ?? 0);
  for (let m = 480; m <= end; m++) {
    if ((by.get(m) ?? 0) < 5) {
      if (cur === 0) curStart = m;
      cur++;
      if (cur > best) { best = cur; bestStart = curStart; }
    } else cur = 0;
  }
  return { amSteps, firstMoveMin, longestStillMin: best, longestStillStart: bestStart, syncedTo };
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
