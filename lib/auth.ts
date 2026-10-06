import { createHash } from "node:crypto";
import { cookies } from "next/headers";

// Single user: one passcode, stored as a hash in an httpOnly cookie.
export const COOKIE = "pc";
export const hashPasscode = (p: string) => createHash("sha256").update(`polarsolor:${p}`).digest("hex");

export async function isAuthed(): Promise<boolean> {
  const pass = process.env.APP_PASSCODE;
  if (!pass) throw new Error("Missing APP_PASSCODE in .env.local");
  return (await cookies()).get(COOKIE)?.value === hashPasscode(pass);
}
