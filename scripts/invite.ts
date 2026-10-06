// Usage: npm run invite -- someone@example.com
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run invite -- someone@example.com");
  process.exit(1);
}
const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? "", "base64").toString("utf8"));
initializeApp({ credential: cert(sa) });
await getFirestore().doc(`invites/${email}`).set({ invitedAt: FieldValue.serverTimestamp() });
console.log(`Invited ${email}`);
