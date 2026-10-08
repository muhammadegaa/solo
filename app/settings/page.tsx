import Link from "next/link";
import SignOut from "@/app/SignOut";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getPolarLink } from "@/lib/store";
import Reminders from "./Reminders";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [link, settings] = await Promise.all([getPolarLink(user.uid), getSettings(user.uid)]);
  return (
    <main className="dv">
      <header className="dv-head">
        <div><p className="dv-eyebrow"><Link href="/dashboard">← Dashboard</Link></p><h1>Settings</h1></div>
      </header>
      <div className="set">
        <Reminders initial={settings} />
        <section className="tile">
          <h2>Polar</h2>
          {link ? (
            <>
              <p>Your Polar Loop is connected. <Link href="/dashboard/data">See the raw numbers</Link>.</p>
              <form action="/api/polar/disconnect" method="post"><button className="link-btn" id="polar-disconnect" type="submit">Disconnect Polar</button></form>
            </>
          ) : <p><a href="/api/polar/connect">Connect Polar</a> to add your sleep and activity to calls and the dashboard.</p>}
        </section>
        <section className="tile">
          <h2>Account</h2>
          <p>{user.email}</p>
          <SignOut />
        </section>
      </div>
    </main>
  );
}
