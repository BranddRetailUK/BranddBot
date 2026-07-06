import { NextResponse } from "next/server";
import { AlpacaBroker } from "@/lib/broker/alpaca";
import { setBotEnabled } from "@/lib/db/botConfig";

export async function POST() {
  await setBotEnabled(false);
  const broker = new AlpacaBroker();
  const health = await broker.healthCheck();

  if (health.ok) {
    await broker.cancelAllOrders();
  }

  return NextResponse.json({
    message: health.ok
      ? "Emergency stop complete. Bot disabled and open paper orders cancelled."
      : "Emergency stop complete. Bot disabled; Alpaca was not configured so no orders were cancelled."
  });
}
