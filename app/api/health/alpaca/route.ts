import { NextResponse } from "next/server";
import { AlpacaBroker } from "@/lib/broker/alpaca";

export async function GET() {
  const broker = new AlpacaBroker();
  const health = await broker.healthCheck();
  return NextResponse.json(health, { status: health.ok ? 200 : 400 });
}
