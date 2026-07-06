import { NextResponse } from "next/server";
import { setBotEnabled } from "@/lib/db/botConfig";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  await setBotEnabled(Boolean(body.enabled));

  return NextResponse.json({
    message: Boolean(body.enabled) ? "Bot enabled for scheduled paper scans." : "Bot disabled."
  });
}
