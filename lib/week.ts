// Pure date and time helpers shared by findings and the dashboard.

export function lastDates(n: number, timeZone: string, now = new Date()): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone });
  return Array.from({ length: n }, (_, i) => fmt.format(new Date(now.getTime() - (n - 1 - i) * 86_400_000)));
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
