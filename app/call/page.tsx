import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getCallContext } from "@/lib/context";
import Call from "./Call";

export const dynamic = "force-dynamic";

export default async function CallPage() {
  if (!(await isAuthed())) redirect("/login");
  const { nights, usualH, summary } = await getCallContext();
  return <Call nights={nights} usualH={usualH} summary={summary} />;
}
