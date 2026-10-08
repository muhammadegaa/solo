import { requireUser } from "@/lib/auth";
import { getCallContext } from "@/lib/context";
import Call from "./Call";

export const dynamic = "force-dynamic";

export default async function CallPage() {
  const user = await requireUser();
  const { nights, usualH, summary, findingIds, finding } = await getCallContext(user.uid);
  return <Call nights={nights} usualH={usualH} summary={summary} findingIds={findingIds} findingTitle={finding?.title ?? null} />;
}
