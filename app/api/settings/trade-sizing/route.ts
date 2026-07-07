import { NextResponse } from "next/server";
import { getTradeSizingSettings, setTradeSizingSettings } from "@/lib/trading/tradeSizing";

export async function GET() {
  return NextResponse.json({ settings: await getTradeSizingSettings() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    minBidNotional?: unknown;
    maxBidNotional?: unknown;
    maxPositionNotionalPerSymbol?: unknown;
  };
  const currentSettings = await getTradeSizingSettings();
  const minBidNotional = Number(body.minBidNotional);
  const maxBidNotional = Number(body.maxBidNotional);
  const maxPositionNotionalPerSymbol =
    body.maxPositionNotionalPerSymbol === undefined
      ? currentSettings.maxPositionNotionalPerSymbol
      : Number(body.maxPositionNotionalPerSymbol);

  if (
    !Number.isFinite(minBidNotional) ||
    !Number.isFinite(maxBidNotional) ||
    !Number.isFinite(maxPositionNotionalPerSymbol)
  ) {
    return NextResponse.json({ error: "Bid and max holding values must be valid numbers." }, { status: 400 });
  }
  if (minBidNotional < 1 || maxBidNotional < 1 || maxPositionNotionalPerSymbol < 1) {
    return NextResponse.json({ error: "Bid and max holding values must be at least $1." }, { status: 400 });
  }
  if (minBidNotional > maxBidNotional) {
    return NextResponse.json({ error: "Min bid cannot be greater than max bid." }, { status: 400 });
  }
  if (maxPositionNotionalPerSymbol < maxBidNotional) {
    return NextResponse.json({ error: "Max holding per stock cannot be lower than max bid." }, { status: 400 });
  }
  if (maxBidNotional > 100_000 || maxPositionNotionalPerSymbol > 100_000) {
    return NextResponse.json({ error: "Bid and max holding values cannot exceed the $100,000 paper account size." }, { status: 400 });
  }

  const settings = await setTradeSizingSettings({
    minBidNotional,
    maxBidNotional,
    maxPositionNotionalPerSymbol
  });
  return NextResponse.json({ settings });
}
