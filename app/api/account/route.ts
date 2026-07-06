import { NextResponse } from "next/server";
import { AlpacaBroker } from "@/lib/broker/alpaca";

export async function GET() {
  const broker = new AlpacaBroker();
  const health = await broker.healthCheck();

  if (!health.ok) {
    return NextResponse.json({ error: health.message }, { status: 400 });
  }

  const [account, positions] = await Promise.all([broker.getAccount(), broker.getPositions()]);
  return NextResponse.json({ account, positions });
}
