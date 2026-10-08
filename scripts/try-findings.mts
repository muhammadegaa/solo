// Dev check: backfill factor tags on the user's calls, print findings and two call openings. Usage: npx tsx --env-file=.env.local scripts/try-findings.mts email
import { getAuth } from "firebase-admin/auth";
import { extract } from "../lib/calls";
import { getCallContext, systemPrompt } from "../lib/context";
import { getDays } from "../lib/days";
import { db } from "../lib/firebase-admin";
import { findings } from "../lib/findings";
import { chat } from "../lib/openrouter";
import { getPolarLink } from "../lib/store";

const email = process.argv[2];
db(); // initialise the app
const uid = (await getAuth().getUserByEmail(email)).uid;
for (const d of (await db().collection(`users/${uid}/calls`).get()).docs) {
  if (Array.isArray(d.data().factors)) continue;
  const { factors } = await extract(d.data().messages);
  await d.ref.update({ factors });
  console.log("factors", d.id, factors);
}
const link = await getPolarLink(uid);
const days = await getDays(uid, link?.accessToken ?? null);
console.log("\nFINDINGS");
for (const f of findings(days)) console.log(`- [${f.kind}/${f.strength} ${f.score.toFixed(2)}] ${f.title}: ${f.detail}${f.suggestion ? ` | try: ${f.suggestion}` : ""}`);
const ctx = await getCallContext(uid);
console.log("\nCALL CONTEXT\n" + ctx.summary);
for (let i = 0; i < 2; i++) console.log(`\nOPENING ${i + 1}: ` + (await chat([{ role: "system", content: systemPrompt(ctx.summary) }, { role: "user", content: "(call started)" }])));
process.exit(0);
