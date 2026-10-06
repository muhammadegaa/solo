import SignOut from "@/app/SignOut";
import { requireUser } from "@/lib/auth";
import { fetchRaw, toRows } from "@/lib/polar";
import { getPolarLink } from "@/lib/store";

export const dynamic = "force-dynamic";

const DAYS = 14;
const cell = (v: string | number | null) => (v === null ? "—" : v);

const banners: Record<string, string> = {
  connected: "Polar connected.",
  disconnected: "Polar disconnected. Solo no longer has access to your Polar data.",
  denied: "Polar access was not granted.",
  expired: "The Polar connection took too long. Try again.",
  failed: "Could not connect Polar. Try again.",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ polar?: string }> }) {
  const user = await requireUser();
  const { polar } = await searchParams;
  const link = await getPolarLink(user.uid);
  const raw = link ? await fetchRaw(link.accessToken, DAYS).catch(() => null) : null;
  const rows = raw ? toRows(raw, DAYS) : [];

  return (
    <main className="dash">
      <div className="dash-head">
        <h1>Dashboard</h1>
        <span>{user.email} · <SignOut /></span>
      </div>
      {polar && banners[polar] && <p className="dash-banner">{banners[polar]}</p>}
      <div className="dash-actions">
        <a href="/call">Start a check-in call</a>
        {link ? (
          <form action="/api/polar/disconnect" method="post"><button className="link-btn" id="polar-disconnect" type="submit">Disconnect Polar</button></form>
        ) : (
          <a href="/api/polar/connect">Connect Polar</a>
        )}
      </div>

      {link && !raw && <p>Polar did not respond. Reload in a minute.</p>}
      {raw && (
        <>
          <h2>Last {DAYS} days</h2>
          <p>Data from Polar.</p>
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
          <details>
            <summary>Raw first record of each</summary>
            <pre>{JSON.stringify({ night: raw.nights[0], recharge: raw.recharges[0], activity: raw.activities[0] }, null, 2)}</pre>
          </details>
        </>
      )}
    </main>
  );
}
