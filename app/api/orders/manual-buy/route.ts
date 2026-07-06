import { NextResponse } from "next/server";
import { submitManualPaperBuy } from "@/lib/trading/manualOrder";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    symbol?: unknown;
    notional?: unknown;
  };

  try {
    const order = await submitManualPaperBuy({
      symbol: String(body.symbol ?? ""),
      notional: Number(body.notional)
    });

    return NextResponse.json({
      message: `Manual paper buy submitted for ${order.symbol}.`,
      order
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Manual paper buy failed."
      },
      { status: 400 }
    );
  }
}
