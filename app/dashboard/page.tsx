import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { fetchRaw, toRows } from "@/lib/polar";

export const dynamic = "force-dynamic";

const DAYS = 14;
const cell = (v: string | number | null) => (v === null ? "—" : v);

export default async function Dashboard() {
  if (!(await isAuthed())) redirect("/login");
  if (!process.env.POLAR_ACCESS_TOKEN) {
    return (
      <main className="dash">
        <h1>Not connected</h1>
        <p>
          <a href="/api/polar/connect">Connect Polar</a>
        </p>
      </main>
    );
  }

  const raw = await fetchRaw(DAYS);
  const rows = toRows(raw, DAYS);

  return (
    <main className="dash">
      <p><a href="/call">Start a check-in call</a></p>
      <h1>Last {DAYS} days</h1>
      <p>Live from Polar AccessLink at {new Date().toLocaleString("en-GB")}. Data from Polar.</p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Bed</th><th>Wake</th><th>Sleep h</th><th>Sleep score</th>
              <th>HRV ms</th><th>ANS charge</th><th>Steps</th><th>Active</th><th>Inactivity alerts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td><td>{cell(r.bed)}</td><td>{cell(r.wake)}</td><td>{cell(r.sleepH)}</td>
                <td>{cell(r.sleepScore)}</td><td>{cell(r.hrv)}</td><td>{cell(r.ansCharge)}</td>
                <td>{cell(r.steps)}</td><td>{cell(r.active)}</td><td>{cell(r.inactivityAlerts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Returned: {raw.nights.length} nights, {raw.recharges.length} recharges, {raw.activities.length} activity days.
      </p>
      <details>
        <summary>Raw first record of each (to see which fields the Loop fills)</summary>
        <pre>{JSON.stringify({ night: raw.nights[0], recharge: raw.recharges[0], activity: raw.activities[0] }, null, 2)}</pre>
      </details>
    </main>
  );
}
