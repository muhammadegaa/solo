// Pure helpers for the dashboard's 7-day view.

export function lastDates(n: number, timeZone: string, now = new Date()): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone });
  return Array.from({ length: n }, (_, i) => fmt.format(new Date(now.getTime() - (n - 1 - i) * 86_400_000)));
}

export const weekdayLetter = (date: string) => "SMTWTFS"[new Date(`${date}T12:00:00Z`).getUTCDay()];
export const weekdayShort = (date: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${date}T12:00:00Z`).getUTCDay()];

export function dailyAverage(items: { localDate: string; value: number | null }[], dates: string[]): (number | null)[] {
  return dates.map((d) => {
    const v = items.filter((x) => x.localDate === d && x.value !== null).map((x) => x.value as number);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  });
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Minutes after 22:00 the previous evening, so times after midnight keep increasing.
export function nightMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h < 12 ? h + 24 : h) * 60 + m - 22 * 60;
}

export const WINDOW_MIN = 10 * 60; // 22:00 to 08:00

export function sleepBar(bed: string | null, wake: string | null): { left: number; width: number } | null {
  if (!bed || !wake) return null;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const a = clamp(nightMinutes(bed) / WINDOW_MIN);
  const b = clamp(nightMinutes(wake) / WINDOW_MIN);
  return b > a ? { left: a * 100, width: (b - a) * 100 } : null;
}

export const clock = (mins: number) => {
  const t = (((mins + 22 * 60) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.round(t % 60)).padStart(2, "0")}`;
};

export function trendTitle(values: (number | null)[]): string {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 2) return "Your week";
  const diff = v[v.length - 1] - v[0];
  return diff <= -1 ? "Stress eased this week" : diff >= 1 ? "Stress rose this week" : "Stress held steady this week";
}
