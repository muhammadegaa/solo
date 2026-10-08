// Server-rendered SVG charts for the dashboard's findings. Labels sit on the data instead of in a legend.
import type { Day } from "@/lib/days";
import type { Finding } from "@/lib/findings";

const dayNum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const bedMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };
const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
const W = 322;

// Sleep per night. Orange: in bed by 23:00 (labelled with the time). Darker grey: after midnight.
export function BedtimeChart({ days }: { days: Day[] }) {
  const nights = days.filter((d) => d.sleepH !== null && d.bed).slice(-14);
  const early = nights.filter((d) => bedMin(d.bed!) <= 23 * 60), late = nights.filter((d) => bedMin(d.bed!) >= 24 * 60);
  if (!early.length || !late.length) return null;
  const H = 150, top = 26, base = 120, scale = (base - top) / 8, bw = (W - 20) / nights.length - 4;
  const yE = base - avg(early.map((d) => d.sleepH!)) * scale, yL = base - avg(late.map((d) => d.sleepH!)) * scale;
  return (
    <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sleep per night. In bed by 23:00: ${avg(early.map((d) => d.sleepH!))} h on average. After midnight: ${avg(late.map((d) => d.sleepH!))} h.`}>
      {nights.map((d, i) => {
        const x = 10 + i * (bw + 4), h = d.sleepH! * scale, b = bedMin(d.bed!);
        const fill = b <= 23 * 60 ? "var(--acc)" : b >= 24 * 60 ? "var(--sleep2)" : "#d9dde7";
        return (
          <g key={d.date}>
            <rect x={x} y={base - h} width={bw} height={h} rx="4" fill={fill} />
            {b <= 23 * 60 && <text className="ann a" x={x + bw / 2} y={base - h - 5} textAnchor="middle">{d.bed}</text>}
            <text className="tick" x={x + bw / 2} y={base + 13} textAnchor="middle">{dayNum(d.date)}</text>
          </g>
        );
      })}
      <line x1="10" x2={W - 10} y1={yE} y2={yE} stroke="var(--acc)" strokeDasharray="3 3" />
      <text className="ann a" x="12" y={yE - 5}>by 23:00 · {avg(early.map((d) => d.sleepH!))} h</text>
      <line x1="10" x2={W - 10} y1={yL} y2={yL} stroke="var(--sleep)" strokeDasharray="3 3" />
      <text className="ann s" x="12" y={yL + 14}>after midnight · {avg(late.map((d) => d.sleepH!))} h</text>
    </svg>
  );
}

// Steps by hour of day across all finished days, mornings shaded.
export function HoursChart({ days }: { days: Day[] }) {
  const done = days.slice(0, -1).filter((d) => d.shape?.hourly);
  const totals = Array.from({ length: 24 }, (_, h) => done.reduce((a, d) => a + d.shape!.hourly[h], 0));
  const all = totals.reduce((a, b) => a + b, 0);
  if (!all) return null;
  const am = Math.round((totals.slice(0, 12).reduce((a, b) => a + b, 0) / all) * 100);
  const H = 118, base = 88, max = Math.max(...totals), bw = (W - 20) / 24 - 2, noon = 10 + 12 * (bw + 2) - 1;
  return (
    <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Steps by hour: ${am}% before noon, ${100 - am}% after.`}>
      <rect x="8" y="10" width={noon - 8} height={base - 8} rx="8" fill="var(--bg)" />
      {totals.map((v, h) => { const hh = Math.max(1.5, (v / max) * 62); return <rect key={h} x={10 + h * (bw + 2)} y={base - hh} width={bw} height={hh} rx="2" fill={h < 12 ? "#c4cad7" : "var(--acc)"} />; })}
      <line x1={noon} x2={noon} y1="8" y2={base} stroke="var(--faint)" strokeDasharray="2 3" />
      <text className="ann m" x="16" y="24">Before noon · {am}%</text>
      <text className="ann a" x={noon + 6} y="24">After · {100 - am}%</text>
      {[0, 6, 12, 18, 23].map((h) => <text key={h} className="tick" x={10 + h * (bw + 2) + bw / 2} y={base + 14} textAnchor="middle">{String(h).padStart(2, "0")}</text>)}
    </svg>
  );
}

// Longest still stretch on each of the last 7 finished days, 08:00 to 21:00.
export function StillChart({ days, at }: { days: Day[]; at: string }) {
  const rows = days.slice(-8, -1);
  const H = rows.length * 18 + 30, x0 = 46, x1 = W - 8, span = 13 * 60;
  const X = (min: number) => x0 + ((Math.max(480, Math.min(1260, min)) - 480) / span) * (x1 - x0);
  const atX = X(Number(at.slice(0, 2)) * 60 + Number(at.slice(3)));
  return (
    <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Longest still stretch on each of the last 7 days">
      <line x1={atX} x2={atX} y1="2" y2={H - 20} stroke="var(--acc)" strokeDasharray="3 3" />
      {rows.map((d, i) => {
        const y = 8 + i * 18, s = d.shape, ok = s && s.longestStillMin >= 60 && s.longestStillStart !== null;
        return (
          <g key={d.date}>
            <text className="tick" x="0" y={y + 9}>{weekday(d.date)} {dayNum(d.date)}</text>
            <rect x={x0} y={y + 2} width={x1 - x0} height="8" rx="4" fill="var(--bg)" />
            {ok && <rect x={X(s!.longestStillStart!)} y={y + 1} width={X(s!.longestStillStart! + s!.longestStillMin) - X(s!.longestStillStart!)} height="10" rx="5" fill="var(--sleep)" />}
          </g>
        );
      })}
      {[8, 11, 14, 17, 20].map((h) => <text key={h} className="tick" x={X(h * 60)} y={H - 4} textAnchor="middle">{h}:00</text>)}
    </svg>
  );
}

// Two labelled bars for any with/without comparison.
export function CompareChart({ compare }: { compare: NonNullable<Finding["compare"]> }) {
  const max = Math.max(compare.a.value, compare.b.value) || 1;
  return (
    <div className="cmp">
      {[compare.a, compare.b].map((c, i) => (
        <div key={i}>
          <span>{c.label} <small>· {c.n} {c.n === 1 ? "day" : "days"}</small></span>
          <span className="cmp-t"><i className={i === 0 ? "a" : "b"} style={{ width: `${(c.value / max) * 100}%` }} /></span>
          <b>{c.value}</b>
        </div>
      ))}
      <small className="cmp-u">{compare.unit}</small>
    </div>
  );
}
