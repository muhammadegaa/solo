import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "./firebase-admin";

export const SESSION_COOKIE = "session";

export type User = { uid: string; email: string };

// Verifies the Firebase session cookie, including revocation.
export async function getUser(): Promise<User | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const t = await adminAuth().verifySessionCookie(cookie, true);
    return { uid: t.uid, email: t.email ?? "" };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
