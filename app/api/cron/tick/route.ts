import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { tick } from "@/lib/scheduler";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${config.cronSecret()}`) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await tick());
}
