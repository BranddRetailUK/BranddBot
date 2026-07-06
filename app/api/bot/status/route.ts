import { NextResponse } from "next/server";
import { getPublicRuntimeSummary } from "@/lib/config/env";
import { getBotEnabled } from "@/lib/db/botConfig";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const [enabled, latestAudit] = await Promise.all([
    getBotEnabled().catch(() => false),
    prisma.aiAudit.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null)
  ]);

  return NextResponse.json({
    enabled,
    runtime: getPublicRuntimeSummary(),
    latestAudit
  });
}
