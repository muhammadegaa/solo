import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin";

// Firestore layout:
//   invites/{email}                 who may create an account
//   users/{uid}                     profile and settings
//   users/{uid}/private/polar       Polar token (server only)

export const normEmail = (e: string) => e.trim().toLowerCase();

export async function isInvited(email: string): Promise<boolean> {
  return (await db().doc(`invites/${normEmail(email)}`).get()).exists;
}

export async function ensureUser(uid: string, email: string): Promise<void> {
  const ref = db().doc(`users/${uid}`);
  if (!(await ref.get()).exists) await ref.set({ email: normEmail(email), createdAt: FieldValue.serverTimestamp() });
}

export type PolarLink = { polarUserId: number; accessToken: string };

const polarRef = (uid: string) => db().doc(`users/${uid}/private/polar`);

export async function getPolarLink(uid: string): Promise<PolarLink | null> {
  const snap = await polarRef(uid).get();
  return snap.exists ? (snap.data() as PolarLink) : null;
}

export async function savePolarLink(uid: string, link: PolarLink): Promise<void> {
  await polarRef(uid).set({ ...link, connectedAt: FieldValue.serverTimestamp() });
}

export async function deletePolarLink(uid: string): Promise<void> {
  await polarRef(uid).delete();
}
