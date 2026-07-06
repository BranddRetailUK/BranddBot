import { NextResponse } from "next/server";
import { getTradeSizingSettings, setTradeSizingSettings } from "@/lib/trading/tradeSizing";

export async function GET() {
  return NextResponse.json({ settings: await getTradeSizingSettings() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    minBidNotional?: unknown;
    maxBidNotional?: unknown;
  };
  const minBidNotional = Number(body.minBidNotional);
  const maxBidNotional = Number(body.maxBidNotional);

  if (!Number.isFinite(minBidNotional) || !Number.isFinite(maxBidNotional)) {
    return NextResponse.json({ error: "Min and max bid values must be valid numbers." }, { status: 400 });
  }
  if (minBidNotional < 1 || maxBidNotional < 1) {
    return NextResponse.json({ error: "Min and max bid values must be at least $1." }, { status: 400 });
  }
  if (minBidNotional > maxBidNotional) {
    return NextResponse.json({ error: "Min bid cannot be greater than max bid." }, { status: 400 });
  }
  if (maxBidNotional > 100_000) {
    return NextResponse.json({ error: "Max bid cannot exceed the $100,000 paper account size." }, { status: 400 });
  }

  const settings = await setTradeSizingSettings({ minBidNotional, maxBidNotional });
  return NextResponse.json({ settings });
}
