import { NextResponse } from "next/server";
import { runBotScan } from "@/lib/bot/scan";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };

  try {
    const result = await runBotScan({ dryRun: body.dryRun ?? true });
    const accepted = result.symbols.filter((symbol) => symbol.riskGate.accepted).length;
    return NextResponse.json({
      message: `${body.dryRun ?? true ? "Dry" : "Paper"} scan complete. ${accepted} accepted decisions.`,
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Bot scan failed."
      },
      { status: 500 }
    );
  }
}
